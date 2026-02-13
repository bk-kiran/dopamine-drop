import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CanvasClient } from '@/lib/canvas-api'
import { decryptToken } from '@/lib/encryption'
import { updateStreak } from '@/lib/streak-tracker'
import { awardPoints } from '@/lib/points-engine'
import { rollReward } from '@/lib/reward-roller'
import { getConvexClient, getConvexUserId } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

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

    // Get Convex client and user ID
    const convex = getConvexClient()
    const convexUserId = await getConvexUserId(user.id)

    // Fetch user's Canvas token and hidden courses from database
    const userData = await convex.query(api.users.getUser, {
      authUserId: user.id,
    })

    if (!userData) {
      return NextResponse.json(
        { error: 'User data not found' },
        { status: 404 }
      )
    }

    if (!userData.canvasTokenEncrypted || !userData.canvasTokenIv) {
      return NextResponse.json(
        { error: 'Canvas token not configured. Please connect your Canvas account.' },
        { status: 400 }
      )
    }

    // Decrypt the Canvas token
    const canvasToken = decryptToken(
      userData.canvasTokenEncrypted,
      userData.canvasTokenIv
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

    const hiddenCourses = userData.hiddenCourses || []
    const canvasUserId = parseInt(userData.canvasUserId || '0')
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
      // Upsert course (create or update)
      const courseId = await convex.mutation(api.courses.upsertCourse, {
        userId: convexUserId,
        canvasCourseId: course.id.toString(),
        name: course.name,
        courseCode: course.course_code,
      })

      // Fetch and upsert assignments for this course
      try {
        const assignments = await canvasClient.getAssignments(course.id.toString())

        for (const assignment of assignments) {
          // Debug logging for submission status
          console.log(`[Sync Debug] Assignment: "${assignment.name}"`)
          console.log(`  - workflow_state: ${assignment.submission?.workflow_state || 'null'}`)
          console.log(`  - submitted_at: ${assignment.submission?.submitted_at || 'null'}`)

          // Check if assignment already exists
          const existingAssignment = await convex.query(api.assignments.getAssignmentByCanvasId, {
            userId: convexUserId,
            canvasAssignmentId: assignment.id.toString(),
          })

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

          // Upsert assignment (unless it's newly submitted, we update it)
          if (!isNewlySubmitted || !existingAssignment) {
            await convex.mutation(api.assignments.upsertAssignment, {
              userId: convexUserId,
              courseId,
              canvasAssignmentId: assignment.id.toString(),
              title: assignmentData.title,
              description: assignmentData.description || undefined,
              dueAt: assignmentData.due_at || undefined,
              pointsPossible: assignmentData.points_possible,
              status: assignmentData.status as 'pending' | 'submitted' | 'missing',
              submittedAt: assignmentData.submitted_at || undefined,
              canvasCourseId: assignmentData.canvas_course_id,
            })
            totalSynced++
          }

          // If newly submitted, trigger gamification (status already updated in upsert above)
          if (isNewlySubmitted && existingAssignment) {
            const isHiddenCourse = hiddenCourses.includes(course.id.toString())

            // ONLY run gamification for visible courses (hidden courses skip this entirely)
            if (!isHiddenCourse) {
              try {
                // 1. Update streak
                await updateStreak({ authUserId: user.id })

                // 2. Award points
                const { pointsAwarded, reason } = await awardPoints({
                  authUserId: user.id,
                  convexUserId,
                  assignmentId: existingAssignment._id,
                  dueAt: assignment.due_at,
                  submittedAt: userSubmission?.submitted_at || new Date().toISOString(),
                })

                // 3. Get updated total points
                const updatedUserStats = await convex.query(api.users.getUserStats, {
                  authUserId: user.id,
                })

                // 4. Roll for reward
                const reward = await rollReward({
                  convexUserId,
                  totalPoints: updatedUserStats?.totalPoints || 0,
                  pointsJustAwarded: pointsAwarded,
                })

                // 5. Collect results
                completedAssignments.push({
                  assignmentId: existingAssignment._id,
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
