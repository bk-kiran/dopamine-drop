import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CanvasClient } from '@/lib/canvas-api'
import { decryptToken } from '@/lib/encryption'
import { updateStreak } from '@/lib/streak-tracker'
import { awardPoints } from '@/lib/points-engine'
import { rollReward } from '@/lib/reward-roller'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      )
    }

    // Fetch user's Canvas token and hidden courses from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('canvas_token_encrypted, canvas_token_iv, canvas_user_id, hidden_courses')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User data not found' },
        { status: 404 }
      )
    }

    if (!userData.canvas_token_encrypted || !userData.canvas_token_iv) {
      return NextResponse.json(
        { error: 'Canvas token not configured. Please connect your Canvas account.' },
        { status: 400 }
      )
    }

    // Decrypt the Canvas token
    const canvasToken = decryptToken(
      userData.canvas_token_encrypted,
      userData.canvas_token_iv
    )

    // Get Canvas base URL
    const canvasBaseUrl = process.env.NEXT_PUBLIC_CANVAS_BASE_URL
    if (!canvasBaseUrl) {
      return NextResponse.json(
        { error: 'Canvas configuration missing' },
        { status: 500 }
      )
    }

    // Create Canvas client and fetch courses
    const canvasClient = new CanvasClient(canvasBaseUrl, canvasToken)
    const courses = await canvasClient.getCourses()

    console.log(`[Canvas Sync] Found ${courses.length} courses for user ${user.id}`)

    const hiddenCourses = userData.hidden_courses || []
    const canvasUserId = parseInt(userData.canvas_user_id || '0')
    let totalSynced = 0
    const completedAssignments: {
      assignmentId: string
      title: string
      pointsAwarded: number
      reason: string
    }[] = []
    let newReward: any = null

    // Process each course
    for (const course of courses) {
      // Check if course already exists
      const { data: existingCourse } = await supabase
        .from('courses')
        .select('id')
        .eq('canvas_course_id', course.id.toString())
        .eq('user_id', user.id)
        .single()

      let courseUuid: string

      if (existingCourse) {
        courseUuid = existingCourse.id
        // Update existing course
        const { error: courseError } = await supabase
          .from('courses')
          .update({
            name: course.name,
            course_code: course.course_code,
          })
          .eq('id', existingCourse.id)

        if (courseError) {
          console.error(`[Canvas Sync] Error updating course ${course.id}:`, courseError)
          continue
        }
      } else {
        // Insert new course
        const { data: newCourse, error: courseError } = await supabase
          .from('courses')
          .insert({
            user_id: user.id,
            canvas_course_id: course.id.toString(),
            name: course.name,
            course_code: course.course_code,
          })
          .select('id')
          .single()

        if (courseError || !newCourse) {
          console.error(`[Canvas Sync] Error inserting course ${course.id}:`, courseError)
          continue
        }

        courseUuid = newCourse.id
      }

      // Fetch and upsert assignments for this course
      try {
        const assignments = await canvasClient.getAssignments(course.id.toString())

        for (const assignment of assignments) {
          // Debug logging for submission status
          console.log(`[Sync Debug] Assignment: "${assignment.name}"`)
          console.log(`  - workflow_state: ${assignment.submission?.workflow_state || 'null'}`)
          console.log(`  - submitted_at: ${assignment.submission?.submitted_at || 'null'}`)

          // Check if assignment already exists
          const { data: existingAssignment } = await supabase
            .from('assignments')
            .select('id, status')
            .eq('canvas_assignment_id', assignment.id.toString())
            .eq('user_id', user.id)
            .single()

          // Read submission data directly from assignment object
          let isNewlySubmitted = false
          const userSubmission = assignment.submission

          // Determine current status from Canvas submission
          const isSubmittedInCanvas =
            userSubmission?.workflow_state === 'submitted' ||
            userSubmission?.workflow_state === 'graded'

          // Check if this is a newly submitted assignment
          if (isSubmittedInCanvas && existingAssignment?.status === 'pending') {
            isNewlySubmitted = true
          }

          // Prepare clean assignment data with only allowed fields
          // IMPORTANT: Never downgrade from 'submitted' to 'pending'
          let assignmentStatus = 'pending'
          if (isSubmittedInCanvas) {
            assignmentStatus = 'submitted'
          } else if (existingAssignment?.status === 'submitted') {
            // Keep existing 'submitted' status, don't downgrade
            assignmentStatus = 'submitted'
          }

          const assignmentData = {
            title: assignment.name,
            description: assignment.description || null,
            due_at: assignment.due_at,
            points_possible: assignment.points_possible || 0,
            status: assignmentStatus,
            submitted_at: isSubmittedInCanvas
              ? userSubmission?.submitted_at || new Date().toISOString()
              : null,
            canvas_course_id: course.id.toString(),
          }

          if (existingAssignment) {
            // Update existing assignment (unless it's newly submitted)
            if (!isNewlySubmitted) {
              const { error: assignmentError } = await supabase
                .from('assignments')
                .update(assignmentData)
                .eq('id', existingAssignment.id)

              if (assignmentError) {
                console.error(
                  `[Canvas Sync] Error updating assignment ${assignment.id}:`,
                  assignmentError
                )
              } else {
                totalSynced++
              }
            }
          } else {
            // Insert new assignment with course_id (UUID foreign key)
            const { data: newAssignment, error: assignmentError } = await supabase
              .from('assignments')
              .insert({
                user_id: user.id,
                course_id: courseUuid,
                canvas_assignment_id: assignment.id.toString(),
                ...assignmentData,
              })
              .select('id')
              .single()

            if (assignmentError) {
              console.error(
                `[Canvas Sync] Error inserting assignment ${assignment.id}:`,
                assignmentError
              )
            } else {
              totalSynced++
            }
          }

          // If newly submitted, trigger gamification (status already updated in upsert above)
          if (isNewlySubmitted && existingAssignment) {
            const isHiddenCourse = hiddenCourses.includes(course.id.toString())

            // ONLY run gamification for visible courses (hidden courses skip this entirely)
            if (!isHiddenCourse) {
              try {
                // 1. Update streak
                await updateStreak({ userId: user.id, supabase })

                // 2. Award points
                const { pointsAwarded, reason } = await awardPoints({
                  userId: user.id,
                  assignmentId: existingAssignment.id,
                  dueAt: assignment.due_at,
                  submittedAt: userSubmission?.submitted_at || new Date().toISOString(),
                  supabase,
                })

                // 3. Get updated total points
                const { data: updatedUser } = await supabase
                  .from('users')
                  .select('total_points')
                  .eq('id', user.id)
                  .single()

                // 4. Roll for reward
                const reward = await rollReward({
                  userId: user.id,
                  totalPoints: updatedUser?.total_points || 0,
                  pointsJustAwarded: pointsAwarded,
                  supabase,
                })

                // 5. Collect results
                completedAssignments.push({
                  assignmentId: existingAssignment.id,
                  title: assignment.name,
                  pointsAwarded,
                  reason,
                })

                if (reward && !newReward) {
                  // Only take the first reward to avoid overwhelming the user
                  newReward = reward
                }
              } catch (gamificationError) {
                console.error(
                  `[Canvas Sync] Error during gamification for assignment ${assignment.id}:`,
                  gamificationError
                )
              }
            }
            // Hidden courses: status updated above, gamification skipped entirely
          }
        }

        console.log(`[Canvas Sync] Synced ${assignments.length} assignments for course ${course.name}`)
      } catch (error) {
        console.error(`[Canvas Sync] Error fetching assignments for course ${course.id}:`, error)
      }
    }

    console.log(`[Canvas Sync] Total assignments synced: ${totalSynced}`)
    console.log(`[Canvas Sync] Completed assignments: ${completedAssignments.length}`)

    // Check if this is an auto-sync request
    const isAutoSync = request.headers.get('x-auto-sync') === 'true'

    if (isAutoSync) {
      // Minimal response for auto-sync
      return NextResponse.json({
        completedAssignments,
        newReward,
      })
    }

    // Full response for manual sync
    return NextResponse.json({
      synced: totalSynced,
      courses: courses.length,
      completedAssignments,
      newReward,
    })
  } catch (error) {
    console.error('[Canvas Sync] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred during sync' },
      { status: 500 }
    )
  }
}
