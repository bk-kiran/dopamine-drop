import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

// GET - Fetch user's hidden courses
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const convex = getConvexClient()
    const convexUser = await convex.query(api.users.getUser, {
      authUserId: user.id,
    })

    return NextResponse.json({
      hidden_courses: convexUser?.hiddenCourses || [],
    })
  } catch (error) {
    console.error('[Hidden Courses] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// POST - Toggle a course ID in/out of hidden_courses array
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { courseId, action } = await request.json()

    if (!['hide', 'show', 'clear'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be hide, show, or clear' },
        { status: 400 }
      )
    }

    if ((action === 'hide' || action === 'show') && !courseId) {
      return NextResponse.json(
        { error: 'courseId is required for hide/show actions' },
        { status: 400 }
      )
    }

    // Fetch current hidden courses
    const convex = getConvexClient()
    const convexUser = await convex.query(api.users.getUser, {
      authUserId: user.id,
    })

    let hiddenCourses: string[] = convexUser?.hiddenCourses || []

    // Handle different actions
    if (action === 'clear') {
      hiddenCourses = []
    } else if (action === 'hide') {
      if (!hiddenCourses.includes(courseId)) {
        hiddenCourses.push(courseId)
      }
    } else if (action === 'show') {
      hiddenCourses = hiddenCourses.filter((id) => id !== courseId)
    }

    // Update in database
    try {
      await convex.mutation(api.users.updateUser, {
        authUserId: user.id,
        data: { hiddenCourses },
      })
    } catch (updateError) {
      console.error('[Hidden Courses] Error updating:', updateError)
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
    console.error('[Hidden Courses] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
