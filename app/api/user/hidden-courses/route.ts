import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    const { data, error } = await supabase
      .from('users')
      .select('hidden_courses')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('[Hidden Courses] Error fetching:', error)
      return NextResponse.json(
        { error: 'Failed to fetch hidden courses' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      hidden_courses: data?.hidden_courses || [],
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
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('hidden_courses')
      .eq('id', user.id)
      .single()

    if (fetchError) {
      console.error('[Hidden Courses] Error fetching user data:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      )
    }

    let hiddenCourses: string[] = userData?.hidden_courses || []

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
    const { error: updateError } = await supabase
      .from('users')
      .update({ hidden_courses: hiddenCourses })
      .eq('id', user.id)

    if (updateError) {
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
