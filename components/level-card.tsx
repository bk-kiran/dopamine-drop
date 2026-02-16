'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Rocket } from 'lucide-react'
import { motion } from 'framer-motion'

interface LevelCardProps {
  supabaseUserId: string
}

export function LevelCard({ supabaseUserId }: LevelCardProps) {
  const levelData = useQuery(api.users.getLevel, {
    supabaseId: supabaseUserId,
  })

  if (!levelData) {
    return (
      <div className="bg-white/5 backdrop-blur-md border border-purple-500/20 rounded-2xl p-6">
        <div className="flex flex-col items-center">
          <Rocket className="w-8 h-8 text-purple-400 mb-4" />
          <p className="text-sm text-[var(--text-muted)]">Loading...</p>
        </div>
      </div>
    )
  }

  const { nextLevelPoints, pointsNeeded, nextLevelName, progressPercentage } = levelData

  return (
    <div className="bg-white/5 backdrop-blur-md border border-purple-500/20 rounded-2xl p-6">
      <div className="flex flex-col items-center">
        {/* Rocket Icon */}
        <Rocket className="w-8 h-8 text-purple-400 mb-4" />

        {/* Title */}
        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">
          Goal: {nextLevelPoints} PTS
        </h3>

        {/* Progress Bar */}
        <div className="w-full relative h-[6px] bg-white/10 rounded-full overflow-hidden mb-3">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-violet-500 rounded-full transition-all duration-1000"
          />
        </div>

        {/* Progress Text */}
        <p className="text-sm text-[var(--text-muted)] text-center">
          {pointsNeeded} pts until {nextLevelName}
        </p>
      </div>
    </div>
  )
}
