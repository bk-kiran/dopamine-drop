'use client'

import { useEffect, useState } from 'react'
import { CompletionToast } from './completion-toast'

export function AutoSync() {
  const [syncResult, setSyncResult] = useState<{
    completedAssignments: any[]
    newReward: any | null
  } | null>(null)

  useEffect(() => {
    // 30-minute cooldown check using localStorage
    const lastSyncTime = localStorage.getItem('lastSyncTime')
    const now = Date.now()
    const thirtyMinutes = 30 * 60 * 1000

    if (lastSyncTime) {
      const timeSinceLastSync = now - parseInt(lastSyncTime, 10)
      if (timeSinceLastSync < thirtyMinutes) {
        const minutesRemaining = Math.ceil((thirtyMinutes - timeSinceLastSync) / 60000)
        console.log(`[Auto-Sync] Cooldown active. Next sync in ${minutesRemaining} minutes.`)
        return
      }
    }

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

          // Mark auto-sync as done for this session and update cooldown timestamp
          sessionStorage.setItem('autoSyncDone', 'true')
          localStorage.setItem('lastSyncTime', Date.now().toString())
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
