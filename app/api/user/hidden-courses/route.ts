import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateInput, hiddenCourseSchema } from '@/lib/validation'
import { logSecurityEvent, logInternalError } from '@/lib/logger'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      logSecurityEvent('unauthorized', { route: 'GET /api/user/hidden-courses' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimitResponse = await checkRateLimit(user.id, 'api')
    if (rateLimitResponse) {
      logSecurityEvent('rate_limit', { route: 'GET /api/user/hidden-courses', userId: user.id })
      return rateLimitResponse
    }

    const convex = getConvexClient()
    const convexUser = await convex.query(api.users.getUser, {
      authUserId: user.id,
    })

    return NextResponse.json({
      hidden_courses: convexUser?.hiddenCourses || [],
    })
  } catch (error) {
    logInternalError('Hidden Courses GET', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      logSecurityEvent('unauthorized', { route: 'POST /api/user/hidden-courses' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimitResponse = await checkRateLimit(user.id, 'mutations')
    if (rateLimitResponse) {
      logSecurityEvent('rate_limit', { route: 'POST /api/user/hidden-courses', userId: user.id })
      return rateLimitResponse
    }

    // Validate input
    const body = await request.json()
    const validation = validateInput(hiddenCourseSchema, body)
    if (!validation.success) {
      logSecurityEvent('invalid_input', {
        route: 'POST /api/user/hidden-courses',
        userId: user.id,
        error: validation.error,
      })
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { courseId, action } = validation.data

    const convex = getConvexClient()
    const convexUser = await convex.query(api.users.getUser, {
      authUserId: user.id,
    })

    let hiddenCourses: string[] = convexUser?.hiddenCourses || []

    if (action === 'clear') {
      hiddenCourses = []
    } else if (action === 'hide' && courseId) {
      if (!hiddenCourses.includes(courseId)) {
        hiddenCourses.push(courseId)
      }
    } else if (action === 'show' && courseId) {
      hiddenCourses = hiddenCourses.filter((id) => id !== courseId)
    }

    try {
      await convex.mutation(api.users.updateUser, {
        authUserId: user.id,
        data: { hiddenCourses },
      })
    } catch (updateError) {
      logInternalError('Hidden Courses POST', updateError, { userId: user.id })
      return NextResponse.json(
        { error: 'Failed to update hidden courses' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      hidden_courses: hiddenCourses,
      success: true,
    })
  } catch (error) {
    logInternalError('Hidden Courses POST', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
