import { mutation, query, internalMutation } from './_generated/server'
import { v } from 'convex/values'

// Helper: get user by Clerk ID
async function getUserByClerkId(ctx: any, clerkId: string) {
  return await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q: any) => q.eq('clerkId', clerkId))
    .first()
}

// ─── Seed achievement pool ────────────────────────────────────────────────────

const ACHIEVEMENT_SEED_DATA = [
  // Easy (bonus ≤ 15)
  { key: 'first_blood',       name: 'First Blood',        description: 'Submit your very first assignment.',                          icon: 'Star',     color: 'yellow', bonusPoints: 10 },
  { key: 'night_owl',         name: 'Night Owl',           description: 'Submit an assignment between midnight and 4 AM.',             icon: 'Moon',     color: 'blue',   bonusPoints: 15 },
  { key: 'dedicated',         name: 'Dedicated',           description: 'Maintain a 3-day activity streak.',                           icon: 'Flame',    color: 'amber',  bonusPoints: 8  },
  { key: 'point_starter',     name: 'Point Starter',       description: 'Earn your first 50 points.',                                  icon: 'Zap',      color: 'yellow', bonusPoints: 8  },

  // Medium (bonus 16–35)
  { key: 'speed_runner',      name: 'Speed Runner',        description: 'Submit an assignment 48+ hours before the deadline.',         icon: 'Zap',      color: 'yellow', bonusPoints: 20 },
  { key: 'on_fire',           name: 'On Fire',             description: 'Maintain a 7-day activity streak.',                           icon: 'Flame',    color: 'orange', bonusPoints: 25 },
  { key: 'consistent',        name: 'Consistent',          description: 'Maintain a 10-day activity streak.',                          icon: 'Flame',    color: 'red',    bonusPoints: 30 },
  { key: 'centurion',         name: 'Centurion',           description: 'Earn 100 total points.',                                      icon: 'Trophy',   color: 'yellow', bonusPoints: 20 },
  { key: 'point_hoarder',     name: 'Point Hoarder',       description: 'Earn 250 total points.',                                      icon: 'Trophy',   color: 'amber',  bonusPoints: 30 },
  { key: 'early_bird',        name: 'Early Bird',          description: 'Submit 5 assignments early (24+ hours before due).',          icon: 'Sun',      color: 'amber',  bonusPoints: 25 },
  { key: 'early_adopter',     name: 'Early Adopter',       description: 'Submit 3 assignments early (24+ hours before due).',          icon: 'Sun',      color: 'yellow', bonusPoints: 18 },
  { key: 'task_master',       name: 'Task Master',         description: 'Complete 5 custom tasks.',                                    icon: 'Dumbbell', color: 'blue',   bonusPoints: 20 },
  { key: 'multi_course',      name: 'Multi-Course',        description: 'Submit assignments in 3 or more different courses.',          icon: 'Target',   color: 'purple', bonusPoints: 22 },
  { key: 'perfect_week',      name: 'Perfect Week',        description: 'Go 7 days without any missing assignments.',                  icon: 'Shield',   color: 'green',  bonusPoints: 30 },
  { key: 'challenge_accepted',name: 'Challenge Accepted',  description: 'Complete 5 daily challenges.',                                icon: 'Target',   color: 'purple', bonusPoints: 35 },

  // Hard (bonus 36+)
  { key: 'unstoppable',       name: 'Unstoppable',         description: 'Maintain a 14-day activity streak.',                          icon: 'Flame',    color: 'red',    bonusPoints: 40 },
  { key: 'overachiever',      name: 'Overachiever',        description: 'Earn 500 total points.',                                      icon: 'Crown',    color: 'purple', bonusPoints: 50 },
  { key: 'grinder',           name: 'Grinder',             description: 'Complete 10 custom tasks.',                                   icon: 'Dumbbell', color: 'blue',   bonusPoints: 30 },
  { key: 'shield_bearer',     name: 'Shield Bearer',       description: 'Use a streak shield to protect your streak.',                 icon: 'Shield',   color: 'purple', bonusPoints: 20 },
  { key: 'legend',            name: 'Legend',              description: 'Reach Level 5 (1000 points).',                               icon: 'Crown',    color: 'gold',   bonusPoints: 100},
] as const

// Shared seed logic (idempotent — skips if any achievement already exists)
async function seedAchievementsIfEmpty(ctx: any): Promise<{ seeded: number } | { skipped: true }> {
  const existing = await ctx.db.query('achievements').first()
  if (existing) return { skipped: true }

  for (const achievement of ACHIEVEMENT_SEED_DATA) {
    await ctx.db.insert('achievements', achievement)
  }
  return { seeded: ACHIEVEMENT_SEED_DATA.length }
}

// Public mutation — can be called manually (idempotent)
export const seedAchievements = mutation({
  args: {},
  handler: async (ctx) => seedAchievementsIfEmpty(ctx),
})

// Internal mutation — called by cron
export const autoSeedAchievementsPool = internalMutation({
  args: {},
  handler: async (ctx) => seedAchievementsIfEmpty(ctx),
})

// ─── Check and award achievements ────────────────────────────────────────────

export const checkAndAwardAchievements = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    // Auto-seed pool if empty (first-time users)
    const pool = await ctx.db.query('achievements').first()
    if (!pool) await seedAchievementsIfEmpty(ctx)

    const user = await getUserByClerkId(ctx, args.clerkId)
    if (!user) return { newAchievements: [] }

    // Already-unlocked achievement IDs
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

    const allAssignments = await ctx.db
      .query('assignments')
      .withIndex('by_user', (q: any) => q.eq('userId', user._id))
      .collect()

    const allLedger = await ctx.db
      .query('pointsLedger')
      .withIndex('by_user', (q: any) => q.eq('userId', user._id))
      .collect()

    const submittedAssignments = allAssignments.filter((a: any) => a.submittedAt)

    const earlySubmissions = submittedAssignments.filter((a: any) => {
      if (!a.dueAt || !a.submittedAt) return false
      return (
        new Date(a.dueAt).getTime() - new Date(a.submittedAt).getTime() >=
        24 * 60 * 60 * 1000
      )
    })

    const speedRunnerAssignment = submittedAssignments.find((a: any) => {
      if (!a.dueAt || !a.submittedAt) return false
      return (
        new Date(a.dueAt).getTime() - new Date(a.submittedAt).getTime() >=
        48 * 60 * 60 * 1000
      )
    })

    const nightOwlAssignment = submittedAssignments.find((a: any) => {
      if (!a.submittedAt) return false
      const hour = new Date(a.submittedAt).getUTCHours()
      return hour >= 0 && hour < 4
    })

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentMissing = allAssignments.filter(
      (a: any) =>
        a.status === 'missing' &&
        a.dueAt &&
        a.dueAt >= sevenDaysAgo.toISOString()
    )

    const distinctCoursesWithSubmission = new Set(
      submittedAssignments.map((a: any) => a.courseId?.toString())
    ).size

    const streakCount = user.streakCount || 0
    const totalPoints = user.totalPoints || 0
    const shieldEverUsed = allLedger.some((e: any) => e.reason === 'shield_used')

    const allCustomTasks = await ctx.db
      .query('customTasks')
      .withIndex('by_user_id', (q: any) => q.eq('userId', user._id))
      .collect()
    const completedCustomTasks = allCustomTasks.filter(
      (t: any) => t.status === 'completed'
    )

    const allUserChallenges = await ctx.db
      .query('userDailyChallenges')
      .withIndex('by_user', (q: any) => q.eq('userId', user._id))
      .collect()
    const completedChallenges = allUserChallenges.filter((c: any) => c.completed)

    // ── Build map of which achievements are earned ──
    const shouldUnlock: Record<string, boolean> = {
      first_blood:        submittedAssignments.length >= 1,
      night_owl:          !!nightOwlAssignment,
      dedicated:          streakCount >= 3,
      point_starter:      totalPoints >= 50,
      speed_runner:       !!speedRunnerAssignment,
      on_fire:            streakCount >= 7,
      consistent:         streakCount >= 10,
      centurion:          totalPoints >= 100,
      point_hoarder:      totalPoints >= 250,
      early_bird:         earlySubmissions.length >= 5,
      early_adopter:      earlySubmissions.length >= 3,
      task_master:        completedCustomTasks.length >= 5,
      multi_course:       distinctCoursesWithSubmission >= 3,
      perfect_week:       recentMissing.length === 0 && submittedAssignments.length >= 1,
      challenge_accepted: completedChallenges.length >= 5,
      unstoppable:        streakCount >= 14,
      overachiever:       totalPoints >= 500,
      grinder:            completedCustomTasks.length >= 10,
      shield_bearer:      shieldEverUsed,
      legend:             totalPoints >= 1000,
    }

    const now = new Date().toISOString()
    const newlyUnlocked: any[] = []

    for (const [key, earned] of Object.entries(shouldUnlock)) {
      if (!earned) continue
      const achievement = achievementByKey.get(key)
      if (!achievement) continue
      if (alreadyUnlockedIds.has(achievement._id)) continue

      await ctx.db.insert('userAchievements', {
        userId: user._id,
        achievementId: achievement._id,
        unlockedAt: now,
        seen: false,
      })

      await ctx.db.insert('pointsLedger', {
        userId: user._id,
        delta: achievement.bonusPoints,
        reason: 'achievement',
      })
      await ctx.db.patch(user._id, {
        totalPoints: (user.totalPoints || 0) + achievement.bonusPoints,
      })
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
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByClerkId(ctx, args.clerkId)
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
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByClerkId(ctx, args.clerkId)
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

// ─── Get all achievements with progress (for profile page) ───────────────────

export const getUserAchievements = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    console.log('[Achievements] Starting query for user:', args.clerkId)

    const user = await getUserByClerkId(ctx, args.clerkId)
    if (!user) {
      console.log('[Achievements] User not found')
      return []
    }
    console.log('[Achievements] User found:', user._id)

    const allAchievements = await ctx.db.query('achievements').collect()
    console.log('[Achievements] Pool size:', allAchievements.length)

    if (allAchievements.length === 0) {
      // Pool not seeded yet — return empty so UI shows loading skeleton,
      // checkAndAwardAchievements (mutation) will auto-seed on next call.
      console.log('[Achievements] Pool empty — auto-seed pending')
      return []
    }

    const userAchievements = await ctx.db
      .query('userAchievements')
      .withIndex('by_user_id', (q: any) => q.eq('userId', user._id))
      .collect()
    console.log('[Achievements] Unlocked:', userAchievements.length)

    const unlockedMap = new Map(
      userAchievements.map((ua: any) => [ua.achievementId, ua])
    )

    // Gather stats — each section wrapped in try/catch so one failure
    // doesn't break the entire query.
    const streakCount = user.streakCount || 0
    const totalPoints = user.totalPoints || 0
    let submittedCount = 0
    let earlyCount = 0
    let distinctCourses = 0
    let completedCustomCount = 0
    let completedChallengeCount = 0

    try {
      const allAssignments = await ctx.db
        .query('assignments')
        .withIndex('by_user', (q: any) => q.eq('userId', user._id))
        .collect()
      const submitted = allAssignments.filter((a: any) => a.submittedAt)
      submittedCount = submitted.length
      earlyCount = submitted.filter((a: any) => {
        if (!a.dueAt || !a.submittedAt) return false
        return (
          new Date(a.dueAt).getTime() - new Date(a.submittedAt).getTime() >=
          24 * 60 * 60 * 1000
        )
      }).length
      distinctCourses = new Set(submitted.map((a: any) => a.courseId?.toString())).size
    } catch (e) {
      console.error('[Achievements] Error loading assignments:', e)
    }

    try {
      const customTasks = await ctx.db
        .query('customTasks')
        .withIndex('by_user_id', (q: any) => q.eq('userId', user._id))
        .collect()
      completedCustomCount = customTasks.filter((t: any) => t.status === 'completed').length
    } catch (e) {
      console.error('[Achievements] Error loading custom tasks:', e)
    }

    try {
      const challenges = await ctx.db
        .query('userDailyChallenges')
        .withIndex('by_user', (q: any) => q.eq('userId', user._id))
        .collect()
      completedChallengeCount = challenges.filter((c: any) => c.completed).length
    } catch (e) {
      console.error('[Achievements] Error loading daily challenges:', e)
    }

    // Progress by achievement key: { current, max }
    const progressByKey: Record<string, { current: number; max: number }> = {
      first_blood:        { current: Math.min(submittedCount, 1),         max: 1    },
      night_owl:          { current: 0,                                    max: 1    },
      dedicated:          { current: Math.min(streakCount, 3),            max: 3    },
      point_starter:      { current: Math.min(totalPoints, 50),           max: 50   },
      speed_runner:       { current: 0,                                    max: 1    },
      on_fire:            { current: Math.min(streakCount, 7),            max: 7    },
      consistent:         { current: Math.min(streakCount, 10),           max: 10   },
      centurion:          { current: Math.min(totalPoints, 100),          max: 100  },
      point_hoarder:      { current: Math.min(totalPoints, 250),          max: 250  },
      early_bird:         { current: Math.min(earlyCount, 5),             max: 5    },
      early_adopter:      { current: Math.min(earlyCount, 3),             max: 3    },
      task_master:        { current: Math.min(completedCustomCount, 5),   max: 5    },
      multi_course:       { current: Math.min(distinctCourses, 3),        max: 3    },
      perfect_week:       { current: 0,                                    max: 1    },
      challenge_accepted: { current: Math.min(completedChallengeCount, 5),max: 5    },
      unstoppable:        { current: Math.min(streakCount, 14),           max: 14   },
      overachiever:       { current: Math.min(totalPoints, 500),          max: 500  },
      grinder:            { current: Math.min(completedCustomCount, 10),  max: 10   },
      shield_bearer:      { current: 0,                                    max: 1    },
      legend:             { current: Math.min(totalPoints, 1000),         max: 1000 },
    }

    const enriched = allAchievements.map((a: any) => {
      const ua = unlockedMap.get(a._id)
      const prog = progressByKey[a.key] || { current: 0, max: 1 }
      return {
        ...a,
        unlocked: !!ua,
        unlockedAt: ua?.unlockedAt || null,
        progress: prog.current,
        progressMax: prog.max,
      }
    })

    console.log('[Achievements] Returning', enriched.length, 'achievements')
    return enriched
  },
})
