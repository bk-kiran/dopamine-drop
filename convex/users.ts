import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// Get or create user by Clerk ID
export const getOrCreateUser = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()

    if (existing) return existing._id

    return await ctx.db.insert('users', {
      clerkId: args.clerkId,
      totalPoints: 0,
      streakCount: 0,
      longestStreak: 0,
    })
  },
})

// Get user by Clerk ID
export const getUser = query({
  args: { authUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.authUserId))
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
      avatarStorageId: v.optional(v.id('_storage')),
    }),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.authUserId))
      .first()

    if (!user) throw new Error('User not found')

    await ctx.db.patch(user._id, args.data)
    return user._id
  },
})

// Update user avatar
export const updateAvatar = mutation({
  args: {
    clerkId: v.string(),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()

    if (!user) throw new Error('User not found')

    await ctx.db.patch(user._id, {
      avatarStorageId: args.storageId,
    })

    return { success: true }
  },
})

// Get avatar URL
export const getAvatarUrl = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()

    if (!user?.avatarStorageId) return null

    return await ctx.storage.getUrl(user.avatarStorageId)
  },
})

// Update display name
export const updateDisplayName = mutation({
  args: {
    clerkId: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()

    if (!user) throw new Error('User not found')

    await ctx.db.patch(user._id, {
      displayName: args.displayName,
    })

    return { success: true }
  },
})

// Get profile stats
export const getProfileStats = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()

    if (!user) {
      return {
        totalPoints: 0,
        streakCount: 0,
        longestStreak: 0,
        submittedCount: 0,
      }
    }

    // Get submitted assignments count
    const assignments = await ctx.db
      .query('assignments')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const submittedCount = assignments.filter(a => a.status === 'submitted').length

    return {
      totalPoints: user.totalPoints || 0,
      streakCount: user.streakCount || 0,
      longestStreak: user.longestStreak || 0,
      submittedCount,
    }
  },
})

// Get user stats (points, streak, etc.)
export const getUserStats = query({
  args: { authUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.authUserId))
      .first()

    return {
      totalPoints: user?.totalPoints || 0,
      streakCount: user?.streakCount || 0,
      longestStreak: user?.longestStreak || 0,
      lastActivityDate: user?.lastActivityDate,
    }
  },
})

// Real-time queries for dashboard
export const getUserBySupabaseId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()
  },
})

export const getVisiblePoints = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
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
    clerkId: v.string(),
    canvasCourseId: v.string(),
    hide: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
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
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()

    if (!user) throw new Error('User not found')

    await ctx.db.patch(user._id, { hiddenCourses: [] })
    return []
  },
})

// Consolidated dashboard data query (reduces 3 separate queries to 1)
export const getDashboardData = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    // Get user
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
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
        longestStreak: user.longestStreak || 0,
      },
    }
  },
})

// Fixed levels table
const LEVELS = [
  { level: 1, name: 'Freshman', minPoints: 0, maxPoints: 100 },
  { level: 2, name: 'Sophomore', minPoints: 100, maxPoints: 250 },
  { level: 3, name: 'Junior', minPoints: 250, maxPoints: 500 },
  { level: 4, name: 'Senior', minPoints: 500, maxPoints: 1000 },
  { level: 5, name: 'Graduate', minPoints: 1000, maxPoints: 2000 },
  { level: 6, name: 'PhD Student', minPoints: 2000, maxPoints: 3500 },
  { level: 7, name: 'Professor', minPoints: 3500, maxPoints: 99999 },
]

// Get user level and progress
export const getLevel = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()

    const currentPoints = user?.totalPoints || 0

    // Find current level
    let currentLevelData = LEVELS[0]
    for (const level of LEVELS) {
      if (currentPoints >= level.minPoints && currentPoints < level.maxPoints) {
        currentLevelData = level
        break
      }
    }

    // Find next level (if not at max level)
    const nextLevelData = LEVELS.find((l) => l.level === currentLevelData.level + 1)

    return {
      currentPoints,
      currentLevel: currentLevelData.level,
      levelName: currentLevelData.name,
      currentLevelMinPoints: currentLevelData.minPoints,
      nextLevelPoints: nextLevelData?.minPoints || currentLevelData.maxPoints,
      nextLevelName: nextLevelData?.name || 'Max Level',
      pointsNeeded: nextLevelData ? nextLevelData.minPoints - currentPoints : 0,
      progressPercentage: nextLevelData
        ? Math.floor(
            ((currentPoints - currentLevelData.minPoints) /
              (nextLevelData.minPoints - currentLevelData.minPoints)) *
              100
          )
        : 100,
    }
  },
})

// Set the user's weekly 2x XP multiplier day
export const setXpMultiplierDay = mutation({
  args: {
    clerkId: v.string(),
    day: v.optional(v.string()), // '0'–'6' (Sun–Sat), or undefined to clear
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()

    if (!user) throw new Error('User not found')

    await ctx.db.patch(user._id, { xpMultiplierDay: args.day })
    return { success: true }
  },
})

// Get dashboard section order
export const getDashboardSectionOrder = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()

    if (!user) return null
    return user.dashboardSectionOrder || null
  },
})

// Update dashboard section order
export const updateDashboardSectionOrder = mutation({
  args: {
    clerkId: v.string(),
    sectionOrder: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()

    if (!user) throw new Error('User not found')

    await ctx.db.patch(user._id, {
      dashboardSectionOrder: args.sectionOrder,
    })

    return args.sectionOrder
  },
})

// Look up a dopamine drop user by their Canvas user ID.
// Called by the Chrome extension: content.js extracts the Canvas user ID from
// window.ENV.current_user.id, then the sidebar queries Convex with it to find
// the matching dopamine drop account (populated during Canvas token connect).
//
export const getUserByCanvasId = query({
  args: { canvasUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_canvas_user_id', (q) => q.eq('canvasUserId', args.canvasUserId))
      .first()
  },
})

// ── Migration: backfill clerkId from authUserId for existing users ────────────
// Run once from the Convex dashboard after deploying the new schema.
// This only sets clerkId on documents that have authUserId but no clerkId.
// After users re-login with Clerk, a new record is created with their real clerkId.
export const migrateAuthUserIdToClerkId = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect()
    let migrated = 0
    for (const user of users) {
      if (!user.clerkId && (user as any).authUserId) {
        await ctx.db.patch(user._id, { clerkId: (user as any).authUserId })
        migrated++
      }
    }
    return { migrated }
  },
})

// ── Clerk Webhook Mutations ─────────────────────────────────────────────────

// Called when a user is created in Clerk
export const createFromClerk = mutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()

    if (existing) {
      // User already exists (e.g. created via getOrCreateUser before webhook fired)
      await ctx.db.patch(existing._id, {
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        imageUrl: args.imageUrl,
      })
      return existing._id
    }

    return await ctx.db.insert('users', {
      clerkId: args.clerkId,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      imageUrl: args.imageUrl,
      totalPoints: 0,
      streakCount: 0,
      longestStreak: 0,
    })
  },
})

// Called when a user is updated in Clerk
export const updateFromClerk = mutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()

    if (!user) return null

    await ctx.db.patch(user._id, {
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      imageUrl: args.imageUrl,
    })

    return user._id
  },
})

// Called when a user is deleted in Clerk
export const deleteFromClerk = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()

    if (!user) return null

    await ctx.db.delete(user._id)
    return user._id
  },
})
