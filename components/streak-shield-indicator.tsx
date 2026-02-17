'use client'

import { useEffect, useRef, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface StreakShieldIndicatorProps {
  shields: number // 0–3
}

const MAX_SHIELDS = 3

export function StreakShieldIndicator({ shields }: StreakShieldIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const prevShieldsRef = useRef(shields)
  const [breakingSlot, setBreakingSlot] = useState<number | null>(null)

  // Detect shield consumption and trigger break animation on the slot that was used
  useEffect(() => {
    if (shields < prevShieldsRef.current) {
      // The consumed slot index = the new count (e.g. going 2→1 means slot index 1 broke)
      setBreakingSlot(prevShieldsRef.current - 1)
      const timer = setTimeout(() => setBreakingSlot(null), 600)
      prevShieldsRef.current = shields
      return () => clearTimeout(timer)
    }
    prevShieldsRef.current = shields
  }, [shields])

  if (shields === 0 && breakingSlot === null) return null

  return (
    <div
      className="relative flex items-center gap-0.5"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {Array.from({ length: MAX_SHIELDS }).map((_, i) => {
        const filled = i < shields || (breakingSlot === i)
        const isBreaking = breakingSlot === i

        return (
          <AnimatePresence key={i} mode="wait">
            {isBreaking ? (
              <motion.div
                key="breaking"
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeIn' }}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400 fill-purple-400/30" />
              </motion.div>
            ) : filled ? (
              <motion.div
                key="filled"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400 fill-purple-400/30" />
              </motion.div>
            ) : (
              <div key="empty">
                <ShieldCheck className="w-3.5 h-3.5 text-gray-500/40" />
              </div>
            )}
          </AnimatePresence>
        )
      })}

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none"
          >
            <div className="bg-[var(--glass-bg)] backdrop-blur-md border border-purple-500/30 rounded-lg px-3 py-1.5 text-center whitespace-nowrap shadow-lg">
              <p className="text-[11px] font-semibold text-purple-300">Streak Shields</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                Protects your streak for 1 missed day each
              </p>
              <p className="text-[10px] text-purple-400 font-bold mt-0.5">
                {shields}/{MAX_SHIELDS} remaining
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
