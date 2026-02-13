import { getConvexClient } from './convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

interface Reward {
  id: string
  name: string
  description: string
  rarity: 'common' | 'rare' | 'legendary'
}

export async function rollReward({
  convexUserId,
  totalPoints,
  pointsJustAwarded,
}: {
  convexUserId: Id<'users'>
  totalPoints: number
  pointsJustAwarded: number
}): Promise<Reward | null> {
  const convex = getConvexClient()

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
  const rewards = await convex.query(api.rewards.getActiveRewardsByRarity, {
    rarity,
  })

  if (!rewards || rewards.length === 0) {
    return null // No rewards available
  }

  // Pick random reward
  const randomReward = rewards[Math.floor(Math.random() * rewards.length)]

  // Insert into user_rewards and return the reward
  const userReward = await convex.mutation(api.rewards.awardReward, {
    userId: convexUserId,
    rewardId: randomReward._id,
  })

  // Return full reward object
  return userReward?.reward as Reward
}
