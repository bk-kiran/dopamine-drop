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
  // DEBUG: Log environment variable presence (no secret values exposed)
  console.log('=== CANVAS CONNECT DEBUG ===')
  console.log('Environment Variables Check:', {
    NEXT_PUBLIC_CANVAS_BASE_URL: process.env.NEXT_PUBLIC_CANVAS_BASE_URL
      ? `✓ SET (${process.env.NEXT_PUBLIC_CANVAS_BASE_URL})`
      : '✗ MISSING',
    CANVAS_ENCRYPTION_SECRET: process.env.CANVAS_ENCRYPTION_SECRET
      ? `✓ SET (length: ${process.env.CANVAS_ENCRYPTION_SECRET.length})`
      : '✗ MISSING',
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL
      ? '✓ SET'
      : '✗ MISSING',
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY
      ? `✓ SET (starts with: ${process.env.CLERK_SECRET_KEY.substring(0, 7)})`
      : '✗ MISSING',
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV ?? 'not set (local?)',
  })

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
      console.error('❌ NEXT_PUBLIC_CANVAS_BASE_URL is missing!')
      logInternalError('Canvas Connect', 'NEXT_PUBLIC_CANVAS_BASE_URL is not set')
      return NextResponse.json(
        { error: 'Canvas configuration is missing: NEXT_PUBLIC_CANVAS_BASE_URL not set' },
        { status: 500 }
      )
    }
    console.log('✅ All required environment variables present')

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

    // Ensure Convex user exists (webhook may not have fired yet after signup)
    await convex.mutation(api.users.getOrCreateUser, { clerkId: userId })

    // Check if this Canvas account is already linked to a different dopamine drop account
    const canvasUserIdStr = canvasUser.id.toString()
    const existingOwner = await convex.query(api.users.getUserByCanvasId, {
      canvasUserId: canvasUserIdStr,
    })
    if (existingOwner && existingOwner.clerkId !== userId) {
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
