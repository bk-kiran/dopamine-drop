import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // Users table - maps to Supabase auth users
  users: defineTable({
    // Auth user ID from Supabase (not auto-generated)
    authUserId: v.string(),

    // Canvas integration
    canvasTokenEncrypted: v.optional(v.string()),
    canvasTokenIv: v.optional(v.string()),
    canvasUserId: v.optional(v.string()),
    displayName: v.optional(v.string()),
    hiddenCourses: v.optional(v.array(v.string())), // Array of Canvas course IDs

    // Gamification
    totalPoints: v.optional(v.number()),
    streakCount: v.optional(v.number()),
    longestStreak: v.optional(v.number()),
    lastActivityDate: v.optional(v.string()), // YYYY-MM-DD format
  }).index('by_auth_user_id', ['authUserId']),

  // Courses table
  courses: defineTable({
    userId: v.id('users'), // Foreign key reference
    canvasCourseId: v.string(),
    name: v.string(),
    courseCode: v.string(),
  })
    .index('by_user', ['userId'])
    .index('by_user_and_canvas_id', ['userId', 'canvasCourseId']),

  // Assignments table
  assignments: defineTable({
    userId: v.id('users'),
    courseId: v.id('courses'),
    canvasAssignmentId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    dueAt: v.optional(v.string()), // ISO timestamp
    pointsPossible: v.number(),
    status: v.union(
      v.literal('pending'),
      v.literal('submitted'),
      v.literal('missing')
    ),
    submittedAt: v.optional(v.string()), // ISO timestamp
    canvasCourseId: v.string(), // Denormalized for faster queries
    manuallyCompleted: v.optional(v.boolean()), // Manual tick-off by user
    isUrgent: v.optional(v.boolean()), // Marked as urgent by user
    urgentOrder: v.optional(v.float64()), // Order in urgent list (for drag-drop)
  })
    .index('by_user', ['userId'])
    .index('by_user_and_canvas_id', ['userId', 'canvasAssignmentId'])
    .index('by_course', ['courseId'])
    .index('by_user_and_urgent', ['userId', 'isUrgent']),

  // Points ledger table
  pointsLedger: defineTable({
    userId: v.id('users'),
    assignmentId: v.optional(v.id('assignments')), // Optional for non-assignment points
    delta: v.number(),
    reason: v.string(), // 'early_submission', 'on_time', 'late_submission', 'streak_bonus'
  })
    .index('by_user', ['userId'])
    .index('by_assignment', ['assignmentId']),

  // Rewards table
  rewards: defineTable({
    type: v.union(v.literal('virtual'), v.literal('real')),
    name: v.string(),
    description: v.string(),
    rarity: v.union(
      v.literal('common'),
      v.literal('rare'),
      v.literal('legendary')
    ),
    isActive: v.boolean(),
  }).index('by_rarity_and_active', ['rarity', 'isActive']),

  // User rewards table (junction table)
  userRewards: defineTable({
    userId: v.id('users'),
    rewardId: v.id('rewards'),
    isRevealed: v.boolean(),
    earnedAt: v.optional(v.string()), // ISO timestamp (Convex auto-creates _creationTime)
  })
    .index('by_user', ['userId'])
    .index('by_user_and_reward', ['userId', 'rewardId']),
})
