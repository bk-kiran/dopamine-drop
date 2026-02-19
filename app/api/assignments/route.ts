import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConvexClient, getConvexUserId } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import { checkRateLimit } from '@/lib/rate-limit'
import { logSecurityEvent, logInternalError } from '@/lib/logger'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      logSecurityEvent('unauthorized', { route: '/api/assignments' })
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      )
    }

    const rateLimitResponse = await checkRateLimit(user.id, 'api')
    if (rateLimitResponse) {
      logSecurityEvent('rate_limit', { route: '/api/assignments', userId: user.id })
      return rateLimitResponse
    }

    const convex = getConvexClient()
    const convexUserId = await getConvexUserId(user.id)

    const courses = await convex.query(api.courses.getAllCourses, {
      userId: convexUserId,
    })

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const assignments = await convex.query(api.assignments.getAssignmentsWithCourseInfo, {
      userId: convexUserId,
      includeSubmittedSince: thirtyDaysAgo.toISOString(),
    })

    const transformedAssignments = (assignments || []).map((assignment) => ({
      ...assignment,
      course_name: assignment.courseName,
      course_code: assignment.courseCode,
    }))

    return NextResponse.json({
      courses: courses || [],
      assignments: transformedAssignments,
    })
  } catch (error) {
    logInternalError('Assignments API', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
