import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// Helper: get user by Supabase ID
async function getUserBySupabaseId(ctx: any, supabaseId: string) {
  return await ctx.db
    .query('users')
    .withIndex('by_auth_user_id', (q: any) => q.eq('authUserId', supabaseId))
    .first()
}

// Weighted random selection - avoids recently shown challenges
function weightedRandomSample<T>(
  items: Array<{ item: T; weight: number }>,
  count: number
): T[] {
  const selected: T[] = []
  const remaining = [...items]

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, item) => sum + item.weight, 0)
    let random = Math.random() * totalWeight

    for (let j = 0; j < remaining.length; j++) {
      random -= remaining[j].weight
      if (random <= 0) {
        selected.push(remaining[j].item)
        remaining.splice(j, 1)
        break
      }
    }
  }

  return selected
}

// ─── Seed the challenge pool ────────────────────────────────────────────────

const CHALLENGE_SEED_DATA = [
  // Easy (8 challenges)
  { title: 'Single Submission', description: 'Submit 1 assignment today', type: 'submit_n', targetValue: 1, bonusPoints: 5, difficulty: 'easy' },
  { title: 'Streak Keeper', description: 'Maintain your active streak', type: 'streak', targetValue: 1, bonusPoints: 5, difficulty: 'easy' },
  { title: 'Personal Progress', description: 'Complete 1 custom task', type: 'custom_task', targetValue: 1, bonusPoints: 8, difficulty: 'easy' },
  { title: 'Quick 10', description: 'Earn 10 points in any way', type: 'points', targetValue: 10, bonusPoints: 5, difficulty: 'easy' },
  { title: 'Point Collector', description: 'Earn 20 points today', type: 'points', targetValue: 20, bonusPoints: 10, difficulty: 'easy' },
  { title: 'Morning Person', description: 'Complete a task before 10am', type: 'time_based', targetValue: 10, bonusPoints: 10, difficulty: 'easy' },
  { title: 'Night Owl Active', description: 'Complete a task after 10pm', type: 'time_based', targetValue: 22, bonusPoints: 10, difficulty: 'easy' },
  { title: 'Grade Hunter', description: 'Check your grades page', type: 'engagement', targetValue: 1, bonusPoints: 3, difficulty: 'easy' },

  // Medium (10 challenges)
  { title: 'Speed Demon', description: 'Submit 2 assignments today', type: 'submit_n', targetValue: 2, bonusPoints: 15, difficulty: 'medium' },
  { title: 'Early Bird', description: 'Submit 1 assignment 24+ hours before due date', type: 'early_submit', targetValue: 1, bonusPoints: 20, difficulty: 'medium' },
  { title: 'Task Master', description: 'Complete 2 custom tasks', type: 'custom_task', targetValue: 2, bonusPoints: 15, difficulty: 'medium' },
  { title: 'Week Warrior', description: 'Have a 7+ day streak', type: 'streak', targetValue: 7, bonusPoints: 15, difficulty: 'medium' },
  { title: 'Lunch Break Grind', description: 'Complete a task between 12-2pm', type: 'time_based', targetValue: 13, bonusPoints: 12, difficulty: 'medium' },
  { title: 'Priority Manager', description: 'Mark 2 tasks as urgent', type: 'urgent', targetValue: 2, bonusPoints: 8, difficulty: 'medium' },
  { title: 'Clear the Urgents', description: 'Complete 1 urgent task', type: 'urgent', targetValue: 1, bonusPoints: 12, difficulty: 'medium' },
  { title: 'Clean Slate', description: 'Have no pending tasks due today', type: 'clean_sweep', targetValue: 1, bonusPoints: 20, difficulty: 'medium' },
  { title: 'Perfect Day', description: 'Complete all tasks due today', type: 'perfect_day', targetValue: 1, bonusPoints: 25, difficulty: 'medium' },
  { title: 'Earn 30 points', description: 'Rack up 30 points today', type: 'points', targetValue: 30, bonusPoints: 18, difficulty: 'medium' },

  // Hard (7 challenges)
  { title: 'Hat Trick', description: 'Submit 3 assignments today', type: 'submit_n', targetValue: 3, bonusPoints: 25, difficulty: 'hard' },
  { title: 'Point Hoarder', description: 'Earn 50 points today', type: 'points', targetValue: 50, bonusPoints: 30, difficulty: 'hard' },
  { title: 'Self Starter', description: 'Complete 3 custom tasks', type: 'custom_task', targetValue: 3, bonusPoints: 25, difficulty: 'hard' },
  { title: 'Marathon Runner', description: 'Have a 14+ day streak', type: 'streak', targetValue: 14, bonusPoints: 30, difficulty: 'hard' },
  { title: 'Inbox Zero', description: 'Complete all tasks due this week', type: 'clean_sweep', targetValue: 1, bonusPoints: 40, difficulty: 'hard' },
  { title: 'Course Conqueror', description: 'Complete all pending tasks in one course', type: 'course_clear', targetValue: 1, bonusPoints: 30, difficulty: 'hard' },
  { title: 'Daily Doer', description: 'Complete at least 1 task every day for 5 days', type: 'consistency', targetValue: 5, bonusPoints: 35, difficulty: 'hard' },
] as const

export const seedChallengePool = mutation({
  args: {},
  handler: async (ctx) => {
    // Idempotent: skip if already seeded
    const existing = await ctx.db.query('challengePool').first()
    if (existing) return { skipped: true, message: 'Pool already seeded' }

    for (const challenge of CHALLENGE_SEED_DATA) {
      await ctx.db.insert('challengePool', challenge)
    }

    return { seeded: CHALLENGE_SEED_DATA.length }
  },
})

// ─── Generate today's challenges for a user ─────────────────────────────────

export const generateDailyChallenges = mutation({
  args: { supabaseId: v.string(), dateString: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) return

    const today = args.dateString || new Date().toISOString().split('T')[0] // 'YYYY-MM-DD'

    // Idempotent: skip if 3 already exist
    const existing = await ctx.db
      .query('userDailyChallenges')
      .withIndex('by_user_date', (q) => q.eq('userId', user._id).eq('date', today))
      .collect()

    if (existing.length >= 3) return

    // Clear any partial state from an earlier failed attempt
    for (const e of existing) {
      await ctx.db.delete(e._id)
    }

    // Pull the full pool
    const pool = await ctx.db.query('challengePool').collect()
    if (pool.length === 0) return

    // Get challenges shown in last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

    const recentChallenges = await ctx.db
      .query('userDailyChallenges')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .filter((q) => q.gte(q.field('date'), sevenDaysAgoStr))
      .collect()

    const recentChallengeIds = new Set(recentChallenges.map((c) => c.challengeId))

    // Weight challenges - recent ones get lower weight (0.2), fresh ones get full weight (1.0)
    const weighted = pool.map((challenge) => ({
      item: challenge,
      weight: recentChallengeIds.has(challenge._id) ? 0.2 : 1.0,
    }))

    // Select 3 challenges using weighted random sampling
    const selected = weightedRandomSample(weighted, Math.min(3, pool.length))

    for (const challenge of selected) {
      await ctx.db.insert('userDailyChallenges', {
        userId: user._id,
        challengeId: challenge._id,
        date: today,
        progress: 0,
        completed: false,
        bonusAwarded: false,
      })
    }
  },
})

// ─── Query today's challenges with joined pool data ──────────────────────────

export const getDailyChallenges = query({
  args: { supabaseId: v.string(), dateString: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) return []

    const today = args.dateString || new Date().toISOString().split('T')[0]

    const userChallenges = await ctx.db
      .query('userDailyChallenges')
      .withIndex('by_user_date', (q) => q.eq('userId', user._id).eq('date', today))
      .collect()

    // If no challenges exist for today, return empty array
    // (client will call generateDailyChallenges mutation separately)
    if (userChallenges.length === 0) {
      return []
    }

    const result = await Promise.all(
      userChallenges.map(async (uc) => {
        const challenge = await ctx.db.get(uc.challengeId)
        return {
          _id: uc._id,
          challengeId: uc.challengeId,
          date: uc.date,
          progress: uc.progress,
          completed: uc.completed,
          bonusAwarded: uc.bonusAwarded,
          challenge,
        }
      })
    )

    return result.filter((r) => r.challenge !== null)
  },
})

// ─── Recalculate progress for today's challenges ─────────────────────────────

export const updateChallengeProgress = mutation({
  args: { supabaseId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) return

    const today = new Date().toISOString().split('T')[0]
    const todayStart = new Date(today + 'T00:00:00.000Z').getTime()
    const todayEnd = new Date(today + 'T23:59:59.999Z').getTime()

    // Get today's user challenges
    const userChallenges = await ctx.db
      .query('userDailyChallenges')
      .withIndex('by_user_date', (q) => q.eq('userId', user._id).eq('date', today))
      .collect()

    if (userChallenges.length === 0) return

    // ── Gather data needed for progress calculation ──

    // Assignments submitted today
    const allAssignments = await ctx.db
      .query('assignments')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const submittedToday = allAssignments.filter((a) => {
      if (!a.submittedAt) return false
      return a.submittedAt >= today + 'T00:00:00' && a.submittedAt <= today + 'T23:59:59'
    })

    const earlySubmittedToday = submittedToday.filter((a) => {
      if (!a.dueAt || !a.submittedAt) return false
      return (
        new Date(a.dueAt).getTime() - new Date(a.submittedAt).getTime() >=
        24 * 60 * 60 * 1000
      )
    })

    // Points earned today (positive ledger entries only)
    const allLedger = await ctx.db
      .query('pointsLedger')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const pointsToday = allLedger
      .filter(
        (e) =>
          e._creationTime >= todayStart &&
          e._creationTime <= todayEnd &&
          e.delta > 0
      )
      .reduce((sum, e) => sum + e.delta, 0)

    // Custom tasks completed today
    const allCustomTasks = await ctx.db
      .query('customTasks')
      .withIndex('by_user_id', (q) => q.eq('userId', user._id))
      .collect()

    const customTasksToday = allCustomTasks.filter(
      (t) =>
        t.status === 'completed' &&
        t.completedAt &&
        t.completedAt >= today + 'T00:00:00'
    )

    const streakCount = user.streakCount || 0

    // ── Update each challenge ──
    let totalBonusAwarded = 0

    for (const uc of userChallenges) {
      if (uc.bonusAwarded) continue // already done

      const challenge = await ctx.db.get(uc.challengeId)
      if (!challenge) continue

      let progress = 0
      switch (challenge.type) {
        case 'submit_n':
          progress = submittedToday.length
          break
        case 'early_submit':
          progress = earlySubmittedToday.length
          break
        case 'streak':
          progress = streakCount
          break
        case 'points':
          progress = pointsToday
          break
        case 'custom_task':
          progress = customTasksToday.length
          break
      }

      const isCompleted = progress >= challenge.targetValue
      const shouldAwardBonus = isCompleted && !uc.completed

      await ctx.db.patch(uc._id, {
        progress,
        completed: isCompleted,
        bonusAwarded: shouldAwardBonus ? true : uc.bonusAwarded,
      })

      if (shouldAwardBonus) {
        // Award bonus points
        await ctx.db.insert('pointsLedger', {
          userId: user._id,
          delta: challenge.bonusPoints,
          reason: 'daily_challenge',
        })
        await ctx.db.patch(user._id, {
          totalPoints: (user.totalPoints || 0) + challenge.bonusPoints,
        })
        totalBonusAwarded += challenge.bonusPoints
      }
    }

    return { totalBonusAwarded }
  },
})
