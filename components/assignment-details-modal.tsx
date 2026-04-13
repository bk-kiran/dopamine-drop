'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { type InsightsViewData } from '@/lib/calculateInsightsGrade'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Calendar, Star, Flame, CheckCircle2, Circle, Check, Loader2, BookOpen, Users, Briefcase, Heart, BarChart2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getUntickStatus, getUntickTooltip } from '@/lib/taskUtils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'academic' | 'club' | 'work' | 'personal'

export interface ModalAssignment {
  type: 'assignment'
  id: string
  title: string
  description?: string | null
  dueAt: string | null
  pointsPossible: number
  status: 'pending' | 'submitted' | 'missing'
  manuallyCompleted?: boolean
  manuallyCompletedAt?: string | null
  isUrgent?: boolean
  courseName: string
  userNotes?: string
}

export interface ModalCustomTask {
  type: 'customTask'
  id: string
  title: string
  description?: string | null
  dueAt?: string | null
  pointsValue: number
  status: 'pending' | 'completed'
  completedAt?: string | null
  isUrgent?: boolean
  category: Category
  userNotes?: string
  // Submission Insights fields
  submittedAt?: number
  originalDueDate?: number
  dueDateHistory?: Array<{ date: number; changedAt: number }>
  maxPossiblePoints?: number
  selfFeedbackRating?: number
  insightsGrade?: string
}

export type ModalItem = ModalAssignment | ModalCustomTask

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<Category, React.ElementType> = {
  academic: BookOpen,
  club: Users,
  work: Briefcase,
  personal: Heart,
}

const CATEGORY_COLOR: Record<Category, string> = {
  academic: 'text-purple-400',
  club: 'text-blue-400',
  work: 'text-green-400',
  personal: 'text-pink-400',
}

function formatDueDate(dueAt: string | null | undefined): string {
  if (!dueAt) return 'No due date'
  return new Date(dueAt).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function StatusBadge({ item }: { item: ModalItem }) {
  if (item.type === 'assignment') {
    const { status, manuallyCompleted } = item
    if (manuallyCompleted || status === 'submitted') {
      return <span className="px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-[11px] font-bold uppercase tracking-wider">Submitted</span>
    }
    if (status === 'missing') {
      return <span className="px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-[11px] font-bold uppercase tracking-wider">Missing</span>
    }
    return <span className="px-2.5 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-[11px] font-bold uppercase tracking-wider">Pending</span>
  }
  // Custom task
  if (item.status === 'completed') {
    return <span className="px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-[11px] font-bold uppercase tracking-wider">Completed</span>
  }
  return <span className="px-2.5 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-[11px] font-bold uppercase tracking-wider">Pending</span>
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AssignmentDetailsModalProps {
  open: boolean
  onClose: () => void
  item: ModalItem | null
  supabaseUserId: string
  onActionComplete?: () => void
  onViewInsights?: (item: ModalCustomTask) => void
  onCompleteWithInsights?: (data: InsightsViewData) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AssignmentDetailsModal({
  open,
  onClose,
  item,
  supabaseUserId,
  onActionComplete,
  onViewInsights,
  onCompleteWithInsights,
}: AssignmentDetailsModalProps) {
  const { toast } = useToast()
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [isActioning, setIsActioning] = useState(false)
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)
  const fieldsTimeout = useRef<NodeJS.Timeout | null>(null)

  // Editable fields state (custom tasks only)
  const [editTitle, setEditTitle] = useState('')
  const [editDueAt, setEditDueAt] = useState('')
  const [editCategory, setEditCategory] = useState<Category>('personal')
  const [editDescription, setEditDescription] = useState('')
  const [editPointsValue, setEditPointsValue] = useState<number>(0)
  const [fieldsSaved, setFieldsSaved] = useState(false)
  const [isSavingFields, setIsSavingFields] = useState(false)

  const updateAssignmentNotes = useMutation(api.assignments.updateAssignmentNotes)
  const updateCustomTaskNotes = useMutation(api.customTasks.updateCustomTaskNotes)
  const updateCustomTask = useMutation(api.customTasks.updateCustomTask)
  const manuallyCompleteAssignment = useMutation(api.assignments.manuallyCompleteAssignment)
  const unCompleteAssignment = useMutation(api.assignments.unCompleteAssignment)
  const completeCustomTask = useMutation(api.customTasks.completeCustomTask)
  const uncompleteCustomTask = useMutation(api.customTasks.uncompleteCustomTask)
  const toggleUrgent = useMutation(api.assignments.toggleUrgent)
  const toggleUrgentCustomTask = useMutation(api.customTasks.toggleUrgentCustomTask)

  // Sync state when item changes
  useEffect(() => {
    if (item) {
      setNotes(item.userNotes || '')
      setNotesSaved(false)
      if (item.type === 'customTask') {
        setEditTitle(item.title)
        setEditDueAt(item.dueAt ? item.dueAt.slice(0, 16) : '')
        setEditCategory(item.category)
        setEditDescription(item.description || '')
        setEditPointsValue(item.pointsValue)
      }
    }
  }, [item?.id])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      if (fieldsTimeout.current) clearTimeout(fieldsTimeout.current)
    }
  }, [])

  const doSaveNotes = useCallback(async (value: string) => {
    if (!item) return
    setIsSavingNotes(true)
    try {
      if (item.type === 'assignment') {
        await updateAssignmentNotes({ assignmentId: item.id as any, clerkId: supabaseUserId, notes: value })
      } else {
        await updateCustomTaskNotes({ taskId: item.id as any, clerkId: supabaseUserId, notes: value })
      }
      setNotesSaved(true)
    } catch (e) {
      console.error('Failed to save notes', e)
    } finally {
      setIsSavingNotes(false)
    }
  }, [item, supabaseUserId, updateAssignmentNotes, updateCustomTaskNotes])

  const handleNotesChange = (value: string) => {
    setNotes(value)
    setNotesSaved(false)
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => doSaveNotes(value), 1200)
  }

  const handleNotesBlur = () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    doSaveNotes(notes)
  }

  const doSaveFields = useCallback(async (
    title: string, description: string, category: Category, dueAt: string, pointsValue: number
  ) => {
    if (!item || item.type !== 'customTask' || !title.trim()) return
    setIsSavingFields(true)
    setFieldsSaved(false)
    try {
      await updateCustomTask({
        taskId: item.id as any,
        clerkId: supabaseUserId,
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        dueAt: dueAt ? dueAt + ':00' : undefined,
        pointsValue: pointsValue > 0 ? pointsValue : undefined,
      })
      setFieldsSaved(true)
    } catch (e) {
      console.error('Failed to save task fields', e)
    } finally {
      setIsSavingFields(false)
    }
  }, [item, supabaseUserId, updateCustomTask])

  const scheduleFieldsSave = (
    title: string, description: string, category: Category, dueAt: string, pointsValue: number
  ) => {
    setFieldsSaved(false)
    if (fieldsTimeout.current) clearTimeout(fieldsTimeout.current)
    fieldsTimeout.current = setTimeout(() => doSaveFields(title, description, category, dueAt, pointsValue), 1200)
  }

  const flushFieldsSave = () => {
    if (fieldsTimeout.current) clearTimeout(fieldsTimeout.current)
    doSaveFields(editTitle, editDescription, editCategory, editDueAt, editPointsValue)
  }

  // ── Quick actions ──

  const handleMarkComplete = async () => {
    if (!item) return
    setIsActioning(true)
    const submittedAtMs = Date.now()
    try {
      if (item.type === 'assignment') {
        const result = await manuallyCompleteAssignment({
          assignmentId: item.id as any,
          clerkId: supabaseUserId,
        })
        toast({
          title: `+${result.pointsAwarded} pts — ${item.title}`,
          description: result.multiplierActive ? '2× XP multiplier applied!' : result.reason.replace('_', ' '),
          className: result.multiplierActive
            ? 'bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-100'
            : 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950/30 dark:border-green-800 dark:text-green-100',
          duration: 4000,
        })
        onCompleteWithInsights?.({
          taskId: item.id as any,
          taskTitle: item.title,
          isCanvas: true,
          pointsEarned: item.pointsPossible ?? 0,
          submittedAt: submittedAtMs,
          originalDueDate: item.dueAt ? new Date(item.dueAt).getTime() : undefined,
          dueDateHistory: [],
          maxPossiblePoints: item.pointsPossible,
          canvasSubmittedAt: submittedAtMs,
        })
      } else {
        const customItem = item as ModalCustomTask
        const result = await completeCustomTask({
          taskId: item.id as any,
          clerkId: supabaseUserId,
        })
        toast({
          title: `+${result.pointsAwarded} pts — ${item.title}`,
          description: result.multiplierActive ? '2× XP multiplier applied!' : undefined,
          className: result.multiplierActive
            ? 'bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-100'
            : 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950/30 dark:border-green-800 dark:text-green-100',
          duration: 4000,
        })
        onCompleteWithInsights?.({
          taskId: item.id as any,
          taskTitle: item.title,
          isCanvas: false,
          pointsEarned: result.pointsAwarded,
          submittedAt: submittedAtMs,
          originalDueDate: customItem.originalDueDate
            ?? (customItem.dueAt ? new Date(customItem.dueAt).getTime() : undefined),
          dueDateHistory: customItem.dueDateHistory ?? [],
          maxPossiblePoints: result.pointsAwarded,
        })
      }
      onActionComplete?.()
      onClose()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to complete', variant: 'destructive' })
    } finally {
      setIsActioning(false)
    }
  }

  const handleUntick = async () => {
    if (!item) return
    setIsActioning(true)
    try {
      if (item.type === 'assignment') {
        const result = await unCompleteAssignment({
          assignmentId: item.id as any,
          clerkId: supabaseUserId,
        })
        toast({
          title: `Assignment unticked — ${result.pointsRemoved} pts removed`,
          description: item.title,
          className: 'bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-100',
          duration: 4000,
        })
      } else {
        const result = await uncompleteCustomTask({
          taskId: item.id as any,
          clerkId: supabaseUserId,
        })
        toast({
          title: `Task unticked — ${result.pointsRemoved} pts removed`,
          description: item.title,
          className: 'bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-100',
          duration: 4000,
        })
      }
      onActionComplete?.()
      onClose()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to untick', variant: 'destructive' })
    } finally {
      setIsActioning(false)
    }
  }

  const handleRemoveUrgent = async () => {
    if (!item) return
    try {
      if (item.type === 'assignment') {
        await toggleUrgent({ assignmentId: item.id as any, clerkId: supabaseUserId })
      } else {
        await toggleUrgentCustomTask({ taskId: item.id as any, clerkId: supabaseUserId })
      }
      toast({ description: 'Removed from urgent', duration: 2000 })
      onActionComplete?.()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  if (!item) return null

  // Derived booleans
  const isPending = item.type === 'assignment'
    ? item.status !== 'submitted' && !item.manuallyCompleted
    : item.status === 'pending'

  const isCompleted = item.type === 'assignment'
    ? item.manuallyCompleted === true
    : item.status === 'completed'

  const isCanvasSubmitted = item.type === 'assignment' && item.status === 'submitted' && !item.manuallyCompleted

  const CategoryIcon = item.type === 'customTask' ? CATEGORY_ICON[item.category] : null
  const categoryColor = item.type === 'customTask' ? CATEGORY_COLOR[item.category] : ''

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] text-[var(--text-primary)] p-0 overflow-hidden">
        {/* Purple top bar */}
        <div className="h-1 bg-gradient-to-r from-purple-600 via-violet-500 to-purple-600" />

        <div className="px-6 pt-5 pb-6 space-y-5">
          {/* Header */}
          <DialogHeader className="space-y-1">
            <DialogTitle className={item.type === 'customTask' ? 'p-0' : 'text-xl font-black text-[var(--text-primary)] leading-tight pr-6'}>
              {item.type === 'customTask' ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => {
                    setEditTitle(e.target.value)
                    scheduleFieldsSave(e.target.value, editDescription, editCategory, editDueAt, editPointsValue)
                  }}
                  onBlur={flushFieldsSave}
                  className="text-xl font-black text-[var(--text-primary)] leading-tight pr-6 bg-transparent border-0 border-b border-white/10 focus:border-purple-500/50 outline-none w-full pb-1 transition-colors"
                  placeholder="Task title..."
                />
              ) : item.title}
            </DialogTitle>
            {item.type === 'customTask' && (
              <div className="h-3">
                {isSavingFields && (
                  <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />Saving…
                  </span>
                )}
                {fieldsSaved && !isSavingFields && (
                  <span className="flex items-center gap-1 text-[10px] text-green-400">
                    <Check className="w-2.5 h-2.5" />Saved
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {item.type === 'assignment' ? (
                <span className="text-xs text-[var(--text-muted)] font-medium">{item.courseName}</span>
              ) : (
                <select
                  value={editCategory}
                  onChange={(e) => {
                    const val = e.target.value as Category
                    setEditCategory(val)
                    scheduleFieldsSave(editTitle, editDescription, val, editDueAt, editPointsValue)
                  }}
                  className={`flex items-center gap-1 text-xs font-bold bg-transparent border-0 outline-none cursor-pointer ${CATEGORY_COLOR[editCategory]}`}
                >
                  <option value="academic" className="bg-[#1a1625] text-white">Academic</option>
                  <option value="club" className="bg-[#1a1625] text-white">Club</option>
                  <option value="work" className="bg-[#1a1625] text-white">Work</option>
                  <option value="personal" className="bg-[#1a1625] text-white">Personal</option>
                </select>
              )}
            </div>
          </DialogHeader>

          {/* Metadata row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Due date */}
            {item.type === 'customTask' ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 focus-within:border-purple-500/50 transition-colors">
                  <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <input
                    type="datetime-local"
                    value={editDueAt}
                    onChange={(e) => {
                      setEditDueAt(e.target.value)
                      scheduleFieldsSave(editTitle, editDescription, editCategory, e.target.value, editPointsValue)
                    }}
                    onBlur={flushFieldsSave}
                    className="text-xs text-[var(--text-muted)] bg-transparent border-0 outline-none"
                  />
                </div>
                <AnimatePresence>
                  {item.dueAt && editDueAt && (editDueAt + ':00') > item.dueAt && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs text-amber-500 pl-1"
                    >
                      Extending your due date will reduce your max possible points
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span className="text-xs text-[var(--text-muted)]">
                  {formatDueDate(item.dueAt)}
                </span>
              </div>
            )}

            {/* Points */}
            {item.type === 'customTask' ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 focus-within:border-purple-500/50 transition-colors">
                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500/50 shrink-0" />
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={editPointsValue}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(1000, Number(e.target.value) || 1))
                    setEditPointsValue(val)
                    scheduleFieldsSave(editTitle, editDescription, editCategory, editDueAt, val)
                  }}
                  onBlur={flushFieldsSave}
                  className="w-12 text-xs font-bold text-[var(--text-primary)] bg-transparent border-0 outline-none"
                />
                <span className="text-xs text-[var(--text-muted)]">pts</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500/50" />
                <span className="text-xs font-bold text-[var(--text-primary)]">{item.pointsPossible} pts</span>
              </div>
            )}

            {/* Status badge */}
            <StatusBadge item={item} />
          </div>

          {/* Description */}
          {item.type === 'assignment' && item.description ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                Assignment Description
              </p>
              <div
                className="text-sm text-[var(--text-muted)] leading-relaxed prose prose-sm prose-invert max-w-none [&_a]:text-purple-400 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 max-h-36 overflow-y-auto pr-1"
                dangerouslySetInnerHTML={{
                  __html: item.description.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''),
                }}
              />
            </div>
          ) : item.type === 'customTask' ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                Description
              </p>
              <Textarea
                value={editDescription}
                onChange={(e) => {
                  setEditDescription(e.target.value)
                  scheduleFieldsSave(editTitle, e.target.value, editCategory, editDueAt, editPointsValue)
                }}
                onBlur={flushFieldsSave}
                placeholder="Add a description…"
                className="min-h-[60px] text-sm bg-white/5 border-white/10 focus:border-purple-500/50 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none"
              />
            </div>
          ) : null}

          {/* Notes section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">My Notes</p>
              {isSavingNotes && (
                <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving…
                </span>
              )}
              {notesSaved && !isSavingNotes && (
                <span className="flex items-center gap-1 text-[10px] text-green-400">
                  <Check className="w-3 h-3" />
                  Saved
                </span>
              )}
            </div>
            <Textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add personal notes, reminders, or highlights…"
              className="min-h-[80px] text-sm bg-white/5 border-white/10 focus:border-purple-500/50 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none"
            />
          </div>

          {/* Quick actions footer */}
          {(isPending || isCompleted || isCanvasSubmitted || item.isUrgent ||
            (item.type === 'customTask' && item.status === 'completed' && item.submittedAt)) && (
            <div className="flex items-center gap-2 pt-1 border-t border-white/10 flex-wrap">
              {/* Mark Complete */}
              {isPending && !isCanvasSubmitted && (
                <button
                  onClick={handleMarkComplete}
                  disabled={isActioning}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-semibold hover:bg-green-500/30 transition-all disabled:opacity-50"
                >
                  {isActioning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                  Mark Complete
                </button>
              )}

              {/* Untick (completed tasks) */}
              {(isCompleted || isCanvasSubmitted) && (() => {
                const untickStatus = getUntickStatus({
                  type: item.type === 'assignment' ? 'canvas' : 'custom',
                  manuallyCompleted: item.type === 'assignment' ? item.manuallyCompleted : undefined,
                  manuallyCompletedAt: item.type === 'assignment' ? item.manuallyCompletedAt : undefined,
                  completedAt: item.type === 'customTask' ? item.completedAt : undefined,
                })
                if (!untickStatus.canUntick) {
                  return (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <button
                              disabled
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/30 text-sm font-semibold cursor-not-allowed"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Untick
                            </button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs">{getUntickTooltip(untickStatus.reason)}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                }
                return (
                  <button
                    onClick={handleUntick}
                    disabled={isActioning}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 text-sm font-semibold hover:bg-orange-500/30 transition-all disabled:opacity-50"
                  >
                    {isActioning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Untick
                  </button>
                )
              })()}

              {/* View Insights */}
              {item.type === 'customTask' && item.status === 'completed' && item.submittedAt && onViewInsights && (
                <button
                  onClick={() => { onViewInsights(item); onClose() }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-semibold hover:bg-purple-500/20 transition-all"
                >
                  <BarChart2 className="w-4 h-4" />
                  View Insights
                </button>
              )}

              {/* Remove from Urgent */}
              {item.isUrgent && isPending && (
                <button
                  onClick={handleRemoveUrgent}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400/80 text-sm font-semibold hover:bg-orange-500/20 transition-all"
                >
                  <Flame className="w-4 h-4 fill-orange-500 text-orange-500" />
                  Remove from Urgent
                </button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
