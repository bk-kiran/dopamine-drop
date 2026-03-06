import { mutation } from '../_generated/server'

export const wipeUserData = mutation({
  handler: async (ctx) => {
    console.log('[Wipe] Starting full Convex data wipe...')
    console.log('[Wipe] Clerk accounts remain intact — users just need to re-link Canvas')

    // Delete child tables first (FK order)
    const userAchievements = await ctx.db.query('userAchievements').collect()
    for (const r of userAchievements) await ctx.db.delete(r._id)

    const userDailyChallenges = await ctx.db.query('userDailyChallenges').collect()
    for (const r of userDailyChallenges) await ctx.db.delete(r._id)

    const userRewards = await ctx.db.query('userRewards').collect()
    for (const r of userRewards) await ctx.db.delete(r._id)

    const leaderboardMembers = await ctx.db.query('leaderboardMembers').collect()
    for (const r of leaderboardMembers) await ctx.db.delete(r._id)

    const leaderboards = await ctx.db.query('leaderboards').collect()
    for (const r of leaderboards) await ctx.db.delete(r._id)

    const pointsLedger = await ctx.db.query('pointsLedger').collect()
    for (const r of pointsLedger) await ctx.db.delete(r._id)

    const customTasks = await ctx.db.query('customTasks').collect()
    for (const r of customTasks) await ctx.db.delete(r._id)

    const assignments = await ctx.db.query('assignments').collect()
    for (const r of assignments) await ctx.db.delete(r._id)

    const courses = await ctx.db.query('courses').collect()
    for (const r of courses) await ctx.db.delete(r._id)

    const users = await ctx.db.query('users').collect()
    for (const r of users) await ctx.db.delete(r._id)

    // Static seed tables (challengePool, achievements, rewards) are intentionally kept

    const result = {
      users: users.length,
      courses: courses.length,
      assignments: assignments.length,
      customTasks: customTasks.length,
      pointsLedger: pointsLedger.length,
      leaderboards: leaderboards.length,
      leaderboardMembers: leaderboardMembers.length,
      userRewards: userRewards.length,
      userAchievements: userAchievements.length,
      userDailyChallenges: userDailyChallenges.length,
    }

    console.log('[Wipe] Complete:', result)
    return result
  },
})
