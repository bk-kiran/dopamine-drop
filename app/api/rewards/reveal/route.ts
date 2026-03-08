import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getConvexClient, getConvexUserId } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateInput, rewardRevealSchema } from '@/lib/validation'
import { logSecurityEvent, logInternalError } from '@/lib/logger'

export async function POST(request: NextRequest) {
  console.log('[Rewards Reveal] Route handler called')

  try {
    const { userId } = await auth()

    console.log('[Rewards Reveal] Auth check:', { hasUser: !!userId })

    if (!userId) {
      logSecurityEvent('unauthorized', { route: '/api/rewards/reveal' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimitResponse = await checkRateLimit(userId, 'mutations')
    if (rateLimitResponse) {
      logSecurityEvent('rate_limit', { route: '/api/rewards/reveal', userId })
      return rateLimitResponse
    }

    // Validate input
    const body = await request.json()
    const validation = validateInput(rewardRevealSchema, body)
    if (!validation.success) {
      logSecurityEvent('invalid_input', {
        route: '/api/rewards/reveal',
        userId,
        error: validation.error,
      })
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { rewardId } = validation.data

    try {
      const convex = getConvexClient()
      const convexUserId = await getConvexUserId(userId)

      console.log('[Rewards Reveal] Debug:', {
        convexUserId,
        rewardId,
        rewardIdType: typeof rewardId,
      })

      await convex.mutation(api.rewards.revealReward, {
        userId: convexUserId,
        rewardId: rewardId as Id<'rewards'>,
      })

      return NextResponse.json({ success: true })
    } catch (error) {
      logInternalError('Rewards Reveal', error, {
        userId,
        rewardId
      })
      return NextResponse.json({ error: 'Failed to reveal reward' }, { status: 500 })
    }
  } catch (error) {
    logInternalError('Rewards Reveal', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
