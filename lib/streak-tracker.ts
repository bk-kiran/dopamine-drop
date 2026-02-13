import { getConvexClient } from './convex-client'
import { api } from '@/convex/_generated/api'

export async function updateStreak({ authUserId }: { authUserId: string }): Promise<number> {
  const convex = getConvexClient()

  // Fetch current streak data
  const userStats = await convex.query(api.users.getUserStats, {
    authUserId,
  })

  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const lastActivity = userStats?.lastActivityDate

  let newStreak = 1

  if (!lastActivity) {
    // First time activity
    newStreak = 1
  } else if (lastActivity === today) {
    // Already active today, no change
    return userStats.streakCount || 1
  } else {
    const lastDate = new Date(lastActivity)
    const todayDate = new Date(today)
    const diffDays = Math.floor(
      (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (diffDays === 1) {
      // Yesterday - increment streak
      newStreak = (userStats.streakCount || 0) + 1
    } else {
      // 2+ days gap - reset streak
      newStreak = 1
    }
  }

  // Update users table
  const newLongest = Math.max(newStreak, userStats?.longestStreak || 0)

  await convex.mutation(api.users.updateUser, {
    authUserId,
    data: {
      streakCount: newStreak,
      longestStreak: newLongest,
      lastActivityDate: today,
    },
  })

  return newStreak
}
