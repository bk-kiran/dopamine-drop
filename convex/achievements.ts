import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// Helper: get user by Supabase ID
async function getUserBySupabaseId(ctx: any, supabaseId: string) {
  return await ctx.db
    .query('users')
    .withIndex('by_auth_user_id', (q: any) => q.eq('authUserId', supabaseId))
    .first()
}

// ─── Seed achievement pool ────────────────────────────────────────────────────

const ACHIEVEMENT_SEED_DATA = [
  {
    key: 'first_blood',
    name: 'First Blood',
    description: 'Submit your very first assignment.',
    icon: 'Star',
    color: 'yellow',
    bonusPoints: 10,
  },
  {
    key: 'night_owl',
    name: 'Night Owl',
    description: 'Submit an assignment between midnight and 4 AM.',
    icon: 'Moon',
    color: 'blue',
    bonusPoints: 15,
  },
  {
    key: 'speed_runner',
    name: 'Speed Runner',
    description: 'Submit an assignment 48+ hours before the deadline.',
    icon: 'Zap',
    color: 'yellow',
    bonusPoints: 20,
  },
  {
    key: 'perfect_week',
    name: 'Perfect Week',
    description: 'Go 7 days without any missing assignments.',
    icon: 'Shield',
    color: 'green',
    bonusPoints: 30,
  },
  {
    key: 'on_fire',
    name: 'On Fire',
    description: 'Maintain a 7-day activity streak.',
    icon: 'Flame',
    color: 'orange',
    bonusPoints: 25,
  },
  {
    key: 'unstoppable',
    name: 'Unstoppable',
    description: 'Maintain a 14-day activity streak.',
    icon: 'Flame',
    color: 'red',
    bonusPoints: 40,
  },
  {
    key: 'centurion',
    name: 'Centurion',
    description: 'Earn 100 total points.',
    icon: 'Trophy',
    color: 'yellow',
    bonusPoints: 20,
  },
  {
    key: 'overachiever',
    name: 'Overachiever',
    description: 'Earn 500 total points.',
    icon: 'Crown',
    color: 'purple',
    bonusPoints: 50,
  },
  {
    key: 'early_bird',
    name: 'Early Bird',
    description: 'Submit 5 assignments early.',
    icon: 'Sun',
    color: 'amber',
    bonusPoints: 25,
  },
  {
    key: 'grinder',
    name: 'Grinder',
    description: 'Complete 10 custom tasks.',
    icon: 'Dumbbell',
    color: 'blue',
    bonusPoints: 30,
  },
  {
    key: 'challenge_accepted',
    name: 'Challenge Accepted',
    description: 'Complete 5 daily challenges.',
    icon: 'Target',
    color: 'purple',
    bonusPoints: 35,
  },
  {
    key: 'legend',
    name: 'Legend',
    description: 'Reach Level 5 (1000 points).',
    icon: 'Crown',
    color: 'gold',
    bonusPoints: 100,
  },
  {
    key: 'shield_bearer',
    name: 'Shield Bearer',
    description: 'Use a streak shield to protect your streak.',
    icon: 'Shield',
    color: 'purple',
    bonusPoints: 20,
  },
] as const

export const seedAchievements = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('achievements').first()
    if (existing) return { skipped: true, message: 'Achievements already seeded' }

    for (const achievement of ACHIEVEMENT_SEED_DATA) {
      await ctx.db.insert('achievements', achievement)
    }

    return { seeded: ACHIEVEMENT_SEED_DATA.length }
  },
})

// ─── Check and award achievements ────────────────────────────────────────────

export const checkAndAwardAchievements = mutation({
  args: { supabaseId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) return { newAchievements: [] }

    // Already-unlocked achievement IDs (keyed by achievementId string)
    const existingUserAchievements = await ctx.db
      .query('userAchievements')
      .withIndex('by_user_id', (q: any) => q.eq('userId', user._id))
      .collect()

    const alreadyUnlockedIds = new Set(
      existingUserAchievements.map((ua: any) => ua.achievementId)
    )

    // Pull all pool achievements
    const allAchievements = await ctx.db.query('achievements').collect()
    const achievementByKey = new Map(allAchievements.map((a: any) => [a.key, a]))

    // ── Gather stats ──

    // All assignments for user
    const allAssignments = await ctx.db
      .query('assignments')
      .withIndex('by_user', (q: any) => q.eq('userId', user._id))
      .collect()

    // Points ledger for shield checks
    const allLedger = await ctx.db
      .query('pointsLedger')
      .withIndex('by_user', (q: any) => q.eq('userId', user._id))
      .collect()

    const submittedAssignments = allAssignments.filter((a: any) => a.submittedAt)

    // Early submissions: dueAt - submittedAt >= 24h
    const earlySubmissions = submittedAssignments.filter((a: any) => {
      if (!a.dueAt || !a.submittedAt) return false
      return (
        new Date(a.dueAt).getTime() - new Date(a.submittedAt).getTime() >=
        24 * 60 * 60 * 1000
      )
    })

    // Speed runner: any submitted >= 48h early
    const speedRunnerAssignment = submittedAssignments.find((a: any) => {
      if (!a.dueAt || !a.submittedAt) return false
      return (
        new Date(a.dueAt).getTime() - new Date(a.submittedAt).getTime() >=
        48 * 60 * 60 * 1000
      )
    })

    // Night owl: any submission between midnight and 4am UTC
    const nightOwlAssignment = submittedAssignments.find((a: any) => {
      if (!a.submittedAt) return false
      const hour = new Date(a.submittedAt).getUTCHours()
      return hour >= 0 && hour < 4
    })

    // Perfect week: no missing assignments in past 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString()
    const recentMissing = allAssignments.filter(
      (a: any) =>
        a.status === 'missing' &&
        a.dueAt &&
        a.dueAt >= sevenDaysAgoStr
    )

    // Streak counts
    const streakCount = user.streakCount || 0

    // Total points
    const totalPoints = user.totalPoints || 0

    // Shield ever used
    const shieldEverUsed = allLedger.some((e: any) => e.reason === 'shield_used')

    // Custom tasks completed
    const allCustomTasks = await ctx.db
      .query('customTasks')
      .withIndex('by_user_id', (q: any) => q.eq('userId', user._id))
      .collect()
    const completedCustomTasks = allCustomTasks.filter(
      (t: any) => t.status === 'completed'
    )

    // Daily challenges completed (all time)
    const allUserChallenges = await ctx.db
      .query('userDailyChallenges')
      .withIndex('by_user_date', (q: any) => q.eq('userId', user._id))
      .collect()
    const completedChallenges = allUserChallenges.filter((c: any) => c.completed)

    // ── Build map of which achievements are earned now ──
    const shouldUnlock: Record<string, boolean> = {
      first_blood: submittedAssignments.length >= 1,
      night_owl: !!nightOwlAssignment,
      speed_runner: !!speedRunnerAssignment,
      perfect_week: recentMissing.length === 0 && submittedAssignments.length >= 1,
      on_fire: streakCount >= 7,
      unstoppable: streakCount >= 14,
      centurion: totalPoints >= 100,
      overachiever: totalPoints >= 500,
      early_bird: earlySubmissions.length >= 5,
      grinder: completedCustomTasks.length >= 10,
      challenge_accepted: completedChallenges.length >= 5,
      legend: totalPoints >= 1000,
      shield_bearer: shieldEverUsed,
    }

    const now = new Date().toISOString()
    const newlyUnlocked: any[] = []

    for (const [key, earned] of Object.entries(shouldUnlock)) {
      if (!earned) continue
      const achievement = achievementByKey.get(key)
      if (!achievement) continue
      if (alreadyUnlockedIds.has(achievement._id)) continue

      // Award achievement
      await ctx.db.insert('userAchievements', {
        userId: user._id,
        achievementId: achievement._id,
        unlockedAt: now,
        seen: false,
      })

      // Award bonus points
      await ctx.db.insert('pointsLedger', {
        userId: user._id,
        delta: achievement.bonusPoints,
        reason: 'achievement',
      })
      await ctx.db.patch(user._id, {
        totalPoints: (user.totalPoints || 0) + achievement.bonusPoints,
      })

      // Refresh user totalPoints for subsequent checks in this loop
      user.totalPoints = (user.totalPoints || 0) + achievement.bonusPoints

      newlyUnlocked.push({
        key: achievement.key,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        color: achievement.color,
        bonusPoints: achievement.bonusPoints,
      })
    }

    return { newAchievements: newlyUnlocked }
  },
})

// ─── Get unseen achievements ──────────────────────────────────────────────────

export const getUnseenAchievements = query({
  args: { supabaseId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) return []

    const unseen = await ctx.db
      .query('userAchievements')
      .withIndex('by_user_id', (q: any) => q.eq('userId', user._id))
      .collect()

    const unseenOnly = unseen.filter((ua: any) => !ua.seen)

    const result = await Promise.all(
      unseenOnly.map(async (ua: any) => {
        const achievement = await ctx.db.get(ua.achievementId)
        return {
          _id: ua._id,
          unlockedAt: ua.unlockedAt,
          achievement,
        }
      })
    )

    return result.filter((r: any) => r.achievement !== null)
  },
})

// ─── Mark achievements as seen ───────────────────────────────────────────────

export const markAchievementsSeen = mutation({
  args: { supabaseId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) return

    const unseen = await ctx.db
      .query('userAchievements')
      .withIndex('by_user_id', (q: any) => q.eq('userId', user._id))
      .collect()

    for (const ua of unseen) {
      if (!ua.seen) {
        await ctx.db.patch(ua._id, { seen: true })
      }
    }
  },
})

// ─── Get all user achievements (for profile page) ─────────────────────────────

export const getUserAchievements = query({
  args: { supabaseId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) return { unlocked: [], allAchievements: [] }

    const allAchievements = await ctx.db.query('achievements').collect()

    const userAchievements = await ctx.db
      .query('userAchievements')
      .withIndex('by_user_id', (q: any) => q.eq('userId', user._id))
      .collect()

    const unlockedMap = new Map(
      userAchievements.map((ua: any) => [ua.achievementId, ua])
    )

    const enriched = allAchievements.map((a: any) => {
      const ua = unlockedMap.get(a._id)
      return {
        ...a,
        unlocked: !!ua,
        unlockedAt: ua?.unlockedAt || null,
      }
    })

    return enriched
  },
})
