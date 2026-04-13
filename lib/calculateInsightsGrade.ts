// Re-export shared type so callers can import everything from one place
export type { InsightsViewData } from './types/insights'

export interface InsightsGradeBreakdown {
  timeliness: number   // 0–40
  efficiency: number   // 0–30
  consistency: number  // 0–15
  selfScore: number    // 0–15
}

export interface InsightsGradeResult {
  score: number
  grade: string
  breakdown: InsightsGradeBreakdown
}

/**
 * Calculate the Submission Insights grade for a completed custom task.
 *
 * @param submittedAt        Unix ms timestamp when the task was marked complete
 * @param originalDueDate    Unix ms of the first due date set. Undefined = no due date → full timeliness credit.
 * @param dueDateHistory     Array of past due dates — length equals number of pushbacks
 * @param pointsEarned       XP actually awarded on completion
 * @param maxPossiblePoints  XP that would have been earned if submitted on originalDueDate
 * @param selfFeedbackRating User self-rating 1–5
 */
export function calculateInsightsGrade(
  submittedAt: number | undefined,
  originalDueDate: number | undefined,
  dueDateHistory: Array<{ date: number; changedAt: number }>,
  pointsEarned: number,
  maxPossiblePoints: number | undefined,
  selfFeedbackRating: number,
): InsightsGradeResult {
  // --- Timeliness (0–40) ---
  // Full 40pts if no due date was set or if submitted on/before the original due date.
  // Linear decay to 0 at 48 hours late.
  const MS_48H = 48 * 60 * 60 * 1000
  let timeliness: number
  if (submittedAt === undefined || originalDueDate === undefined) {
    timeliness = 40 // unknown data → full credit
  } else {
    const msLate = submittedAt - originalDueDate
    if (msLate <= 0) {
      timeliness = 40
    } else if (msLate >= MS_48H) {
      timeliness = 0
    } else {
      timeliness = 40 * (1 - msLate / MS_48H)
    }
  }

  // --- Points efficiency (0–30) ---
  // Full credit when maxPossiblePoints is 0, undefined, or otherwise untracked.
  const efficiency =
    maxPossiblePoints !== undefined && maxPossiblePoints > 0
      ? 30 * (pointsEarned / maxPossiblePoints)
      : 30

  // --- Consistency / pushback penalty (0–15) ---
  const pushbacks = dueDateHistory.length
  const consistency = Math.max(0, 15 - pushbacks * 3)

  // --- Self-feedback (0–15) ---
  const selfScore = 15 * (selfFeedbackRating / 5)

  const score = Math.round(timeliness + efficiency + consistency + selfScore)

  let grade: string
  if (score >= 90) grade = 'A'
  else if (score >= 80) grade = 'B'
  else if (score >= 70) grade = 'C'
  else if (score >= 60) grade = 'D'
  else grade = 'F'

  return {
    score,
    grade,
    breakdown: {
      timeliness: Math.round(timeliness),
      efficiency: Math.round(efficiency),
      consistency,
      selfScore: Math.round(selfScore),
    },
  }
}
