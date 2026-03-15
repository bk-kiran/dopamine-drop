'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useUser } from '@clerk/nextjs'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Trash2, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface Props {
  isEnabled: boolean
  onToggle: (enabled: boolean) => void
}

export function GradesToggle({ isEnabled, onToggle }: Props) {
  const { user } = useUser()
  const { toast } = useToast()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const updateGradesPreference = useMutation(api.users.updateGradesPreference)
  const clearUserGrades = useMutation(api.grades.clearUserGrades)

  const handleEnable = async () => {
    if (!user) return
    setIsUpdating(true)
    try {
      await updateGradesPreference({ clerkId: user.id, hasOptedInToGrades: true })
      // Sync course-level grades from Canvas
      await fetch('/api/canvas/sync-grades', { method: 'POST' })
      toast({ description: 'Grades synced from Canvas', duration: 3000 })
      onToggle(true)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to enable grades', variant: 'destructive', duration: 3000 })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDisable = async () => {
    if (!user) return
    setIsUpdating(true)
    try {
      await clearUserGrades({ clerkId: user.id })
      await updateGradesPreference({ clerkId: user.id, hasOptedInToGrades: false })
      toast({ description: 'Grade data deleted', duration: 3000 })
      onToggle(false)
      setShowConfirm(false)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to disable grades', variant: 'destructive', duration: 3000 })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <>
      <button
        onClick={isEnabled ? () => setShowConfirm(true) : handleEnable}
        disabled={isUpdating}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
          isEnabled
            ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30'
            : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10'
        }`}
      >
        {isUpdating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isEnabled ? (
          <Eye className="w-4 h-4" />
        ) : (
          <EyeOff className="w-4 h-4" />
        )}
        {isEnabled ? 'Sharing Grades' : 'Share Grades'}
      </button>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18 }}
              className="bg-[var(--bg-secondary,#0F0A1E)] border border-white/10 rounded-2xl w-full max-w-sm p-7"
            >
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>

              <h2 className="text-lg font-bold text-white text-center mb-2">Stop Sharing Grades?</h2>
              <p className="text-sm text-white/60 text-center mb-6">
                This will <span className="text-red-400 font-semibold">permanently delete</span> all grade data from dopamine drop. You can re-enable later, but current data will be lost.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={isUpdating}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 border border-white/10 text-white/70 hover:text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisable}
                  disabled={isUpdating}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Delete Grades
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
