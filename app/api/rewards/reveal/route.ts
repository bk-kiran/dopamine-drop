import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConvexClient, getConvexUserId } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[Rewards Reveal] Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { rewardId } = await request.json()
    console.log('[Rewards Reveal] Request received:', { rewardId, userId: user.id })

    if (!rewardId) {
      console.error('[Rewards Reveal] Missing rewardId')
      return NextResponse.json({ error: 'rewardId required' }, { status: 400 })
    }

    // Verify reward belongs to user and mark as revealed
    const convex = getConvexClient()
    const convexUserId = await getConvexUserId(user.id)

    try {
      await convex.mutation(api.rewards.revealReward, {
        userId: convexUserId,
        rewardId, // This is now a Convex ID
      })
      console.log('[Rewards Reveal] Success! Marked as revealed.')
    } catch (error) {
      console.error('[Rewards Reveal] Reveal failed:', error)
      return NextResponse.json({ error: 'Failed to reveal reward' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Rewards Reveal] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
