'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { X, Flame, Check, Calendar } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'

interface CourseTaskModalProps {
  canvasCourseId: string
  courseName: string
  courseCode: string
  clerkId: string
  isOpen: boolean
  onClose: () => void
}

export function CourseTaskModal({
  canvasCourseId,
  courseName,
  courseCode,
  clerkId,
  isOpen,
  onClose,
}: CourseTaskModalProps) {
  const { toast } = useToast()
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [sortBy, setSortBy] = useState<'dueDate' | 'name'>('dueDate')

  const assignments = useQuery(
    api.assignments.getAssignmentsByCourse,
    isOpen ? { clerkId, canvasCourseId } : 'skip'
  )

  const toggleUrgent = useMutation(api.assignments.toggleUrgent)
  const completeAssignment = useMutation(api.assignments.manuallyCompleteAssignment)

  const handleToggleUrgent = async (assignmentId: string) => {
    try {
      await toggleUrgent({ assignmentId: assignmentId as any, clerkId })
    } catch {
      toast({ title: 'Error', description: 'Failed to update urgent status', variant: 'destructive' })
    }
  }

  const handleComplete = async (assignmentId: string) => {
    try {
      await completeAssignment({ assignmentId: assignmentId as any, clerkId })
      toast({ title: 'Assignment completed!', description: '+points awarded' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to complete', variant: 'destructive' })
    }
  }

  const filtered = (assignments ?? [])
    .filter((a) => {
      const done = a.status === 'submitted' || a.manuallyCompleted
      if (filter === 'pending') return !done
      if (filter === 'completed') return done
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.title.localeCompare(b.title)
      if (!a.dueAt) return 1
      if (!b.dueAt) return -1
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    })

  const pendingCount = (assignments ?? []).filter(
    (a) => a.status !== 'submitted' && !a.manuallyCompleted
  ).length
  const completedCount = (assignments ?? []).length - pendingCount

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--bg-secondary,#0F0A1E)] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/10 shrink-0">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary,white)]">{courseName}</h2>
                  <p className="text-sm text-[var(--text-muted,#9ca3af)] mt-0.5">{courseCode}</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-[var(--text-muted,#9ca3af)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filter + sort row */}
              <div className="flex flex-wrap items-center gap-2">
                {(['all', 'pending', 'completed'] as const).map((f) => {
                  const label =
                    f === 'all'
                      ? `All (${assignments?.length ?? 0})`
                      : f === 'pending'
                      ? `Pending (${pendingCount})`
                      : `Completed (${completedCount})`
                  return (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                        filter === f
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/5 text-[var(--text-muted,#9ca3af)] hover:bg-white/10'
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'dueDate' | 'name')}
                  className="ml-auto px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-[var(--text-muted,#9ca3af)] focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="dueDate">Sort: Due Date</option>
                  <option value="name">Sort: Name</option>
                </select>
              </div>
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {assignments === undefined ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted,#9ca3af)]">
                  {filter === 'completed' ? 'No completed assignments' : 'No assignments found'}
                </div>
              ) : (
                filtered.map((task) => {
                  const done = task.status === 'submitted' || task.manuallyCompleted
                  return (
                    <div
                      key={task._id}
                      className={cn(
                        'flex items-start gap-3 p-4 rounded-xl border transition-all',
                        task.isUrgent && !done
                          ? 'border-orange-500/40 bg-orange-500/5'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                      )}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => !done && handleComplete(task._id)}
                        disabled={done}
                        className={cn(
                          'mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                          done
                            ? 'bg-green-500 border-green-500 cursor-default'
                            : 'border-gray-500 hover:border-purple-400 cursor-pointer'
                        )}
                      >
                        {done && <Check className="w-3 h-3 text-white" />}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium leading-snug',
                            done
                              ? 'line-through text-[var(--text-muted,#9ca3af)]'
                              : 'text-[var(--text-primary,white)]'
                          )}
                        >
                          {task.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-[var(--text-muted,#9ca3af)]">
                          {task.dueAt && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDueDate(task.dueAt)}
                            </span>
                          )}
                          {task.pointsPossible > 0 && (
                            <span className="text-purple-400 font-semibold">
                              {task.pointsPossible} pts
                            </span>
                          )}
                          {done && (
                            <span className="text-green-400 font-semibold">Completed</span>
                          )}
                        </div>
                      </div>

                      {/* Urgent toggle */}
                      {!done && (
                        <button
                          onClick={() => handleToggleUrgent(task._id)}
                          className={cn(
                            'p-1.5 rounded-lg transition-all shrink-0',
                            task.isUrgent
                              ? 'text-orange-400 bg-orange-500/15'
                              : 'text-[var(--text-muted,#9ca3af)] hover:text-orange-400 hover:bg-orange-500/10'
                          )}
                          title={task.isUrgent ? 'Remove from urgent' : 'Mark as urgent'}
                        >
                          <Flame className={cn('w-4 h-4', task.isUrgent && 'fill-orange-400')} />
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function formatDueDate(dueAt: string) {
  const date = new Date(dueAt)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffH = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffH < 0) {
    const absH = Math.abs(diffH)
    return absH < 24 ? `${absH}h overdue` : `${Math.floor(absH / 24)}d overdue`
  }
  if (diffH < 1) return 'Due very soon'
  if (diffH < 24) return `Due in ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1) return 'Due tomorrow'
  return `Due in ${diffD}d`
}
