import { Id } from '@/convex/_generated/dataModel'

/**
 * All data needed to open SubmissionInsightsModal.
 * Assembled at completion time or from stored task fields when reviewing later.
 */
export interface InsightsViewData {
  taskId: Id<'customTasks'>
  taskTitle: string
  isCanvas: boolean
  pointsEarned: number
  submittedAt?: number                                  // Unix ms — undefined = unknown
  originalDueDate?: number                              // Unix ms — undefined = no due date set
  dueDateHistory: Array<{ date: number; changedAt: number }>
  maxPossiblePoints?: number
  canvasSubmittedAt?: number
  existingRating?: number                               // pre-fills stars and skips to reveal
  existingGrade?: string                                // skips straight to grade display
}
