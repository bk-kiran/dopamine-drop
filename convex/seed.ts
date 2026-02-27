import { mutation } from './_generated/server'

export const seedRewards = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if rewards table is empty
    const existingRewards = await ctx.db.query('rewards').collect()

    if (existingRewards.length > 0) {
      return {
        success: false,
        message: 'Rewards table already has data. Skipping seed.',
        count: existingRewards.length,
      }
    }

    // Insert the 4 starter rewards
    await ctx.db.insert('rewards', {
      type: 'virtual',
      name: 'Fire Streak Badge',
      description: 'Awarded for a 3-day streak',
      rarity: 'common',
      isActive: true,
    })

    await ctx.db.insert('rewards', {
      type: 'virtual',
      name: 'Early Bird Icon',
      description: 'Submit 5 assignments early',
      rarity: 'rare',
      isActive: true,
    })

    await ctx.db.insert('rewards', {
      type: 'virtual',
      name: 'Legend Status Frame',
      description: 'Reach 500 points',
      rarity: 'legendary',
      isActive: true,
    })

    await ctx.db.insert('rewards', {
      type: 'real',
      name: '10% off Campus Coffee',
      description: 'Discount at the student union café',
      rarity: 'rare',
      isActive: true,
    })

    return {
      success: true,
      message: 'Successfully seeded 4 rewards',
      count: 4,
    }
  },
})

// Reseed the challenge pool with expanded 25 challenges
// Run this to update existing pool: npx convex run seed:reseedChallengePool
export const reseedChallengePool = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all existing challenges
    const existing = await ctx.db.query('challengePool').collect()
    for (const challenge of existing) {
      await ctx.db.delete(challenge._id)
    }

    // Note: This will also clear userDailyChallenges references
    // but they'll regenerate on next query
    console.log(`Deleted ${existing.length} existing challenges`)

    // Seed the expanded pool - this will be picked up by
    // seedChallengePool mutation in challenges.ts
    return {
      success: true,
      message: 'Challenge pool cleared. Run seedChallengePool from challenges.ts to reseed.',
      deletedCount: existing.length,
    }
  },
})
