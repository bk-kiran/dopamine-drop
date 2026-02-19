import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConvexClient, getConvexUserId } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateInput, rewardRevealSchema } from '@/lib/validation'
import { logSecurityEvent, logInternalError } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      logSecurityEvent('unauthorized', { route: '/api/rewards/reveal' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimitResponse = await checkRateLimit(user.id, 'mutations')
    if (rateLimitResponse) {
      logSecurityEvent('rate_limit', { route: '/api/rewards/reveal', userId: user.id })
      return rateLimitResponse
    }

    // Validate input
    const body = await request.json()
    const validation = validateInput(rewardRevealSchema, body)
    if (!validation.success) {
      logSecurityEvent('invalid_input', {
        route: '/api/rewards/reveal',
        userId: user.id,
        error: validation.error,
      })
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { rewardId } = validation.data

    const convex = getConvexClient()
    const convexUserId = await getConvexUserId(user.id)

    try {
      await convex.mutation(api.rewards.revealReward, {
        userId: convexUserId,
        rewardId,
      })
    } catch (error) {
      logInternalError('Rewards Reveal', error, { userId: user.id })
      return NextResponse.json({ error: 'Failed to reveal reward' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logInternalError('Rewards Reveal', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
