import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CanvasClient } from '@/lib/canvas-api'
import { encryptToken } from '@/lib/encryption'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json()
    const { token } = body

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Get Canvas base URL from environment
    const canvasBaseUrl = process.env.NEXT_PUBLIC_CANVAS_BASE_URL
    if (!canvasBaseUrl) {
      console.error('[Canvas Connect] NEXT_PUBLIC_CANVAS_BASE_URL is not set')
      return NextResponse.json(
        { error: 'Canvas configuration is missing' },
        { status: 500 }
      )
    }

    console.log('[Canvas Connect] Using Canvas base URL:', canvasBaseUrl)
    console.log('[Canvas Connect] Token received, length:', token.length)

    // Validate the token by calling Canvas API
    const canvasClient = new CanvasClient(canvasBaseUrl, token)
    let canvasUser
    try {
      canvasUser = await canvasClient.getMe()
    } catch (error) {
      console.error('Canvas token validation failed:', error)
      return NextResponse.json(
        { error: 'Invalid Canvas token. Please check your token and try again.' },
        { status: 400 }
      )
    }

    // Encrypt the token
    const { encrypted, iv } = encryptToken(token)

    // Get the current user from Supabase
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

    // Update the user's record in Convex with encrypted token and Canvas info
    const convex = getConvexClient()
    try {
      await convex.mutation(api.users.updateUser, {
        authUserId: user.id,
        data: {
          canvasTokenEncrypted: encrypted,
          canvasTokenIv: iv,
          canvasUserId: canvasUser.id.toString(),
          displayName: canvasUser.name,
        },
      })
    } catch (updateError) {
      console.error('Failed to update user:', updateError)
      return NextResponse.json(
        { error: 'Failed to save Canvas token' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        canvas_user_id: canvasUser.id,
        display_name: canvasUser.name,
        email: canvasUser.primary_email,
      },
    })
  } catch (error) {
    console.error('Unexpected error in Canvas connect:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
