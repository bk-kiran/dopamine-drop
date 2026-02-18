'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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
import { Calendar, Star, Flame, CheckCircle2, Circle, Check, Loader2, BookOpen, Users, Briefcase, Heart } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

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
  isUrgent?: boolean
  category: Category
  userNotes?: string
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
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AssignmentDetailsModal({
  open,
  onClose,
  item,
  supabaseUserId,
  onActionComplete,
}: AssignmentDetailsModalProps) {
  const { toast } = useToast()
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [isActioning, setIsActioning] = useState(false)
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)

  const updateAssignmentNotes = useMutation(api.assignments.updateAssignmentNotes)
  const updateCustomTaskNotes = useMutation(api.customTasks.updateCustomTaskNotes)
  const manuallyCompleteAssignment = useMutation(api.assignments.manuallyCompleteAssignment)
  const unCompleteAssignment = useMutation(api.assignments.unCompleteAssignment)
  const completeCustomTask = useMutation(api.customTasks.completeCustomTask)
  const uncompleteCustomTask = useMutation(api.customTasks.uncompleteCustomTask)
  const toggleUrgent = useMutation(api.assignments.toggleUrgent)
  const toggleUrgentCustomTask = useMutation(api.customTasks.toggleUrgentCustomTask)

  // Sync notes when item changes
  useEffect(() => {
    if (item) {
      setNotes(item.userNotes || '')
      setNotesSaved(false)
    }
  }, [item?.id])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [])

  const doSaveNotes = useCallback(async (value: string) => {
    if (!item) return
    setIsSavingNotes(true)
    try {
      if (item.type === 'assignment') {
        await updateAssignmentNotes({ assignmentId: item.id as any, supabaseId: supabaseUserId, notes: value })
      } else {
        await updateCustomTaskNotes({ taskId: item.id as any, supabaseId: supabaseUserId, notes: value })
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

  // ── Quick actions ──

  const handleMarkComplete = async () => {
    if (!item) return
    setIsActioning(true)
    try {
      if (item.type === 'assignment') {
        const result = await manuallyCompleteAssignment({
          assignmentId: item.id as any,
          supabaseId: supabaseUserId,
        })
        toast({
          title: `+${result.pointsAwarded} pts — ${item.title}`,
          description: result.multiplierActive ? '2× XP multiplier applied!' : result.reason.replace('_', ' '),
          className: result.multiplierActive ? 'bg-purple-50 border-purple-200' : 'bg-green-50 border-green-200',
          duration: 4000,
        })
      } else {
        const result = await completeCustomTask({
          taskId: item.id as any,
          supabaseId: supabaseUserId,
        })
        toast({
          title: `+${result.pointsAwarded} pts — ${item.title}`,
          description: result.multiplierActive ? '2× XP multiplier applied!' : undefined,
          className: result.multiplierActive ? 'bg-purple-50 border-purple-200' : 'bg-green-50 border-green-200',
          duration: 4000,
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
          supabaseId: supabaseUserId,
        })
        toast({
          title: `Assignment unticked — ${result.pointsRemoved} pts removed`,
          description: item.title,
          className: 'bg-orange-50 border-orange-200',
          duration: 4000,
        })
      } else {
        const result = await uncompleteCustomTask({
          taskId: item.id as any,
          supabaseId: supabaseUserId,
        })
        toast({
          title: `Task unticked — ${result.pointsRemoved} pts removed`,
          description: item.title,
          className: 'bg-orange-50 border-orange-200',
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
        await toggleUrgent({ assignmentId: item.id as any, supabaseId: supabaseUserId })
      } else {
        await toggleUrgentCustomTask({ taskId: item.id as any, supabaseId: supabaseUserId })
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
            <DialogTitle className="text-xl font-black text-[var(--text-primary)] leading-tight pr-6">
              {item.title}
            </DialogTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {item.type === 'assignment' ? (
                <span className="text-xs text-[var(--text-muted)] font-medium">{item.courseName}</span>
              ) : (
                <span className={`flex items-center gap-1 text-xs font-bold ${categoryColor}`}>
                  {CategoryIcon && <CategoryIcon className="w-3 h-3" />}
                  {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                </span>
              )}
            </div>
          </DialogHeader>

          {/* Metadata row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Due date */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span className="text-xs text-[var(--text-muted)]">
                {formatDueDate(item.type === 'assignment' ? item.dueAt : item.dueAt)}
              </span>
            </div>

            {/* Points */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500/50" />
              <span className="text-xs font-bold text-[var(--text-primary)]">
                {item.type === 'assignment' ? item.pointsPossible : item.pointsValue} pts
              </span>
            </div>

            {/* Status badge */}
            <StatusBadge item={item} />
          </div>

          {/* Description */}
          {item.description ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                {item.type === 'assignment' ? 'Assignment Description' : 'Task Details'}
              </p>
              {item.type === 'assignment' ? (
                <div
                  className="text-sm text-[var(--text-muted)] leading-relaxed prose prose-sm prose-invert max-w-none [&_a]:text-purple-400 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 max-h-36 overflow-y-auto pr-1"
                  dangerouslySetInnerHTML={{
                    __html: item.description.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''),
                  }}
                />
              ) : (
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{item.description}</p>
              )}
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
          {(isPending || isCompleted || item.isUrgent) && (
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

              {/* Untick (manually completed only) */}
              {isCompleted && (
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
