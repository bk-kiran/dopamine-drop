'use client'

import { RefreshCw, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { useToast } from '@/components/ui/use-toast'

interface DashboardNavbarProps {
  showStats?: boolean // Whether to show streak/points chips (for main dashboard)
}

export function DashboardNavbar({ showStats = false }: DashboardNavbarProps) {
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = async () => {
    setIsSyncing(true)
    localStorage.removeItem('lastSyncTime')

    try {
      const response = await fetch('/api/canvas/sync', {
        method: 'POST',
      })
      const data = await response.json()

      if (response.ok) {
        toast({
          description: `Synced ${data.courses} courses successfully`,
          duration: 3000,
        })
      } else {
        toast({
          description: 'Sync failed. Please try again.',
          variant: 'destructive',
          duration: 3000,
        })
      }
    } catch (error) {
      console.error('Sync error:', error)
      toast({
        description: 'Network error. Please check your connection.',
        variant: 'destructive',
        duration: 3000,
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Sync Canvas Button */}
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className="p-1.5 rounded-full bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] hover:border-purple-400/30 transition-all duration-200 disabled:opacity-50"
        title="Sync with Canvas"
      >
        <RefreshCw
          className={`w-3.5 h-3.5 text-[var(--text-primary)] ${
            isSyncing ? 'animate-spin' : ''
          }`}
        />
      </button>

      {/* Theme Toggle */}
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="p-1.5 rounded-full bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] hover:border-purple-400/30 transition-all duration-200"
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {theme === 'dark' ? (
          <Sun className="w-3.5 h-3.5 text-[var(--text-primary)]" />
        ) : (
          <Moon className="w-3.5 h-3.5 text-[var(--text-primary)]" />
        )}
      </button>
    </div>
  )
}
