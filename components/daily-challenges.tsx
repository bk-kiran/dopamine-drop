'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { CheckCircle2, Clock } from 'lucide-react'
import { motion } from 'framer-motion'

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

interface DailyChallengesProps {
  supabaseUserId: string
}

export function DailyChallenges({ supabaseUserId }: DailyChallengesProps) {
  const today = new Date().toISOString().split('T')[0]
  const [timeLeft, setTimeLeft] = useState('')

  const generateDailyChallenges = useMutation(api.challenges.generateDailyChallenges)

  const dailyChallenges = useQuery(api.challenges.getDailyChallenges, {
    supabaseId: supabaseUserId,
  })

  // Generate challenges on mount (idempotent)
  useEffect(() => {
    generateDailyChallenges({ supabaseId: supabaseUserId }).catch(console.error)
  }, [supabaseUserId])

  // Countdown to midnight UTC
  useEffect(() => {
    const update = () => {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setUTCHours(24, 0, 0, 0)
      const diff = midnight.getTime() - now.getTime()
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setTimeLeft(`${h}h ${m}m`)
    }
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [])

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

  // Empty (pool not seeded yet)
  if (dailyChallenges.length === 0) {
    return (
      <div>
        {header}
        <div className="text-center py-6 text-xs text-[var(--text-muted)]">
          No challenges yet — seed the pool first.
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

          const diffConfig =
            DIFFICULTY_CONFIG[challenge.difficulty as keyof typeof DIFFICULTY_CONFIG]
          const rawPct = (item.progress / challenge.targetValue) * 100
          const pct = Math.min(100, rawPct)
          const displayProgress = Math.min(item.progress, challenge.targetValue)

          return (
            <motion.div
              key={item._id}
              layout
              className={`p-3 rounded-xl border transition-all duration-300 ${
                item.completed
                  ? 'bg-green-500/5 border-green-500/20'
                  : 'bg-white/5 border-white/10 hover:border-purple-400/20'
              }`}
            >
              {/* Top row: checkbox + badges + title */}
              <div className="flex items-start gap-2 mb-2">
                {item.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0 mt-0.5" />
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
                      item.completed
                        ? 'text-green-400'
                        : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {challenge.title}
                  </p>
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
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {displayProgress}/{challenge.targetValue}
                  </span>
                  {item.completed && (
                    <span className="text-[10px] text-green-400 font-bold">
                      Done!
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
