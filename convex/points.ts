import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// Add points to user and ledger
export const addPoints = mutation({
  args: {
    userId: v.id('users'),
    assignmentId: v.optional(v.id('assignments')),
    delta: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    // Insert ledger entry
    await ctx.db.insert('pointsLedger', {
      userId: args.userId,
      assignmentId: args.assignmentId,
      delta: args.delta,
      reason: args.reason,
    })

    // Update user's total points
    const user = await ctx.db.get(args.userId)
    if (user) {
      await ctx.db.patch(args.userId, {
        totalPoints: (user.totalPoints || 0) + args.delta,
      })
    }
  },
})

// Get points history for a user
export const getPointsHistory = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('pointsLedger')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()
  },
})
