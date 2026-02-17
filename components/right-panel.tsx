'use client'

import { useState, useEffect } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Circle, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { LevelCard } from '@/components/level-card'
import { DailyChallenges } from '@/components/daily-challenges'

interface UrgentAssignment {
  _id: string
  title: string
  dueAt: string | null
  pointsPossible: number
  status: 'pending' | 'submitted' | 'missing'
  courseName: string
  courseCode: string
}

function formatDueDate(dateString: string | null): string {
  if (!dateString) return 'NO DUE DATE'

  const now = new Date()
  const dueDate = new Date(dateString)
  const diffMs = dueDate.getTime() - now.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMs < 0) {
    return 'OVERDUE'
  } else if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    return `DUE IN ${diffMinutes} MIN${diffMinutes !== 1 ? 'S' : ''}`
  } else if (diffHours < 24) {
    return `DUE IN ${diffHours} HOUR${diffHours !== 1 ? 'S' : ''}`
  } else if (diffDays === 1) {
    return 'DUE TOMORROW'
  } else if (diffDays < 7) {
    return `DUE IN ${diffDays} DAYS`
  } else {
    return dueDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }
}

export function RightPanel() {
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Get Supabase user ID
  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setSupabaseUserId(user.id)
      }
    }
    getUser()
  }, [])

  // Load collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('rightPanelCollapsed')
    if (stored !== null) {
      setIsCollapsed(stored === 'true')
    }
  }, [])

  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('rightPanelCollapsed', String(newState))
  }

  // Get urgent assignments
  const urgentAssignments = useQuery(
    api.assignments.getUrgentAssignments,
    supabaseUserId ? { supabaseId: supabaseUserId } : 'skip'
  )

  // Get urgent custom tasks
  const urgentCustomTasks = useQuery(
    api.customTasks.getUrgentCustomTasks,
    supabaseUserId ? { supabaseId: supabaseUserId } : 'skip'
  )

  // Get user data
  const dashboardData = useQuery(
    api.users.getDashboardData,
    supabaseUserId ? { supabaseId: supabaseUserId } : 'skip'
  )

  const userData = dashboardData?.user
  const pointsData = dashboardData?.visiblePoints

  // Merge and sort all urgent items by urgentOrder
  const mergedUrgentItems = [
    ...(urgentAssignments || []).map((a: any) => ({
      _id: a._id,
      title: a.title,
      dueAt: a.dueAt,
      urgentOrder: a.urgentOrder,
      isCustomTask: false,
    })),
    ...(urgentCustomTasks || []).map((t: any) => ({
      _id: t._id,
      title: t.title,
      dueAt: t.dueAt,
      urgentOrder: t.urgentOrder,
      isCustomTask: true,
    })),
  ].sort((a, b) => (a.urgentOrder ?? 0) - (b.urgentOrder ?? 0))

  const urgentCount = mergedUrgentItems.length

  // Get user initials
  const getInitials = () => {
    if (!userData?.displayName) return '?'
    const names = userData.displayName.split(' ')
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase()
    }
    return names[0][0].toUpperCase()
  }

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 64 : 320 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="h-screen bg-[var(--glass-bg)] backdrop-blur-md border-l border-[var(--glass-border)] flex flex-col overflow-hidden"
    >
      {/* Collapse Toggle Button */}
      <div className="p-3 border-b border-[var(--glass-border)]">
        <button
          onClick={toggleCollapse}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[var(--text-muted)] hover:bg-purple-500/10 hover:text-purple-400 transition-all duration-200"
        >
          {isCollapsed ? (
            <ChevronLeft className="w-5 h-5" />
          ) : (
            <>
              <span className="text-sm font-medium">Collapse</span>
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-y-auto p-6 space-y-6"
          >
            {/* Urgent Tasks Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  URGENT TASKS
                </h3>
                {urgentCount > 0 && (
                  <Badge className="bg-red-500/20 text-red-400 border border-red-500/40 px-2 py-0.5 text-[10px] font-bold uppercase">
                    {urgentCount} ALERT
                  </Badge>
                )}
              </div>

          {/* Urgent items list (Canvas + custom tasks merged) */}
          <div className="space-y-2">
            {mergedUrgentItems.length > 0 ? (
              mergedUrgentItems.map((item) => {
                const dueText = formatDueDate(item.dueAt)
                const isOverdue = dueText === 'OVERDUE'
                const isUrgentTime = dueText.includes('HOUR') || dueText === 'DUE TOMORROW'

                return (
                  <motion.div
                    key={item._id}
                    layout
                    className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-purple-400/20 transition-all duration-200"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1 truncate">
                          {item.title}
                        </h4>
                        <p className={`text-xs font-bold uppercase tracking-wide ${
                          isOverdue ? 'text-red-400' : isUrgentTime ? 'text-orange-400' : 'text-yellow-400'
                        }`}>
                          {dueText}
                        </p>
                      </div>
                      {item.isCustomTask && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 flex-shrink-0">
                          CUSTOM
                        </span>
                      )}
                    </div>
                  </motion.div>
                )
              })
            ) : (
              <div className="text-center py-8">
                <Circle className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)] opacity-30" />
                <p className="text-sm text-[var(--text-muted)]">No urgent tasks</p>
              </div>
            )}
          </div>
        </div>

        {/* Daily Challenges */}
        {supabaseUserId && <DailyChallenges supabaseUserId={supabaseUserId} />}

        {/* Goal/Level Progress Card */}
        {supabaseUserId && <LevelCard supabaseUserId={supabaseUserId} />}

        {/* Profile Mini Card */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <span className="text-base font-bold text-purple-400">
                {getInitials()}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                {userData?.displayName || 'Student'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  <span className="text-xs text-[var(--text-muted)]">
                    {pointsData?.streakCount || 0} day streak
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="text-center p-2 rounded-lg bg-purple-500/5">
              <p className="text-lg font-bold text-purple-400">
                {pointsData?.totalPoints || 0}
              </p>
              <p className="text-xs text-[var(--text-muted)]">Total Points</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-purple-500/5">
              <p className="text-lg font-bold text-purple-400">
                {pointsData?.longestStreak || 0}
              </p>
              <p className="text-xs text-[var(--text-muted)]">Best Streak</p>
            </div>
          </div>
        </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}
