import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { CanvasClient } from '@/lib/canvas-api'
import { encryptToken } from '@/lib/encryption'
import { getConvexClient } from '@/lib/convex-client'

import { api } from '@/convex/_generated/api'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { validateInput, canvasTokenSchema } from '@/lib/validation'
import { logSecurityEvent, logInternalError } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    // Rate-limit by IP (user may not be authenticated yet)
    const ip = getClientIp(request)
    const rateLimitResponse = await checkRateLimit(ip, 'auth')
    if (rateLimitResponse) {
      logSecurityEvent('rate_limit', { route: '/api/canvas/connect', ip })
      return rateLimitResponse
    }

    // Validate and sanitize input
    const body = await request.json()
    const validation = validateInput(canvasTokenSchema, body)
    if (!validation.success) {
      logSecurityEvent('invalid_input', {
        route: '/api/canvas/connect',
        ip,
        error: validation.error,
      })
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { token } = validation.data

    const canvasBaseUrl = process.env.NEXT_PUBLIC_CANVAS_BASE_URL
    if (!canvasBaseUrl) {
      logInternalError('Canvas Connect', 'NEXT_PUBLIC_CANVAS_BASE_URL is not set')
      return NextResponse.json(
        { error: 'Canvas configuration is missing' },
        { status: 500 }
      )
    }

    // Validate token against Canvas API
    const canvasClient = new CanvasClient(canvasBaseUrl, token)
    let canvasUser
    try {
      canvasUser = await canvasClient.getMe()
    } catch (error) {
      logInternalError('Canvas Connect', error, { hint: 'token validation failed', ip })
      return NextResponse.json(
        { error: 'Invalid Canvas token. Please check your token and try again.' },
        { status: 400 }
      )
    }

    const { encrypted, iv } = encryptToken(token)

    const { userId } = await auth()

    if (!userId) {
      logSecurityEvent('unauthorized', { route: '/api/canvas/connect', ip })
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      )
    }

    const convex = getConvexClient()

    // Check if this Canvas account is already linked to a different dopamine drop account
    const canvasUserIdStr = canvasUser.id.toString()
    const existingOwner = await convex.query(api.users.getUserByCanvasId, {
      canvasUserId: canvasUserIdStr,
    })
    if (existingOwner && existingOwner.authUserId !== user.id) {
      logSecurityEvent('duplicate_canvas_account', {
        route: '/api/canvas/connect',
        ip,
        canvasUserId: canvasUserIdStr,
      })
      return NextResponse.json(
        {
          error:
            'This Canvas account is already linked to another dopamine drop account. Each Canvas account can only be linked once.',
        },
        { status: 409 }
      )
    }

    try {
      await convex.mutation(api.users.updateUser, {
        authUserId: userId,
        data: {
          canvasTokenEncrypted: encrypted,
          canvasTokenIv: iv,
          canvasUserId: canvasUser.id.toString(),
          displayName: canvasUser.name,
        },
      })
    } catch (updateError) {
      logInternalError('Canvas Connect', updateError, { userId })
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
    logInternalError('Canvas Connect', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
