import { SupabaseClient } from '@supabase/supabase-js'

export async function awardPoints({
  userId,
  assignmentId,
  dueAt,
  submittedAt,
  supabase,
}: {
  userId: string
  assignmentId: string
  dueAt: string | null
  submittedAt: string
  supabase: SupabaseClient
}): Promise<{ pointsAwarded: number; reason: string }> {
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
  const { data: user } = await supabase
    .from('users')
    .select('streak_count')
    .eq('id', userId)
    .single()

  const streakCount = user?.streak_count || 0
  let totalPointsAwarded = basePoints

  // Insert base points into ledger
  await supabase.from('points_ledger').insert({
    user_id: userId,
    assignment_id: assignmentId,
    delta: basePoints,
    reason: reason,
  })

  // If streak >= 3, add 5 bonus points
  if (streakCount >= 3) {
    totalPointsAwarded += 5

    await supabase.from('points_ledger').insert({
      user_id: userId,
      assignment_id: assignmentId,
      delta: 5,
      reason: 'streak_bonus',
    })
  }

  // Update user's total_points
  const { data: userData } = await supabase
    .from('users')
    .select('total_points')
    .eq('id', userId)
    .single()

  await supabase
    .from('users')
    .update({ total_points: (userData?.total_points || 0) + totalPointsAwarded })
    .eq('id', userId)

  return { pointsAwarded: totalPointsAwarded, reason }
}
