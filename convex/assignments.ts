import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// Get assignment by Canvas ID
export const getAssignmentByCanvasId = query({
  args: { userId: v.id('users'), canvasAssignmentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('assignments')
      .withIndex('by_user_and_canvas_id', (q) =>
        q.eq('userId', args.userId).eq('canvasAssignmentId', args.canvasAssignmentId)
      )
      .first()
  },
})

// Get all assignments for a user
export const getAllAssignments = query({
  args: {
    userId: v.id('users'),
    includeSubmittedSince: v.optional(v.string()), // ISO timestamp
  },
  handler: async (ctx, args) => {
    const allAssignments = await ctx.db
      .query('assignments')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()

    // Filter: pending OR submitted after date
    return allAssignments.filter((a) => {
      if (a.status === 'pending') return true
      if (a.submittedAt && args.includeSubmittedSince) {
        return a.submittedAt >= args.includeSubmittedSince
      }
      return false
    })
  },
})

// Get assignments with course info
export const getAssignmentsWithCourseInfo = query({
  args: {
    userId: v.id('users'),
    includeSubmittedSince: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query('assignments')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()

    // Get all unique course IDs
    const courseIds = [...new Set(assignments.map((a) => a.courseId))]

    // Fetch courses
    const courses = await Promise.all(courseIds.map((id) => ctx.db.get(id)))

    // Build course map
    const courseMap = new Map()
    courses.forEach((course) => {
      if (course) {
        courseMap.set(course._id, course)
      }
    })

    // Join and filter
    const joined = assignments
      .map((a) => {
        const course = courseMap.get(a.courseId)
        return {
          ...a,
          courseName: course?.name || '',
          courseCode: course?.courseCode || '',
          isUrgent: a.isUrgent ?? false,
          urgentOrder: a.urgentOrder,
        }
      })
      .filter((a) => {
        if (a.status === 'pending') return true
        if (a.submittedAt && args.includeSubmittedSince) {
          return a.submittedAt >= args.includeSubmittedSince
        }
        return false
      })

    return joined
  },
})

// Real-time query for dashboard (using supabaseId parameter naming)
export const getAssignmentsBySupabaseId = query({
  args: {
    supabaseId: v.string(),
    includeSubmittedSince: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find user by Supabase ID
    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.supabaseId))
      .first()

    if (!user) return []

    // Get assignments for this user
    const assignments = await ctx.db
      .query('assignments')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    // Get all unique course IDs
    const courseIds = [...new Set(assignments.map((a) => a.courseId))]

    // Fetch courses
    const courses = await Promise.all(courseIds.map((id) => ctx.db.get(id)))

    // Build course map
    const courseMap = new Map()
    courses.forEach((course) => {
      if (course) {
        courseMap.set(course._id, course)
      }
    })

    // Join and filter
    const joined = assignments
      .map((a) => {
        const course = courseMap.get(a.courseId)
        return {
          ...a,
          courseName: course?.name || '',
          courseCode: course?.courseCode || '',
          isUrgent: a.isUrgent ?? false,
          urgentOrder: a.urgentOrder,
        }
      })
      .filter((a) => {
        if (a.status === 'pending') return true
        if (a.submittedAt && args.includeSubmittedSince) {
          return a.submittedAt >= args.includeSubmittedSince
        }
        return false
      })

    return joined
  },
})

// Upsert assignment (create or update)
export const upsertAssignment = mutation({
  args: {
    userId: v.id('users'),
    courseId: v.id('courses'),
    canvasAssignmentId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    dueAt: v.optional(v.string()),
    pointsPossible: v.number(),
    status: v.union(v.literal('pending'), v.literal('submitted'), v.literal('missing')),
    submittedAt: v.optional(v.string()),
    canvasCourseId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('assignments')
      .withIndex('by_user_and_canvas_id', (q) =>
        q.eq('userId', args.userId).eq('canvasAssignmentId', args.canvasAssignmentId)
      )
      .first()

    const data = {
      title: args.title,
      description: args.description,
      dueAt: args.dueAt,
      pointsPossible: args.pointsPossible,
      status: args.status,
      submittedAt: args.submittedAt,
      canvasCourseId: args.canvasCourseId,
    }

    if (existing) {
      await ctx.db.patch(existing._id, data)
      return existing
    }

    const id = await ctx.db.insert('assignments', {
      userId: args.userId,
      courseId: args.courseId,
      canvasAssignmentId: args.canvasAssignmentId,
      ...data,
    })

    return await ctx.db.get(id)
  },
})

// Uncomplete a manually completed assignment
export const unCompleteAssignment = mutation({
  args: {
    assignmentId: v.id('assignments'),
    supabaseId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the user
    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.supabaseId))
      .first()

    if (!user) throw new Error('User not found')

    // Get the assignment
    const assignment = await ctx.db.get(args.assignmentId)
    if (!assignment) throw new Error('Assignment not found')

    // Verify ownership
    if (assignment.userId !== user._id) {
      throw new Error('Assignment does not belong to user')
    }

    // Only allow uncompleting manually completed assignments
    if (!assignment.manuallyCompleted) {
      throw new Error('Cannot untick assignments submitted on Canvas')
    }

    // Note: We don't check status here because Canvas sync might have updated
    // the status to 'missing' after the user manually completed it

    // Find all points ledger entries for this assignment and calculate total
    const ledgerEntries = await ctx.db
      .query('pointsLedger')
      .withIndex('by_assignment', (q) => q.eq('assignmentId', args.assignmentId))
      .collect()

    const pointsToRemove = ledgerEntries.reduce((sum, entry) => sum + entry.delta, 0)

    // Delete all ledger entries
    await Promise.all(ledgerEntries.map((entry) => ctx.db.delete(entry._id)))

    // Update user's total points
    await ctx.db.patch(user._id, {
      totalPoints: Math.max(0, (user.totalPoints || 0) - pointsToRemove),
    })

    // Reset assignment to pending
    await ctx.db.patch(args.assignmentId, {
      status: 'pending',
      manuallyCompleted: false,
      submittedAt: undefined,
    })

    return {
      pointsRemoved: pointsToRemove,
    }
  },
})

// Manually complete an assignment (manual tick-off)
export const manuallyCompleteAssignment = mutation({
  args: {
    assignmentId: v.id('assignments'),
    supabaseId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the user
    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.supabaseId))
      .first()

    if (!user) throw new Error('User not found')

    // Get the assignment
    const assignment = await ctx.db.get(args.assignmentId)
    if (!assignment) throw new Error('Assignment not found')

    // Verify ownership
    if (assignment.userId !== user._id) {
      throw new Error('Assignment does not belong to user')
    }

    // Don't allow completing already completed assignments
    if (assignment.status === 'submitted') {
      throw new Error('Assignment is already submitted')
    }

    const now = new Date()
    const submittedAt = now.toISOString()

    // Calculate points based on due date
    let basePoints = 10
    let reason = 'on_time'

    if (assignment.dueAt) {
      const dueDate = new Date(assignment.dueAt)
      const hoursDiff = (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60)

      if (hoursDiff < -24) {
        // More than 24 hours early
        basePoints = 15
        reason = 'early_submission'
      } else if (hoursDiff <= 0) {
        // On time (within 24 hours of due date or before)
        basePoints = 10
        reason = 'on_time'
      } else {
        // Late
        basePoints = 5
        reason = 'late_submission'
      }
    }

    // Update streak
    const today = new Date().toISOString().split('T')[0]
    const lastActivityDate = user.lastActivityDate

    let newStreak = 1
    if (lastActivityDate) {
      const lastDate = new Date(lastActivityDate)
      const todayDate = new Date(today)
      const daysDiff = Math.floor(
        (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysDiff === 0) {
        // Same day, keep current streak
        newStreak = user.streakCount || 1
      } else if (daysDiff === 1) {
        // Consecutive day, increment streak
        newStreak = (user.streakCount || 0) + 1
      } else {
        // Streak broken, reset to 1
        newStreak = 1
      }
    }

    // Calculate streak bonus
    const streakBonus = newStreak >= 3 ? 5 : 0

    // Update assignment status
    await ctx.db.patch(args.assignmentId, {
      status: 'submitted',
      submittedAt,
      manuallyCompleted: true,
    })

    // Add base points to ledger
    await ctx.db.insert('pointsLedger', {
      userId: user._id,
      assignmentId: args.assignmentId,
      delta: basePoints,
      reason,
    })

    // Add streak bonus if applicable
    if (streakBonus > 0) {
      await ctx.db.insert('pointsLedger', {
        userId: user._id,
        assignmentId: args.assignmentId,
        delta: streakBonus,
        reason: 'streak_bonus',
      })
    }

    // Update user stats
    await ctx.db.patch(user._id, {
      totalPoints: (user.totalPoints || 0) + basePoints + streakBonus,
      streakCount: newStreak,
      longestStreak: Math.max(newStreak, user.longestStreak || 0),
      lastActivityDate: today,
    })

    return {
      pointsAwarded: basePoints + streakBonus,
      reason,
      assignment: await ctx.db.get(args.assignmentId),
    }
  },
})

// Get ALL assignments with course info for schedule (no filtering by status)
export const getAssignmentsForSchedule = query({
  args: {
    supabaseId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by Supabase ID
    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.supabaseId))
      .first()

    if (!user) return []

    // Get ALL assignments for this user (no status filtering)
    const assignments = await ctx.db
      .query('assignments')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    // Get all unique course IDs
    const courseIds = [...new Set(assignments.map((a) => a.courseId))]

    // Fetch courses
    const courses = await Promise.all(courseIds.map((id) => ctx.db.get(id)))

    // Build course map
    const courseMap = new Map()
    courses.forEach((course) => {
      if (course) {
        courseMap.set(course._id, course)
      }
    })

    // Join with course info (no filtering)
    const joined = assignments.map((a) => {
      const course = courseMap.get(a.courseId)
      return {
        ...a,
        courseName: course?.name || '',
        courseCode: course?.courseCode || '',
        isUrgent: a.isUrgent ?? false,
      }
    })

    return joined
  },
})

// Toggle urgent status of an assignment
export const toggleUrgent = mutation({
  args: {
    assignmentId: v.id('assignments'),
    supabaseId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the user
    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.supabaseId))
      .first()

    if (!user) throw new Error('User not found')

    // Get the assignment
    const assignment = await ctx.db.get(args.assignmentId)
    if (!assignment) throw new Error('Assignment not found')

    // Verify ownership
    if (assignment.userId !== user._id) {
      throw new Error('Assignment does not belong to user')
    }

    const isCurrentlyUrgent = assignment.isUrgent || false
    const newUrgentStatus = !isCurrentlyUrgent

    // If marking as urgent, set urgentOrder to current timestamp (end of list)
    // If unmarking, clear urgentOrder
    await ctx.db.patch(args.assignmentId, {
      isUrgent: newUrgentStatus,
      urgentOrder: newUrgentStatus ? Date.now() : undefined,
    })

    return {
      isUrgent: newUrgentStatus,
    }
  },
})

// Get all urgent assignments for a user (sorted by urgentOrder)
export const getUrgentAssignments = query({
  args: {
    supabaseId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by Supabase ID
    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.supabaseId))
      .first()

    if (!user) return []

    // Get all urgent assignments
    const urgentAssignments = await ctx.db
      .query('assignments')
      .withIndex('by_user_and_urgent', (q) =>
        q.eq('userId', user._id).eq('isUrgent', true)
      )
      .collect()

    // Get course info for each assignment
    const courseIds = [...new Set(urgentAssignments.map((a) => a.courseId))]
    const courses = await Promise.all(courseIds.map((id) => ctx.db.get(id)))
    const courseMap = new Map()
    courses.forEach((course) => {
      if (course) {
        courseMap.set(course._id, course)
      }
    })

    // Join and sort by urgentOrder
    const joined = urgentAssignments
      .map((a) => {
        const course = courseMap.get(a.courseId)
        return {
          ...a,
          courseName: course?.name || '',
          courseCode: course?.courseCode || '',
        }
      })
      .sort((a, b) => (a.urgentOrder || 0) - (b.urgentOrder || 0))

    return joined
  },
})

// Reorder urgent assignments (for drag-drop)
export const reorderUrgentAssignments = mutation({
  args: {
    supabaseId: v.string(),
    assignmentIds: v.array(v.id('assignments')), // Ordered array of assignment IDs
  },
  handler: async (ctx, args) => {
    // Get the user
    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.supabaseId))
      .first()

    if (!user) throw new Error('User not found')

    // Update urgentOrder for each assignment based on position in array
    await Promise.all(
      args.assignmentIds.map((assignmentId, index) =>
        ctx.db.patch(assignmentId, {
          urgentOrder: index,
        })
      )
    )

    return { success: true }
  },
})
