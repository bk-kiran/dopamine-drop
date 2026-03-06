import { mutation } from '../_generated/server'

export const wipeAllData = mutation({
  handler: async (ctx) => {
    console.log('')
    console.log('╔════════════════════════════════════════╗')
    console.log('║   CONVEX DATA WIPE - STARTING          ║')
    console.log('║   Clerk auth will remain intact        ║')
    console.log('╚════════════════════════════════════════╝')
    console.log('')

    let totalDeleted = 0
    const results: Record<string, number> = {}

    const tablesToWipe = [
      'userAchievements',
      'userDailyChallenges',
      'userRewards',
      'leaderboardMembers',
      'leaderboards',
      'pointsLedger',
      'customTasks',
      'assignments',
      'courses',
      'users',
      // Static seed tables — comment out to preserve between wipes
      'challengePool',
      'achievements',
      'rewards',
    ] as const

    for (const tableName of tablesToWipe) {
      try {
        const records = await ctx.db.query(tableName as any).collect()
        for (const record of records) {
          await ctx.db.delete(record._id)
        }
        results[tableName] = records.length
        totalDeleted += records.length
        if (records.length > 0) {
          console.log(`✓ ${tableName.padEnd(25)} ${records.length} deleted`)
        } else {
          console.log(`⊘ ${tableName.padEnd(25)} (empty)`)
        }
      } catch {
        console.log(`⊘ ${tableName.padEnd(25)} (table not found)`)
        results[tableName] = 0
      }
    }

    console.log('')
    console.log('═'.repeat(50))
    console.log(`✅ COMPLETE: ${totalDeleted} total records deleted`)
    console.log('═'.repeat(50))
    console.log('')
    console.log('Next steps:')
    console.log('1. Log in with existing Clerk account')
    console.log('2. Connect Canvas (auto-sync will start)')
    console.log('3. Fresh start with encrypted token storage')
    console.log('')

    return { success: true, totalDeleted, breakdown: results }
  },
})
