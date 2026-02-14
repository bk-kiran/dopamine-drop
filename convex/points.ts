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

// Remove points for a specific assignment
export const removePoints = mutation({
  args: {
    assignmentId: v.id('assignments'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    // Find all ledger entries for this assignment
    const ledgerEntries = await ctx.db
      .query('pointsLedger')
      .withIndex('by_assignment', (q) => q.eq('assignmentId', args.assignmentId))
      .collect()

    // Calculate total points to remove
    const pointsToRemove = ledgerEntries.reduce((sum, entry) => sum + entry.delta, 0)

    // Delete all ledger entries for this assignment
    await Promise.all(ledgerEntries.map((entry) => ctx.db.delete(entry._id)))

    // Update user's total points
    const user = await ctx.db.get(args.userId)
    if (user) {
      await ctx.db.patch(args.userId, {
        totalPoints: Math.max(0, (user.totalPoints || 0) - pointsToRemove),
      })
    }

    return pointsToRemove
  },
})
