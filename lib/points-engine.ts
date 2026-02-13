import { getConvexClient } from './convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function awardPoints({
  authUserId,
  convexUserId,
  assignmentId,
  dueAt,
  submittedAt,
}: {
  authUserId: string
  convexUserId: Id<'users'>
  assignmentId: Id<'assignments'>
  dueAt: string | null
  submittedAt: string
}): Promise<{ pointsAwarded: number; reason: string }> {
  const convex = getConvexClient()

  // Calculate base points based on submission timing
  const submittedDate = new Date(submittedAt)
  const dueDate = dueAt ? new Date(dueAt) : null

  let basePoints = 10
  let reason = 'on_time'

  if (!dueDate) {
    // No due date → default 10 points
    basePoints = 10
    reason = 'on_time'
  } else {
    const timeDiff = dueDate.getTime() - submittedDate.getTime()
    const hoursDiff = timeDiff / (1000 * 60 * 60)

    if (hoursDiff >= 24) {
      // Submitted 24+ hours before due
      basePoints = 20
      reason = 'early_submission'
    } else if (timeDiff > 0) {
      // Submitted before due but less than 24 hours
      basePoints = 10
      reason = 'on_time'
    } else {
      // Submitted after due date
      basePoints = 2
      reason = 'late_submission'
    }
  }

  // Fetch user's current streak_count for potential bonus
  const userStats = await convex.query(api.users.getUserStats, {
    authUserId,
  })

  const streakCount = userStats?.streakCount || 0
  let totalPointsAwarded = basePoints

  // Insert base points into ledger (this also updates user's total_points)
  await convex.mutation(api.points.addPoints, {
    userId: convexUserId,
    assignmentId,
    delta: basePoints,
    reason,
  })

  // If streak >= 3, add 5 bonus points
  if (streakCount >= 3) {
    totalPointsAwarded += 5

    await convex.mutation(api.points.addPoints, {
      userId: convexUserId,
      assignmentId,
      delta: 5,
      reason: 'streak_bonus',
    })
  }

  return { pointsAwarded: totalPointsAwarded, reason }
}
