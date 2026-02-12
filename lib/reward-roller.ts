import { SupabaseClient } from '@supabase/supabase-js'

interface Reward {
  id: string
  name: string
  description: string
  rarity: 'common' | 'rare' | 'legendary'
}

export async function rollReward({
  userId,
  totalPoints,
  pointsJustAwarded,
  supabase,
}: {
  userId: string
  totalPoints: number
  pointsJustAwarded: number
  supabase: SupabaseClient
}): Promise<Reward | null> {
  // Check if crossed a 50-point milestone
  const previousMilestones = Math.floor((totalPoints - pointsJustAwarded) / 50)
  const currentMilestones = Math.floor(totalPoints / 50)

  if (currentMilestones <= previousMilestones) {
    return null // No new milestone crossed
  }

  // Roll rarity (weighted random)
  const roll = Math.random() * 100
  let rarity: 'common' | 'rare' | 'legendary'

  if (roll < 60) {
    rarity = 'common'
  } else if (roll < 90) {
    rarity = 'rare'
  } else {
    rarity = 'legendary'
  }

  // Fetch active rewards of that rarity
  const { data: rewards } = await supabase
    .from('rewards')
    .select('*')
    .eq('rarity', rarity)
    .eq('is_active', true)

  if (!rewards || rewards.length === 0) {
    return null // No rewards available
  }

  // Pick random reward
  const randomReward = rewards[Math.floor(Math.random() * rewards.length)]

  // Insert into user_rewards
  const { data: userReward } = await supabase
    .from('user_rewards')
    .insert({
      user_id: userId,
      reward_id: randomReward.id,
      is_revealed: false,
    })
    .select(
      `
      *,
      rewards (*)
    `
    )
    .single()

  // Return full reward object
  return userReward?.rewards as Reward
}
