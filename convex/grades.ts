import { mutation } from './_generated/server'
import { v } from 'convex/values'

// Clear all grade data for a user (called when user opts out of grade sharing)
export const clearUserGrades = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()

    if (!user) throw new Error('User not found')

    // Clear grade fields from all courses
    const courses = await ctx.db
      .query('courses')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    await Promise.all(
      courses.map((c) =>
        ctx.db.patch(c._id, {
          currentGrade: undefined,
          currentScore: undefined,
          finalGrade: undefined,
        })
      )
    )

    // Clear gradeReceived from all assignments
    const assignments = await ctx.db
      .query('assignments')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    await Promise.all(
      assignments.map((a) =>
        ctx.db.patch(a._id, { gradeReceived: undefined })
      )
    )

    return { clearedCourses: courses.length, clearedAssignments: assignments.length }
  },
})
