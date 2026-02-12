import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CanvasClient } from '@/lib/canvas-api'
import { decryptToken } from '@/lib/encryption'

export async function POST() {
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

    // Fetch user's Canvas token from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('canvas_token_encrypted, canvas_token_iv, canvas_user_id')
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

    let totalSynced = 0

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
          // Check if assignment already exists
          const { data: existingAssignment } = await supabase
            .from('assignments')
            .select('id')
            .eq('canvas_assignment_id', assignment.id.toString())
            .eq('user_id', user.id)
            .single()

          // Prepare clean assignment data with only allowed fields
          const assignmentData = {
            title: assignment.name,
            description: assignment.description || null,
            due_at: assignment.due_at,
            points_possible: assignment.points_possible || 0,
            status: 'pending', // Default status, can be updated later
            canvas_course_id: course.id.toString(),
          }

          if (existingAssignment) {
            // Update existing assignment
            const { error: assignmentError } = await supabase
              .from('assignments')
              .update(assignmentData)
              .eq('id', existingAssignment.id)

            if (assignmentError) {
              console.error(`[Canvas Sync] Error updating assignment ${assignment.id}:`, assignmentError)
            } else {
              totalSynced++
            }
          } else {
            // Insert new assignment with course_id (UUID foreign key)
            const { error: assignmentError } = await supabase
              .from('assignments')
              .insert({
                user_id: user.id,
                course_id: courseUuid,
                canvas_assignment_id: assignment.id.toString(),
                ...assignmentData,
              })

            if (assignmentError) {
              console.error(`[Canvas Sync] Error inserting assignment ${assignment.id}:`, assignmentError)
            } else {
              totalSynced++
            }
          }
        }

        console.log(`[Canvas Sync] Synced ${assignments.length} assignments for course ${course.name}`)
      } catch (error) {
        console.error(`[Canvas Sync] Error fetching assignments for course ${course.id}:`, error)
      }
    }

    console.log(`[Canvas Sync] Total assignments synced: ${totalSynced}`)

    return NextResponse.json({
      synced: totalSynced,
      courses: courses.length,
    })
  } catch (error) {
    console.error('[Canvas Sync] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred during sync' },
      { status: 500 }
    )
  }
}
