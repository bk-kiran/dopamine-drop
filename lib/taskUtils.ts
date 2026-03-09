const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

export type UntickStatus =
  | { canUntick: true }
  | { canUntick: false; reason: 'canvas_submitted' | 'expired' }

export function getUntickStatus(task: {
  type: 'canvas' | 'custom'
  manuallyCompleted?: boolean
  manuallyCompletedAt?: string | null
  completedAt?: string | null
}): UntickStatus {
  if (task.type === 'canvas') {
    if (!task.manuallyCompleted) {
      return { canUntick: false, reason: 'canvas_submitted' }
    }
    if (task.manuallyCompletedAt) {
      const age = Date.now() - new Date(task.manuallyCompletedAt).getTime()
      if (age > FOURTEEN_DAYS_MS) return { canUntick: false, reason: 'expired' }
    }
    return { canUntick: true }
  } else {
    if (task.completedAt) {
      const age = Date.now() - new Date(task.completedAt).getTime()
      if (age > FOURTEEN_DAYS_MS) return { canUntick: false, reason: 'expired' }
    }
    return { canUntick: true }
  }
}

export function getUntickTooltip(reason: 'canvas_submitted' | 'expired'): string {
  if (reason === 'canvas_submitted') return 'Cannot untick — submitted in Canvas'
  return 'Cannot untick — completed over 2 weeks ago'
}
