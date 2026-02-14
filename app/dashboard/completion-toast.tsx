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
        className: 'bg-green-50 border-green-200 text-green-900',
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
        const error = await res.json()
        console.error('[Claim Reward] Failed:', error)
        alert(`Failed to claim reward: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[Claim Reward] Network error:', error)
      alert('Network error. Please try again.')
    } finally {
      setClaiming(false)
    }
  }

  const rarityColors = {
    common: 'bg-gray-100 text-gray-800 border-gray-300',
    rare: 'bg-blue-100 text-blue-800 border-blue-300',
    legendary: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  }

  return (
    <AnimatePresence>
      {showRewardModal && newReward && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowRewardModal(false)}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.5 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="w-full max-w-md shadow-2xl">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl mb-2 flex items-center justify-center gap-2">
                  <PartyPopper className="w-6 h-6 text-purple-500" />
                  Reward Unlocked!
                </CardTitle>
                <Badge
                  className={`${rarityColors[newReward.rarity]} text-sm uppercase px-3 py-1`}
                >
                  {newReward.rarity}
                </Badge>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <div className="text-xl font-bold">{newReward.name}</div>
                <p className="text-muted-foreground">{newReward.description}</p>
                <Button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 flex items-center justify-center gap-2"
                >
                  {claiming ? 'Claiming...' : (
                    <>
                      Claim Reward
                      <Sparkles className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
