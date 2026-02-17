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
    avatarStorageId: v.optional(v.id('_storage')), // Convex file storage ID for profile photo
    hiddenCourses: v.optional(v.array(v.string())), // Array of Canvas course IDs

    // Gamification
    totalPoints: v.optional(v.number()),
    streakCount: v.optional(v.number()),
    longestStreak: v.optional(v.number()),
    lastActivityDate: v.optional(v.string()), // YYYY-MM-DD format
    dashboardSectionOrder: v.optional(v.array(v.string())), // e.g. ['course_123', 'my_tasks', 'course_456']
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
    customTaskId: v.optional(v.id('customTasks')), // Optional for custom task points
    delta: v.number(),
    reason: v.string(), // 'early_submission', 'on_time', 'late_submission', 'streak_bonus', 'custom_task'
  })
    .index('by_user', ['userId'])
    .index('by_assignment', ['assignmentId'])
    .index('by_custom_task', ['customTaskId']),

  // Custom tasks table
  customTasks: defineTable({
    userId: v.id('users'),
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
    status: v.union(v.literal('pending'), v.literal('completed')),
    completedAt: v.optional(v.string()),
    isUrgent: v.optional(v.boolean()),
    urgentOrder: v.optional(v.float64()),
  }).index('by_user_id', ['userId']),

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
