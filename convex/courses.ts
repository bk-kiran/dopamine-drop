import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// Get course by Canvas ID
export const getCourseByCanvasId = query({
  args: { userId: v.id('users'), canvasCourseId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('courses')
      .withIndex('by_user_and_canvas_id', (q) =>
        q.eq('userId', args.userId).eq('canvasCourseId', args.canvasCourseId)
      )
      .first()
  },
})

// Get all courses for a user
export const getAllCourses = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('courses')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()
  },
})

// Real-time query for dashboard (using supabaseId parameter naming)
export const getCoursesBySupabaseId = query({
  args: { supabaseId: v.string() },
  handler: async (ctx, args) => {
    // Find user by Supabase ID
    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.supabaseId))
      .first()

    if (!user) return []

    return await ctx.db
      .query('courses')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
  },
})

// Upsert course (create or update)
export const upsertCourse = mutation({
  args: {
    userId: v.id('users'),
    canvasCourseId: v.string(),
    name: v.string(),
    courseCode: v.string(),
    currentGrade: v.optional(v.float64()),
    currentScore: v.optional(v.float64()),
    finalGrade: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('courses')
      .withIndex('by_user_and_canvas_id', (q) =>
        q.eq('userId', args.userId).eq('canvasCourseId', args.canvasCourseId)
      )
      .first()

    const gradeFields: any = {}
    if (args.currentGrade !== undefined) gradeFields.currentGrade = args.currentGrade
    if (args.currentScore !== undefined) gradeFields.currentScore = args.currentScore
    if (args.finalGrade !== undefined) gradeFields.finalGrade = args.finalGrade

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        courseCode: args.courseCode,
        ...gradeFields,
      })
      return existing._id
    }

    return await ctx.db.insert('courses', {
      userId: args.userId,
      canvasCourseId: args.canvasCourseId,
      name: args.name,
      courseCode: args.courseCode,
      ...gradeFields,
    })
  },
})

// Get all assignments for a course (for grades page)
export const getAssignmentsForGrades = query({
  args: { supabaseId: v.string(), canvasCourseId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.supabaseId))
      .first()
    if (!user) return []

    const course = await ctx.db
      .query('courses')
      .withIndex('by_user_and_canvas_id', (q) =>
        q.eq('userId', user._id).eq('canvasCourseId', args.canvasCourseId)
      )
      .first()
    if (!course) return []

    const assignments = await ctx.db
      .query('assignments')
      .withIndex('by_course', (q) => q.eq('courseId', course._id))
      .collect()

    // Sort: graded first (by dueAt desc), then ungraded
    return assignments.sort((a: any, b: any) => {
      const aGraded = a.gradeReceived != null
      const bGraded = b.gradeReceived != null
      if (aGraded && !bGraded) return -1
      if (!aGraded && bGraded) return 1
      // Both graded or both ungraded — sort by dueAt desc
      if (!a.dueAt && !b.dueAt) return 0
      if (!a.dueAt) return 1
      if (!b.dueAt) return -1
      return new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime()
    })
  },
})
