'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PartyPopper, Sparkles } from 'lucide-react'

interface CompletedAssignment {
  assignmentId: string
  title: string
  pointsAwarded: number
  reason: string
}

interface Reward {
  id: string
  name: string
  description: string
  rarity: 'common' | 'rare' | 'legendary'
}

interface CompletionToastProps {
  completedAssignments: CompletedAssignment[]
  newReward: Reward | null
}

function formatReason(reason: string): string {
  const map: Record<string, string> = {
    early_submission: 'Early submission!',
    on_time: 'On time!',
    late_submission: 'Late submission',
    streak_bonus: 'Streak bonus!',
  }
  return map[reason] || reason
}

export function CompletionToast({ completedAssignments, newReward }: CompletionToastProps) {
  const { toast } = useToast()
  const [showRewardModal, setShowRewardModal] = useState(false)
  const [claiming, setClaiming] = useState(false)

  // Show toasts for completed assignments
  useEffect(() => {
    completedAssignments.forEach((assignment) => {
      const reasonText = formatReason(assignment.reason)

      toast({
        title: `+${assignment.pointsAwarded} pts`,
        description: `${assignment.title} — ${reasonText}`,
        duration: 4000,
        className: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950/30 dark:border-green-800 dark:text-green-100',
      })
    })
  }, [completedAssignments, toast])

  // Show reward modal after delay
  useEffect(() => {
    if (newReward && completedAssignments.length > 0) {
      setTimeout(() => {
        setShowRewardModal(true)
      }, 1500)
    }
  }, [newReward, completedAssignments])

  const handleClaim = async () => {
    if (!newReward) {
      console.error('[Claim Reward] No reward to claim')
      return
    }

    console.log('[Claim Reward] Claiming reward:', newReward.id)
    setClaiming(true)

    try {
      const res = await fetch('/api/rewards/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId: newReward.id }),
      })

      if (res.ok) {
        console.log('[Claim Reward] Success! Closing modal.')
        setShowRewardModal(false)
      } else {
        let errorMessage = 'Unknown error'
        try {
          const error = await res.json()
          errorMessage = error.error || errorMessage
          console.error('[Claim Reward] Failed:', error)
        } catch (parseError) {
          console.error('[Claim Reward] Failed to parse error response:', parseError)
        }
        alert(`Failed to claim reward: ${errorMessage}`)
      }
    } catch (error) {
      console.error('[Claim Reward] Network error:', error)
      alert('Network error. Please try again.')
    } finally {
      setClaiming(false)
    }
  }

  const rarityColors = {
    common: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-400/30',
    rare: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-400/30 shadow-[0_0_12px_rgba(6,182,212,0.3)]',
    legendary: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-900 dark:text-amber-100 border-0 shadow-[0_0_20px_rgba(251,191,36,0.5)]',
  }

  // Particle positions for animation
  const particles = [
    { x: '-50%', y: '-50%', delay: 0 },
    { x: '50%', y: '-50%', delay: 0.1 },
    { x: '50%', y: '50%', delay: 0.2 },
    { x: '-50%', y: '50%', delay: 0.3 },
    { x: '0%', y: '-60%', delay: 0.15 },
    { x: '0%', y: '60%', delay: 0.25 },
  ]

  return (
    <AnimatePresence>
      {showRewardModal && newReward && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowRewardModal(false)}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.5 }}
            onClick={(e) => e.stopPropagation()}
            className="relative"
          >
            {/* Particle effects */}
            {particles.map((particle, i) => (
              <motion.div
                key={i}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                animate={{
                  x: particle.x,
                  y: particle.y,
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0.5],
                }}
                transition={{
                  duration: 1.5,
                  delay: particle.delay,
                  repeat: Infinity,
                  repeatDelay: 1,
                }}
                className="absolute top-1/2 left-1/2 w-3 h-3 rounded-full bg-purple-400 blur-sm"
              />
            ))}

            <Card className="w-full max-w-md bg-gradient-to-b from-[var(--bg-secondary)] to-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl p-8 shadow-[0_0_60px_rgba(168,85,247,0.3)]">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl mb-3 flex items-center justify-center gap-2 text-[var(--text-primary)]">
                  <PartyPopper className="w-6 h-6 text-purple-500" />
                  Reward Unlocked!
                </CardTitle>
                <Badge
                  className={`${rarityColors[newReward.rarity]} text-sm uppercase px-4 py-1.5 font-bold`}
                >
                  {newReward.rarity}
                </Badge>
              </CardHeader>
              <CardContent className="text-center space-y-4 pt-2">
                <div className="text-xl font-bold text-[var(--text-primary)]">{newReward.name}</div>
                <p className="text-[var(--text-muted)]">{newReward.description}</p>
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 text-white font-semibold hover:from-purple-500 hover:to-violet-400 shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_28px_rgba(168,85,247,0.6)] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {claiming ? 'Claiming...' : (
                    <>
                      Claim Reward
                      <Sparkles className="w-4 h-4" />
                    </>
                  )}
                </button>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
