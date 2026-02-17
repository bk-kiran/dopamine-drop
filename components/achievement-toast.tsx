'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Star, Moon, Zap, Shield, Flame, Trophy, Crown,
  Sun, Dumbbell, Target, X,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ElementType> = {
  Star, Moon, Zap, Shield, Flame, Trophy, Crown, Sun, Dumbbell, Target,
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; glow: string; iconBg: string }> = {
  yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', text: 'text-yellow-400', glow: 'shadow-yellow-500/30', iconBg: 'bg-yellow-500/20' },
  blue:   { bg: 'bg-blue-500/10',   border: 'border-blue-500/40',   text: 'text-blue-400',   glow: 'shadow-blue-500/30',   iconBg: 'bg-blue-500/20' },
  green:  { bg: 'bg-green-500/10',  border: 'border-green-500/40',  text: 'text-green-400',  glow: 'shadow-green-500/30',  iconBg: 'bg-green-500/20' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/40', text: 'text-orange-400', glow: 'shadow-orange-500/30', iconBg: 'bg-orange-500/20' },
  red:    { bg: 'bg-red-500/10',    border: 'border-red-500/40',    text: 'text-red-400',    glow: 'shadow-red-500/30',    iconBg: 'bg-red-500/20' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/40', text: 'text-purple-400', glow: 'shadow-purple-500/30', iconBg: 'bg-purple-500/20' },
  amber:  { bg: 'bg-amber-500/10',  border: 'border-amber-500/40',  text: 'text-amber-400',  glow: 'shadow-amber-500/30',  iconBg: 'bg-amber-500/20' },
  gold:   { bg: 'bg-yellow-500/10', border: 'border-yellow-400/50', text: 'text-yellow-300', glow: 'shadow-yellow-400/40', iconBg: 'bg-yellow-400/20' },
}

interface PendingAchievement {
  _id: string
  achievement: {
    key: string
    name: string
    description: string
    icon: string
    color: string
    bonusPoints: number
  }
  unlockedAt: string
}

function AchievementToastInner({ supabaseUserId }: { supabaseUserId: string }) {
  const [queue, setQueue] = useState<PendingAchievement[]>([])
  const [current, setCurrent] = useState<PendingAchievement | null>(null)
  const [exiting, setExiting] = useState(false)

  const unseenAchievements = useQuery(api.achievements.getUnseenAchievements, {
    supabaseId: supabaseUserId,
  })
  const markSeen = useMutation(api.achievements.markAchievementsSeen)

  // When new unseen achievements arrive, enqueue them
  useEffect(() => {
    if (!unseenAchievements || unseenAchievements.length === 0) return
    setQueue(unseenAchievements as PendingAchievement[])
  }, [unseenAchievements])

  const advanceQueue = useCallback(() => {
    setQueue((prev) => {
      if (prev.length === 0) {
        setCurrent(null)
        return prev
      }
      const [next, ...rest] = prev
      setCurrent(next)
      setExiting(false)
      return rest
    })
  }, [])

  // Show next item when queue has items and nothing is showing
  useEffect(() => {
    if (!current && queue.length > 0) {
      advanceQueue()
    }
  }, [queue, current, advanceQueue])

  // Auto-dismiss after 5s
  useEffect(() => {
    if (!current) return
    const timer = setTimeout(handleDismiss, 5000)
    return () => clearTimeout(timer)
  }, [current])

  // Mark seen once everything is dismissed
  useEffect(() => {
    if (!current && queue.length === 0 && unseenAchievements && unseenAchievements.length > 0) {
      markSeen({ supabaseId: supabaseUserId }).catch(console.error)
    }
  }, [current, queue, unseenAchievements, supabaseUserId, markSeen])

  const handleDismiss = () => {
    setExiting(true)
    setTimeout(() => {
      setCurrent(null)
      setExiting(false)
      // 1-second gap before next
      setTimeout(advanceQueue, 1000)
    }, 300)
  }

  if (!current || !current.achievement) return null

  const achievement = current.achievement
  const colors = COLOR_MAP[achievement.color] ?? COLOR_MAP.purple
  const IconComponent = ICON_MAP[achievement.icon] ?? Star

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
      <AnimatePresence>
        {!exiting && (
          <motion.div
            key={current._id}
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className={`pointer-events-auto flex items-center gap-4 px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl ${colors.bg} ${colors.border} ${colors.glow}`}
            style={{ minWidth: 320, maxWidth: 420 }}
          >
            {/* Glowing icon circle */}
            <div className={`shrink-0 w-14 h-14 rounded-full flex items-center justify-center ${colors.iconBg} border ${colors.border} shadow-lg`}>
              <IconComponent className={`w-7 h-7 ${colors.text}`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-(--text-muted) mb-0.5">
                Achievement Unlocked!
              </p>
              <p className={`text-base font-bold leading-tight ${colors.text}`}>
                {achievement.name}
              </p>
              <p className="text-xs text-(--text-muted) mt-0.5 leading-snug">
                {achievement.description}
              </p>
              <p className={`text-xs font-bold mt-1 ${colors.text}`}>
                +{achievement.bonusPoints} bonus pts
              </p>
            </div>

            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className="shrink-0 p-1.5 rounded-lg text-(--text-muted) hover:text-(--text-primary) hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Self-contained wrapper — fetches its own Supabase user ID
export function AchievementToast() {
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null)

  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setSupabaseUserId(user.id)
    }
    getUser()
  }, [])

  if (!supabaseUserId) return null
  return <AchievementToastInner supabaseUserId={supabaseUserId} />
}
