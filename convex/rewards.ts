import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// Get active rewards by rarity
export const getActiveRewardsByRarity = query({
  args: {
    rarity: v.union(v.literal('common'), v.literal('rare'), v.literal('legendary')),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('rewards')
      .withIndex('by_rarity_and_active', (q) =>
        q.eq('rarity', args.rarity).eq('isActive', true)
      )
      .collect()
  },
})

// Award reward to user
export const awardReward = mutation({
  args: {
    userId: v.id('users'),
    rewardId: v.id('rewards'),
  },
  handler: async (ctx, args) => {
    const userRewardId = await ctx.db.insert('userRewards', {
      userId: args.userId,
      rewardId: args.rewardId,
      isRevealed: false,
      earnedAt: new Date().toISOString(),
    })

    // Return user reward with reward details
    const userReward = await ctx.db.get(userRewardId)
    const reward = await ctx.db.get(args.rewardId)

    return {
      ...userReward,
      reward,
    }
  },
})

// Reveal reward
export const revealReward = mutation({
  args: {
    userId: v.id('users'),
    rewardId: v.id('rewards'),
  },
  handler: async (ctx, args) => {
    const userReward = await ctx.db
      .query('userRewards')
      .withIndex('by_user_and_reward', (q) =>
        q.eq('userId', args.userId).eq('rewardId', args.rewardId)
      )
      .first()

    if (!userReward) throw new Error('Reward not found')

    await ctx.db.patch(userReward._id, { isRevealed: true })
    return true
  },
})

// Get all user rewards
export const getUserRewards = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const userRewards = await ctx.db
      .query('userRewards')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()

    // Get reward details
    const rewards = await Promise.all(userRewards.map((ur) => ctx.db.get(ur.rewardId)))

    return userRewards.map((ur, i) => ({
      ...ur,
      reward: rewards[i],
    }))
  },
})

// Get user rewards by Supabase ID
export const getUserRewardsBySupabaseId = query({
  args: { supabaseId: v.string() },
  handler: async (ctx, args) => {
    // Find user by Supabase ID
    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.supabaseId))
      .first()

    if (!user) return []

    const userRewards = await ctx.db
      .query('userRewards')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    // Get reward details
    const rewards = await Promise.all(userRewards.map((ur) => ctx.db.get(ur.rewardId)))

    return userRewards.map((ur, i) => ({
      ...ur,
      reward: rewards[i],
    }))
  },
})

// Create reward (for seeding)
export const create = mutation({
  args: {
    type: v.union(v.literal('virtual'), v.literal('real')),
    name: v.string(),
    description: v.string(),
    rarity: v.union(v.literal('common'), v.literal('rare'), v.literal('legendary')),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('rewards', args)
  },
})
