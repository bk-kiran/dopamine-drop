'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, BookOpen } from 'lucide-react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useUser } from '@clerk/nextjs'

export interface SyncedCourse {
  canvasCourseId: string
  name: string
  courseCode: string
}

interface Props {
  isOpen: boolean
  courses: SyncedCourse[]
  onComplete: () => void
}

export function CourseSelectionModal({ isOpen, courses, onComplete }: Props) {
  const { user } = useUser()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const setHiddenCourses = useMutation(api.users.setHiddenCourses)

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirm = async () => {
    if (!user?.id) return
    setIsSaving(true)
    try {
      // Hidden = courses NOT selected by the user
      const hiddenCourses = courses
        .filter((c) => !selected.has(c.canvasCourseId))
        .map((c) => c.canvasCourseId)

      await setHiddenCourses({ clerkId: user.id, hiddenCourses })
      onComplete()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2 }}
            className="bg-[var(--bg-secondary,#0F0A1E)] border border-white/10 rounded-2xl w-full max-w-md"
          >
            <div className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-bold text-white">Select Your Courses</h2>
              </div>
              <p className="text-sm text-white/50 mb-5">
                Choose which courses to track. You can change this later in settings.
              </p>

              <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                {courses.map((course) => {
                  const isSelected = selected.has(course.canvasCourseId)
                  return (
                    <button
                      key={course.canvasCourseId}
                      onClick={() => toggle(course.canvasCourseId)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        isSelected
                          ? 'bg-purple-500/15 border-purple-500/40'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                          isSelected ? 'bg-purple-500 border-purple-500' : 'border-white/30'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{course.name}</p>
                        <p className="text-xs text-white/40">{course.courseCode}</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              <p className="text-xs text-white/30 mb-4 text-center">
                {selected.size} of {courses.length} courses selected
              </p>

              <button
                onClick={handleConfirm}
                disabled={isSaving}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-all"
              >
                {isSaving
                  ? 'Saving…'
                  : selected.size === 0
                  ? 'Skip for now'
                  : `Track ${selected.size} course${selected.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
