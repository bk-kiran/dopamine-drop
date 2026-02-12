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

    // Calculate date 7 days ago for filtering submitted assignments
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Fetch assignments with course information
    // Filter: future assignments OR submitted within last 7 days
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
      .or(`due_at.gte.${new Date().toISOString()},submitted_at.gte.${sevenDaysAgo.toISOString()}`)
      .order('due_at', { ascending: true })

    if (assignmentsError) {
      console.error('[Assignments API] Error fetching assignments:', assignmentsError)
      return NextResponse.json(
        { error: 'Failed to fetch assignments' },
        { status: 500 }
      )
    }

    // Transform the data to include course_name at the top level
    const transformedAssignments = assignments.map((assignment) => ({
      ...assignment,
      course_name: assignment.courses.name,
      course_code: assignment.courses.course_code,
    }))

    return NextResponse.json(transformedAssignments)
  } catch (error) {
    console.error('[Assignments API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
