import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// Helper: get user by Supabase ID
async function getUserBySupabaseId(ctx: any, supabaseId: string) {
  return await ctx.db
    .query('users')
    .withIndex('by_auth_user_id', (q: any) => q.eq('authUserId', supabaseId))
    .first()
}

// Fisher-Yates shuffle with LCG seeded random — picks first n items
function seededSelectN<T>(items: T[], n: number, seed: number): T[] {
  const arr = [...items]
  let s = ((seed | 0) >>> 0) || 1 // ensure non-zero unsigned 32-bit int
  for (let i = arr.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    const j = s % (i + 1)
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
  }
  return arr.slice(0, n)
}

// ─── Seed the challenge pool ────────────────────────────────────────────────

const CHALLENGE_SEED_DATA = [
  // Easy
  { title: 'Submit 1 assignment today', description: 'Submit or tick off any assignment.', type: 'submit_n', targetValue: 1, bonusPoints: 5, difficulty: 'easy' },
  { title: 'Keep your streak alive', description: 'Make sure your daily streak is active.', type: 'streak', targetValue: 1, bonusPoints: 5, difficulty: 'easy' },
  { title: 'Complete 1 custom task', description: 'Tick off any task from your My Tasks list.', type: 'custom_task', targetValue: 1, bonusPoints: 8, difficulty: 'easy' },
  { title: 'Earn 10 points today', description: 'Collect at least 10 points in a single day.', type: 'points', targetValue: 10, bonusPoints: 8, difficulty: 'easy' },
  { title: 'Submit an assignment early', description: 'Submit any assignment before its deadline.', type: 'early_submit', targetValue: 1, bonusPoints: 10, difficulty: 'easy' },
  { title: 'Earn 15 points today', description: 'Collect at least 15 points today.', type: 'points', targetValue: 15, bonusPoints: 8, difficulty: 'easy' },
  { title: 'Maintain a 2-day streak', description: 'Keep your streak going for 2 days.', type: 'streak', targetValue: 2, bonusPoints: 8, difficulty: 'easy' },
  // Medium
  { title: 'Submit 2 assignments today', description: 'Complete two assignments in one day.', type: 'submit_n', targetValue: 2, bonusPoints: 15, difficulty: 'medium' },
  { title: 'Earn 20 points today', description: 'Rack up 20 points before midnight.', type: 'points', targetValue: 20, bonusPoints: 15, difficulty: 'medium' },
  { title: 'Complete 2 custom tasks', description: 'Knock out two tasks from your list.', type: 'custom_task', targetValue: 2, bonusPoints: 15, difficulty: 'medium' },
  { title: 'Maintain a 3-day streak', description: 'Keep the momentum with a 3-day streak.', type: 'streak', targetValue: 3, bonusPoints: 15, difficulty: 'medium' },
  { title: 'Earn 25 points today', description: 'Push yourself to 25 points today.', type: 'points', targetValue: 25, bonusPoints: 20, difficulty: 'medium' },
  { title: 'Submit 3 assignments today', description: 'A productive day — three submissions!', type: 'submit_n', targetValue: 3, bonusPoints: 20, difficulty: 'medium' },
  { title: 'Submit an assignment 24hrs early', description: 'Turn something in a full day before it is due.', type: 'early_submit', targetValue: 1, bonusPoints: 20, difficulty: 'medium' },
  // Hard
  { title: 'Submit 4 assignments today', description: 'Four submissions in a single day — champion!', type: 'submit_n', targetValue: 4, bonusPoints: 25, difficulty: 'hard' },
  { title: 'Earn 30 points today', description: 'Crush it — earn 30 points before the day ends.', type: 'points', targetValue: 30, bonusPoints: 25, difficulty: 'hard' },
  { title: 'Complete 4 custom tasks', description: 'Clear four personal tasks today.', type: 'custom_task', targetValue: 4, bonusPoints: 25, difficulty: 'hard' },
  { title: 'Maintain a 7-day streak', description: 'One full week without breaking the chain.', type: 'streak', targetValue: 7, bonusPoints: 30, difficulty: 'hard' },
  { title: 'Submit 2 assignments early', description: 'Get ahead — two early submissions today.', type: 'early_submit', targetValue: 2, bonusPoints: 30, difficulty: 'hard' },
  { title: 'Earn 50 points today', description: 'The ultimate grind — 50 points in one day.', type: 'points', targetValue: 50, bonusPoints: 35, difficulty: 'hard' },
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
  args: { supabaseId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) return

    const today = new Date().toISOString().split('T')[0] // 'YYYY-MM-DD'

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

    // Derive a repeatable seed from userId + date
    const userSeed = user._id
      .split('')
      .reduce((acc: number, c: string) => (acc * 31 + c.charCodeAt(0)) | 0, 0)
    const dateSeed = parseInt(today.replace(/-/g, ''), 10)
    const seed = (Math.abs(userSeed) ^ dateSeed) >>> 0

    const selected = seededSelectN(pool, Math.min(3, pool.length), seed)

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
  args: { supabaseId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) return []

    const today = new Date().toISOString().split('T')[0]

    const userChallenges = await ctx.db
      .query('userDailyChallenges')
      .withIndex('by_user_date', (q) => q.eq('userId', user._id).eq('date', today))
      .collect()

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
