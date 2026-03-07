'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { CheckCircle2, Clock, ChevronDown, ChevronUp, Info, Zap, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const DIFFICULTY_CONFIG = {
  easy: {
    label: 'EASY',
    color: 'text-green-400',
    bg: 'bg-green-500/20 border-green-500/30',
  },
  medium: {
    label: 'MED',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/20 border-yellow-500/30',
  },
  hard: {
    label: 'HARD',
    color: 'text-red-400',
    bg: 'bg-red-500/20 border-red-500/30',
  },
}

// Helper: Get today's date in local timezone as YYYY-MM-DD
function getTodayLocalDate(): string {
  const now = new Date()
  return now.toLocaleDateString('en-CA') // YYYY-MM-DD format
}

// Helper: Calculate time until local midnight
function getTimeUntilMidnight(): string {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)

  const diff = midnight.getTime() - now.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  return `${hours}h ${minutes}m`
}

function getTargetUnit(type: string): string {
  switch (type) {
    case 'submit_n': return 'assignments'
    case 'early_submit': return 'early assignments'
    case 'streak': return 'day streak'
    case 'points': return 'points'
    case 'custom_task': return 'custom tasks'
    case 'urgent': return 'urgent tasks'
    case 'consistency': return 'days'
    default: return 'completions'
  }
}

function getHint(type: string): string | null {
  switch (type) {
    case 'submit_n':
      return 'Tick off or submit assignments from any course to make progress.'
    case 'early_submit':
      return 'Find assignments with a future due date and complete them more than 24 hours early.'
    case 'streak':
      return 'Complete at least one task every day to build your streak.'
    case 'points':
      return 'Every assignment you complete earns points — early submissions earn the most.'
    case 'custom_task':
      return 'Add and complete personal tasks in the My Tasks section.'
    case 'time_based':
      return 'Complete a task during the specified time window today.'
    case 'urgent':
      return 'Mark tasks as urgent using the flag icon, then complete them.'
    case 'clean_sweep':
      return 'Complete all tasks that are due today.'
    case 'perfect_day':
      return 'Clear everything due today — no pending or overdue tasks left.'
    case 'course_clear':
      return 'Pick one course and complete all its pending assignments.'
    case 'consistency':
      return 'Keep completing at least one task each day for the required number of days.'
    case 'engagement':
      return 'Visit your grades or leaderboard page to complete this.'
    default:
      return null
  }
}

interface DailyChallengesProps {
  supabaseUserId: string
}

export function DailyChallenges({ supabaseUserId }: DailyChallengesProps) {
  const [currentDate, setCurrentDate] = useState(getTodayLocalDate())
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnight())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const generateDailyChallenges = useMutation(api.challenges.generateDailyChallenges)

  const dailyChallenges = useQuery(api.challenges.getDailyChallenges, {
    clerkId: supabaseUserId,
    dateString: currentDate,
  })

  // Generate challenges on mount and when date changes
  useEffect(() => {
    generateDailyChallenges({
      clerkId: supabaseUserId,
      dateString: currentDate,
    }).catch(console.error)
  }, [supabaseUserId, currentDate])

  // Check for date change every minute (automatic reset at local midnight)
  useEffect(() => {
    const interval = setInterval(() => {
      const newDate = getTodayLocalDate()
      if (newDate !== currentDate) {
        setCurrentDate(newDate)
        setExpandedIds(new Set())
      }
    }, 60000)

    return () => clearInterval(interval)
  }, [currentDate])

  // Update countdown timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntilMidnight())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Header
  const header = (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
        DAILY CHALLENGES
      </h3>
      {timeLeft && (
        <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
          <Clock className="w-3 h-3" />
          <span>Resets in {timeLeft}</span>
        </div>
      )}
    </div>
  )

  // Loading skeleton
  if (dailyChallenges === undefined) {
    return (
      <div>
        {header}
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // Empty — challenges are generating
  if (dailyChallenges.length === 0) {
    return (
      <div>
        {header}
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const completedCount = dailyChallenges.filter((c: any) => c.completed).length

  return (
    <div>
      {header}

      {/* Completion summary */}
      {completedCount > 0 && (
        <p className="text-[10px] text-green-400 mb-2 font-bold">
          {completedCount}/{dailyChallenges.length} completed today
        </p>
      )}

      <div className="space-y-2">
        {dailyChallenges.map((item: any) => {
          const challenge = item.challenge
          if (!challenge) return null

          const diffConfig = DIFFICULTY_CONFIG[challenge.difficulty as keyof typeof DIFFICULTY_CONFIG]
          const pct = Math.min(100, (item.progress / challenge.targetValue) * 100)
          const displayProgress = Math.min(item.progress, challenge.targetValue)
          const isExpanded = expandedIds.has(item._id)
          const hint = getHint(challenge.type)

          return (
            <motion.div
              key={item._id}
              layout
              className={`rounded-xl border transition-all duration-300 ${
                item.completed
                  ? 'bg-green-500/5 border-green-500/20'
                  : 'bg-white/5 border-white/10 hover:border-purple-400/20'
              }`}
            >
              {/* Clickable card header */}
              <button
                onClick={() => toggleExpand(item._id)}
                className="w-full text-left p-3"
              >
                {/* Top row: checkbox + badges + title + chevron */}
                <div className="flex items-start gap-2 mb-2">
                  {item.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-white/20 shrink-0 mt-0.5" />
                  )}

                  <div className="flex-1 min-w-0">
                    {/* Badges */}
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${diffConfig.bg} ${diffConfig.color}`}
                      >
                        {diffConfig.label}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                        +{challenge.bonusPoints} PTS
                      </span>
                    </div>

                    {/* Title */}
                    <p
                      className={`text-xs font-medium leading-tight ${
                        item.completed ? 'text-green-400' : 'text-(--text-primary)'
                      }`}
                    >
                      {challenge.title}
                    </p>
                  </div>

                  {/* Chevron */}
                  <div className="shrink-0 mt-0.5">
                    {isExpanded
                      ? <ChevronUp className="w-3.5 h-3.5 text-white/30" />
                      : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="ml-6">
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.completed ? 'bg-green-400' : 'bg-purple-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] text-(--text-muted)">
                      {displayProgress}/{challenge.targetValue}
                    </span>
                    {item.completed && (
                      <span className="text-[10px] text-green-400 font-bold">Done!</span>
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded details */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key="expand"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 border-t border-white/10 pt-2.5 ml-0">
                      {/* Description */}
                      <div className="flex items-start gap-2 mb-3">
                        <Info className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-white/60 leading-relaxed">
                          {challenge.description}
                        </p>
                      </div>

                      {/* Requirements table */}
                      <div className="bg-white/5 rounded-lg p-2.5 space-y-1.5 mb-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-(--text-muted) mb-2">
                          Requirements
                        </p>

                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-white/50">Target</span>
                          <span className="text-[11px] font-medium text-white">
                            {challenge.targetValue} {getTargetUnit(challenge.type)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-white/50">Progress</span>
                          <span className={`text-[11px] font-medium ${item.completed ? 'text-green-400' : 'text-purple-400'}`}>
                            {displayProgress} / {challenge.targetValue}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-white/50">Reward</span>
                          <span className="text-[11px] font-medium text-purple-400 flex items-center gap-1">
                            <Zap className="w-3 h-3 fill-purple-400" />
                            {challenge.bonusPoints} pts
                          </span>
                        </div>

                        {item.completed && (
                          <div className="pt-1.5 border-t border-white/10 flex items-center gap-1.5 text-green-400">
                            <Check className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-bold">Completed!</span>
                          </div>
                        )}
                      </div>

                      {/* Hint */}
                      {!item.completed && hint && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-2.5 py-2">
                          <p className="text-[11px] text-blue-300 leading-relaxed">
                            <span className="font-bold">Tip: </span>{hint}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
