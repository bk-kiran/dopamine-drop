'use client'

import { useEffect, useState } from 'react'
import { CompletionToast } from './completion-toast'

export function AutoSync() {
  const [syncResult, setSyncResult] = useState<{
    completedAssignments: any[]
    newReward: any | null
  } | null>(null)

  useEffect(() => {
    // Session-level guard: only run auto-sync once per browser session
    const autoSyncDone = sessionStorage.getItem('autoSyncDone')

    if (autoSyncDone) {
      console.log('[Auto-Sync] Already completed this session, skipping.')
      return
    }

    const runAutoSync = async () => {
      try {
        console.log('[Auto-Sync] Running auto-sync for this session...')

        const res = await fetch('/api/canvas/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auto-sync': 'true',
          },
        })

        if (res.ok) {
          const data = await res.json()

          // Mark auto-sync as done for this session
          sessionStorage.setItem('autoSyncDone', 'true')
          console.log('[Auto-Sync] Completed and marked as done.')

          // Only set result if there are completions or rewards
          if (data.completedAssignments?.length > 0 || data.newReward) {
            setSyncResult(data)
          }
        }
      } catch (error) {
        console.error('[Auto-Sync] Error:', error)
        // Still mark as done even on error to prevent retry loops
        sessionStorage.setItem('autoSyncDone', 'true')
      }
    }

    runAutoSync()
  }, [])

  if (!syncResult || (!syncResult.completedAssignments?.length && !syncResult.newReward)) {
    return null
  }

  return (
    <CompletionToast
      completedAssignments={syncResult.completedAssignments || []}
      newReward={syncResult.newReward}
    />
  )
}
