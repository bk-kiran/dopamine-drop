'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useUser } from '@clerk/nextjs'
import { motion } from 'framer-motion'
import { BarChart3, Eye, EyeOff, Shield } from 'lucide-react'

interface Props {
  isOpen: boolean
  onComplete: () => void
}

export function GradesOptInModal({ isOpen, onComplete }: Props) {
  const { user } = useUser()
  const [isSaving, setIsSaving] = useState(false)
  const updateGradesPreference = useMutation(api.users.updateGradesPreference)
  const clearUserGrades = useMutation(api.grades.clearUserGrades)

  const handleChoice = async (optIn: boolean) => {
    if (!user) return
    setIsSaving(true)
    try {
      await updateGradesPreference({ clerkId: user.id, hasOptedInToGrades: optIn })
      if (!optIn) {
        // Delete any grades already synced during the initial Canvas sync
        await clearUserGrades({ clerkId: user.id })
      }
      onComplete()
    } catch (err) {
      console.error('Failed to save grades preference', err)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-[var(--bg-secondary,#0F0A1E)] border border-white/10 rounded-2xl w-full max-w-md p-8"
      >
        {/* Icon */}
        <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <BarChart3 className="w-7 h-7 text-blue-400" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-white text-center mb-2">
          Sync Your Grades?
        </h2>
        <p className="text-sm text-white/60 text-center mb-6">
          Would you like dopamine drop to display your Canvas grade percentages?
        </p>

        {/* Privacy note */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Shield className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <ul className="text-xs text-white/50 space-y-1">
              <li>Grades are stored securely and never shared publicly</li>
              <li>You can turn this off anytime in the Grades page</li>
              <li>Turning off will delete all stored grade data</li>
            </ul>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => handleChoice(false)}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 border border-white/10 text-white/70 hover:text-white rounded-xl text-sm font-medium transition-colors"
          >
            <EyeOff className="w-4 h-4" />
            No Thanks
          </button>
          <button
            onClick={() => handleChoice(true)}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all"
          >
            <Eye className="w-4 h-4" />
            {isSaving ? 'Saving…' : 'Yes, Show Grades'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
