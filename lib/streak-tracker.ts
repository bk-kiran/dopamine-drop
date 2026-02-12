import { SupabaseClient } from '@supabase/supabase-js'

export async function updateStreak({
  userId,
  supabase,
}: {
  userId: string
  supabase: SupabaseClient
}): Promise<number> {
  // Fetch current streak data
  const { data: user } = await supabase
    .from('users')
    .select('last_activity_date, streak_count, longest_streak')
    .eq('id', userId)
    .single()

  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const lastActivity = user?.last_activity_date

  let newStreak = 1

  if (!lastActivity) {
    // First time activity
    newStreak = 1
  } else if (lastActivity === today) {
    // Already active today, no change
    return user.streak_count || 1
  } else {
    const lastDate = new Date(lastActivity)
    const todayDate = new Date(today)
    const diffDays = Math.floor(
      (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (diffDays === 1) {
      // Yesterday - increment streak
      newStreak = (user.streak_count || 0) + 1
    } else {
      // 2+ days gap - reset streak
      newStreak = 1
    }
  }

  // Update users table
  const newLongest = Math.max(newStreak, user?.longest_streak || 0)

  await supabase
    .from('users')
    .update({
      streak_count: newStreak,
      longest_streak: newLongest,
      last_activity_date: today,
    })
    .eq('id', userId)

  return newStreak
}
