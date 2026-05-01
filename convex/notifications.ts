import { mutation, query, internalQuery, internalMutation } from './_generated/server'
import { v } from 'convex/values'

// ─── Push Subscriptions ───────────────────────────────────────────────────────

export const savePushSubscription = mutation({
  args: {
    clerkId: v.string(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .filter((q) => q.eq(q.field('endpoint'), args.endpoint))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        keys: { p256dh: args.p256dh, auth: args.auth },
        createdAt: Date.now(),
      })
    } else {
      await ctx.db.insert('pushSubscriptions', {
        clerkId: args.clerkId,
        endpoint: args.endpoint,
        keys: { p256dh: args.p256dh, auth: args.auth },
        createdAt: Date.now(),
      })
    }
  },
})

export const deletePushSubscription = mutation({
  args: {
    clerkId: v.string(),
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .filter((q) => q.eq(q.field('endpoint'), args.endpoint))
      .first()

    if (existing) {
      await ctx.db.delete(existing._id)
    }
  },
})

// ─── Notification Preferences ─────────────────────────────────────────────────

const DEFAULTS = { pushEnabled: true, emailEnabled: true }

export const getNotificationPreferences = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query('notificationPreferences')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()

    return prefs ?? { ...DEFAULTS, clerkId: args.clerkId }
  },
})

export const updateNotificationPreferences = mutation({
  args: {
    clerkId: v.string(),
    pushEnabled: v.optional(v.boolean()),
    emailEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('notificationPreferences')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.pushEnabled !== undefined && { pushEnabled: args.pushEnabled }),
        ...(args.emailEnabled !== undefined && { emailEnabled: args.emailEnabled }),
      })
    } else {
      await ctx.db.insert('notificationPreferences', {
        clerkId: args.clerkId,
        pushEnabled: args.pushEnabled ?? DEFAULTS.pushEnabled,
        emailEnabled: args.emailEnabled ?? DEFAULTS.emailEnabled,
      })
    }
  },
})

// ─── Last Seen ────────────────────────────────────────────────────────────────

export const updateLastSeen = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()
    if (!user) return
    await ctx.db.patch(user._id, { lastSeenAt: Date.now() })
  },
})

// ─── Internal: subscriptions for a single user ───────────────────────────────

export const getSubscriptionsForUser = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_clerk_id', (q: any) => q.eq('clerkId', args.clerkId))
      .collect()
  },
})

// ─── Internal: tasks due in a time window (with push data pre-loaded) ─────────

export const getRemindableTasks = internalQuery({
  args: { windowStartMs: v.number(), windowEndMs: v.number() },
  handler: async (ctx, { windowStartMs, windowEndMs }) => {
    // Collect all non-completed assignments with a due date in the window
    const allAssignments = await ctx.db.query('assignments').collect()
    const dueAssignments = allAssignments.filter((a: any) => {
      if (a.manuallyCompleted || a.status === 'submitted') return false
      if (!a.dueAt) return false
      const t = new Date(a.dueAt).getTime()
      return t >= windowStartMs && t <= windowEndMs
    })

    // Collect all non-completed custom tasks with a due date in the window
    const allCustom = await ctx.db.query('customTasks').collect()
    const dueCustom = allCustom.filter((t: any) => {
      if (t.status === 'completed') return false
      if (!t.dueAt) return false
      const ms = new Date(t.dueAt).getTime()
      return ms >= windowStartMs && ms <= windowEndMs
    })

    // Collect user data keyed by userId string (push prefs + subscriptions)
    const userIdSet = new Set<string>([
      ...dueAssignments.map((a: any) => a.userId.toString()),
      ...dueCustom.map((t: any) => t.userId.toString()),
    ])

    const userDataMap = new Map<string, { clerkId: string; subs: { endpoint: string; keys: { p256dh: string; auth: string } }[] }>()

    for (const userId of userIdSet) {
      const user = await ctx.db.get(userId as any)
      if (!user || !(user as any).clerkId) continue

      const clerkId: string = (user as any).clerkId

      const prefs = await ctx.db
        .query('notificationPreferences')
        .withIndex('by_clerk_id', (q: any) => q.eq('clerkId', clerkId))
        .first()
      // Default: push enabled. Skip only if explicitly disabled.
      if (prefs !== null && prefs !== undefined && prefs.pushEnabled === false) continue

      const subs = await ctx.db
        .query('pushSubscriptions')
        .withIndex('by_clerk_id', (q: any) => q.eq('clerkId', clerkId))
        .collect()
      if (subs.length === 0) continue

      userDataMap.set(userId, {
        clerkId,
        subs: subs.map((s: any) => ({ endpoint: s.endpoint, keys: s.keys })),
      })
    }

    const result: { taskId: string; title: string; clerkId: string; subscriptions: { endpoint: string; keys: { p256dh: string; auth: string } }[] }[] = []

    for (const a of dueAssignments) {
      const userData = userDataMap.get(a.userId.toString())
      if (!userData) continue
      result.push({ taskId: a._id.toString(), title: a.title, clerkId: userData.clerkId, subscriptions: userData.subs })
    }
    for (const t of dueCustom) {
      const userData = userDataMap.get(t.userId.toString())
      if (!userData) continue
      result.push({ taskId: t._id.toString(), title: t.title, clerkId: userData.clerkId, subscriptions: userData.subs })
    }

    return result
  },
})

// ─── Internal: notification dedup log ────────────────────────────────────────

export const getNotificationLogEntry = internalQuery({
  args: { clerkId: v.string(), taskId: v.string(), type: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('notificationLog')
      .withIndex('by_clerk_task_type', (q: any) =>
        q.eq('clerkId', args.clerkId).eq('taskId', args.taskId).eq('type', args.type)
      )
      .first()
  },
})

export const upsertNotificationLog = internalMutation({
  args: { clerkId: v.string(), taskId: v.string(), type: v.string(), sentAt: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('notificationLog')
      .withIndex('by_clerk_task_type', (q: any) =>
        q.eq('clerkId', args.clerkId).eq('taskId', args.taskId).eq('type', args.type)
      )
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { sentAt: args.sentAt })
    } else {
      await ctx.db.insert('notificationLog', {
        clerkId: args.clerkId,
        taskId: args.taskId,
        type: args.type,
        sentAt: args.sentAt,
      })
    }
  },
})

// ─── Internal: streak-at-risk users ──────────────────────────────────────────

export const getStreakAtRiskUsers = internalQuery({
  handler: async (ctx) => {
    const nowMs = Date.now()
    const min = nowMs - 24 * 3600 * 1000 // 24hrs ago
    const max = nowMs - 23 * 3600 * 1000 // 23hrs ago

    const allUsers = await ctx.db.query('users').collect()
    const atRisk = allUsers.filter((u: any) => {
      if (!u.lastSeenAt) return false
      return u.lastSeenAt >= min && u.lastSeenAt <= max
    })

    const result = []
    for (const user of atRisk) {
      if (!user.clerkId) continue

      const prefs = await ctx.db
        .query('notificationPreferences')
        .withIndex('by_clerk_id', (q: any) => q.eq('clerkId', user.clerkId))
        .first()
      if (prefs !== null && prefs !== undefined && prefs.pushEnabled === false) continue

      const subs = await ctx.db
        .query('pushSubscriptions')
        .withIndex('by_clerk_id', (q: any) => q.eq('clerkId', user.clerkId))
        .collect()
      if (subs.length === 0) continue

      result.push({
        clerkId: user.clerkId as string,
        streakCount: (user.streakCount ?? 0) as number,
        subscriptions: subs.map((s: any) => ({ endpoint: s.endpoint, keys: s.keys })),
      })
    }
    return result
  },
})

// ─── Internal: weekly digest data ────────────────────────────────────────────

export const getWeeklyDigestData = internalQuery({
  handler: async (ctx) => {
    const nowMs = Date.now()
    const oneWeekAgo = nowMs - 7 * 24 * 3600 * 1000

    // Only users who opted into email
    const emailPrefs = await ctx.db
      .query('notificationPreferences')
      .filter((q: any) => q.eq(q.field('emailEnabled'), true))
      .collect()

    const results = []

    for (const pref of emailPrefs) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q: any) => q.eq('clerkId', pref.clerkId))
        .first()
      if (!user || !(user as any).email) continue

      const userId = user._id

      // Upcoming assignments — next 3 by dueAt
      const assignments = await ctx.db
        .query('assignments')
        .withIndex('by_user', (q: any) => q.eq('userId', userId))
        .collect()

      const upcoming = await Promise.all(
        assignments
          .filter((a: any) => !a.manuallyCompleted && a.status !== 'submitted' && a.dueAt && new Date(a.dueAt).getTime() > nowMs)
          .sort((a: any, b: any) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
          .slice(0, 3)
          .map(async (a: any) => {
            const course = await ctx.db.get(a.courseId)
            return {
              title: a.title,
              courseName: (course as any)?.name ?? (course as any)?.courseCode ?? 'Canvas',
              dueAt: a.dueAt as string,
            }
          })
      )

      // On-time completions in last 7 days (assignments + custom tasks)
      const recentAssignments = assignments.filter(
        (a: any) => a.manuallyCompleted && a.insightsSubmittedAt && a.insightsSubmittedAt >= oneWeekAgo
      )
      const onTimeAssignments = recentAssignments.filter(
        (a: any) => !a.dueAt || a.insightsSubmittedAt <= new Date(a.dueAt).getTime()
      ).length

      const customTasks = await ctx.db
        .query('customTasks')
        .withIndex('by_user_id', (q: any) => q.eq('userId', userId))
        .collect()
      const recentCustom = customTasks.filter(
        (t: any) => t.status === 'completed' && t.submittedAt && t.submittedAt >= oneWeekAgo
      )
      const onTimeCustom = recentCustom.filter(
        (t: any) => !t.dueAt || t.submittedAt <= new Date(t.dueAt).getTime()
      ).length

      const totalCompleted = recentAssignments.length + recentCustom.length
      const totalOnTime = onTimeAssignments + onTimeCustom

      // Leaderboard rank (first leaderboard the user is in)
      let leaderboardRank: number | null = null
      const memberships = await ctx.db
        .query('leaderboardMembers')
        .withIndex('by_user', (q: any) => q.eq('userId', userId))
        .collect()
      if (memberships.length > 0) {
        const boardMembers = await ctx.db
          .query('leaderboardMembers')
          .withIndex('by_leaderboard', (q: any) => q.eq('leaderboardId', memberships[0].leaderboardId))
          .collect()
        const memberUsers = await Promise.all(boardMembers.map((m: any) => ctx.db.get(m.userId)))
        const ranked = memberUsers
          .filter(Boolean)
          .sort((a: any, b: any) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0))
        const idx = ranked.findIndex((u: any) => u._id === userId)
        leaderboardRank = idx >= 0 ? idx + 1 : null
      }

      results.push({
        clerkId: pref.clerkId,
        email: (user as any).email as string,
        displayName: ((user as any).displayName ?? 'Student') as string,
        streakCount: ((user as any).streakCount ?? 0) as number,
        leaderboardRank,
        upcoming,
        onTimeCount: totalOnTime,
        totalCount: totalCompleted,
      })
    }

    return results
  },
})

