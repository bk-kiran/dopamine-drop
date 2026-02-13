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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('courses')
      .withIndex('by_user_and_canvas_id', (q) =>
        q.eq('userId', args.userId).eq('canvasCourseId', args.canvasCourseId)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        courseCode: args.courseCode,
      })
      return existing._id
    }

    return await ctx.db.insert('courses', {
      userId: args.userId,
      canvasCourseId: args.canvasCourseId,
      name: args.name,
      courseCode: args.courseCode,
    })
  },
})
