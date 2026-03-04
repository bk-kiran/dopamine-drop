import { mutation } from '../_generated/server'

export const wipeUserData = mutation({
  handler: async (ctx) => {
    console.log('[Migration] Starting data wipe...')

    // Delete all user-dependent records first (FK order)
    const userAchievements = await ctx.db.query('userAchievements').collect()
    for (const r of userAchievements) await ctx.db.delete(r._id)
    console.log(`[Migration] Deleted ${userAchievements.length} userAchievements`)

    const userDailyChallenges = await ctx.db.query('userDailyChallenges').collect()
    for (const r of userDailyChallenges) await ctx.db.delete(r._id)
    console.log(`[Migration] Deleted ${userDailyChallenges.length} userDailyChallenges`)

    const userRewards = await ctx.db.query('userRewards').collect()
    for (const r of userRewards) await ctx.db.delete(r._id)
    console.log(`[Migration] Deleted ${userRewards.length} userRewards`)

    const leaderboardMembers = await ctx.db.query('leaderboardMembers').collect()
    for (const r of leaderboardMembers) await ctx.db.delete(r._id)
    console.log(`[Migration] Deleted ${leaderboardMembers.length} leaderboardMembers`)

    const pointsLedger = await ctx.db.query('pointsLedger').collect()
    for (const r of pointsLedger) await ctx.db.delete(r._id)
    console.log(`[Migration] Deleted ${pointsLedger.length} pointsLedger entries`)

    const tasks = await ctx.db.query('customTasks').collect()
    for (const r of tasks) await ctx.db.delete(r._id)
    console.log(`[Migration] Deleted ${tasks.length} customTasks`)

    const assignments = await ctx.db.query('assignments').collect()
    for (const r of assignments) await ctx.db.delete(r._id)
    console.log(`[Migration] Deleted ${assignments.length} assignments`)

    const courses = await ctx.db.query('courses').collect()
    for (const r of courses) await ctx.db.delete(r._id)
    console.log(`[Migration] Deleted ${courses.length} courses`)

    const users = await ctx.db.query('users').collect()
    for (const r of users) await ctx.db.delete(r._id)
    console.log(`[Migration] Deleted ${users.length} users`)

    console.log('[Migration] Data wipe complete!')
    return {
      usersDeleted: users.length,
      coursesDeleted: courses.length,
      assignmentsDeleted: assignments.length,
      tasksDeleted: tasks.length,
      pointsLedgerDeleted: pointsLedger.length,
      userRewardsDeleted: userRewards.length,
      userAchievementsDeleted: userAchievements.length,
      userDailyChallengesDeleted: userDailyChallenges.length,
      leaderboardMembersDeleted: leaderboardMembers.length,
    }
  },
})
