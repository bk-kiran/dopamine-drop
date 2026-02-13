import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConvexClient, getConvexUserId } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function GET() {
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

    // Fetch ALL courses for the user
    const courses = await convex.query(api.courses.getAllCourses, {
      userId: convexUserId,
    })

    // Calculate date 30 days ago for filtering submitted assignments
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Fetch assignments with course information
    // Filter: all pending assignments OR submitted within last 30 days
    const assignments = await convex.query(api.assignments.getAssignmentsWithCourseInfo, {
      userId: convexUserId,
      includeSubmittedSince: thirtyDaysAgo.toISOString(),
    })

    // Transform the data to match expected format (Convex uses camelCase)
    const transformedAssignments = (assignments || []).map((assignment) => ({
      ...assignment,
      course_name: assignment.courseName,
      course_code: assignment.courseCode,
    }))

    // Return both courses and assignments as separate arrays
    return NextResponse.json({
      courses: courses || [],
      assignments: transformedAssignments,
    })
  } catch (error) {
    console.error('[Assignments API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

