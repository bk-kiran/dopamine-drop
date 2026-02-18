import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// Helper: get user by supabase ID
async function getUserBySupabaseId(ctx: any, supabaseId: string) {
  return await ctx.db
    .query('users')
    .withIndex('by_auth_user_id', (q: any) => q.eq('authUserId', supabaseId))
    .first()
}

// Helper: update streak (with shield protection and milestone awards)
async function updateStreak(ctx: any, user: any): Promise<{ newStreak: number; shieldUsed: boolean; protectedStreak: number | null }> {
  const today = new Date().toISOString().split('T')[0]
  const lastActivity = user.lastActivityDate
  let currentShields = user.streakShields ?? 0

  let newStreak = user.streakCount || 0
  let shieldUsed = false

  if (!lastActivity) {
    newStreak = 1
  } else if (lastActivity === today) {
    // Already updated today — no change, no shield consumed
    return { newStreak, shieldUsed: false, protectedStreak: null }
  } else {
    const lastDate = new Date(lastActivity)
    const todayDate = new Date(today)
    const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      newStreak = (user.streakCount || 0) + 1
    } else {
      // Missed day(s) — consume shield or reset
      if (currentShields > 0) {
        currentShields -= 1
        newStreak = user.streakCount || 1
        shieldUsed = true
        await ctx.db.insert('pointsLedger', {
          userId: user._id,
          delta: 0,
          reason: 'shield_used',
        })
      } else {
        newStreak = 1
      }
    }
  }

  // Milestone shield awards (7, 14, 30 — once each)
  const shieldMilestones = [
    { streak: 7,  reason: 'shield_milestone_7' },
    { streak: 14, reason: 'shield_milestone_14' },
    { streak: 30, reason: 'shield_milestone_30' },
  ]
  const userLedger = await ctx.db
    .query('pointsLedger')
    .withIndex('by_user', (q: any) => q.eq('userId', user._id))
    .collect()

  for (const milestone of shieldMilestones) {
    if (newStreak === milestone.streak) {
      const alreadyAwarded = userLedger.some((e: any) => e.reason === milestone.reason)
      if (!alreadyAwarded && currentShields < 3) {
        currentShields = Math.min(3, currentShields + 1)
        await ctx.db.insert('pointsLedger', {
          userId: user._id,
          delta: 0,
          reason: milestone.reason,
        })
      }
    }
  }

  const longestStreak = Math.max(newStreak, user.longestStreak || 0)

  await ctx.db.patch(user._id, {
    streakCount: newStreak,
    longestStreak,
    lastActivityDate: today,
    streakShields: Math.max(0, currentShields),
  })

  return { newStreak, shieldUsed, protectedStreak: shieldUsed ? newStreak : null }
}

// Get all custom tasks for a user
export const getCustomTasks = query({
  args: { supabaseId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) return []

    const tasks = await ctx.db
      .query('customTasks')
      .withIndex('by_user_id', (q: any) => q.eq('userId', user._id))
      .collect()

    // Sort: pending first by dueAt, then completed by completedAt desc
    return tasks.sort((a: any, b: any) => {
      if (a.status === 'pending' && b.status === 'completed') return -1
      if (a.status === 'completed' && b.status === 'pending') return 1

      if (a.status === 'pending' && b.status === 'pending') {
        if (!a.dueAt) return 1
        if (!b.dueAt) return -1
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
      }

      if (a.status === 'completed' && b.status === 'completed') {
        if (!a.completedAt) return 1
        if (!b.completedAt) return -1
        return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      }

      return 0
    })
  },
})

// Get urgent custom tasks
export const getUrgentCustomTasks = query({
  args: { supabaseId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) return []

    const tasks = await ctx.db
      .query('customTasks')
      .withIndex('by_user_id', (q: any) => q.eq('userId', user._id))
      .collect()

    return tasks
      .filter((t: any) => t.isUrgent === true && t.status === 'pending')
      .sort((a: any, b: any) => {
        if (a.urgentOrder !== undefined && b.urgentOrder !== undefined) {
          return a.urgentOrder - b.urgentOrder
        }
        return 0
      })
  },
})

// Create a new custom task
export const createCustomTask = mutation({
  args: {
    supabaseId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.union(
      v.literal('academic'),
      v.literal('club'),
      v.literal('work'),
      v.literal('personal')
    ),
    pointsValue: v.float64(),
    dueAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) throw new Error('User not found')

    const taskId = await ctx.db.insert('customTasks', {
      userId: user._id,
      title: args.title,
      description: args.description,
      category: args.category,
      pointsValue: args.pointsValue,
      dueAt: args.dueAt,
      status: 'pending',
    })

    return taskId
  },
})

// Update a custom task
export const updateCustomTask = mutation({
  args: {
    taskId: v.id('customTasks'),
    supabaseId: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(
      v.union(
        v.literal('academic'),
        v.literal('club'),
        v.literal('work'),
        v.literal('personal')
      )
    ),
    pointsValue: v.optional(v.float64()),
    dueAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) throw new Error('User not found')

    const task = await ctx.db.get(args.taskId)
    if (!task || task.userId !== user._id) throw new Error('Task not found')

    const updates: any = {}
    if (args.title !== undefined) updates.title = args.title
    if (args.description !== undefined) updates.description = args.description
    if (args.category !== undefined) updates.category = args.category
    if (args.pointsValue !== undefined) updates.pointsValue = args.pointsValue
    if (args.dueAt !== undefined) updates.dueAt = args.dueAt

    await ctx.db.patch(args.taskId, updates)
    return args.taskId
  },
})

// Complete a custom task (awards exact pointsValue, updates streak)
export const completeCustomTask = mutation({
  args: {
    taskId: v.id('customTasks'),
    supabaseId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) throw new Error('User not found')

    const task = await ctx.db.get(args.taskId)
    if (!task || task.userId !== user._id) throw new Error('Task not found')
    if (task.status === 'completed') throw new Error('Task already completed')

    const now = new Date().toISOString()

    // Mark task as completed
    await ctx.db.patch(args.taskId, {
      status: 'completed',
      completedAt: now,
      isUrgent: false,
    })

    // Check 2x XP multiplier day
    const todayDayStr = String(new Date().getDay()) // '0'=Sun … '6'=Sat
    const multiplierActive = !!user.xpMultiplierDay && user.xpMultiplierDay === todayDayStr

    // Award exact points (no early/late calculation), doubled if multiplier active
    const basePoints = task.pointsValue
    const pointsToAward = multiplierActive ? basePoints * 2 : basePoints
    const reasonStr = multiplierActive ? 'custom_task (2x Multiplier!)' : 'custom_task'

    await ctx.db.insert('pointsLedger', {
      userId: user._id,
      customTaskId: args.taskId,
      delta: pointsToAward,
      reason: reasonStr,
    })

    await ctx.db.patch(user._id, {
      totalPoints: (user.totalPoints || 0) + pointsToAward,
    })

    // Update streak
    const streakResult = await updateStreak(ctx, user)

    return {
      pointsAwarded: pointsToAward,
      multiplierActive,
      shieldUsed: streakResult.shieldUsed,
      protectedStreak: streakResult.protectedStreak,
    }
  },
})

// Uncomplete a custom task (removes points, resets status)
export const uncompleteCustomTask = mutation({
  args: {
    taskId: v.id('customTasks'),
    supabaseId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) throw new Error('User not found')

    const task = await ctx.db.get(args.taskId)
    if (!task || task.userId !== user._id) throw new Error('Task not found')
    if (task.status === 'pending') throw new Error('Task is not completed')

    // Find and remove ledger entries for this custom task
    const ledgerEntries = await ctx.db
      .query('pointsLedger')
      .withIndex('by_custom_task', (q: any) => q.eq('customTaskId', args.taskId))
      .collect()

    const pointsToRemove = ledgerEntries.reduce((sum: number, e: any) => sum + e.delta, 0)

    await Promise.all(ledgerEntries.map((e: any) => ctx.db.delete(e._id)))

    // Update user total points
    await ctx.db.patch(user._id, {
      totalPoints: Math.max(0, (user.totalPoints || 0) - pointsToRemove),
    })

    // Reset task status
    await ctx.db.patch(args.taskId, {
      status: 'pending',
      completedAt: undefined,
    })

    return { pointsRemoved: pointsToRemove }
  },
})

// Delete a custom task
export const deleteCustomTask = mutation({
  args: {
    taskId: v.id('customTasks'),
    supabaseId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) throw new Error('User not found')

    const task = await ctx.db.get(args.taskId)
    if (!task || task.userId !== user._id) throw new Error('Task not found')

    // If task was completed, remove points first
    if (task.status === 'completed') {
      const ledgerEntries = await ctx.db
        .query('pointsLedger')
        .withIndex('by_custom_task', (q: any) => q.eq('customTaskId', args.taskId))
        .collect()

      const pointsToRemove = ledgerEntries.reduce((sum: number, e: any) => sum + e.delta, 0)

      await Promise.all(ledgerEntries.map((e: any) => ctx.db.delete(e._id)))

      if (pointsToRemove > 0) {
        await ctx.db.patch(user._id, {
          totalPoints: Math.max(0, (user.totalPoints || 0) - pointsToRemove),
        })
      }
    }

    await ctx.db.delete(args.taskId)
    return { success: true }
  },
})

// Update personal notes on a custom task
export const updateCustomTaskNotes = mutation({
  args: {
    taskId: v.id('customTasks'),
    supabaseId: v.string(),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) throw new Error('User not found')

    const task = await ctx.db.get(args.taskId)
    if (!task || task.userId !== user._id) throw new Error('Task not found')

    await ctx.db.patch(args.taskId, { userNotes: args.notes })
    return { success: true }
  },
})

// Toggle urgent status on a custom task
export const toggleUrgentCustomTask = mutation({
  args: {
    taskId: v.id('customTasks'),
    supabaseId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) throw new Error('User not found')

    const task = await ctx.db.get(args.taskId)
    if (!task || task.userId !== user._id) throw new Error('Task not found')

    const newUrgent = !task.isUrgent

    await ctx.db.patch(args.taskId, {
      isUrgent: newUrgent,
      urgentOrder: newUrgent ? Date.now() : undefined,
    })

    return { isUrgent: newUrgent }
  },
})
