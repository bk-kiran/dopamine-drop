import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Verify reward belongs to user
    const { data: userReward, error: fetchError } = await supabase
      .from('user_rewards')
      .select('id')
      .eq('reward_id', rewardId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !userReward) {
      console.error('[Rewards Reveal] Reward not found:', { rewardId, fetchError })
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 })
    }

    console.log('[Rewards Reveal] Found user_reward:', userReward.id)

    // Mark as revealed
    const { error: updateError } = await supabase
      .from('user_rewards')
      .update({ is_revealed: true })
      .eq('id', userReward.id)

    if (updateError) {
      console.error('[Rewards Reveal] Update failed:', updateError)
      return NextResponse.json({ error: 'Failed to reveal reward' }, { status: 500 })
    }

    console.log('[Rewards Reveal] Success! Marked as revealed.')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Rewards Reveal] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
