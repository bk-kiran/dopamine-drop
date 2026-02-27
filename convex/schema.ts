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
    streakShields: v.optional(v.float64()), // 0–3, protect streak for 1 missed day each
    xpMultiplierDay: v.optional(v.string()), // '0'=Sunday … '6'=Saturday; all points on this day are doubled
    dashboardSectionOrder: v.optional(v.array(v.string())), // e.g. ['course_123', 'my_tasks', 'course_456']
  }).index('by_auth_user_id', ['authUserId']),

  // Courses table
  courses: defineTable({
    userId: v.id('users'), // Foreign key reference
    canvasCourseId: v.string(),
    name: v.string(),
    courseCode: v.string(),
    currentGrade: v.optional(v.float64()),  // percentage e.g. 87.5 (from Canvas enrollments)
    currentScore: v.optional(v.float64()),  // raw score points
    finalGrade: v.optional(v.float64()),    // final/projected percentage
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
    userNotes: v.optional(v.string()), // Personal notes on the assignment
    gradeReceived: v.optional(v.float64()),      // Actual score received e.g. 18
    assignmentGroupName: v.optional(v.string()), // e.g. 'Homework', 'Exams'
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
    dueAt: v.optional(v.string()), // ISO 8601 local datetime: "YYYY-MM-DDTHH:mm:ss" (no Z suffix)
    status: v.union(v.literal('pending'), v.literal('completed')),
    completedAt: v.optional(v.string()), // ISO 8601 local datetime
    isUrgent: v.optional(v.boolean()),
    urgentOrder: v.optional(v.float64()),
    userNotes: v.optional(v.string()), // Personal notes on the task
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

  // Daily challenge pool (static content, seeded by admin)
  challengePool: defineTable({
    title: v.string(),
    description: v.string(),
    type: v.union(
      v.literal('submit_n'),
      v.literal('early_submit'),
      v.literal('streak'),
      v.literal('points'),
      v.literal('custom_task'),
      v.literal('time_based'),
      v.literal('urgent'),
      v.literal('clean_sweep'),
      v.literal('perfect_day'),
      v.literal('course_clear'),
      v.literal('consistency'),
      v.literal('engagement'),
    ),
    targetValue: v.float64(),
    bonusPoints: v.float64(),
    difficulty: v.union(v.literal('easy'), v.literal('medium'), v.literal('hard')),
  }),

  // Per-user daily challenge instances
  userDailyChallenges: defineTable({
    userId: v.id('users'),
    challengeId: v.id('challengePool'),
    date: v.string(), // 'YYYY-MM-DD'
    progress: v.float64(),
    completed: v.boolean(),
    bonusAwarded: v.boolean(),
  })
    .index('by_user_date', ['userId', 'date'])
    .index('by_user', ['userId']),

  // Achievements pool (static, seeded once)
  achievements: defineTable({
    key: v.string(), // unique identifier e.g. 'first_blood'
    name: v.string(),
    description: v.string(),
    icon: v.string(), // lucide icon name e.g. 'Star'
    color: v.string(), // tailwind color e.g. 'yellow'
    bonusPoints: v.float64(),
  }).index('by_key', ['key']),

  // Per-user unlocked achievements
  userAchievements: defineTable({
    userId: v.id('users'),
    achievementId: v.id('achievements'),
    unlockedAt: v.string(), // ISO timestamp
    seen: v.boolean(),
  }).index('by_user_id', ['userId']),

  // Leaderboards
  leaderboards: defineTable({
    name: v.string(),
    creatorId: v.id('users'),
    inviteCode: v.string(), // unique 8-char alphanumeric code
    createdAt: v.string(),
  }).index('by_invite_code', ['inviteCode']),

  leaderboardMembers: defineTable({
    leaderboardId: v.id('leaderboards'),
    userId: v.id('users'),
    joinedAt: v.string(),
  })
    .index('by_leaderboard', ['leaderboardId'])
    .index('by_user', ['userId']),

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
