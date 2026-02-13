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
