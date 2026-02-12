import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Fetch ALL courses for the user
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (coursesError) {
      console.error('[Assignments API] Error fetching courses:', coursesError)
      return NextResponse.json(
        { error: 'Failed to fetch courses' },
        { status: 500 }
      )
    }

    // Calculate date 30 days ago for filtering submitted assignments
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Fetch assignments with course information
    // Filter: all pending assignments OR submitted within last 30 days
    const { data: assignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select(`
        *,
        courses!inner (
          name,
          course_code
        )
      `)
      .eq('user_id', user.id)
      .or(`status.eq.pending,submitted_at.gte.${thirtyDaysAgo.toISOString()}`)
      .order('due_at', { ascending: true })

    if (assignmentsError) {
      console.error('[Assignments API] Error fetching assignments:', assignmentsError)
      return NextResponse.json(
        { error: 'Failed to fetch assignments' },
        { status: 500 }
      )
    }

    // Transform the data to include course_name at the top level
    const transformedAssignments = (assignments || []).map((assignment) => ({
      ...assignment,
      course_name: assignment.courses.name,
      course_code: assignment.courses.course_code,
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

