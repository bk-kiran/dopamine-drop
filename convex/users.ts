import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// Get or create user by auth ID
export const getOrCreateUser = mutation({
  args: { authUserId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.authUserId))
      .first()

    if (existing) return existing._id

    return await ctx.db.insert('users', {
      authUserId: args.authUserId,
      totalPoints: 0,
      streakCount: 0,
      longestStreak: 0,
    })
  },
})

// Get user by auth ID
export const getUser = query({
  args: { authUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.authUserId))
      .first()
  },
})

// Update user
export const updateUser = mutation({
  args: {
    authUserId: v.string(),
    data: v.object({
      canvasTokenEncrypted: v.optional(v.string()),
      canvasTokenIv: v.optional(v.string()),
      canvasUserId: v.optional(v.string()),
      displayName: v.optional(v.string()),
      hiddenCourses: v.optional(v.array(v.string())),
      totalPoints: v.optional(v.number()),
      streakCount: v.optional(v.number()),
      longestStreak: v.optional(v.number()),
      lastActivityDate: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.authUserId))
      .first()

    if (!user) throw new Error('User not found')

    await ctx.db.patch(user._id, args.data)
    return user._id
  },
})

// Get user stats (points, streak, etc.)
export const getUserStats = query({
  args: { authUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.authUserId))
      .first()

    return {
      totalPoints: user?.totalPoints || 0,
      streakCount: user?.streakCount || 0,
      longestStreak: user?.longestStreak || 0,
      lastActivityDate: user?.lastActivityDate,
    }
  },
})

// Real-time queries for dashboard (using supabaseId parameter naming)
export const getUserBySupabaseId = query({
  args: { supabaseId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.supabaseId))
      .first()
  },
})

export const getVisiblePoints = query({
  args: { supabaseId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.supabaseId))
      .first()

    return {
      totalPoints: user?.totalPoints || 0,
      streakCount: user?.streakCount || 0,
    }
  },
})

// Toggle hidden course
export const toggleHiddenCourse = mutation({
  args: {
    supabaseId: v.string(),
    canvasCourseId: v.string(),
    hide: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.supabaseId))
      .first()

    if (!user) throw new Error('User not found')

    const hiddenCourses = user.hiddenCourses || []
    let newHiddenCourses: string[]

    if (args.hide) {
      // Add to hidden list if not already there
      newHiddenCourses = hiddenCourses.includes(args.canvasCourseId)
        ? hiddenCourses
        : [...hiddenCourses, args.canvasCourseId]
    } else {
      // Remove from hidden list
      newHiddenCourses = hiddenCourses.filter((id) => id !== args.canvasCourseId)
    }

    await ctx.db.patch(user._id, { hiddenCourses: newHiddenCourses })
    return newHiddenCourses
  },
})

// Show all courses (clear hidden list)
export const showAllCourses = mutation({
  args: { supabaseId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.supabaseId))
      .first()

    if (!user) throw new Error('User not found')

    await ctx.db.patch(user._id, { hiddenCourses: [] })
    return []
  },
})

// Consolidated dashboard data query (reduces 3 separate queries to 1)
export const getDashboardData = query({
  args: { supabaseId: v.string() },
  handler: async (ctx, args) => {
    // Get user
    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_user_id', (q) => q.eq('authUserId', args.supabaseId))
      .first()

    if (!user) {
      return {
        user: null,
        courses: [],
        visiblePoints: { totalPoints: 0, streakCount: 0 },
      }
    }

    // Get courses (using indexed query)
    const courses = await ctx.db
      .query('courses')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    // Return consolidated data
    return {
      user,
      courses,
      visiblePoints: {
        totalPoints: user.totalPoints || 0,
        streakCount: user.streakCount || 0,
      },
    }
  },
})
