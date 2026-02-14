'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export function SyncButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleSync = async () => {
    setLoading(true)
    setResult(null)

    // Clear auto-sync cooldown for manual syncs
    localStorage.removeItem('lastSyncTime')

    try {
      const response = await fetch('/api/canvas/sync', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        setResult(`Error: ${data.error || 'Failed to sync'}`)
        setLoading(false)
        return
      }

      // Show success message
      setResult(`Synced ${data.synced} assignments from ${data.courses} courses`)

      // Refresh the page data
      router.refresh()

      // Clear success message after 5 seconds
      setTimeout(() => {
        setResult(null)
      }, 5000)

      setLoading(false)
    } catch (error) {
      setResult('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={handleSync}
        disabled={loading}
        variant="outline"
        size="sm"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Syncing...' : 'Sync Canvas'}
      </Button>
      {result && (
        <span
          className={`text-sm ${
            result.startsWith('Error') ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          {result}
        </span>
      )}
    </div>
  )
}
