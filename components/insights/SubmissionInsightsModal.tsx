'use client'

import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import {
  Sparkles, X, CheckCircle2, AlertTriangle, Zap, Trophy,
  Star, ArrowRight, Loader2, Flame, TrendingUp, BarChart2,
  RefreshCcw, Sun, CalendarDays, CalendarCheck, History,
} from 'lucide-react'
import {
  calculateInsightsGrade,
  type InsightsGradeResult,
  type InsightsViewData,
} from '@/lib/calculateInsightsGrade'

// InsightsViewData is defined in lib/types/insights.ts, re-exported via lib/calculateInsightsGrade.ts
export type { InsightsViewData }

// ─── Props ────────────────────────────────────────────────────────────────────

interface SubmissionInsightsModalProps extends InsightsViewData {
  open: boolean
  onClose: () => void
  supabaseUserId: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const GRADE_COLORS: Record<string, string> = {
  A: 'text-emerald-400',
  B: 'text-blue-400',
  C: 'text-amber-400',
  D: 'text-orange-400',
  F: 'text-red-400',
}

export const GRADE_BG: Record<string, string> = {
  A: 'bg-emerald-500/10 border-emerald-500/25',
  B: 'bg-blue-500/10 border-blue-500/25',
  C: 'bg-amber-500/10 border-amber-500/25',
  D: 'bg-orange-500/10 border-orange-500/25',
  F: 'bg-red-500/10 border-red-500/25',
}

const GRADE_COMMENTS: Record<string, { text: string; Icon: React.ElementType }> = {
  A: { text: 'Outstanding discipline', Icon: Flame },
  B: { text: 'Solid work, keep it up', Icon: TrendingUp },
  C: { text: "Room to grow — you've got this", Icon: BarChart2 },
  D: { text: 'Rough one. Reset and push forward', Icon: RefreshCcw },
  F: { text: 'It happens. Tomorrow is a fresh start', Icon: Sun },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function computeLateness(
  submittedAt: number | undefined,
  originalDueDate: number | undefined,
): { isLate: boolean; label: string } {
  if (submittedAt === undefined) return { isLate: false, label: 'Unknown' }
  if (originalDueDate === undefined) return { isLate: false, label: 'Completed' }
  const msLate = submittedAt - originalDueDate
  if (msLate <= 0) return { isLate: false, label: 'On Time' }
  const totalHours = Math.floor(msLate / (1000 * 60 * 60))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return {
    isLate: true,
    label: days > 0 ? `${days}d ${hours}h late` : `${hours}h late`,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BreakdownBar({
  label, score, max, delay,
}: { label: string; score: number; max: number; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay }}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-muted)] font-medium">{label}</span>
        <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums">
          {score} <span className="text-[var(--text-muted)] font-normal">/ {max}</span>
        </span>
      </div>
      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: max > 0 ? score / max : 0 }}
          transition={{ duration: 0.7, delay: delay + 0.1, ease: 'easeOut' }}
          style={{ transformOrigin: 'left' }}
          className="h-full w-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400"
        />
      </div>
    </motion.div>
  )
}

function StarRating({ value, onChange, locked }: {
  value: number
  onChange: (v: number) => void
  locked?: boolean
}) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value)
        return (
          <motion.button
            key={star}
            type="button"
            whileHover={locked ? {} : { scale: 1.25 }}
            whileTap={locked ? {} : { scale: 0.85 }}
            onHoverStart={() => !locked && setHovered(star)}
            onHoverEnd={() => !locked && setHovered(0)}
            onClick={() => !locked && onChange(star)}
            className={`p-0.5 focus:outline-none ${locked ? 'cursor-default' : ''}`}
          >
            <Star
              className={`w-7 h-7 transition-colors duration-150 ${
                filled ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'
              }`}
            />
          </motion.button>
        )
      })}
    </div>
  )
}

function StatCard({
  icon: Icon, iconClass, label, value, valueClass, colSpan,
}: {
  icon: React.ElementType
  iconClass: string
  label: string
  value: React.ReactNode
  valueClass?: string
  colSpan?: boolean
}) {
  return (
    <div className={`p-3 rounded-xl bg-white/5 border border-white/10 space-y-1 ${colSpan ? 'col-span-2' : ''}`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          {label}
        </span>
      </div>
      <p className={`text-sm font-bold ${valueClass ?? 'text-[var(--text-primary)]'}`}>{value}</p>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function SubmissionInsightsModal({
  open,
  onClose,
  taskId,
  taskTitle,
  isCanvas,
  pointsEarned,
  submittedAt,
  originalDueDate,
  dueDateHistory,
  maxPossiblePoints,
  canvasSubmittedAt,
  existingRating,
  existingGrade,
  supabaseUserId,
}: SubmissionInsightsModalProps) {
  const saveInsightsFeedback = useMutation(api.customTasks.saveInsightsFeedback)
  const saveAssignmentInsightsFeedback = useMutation(api.assignments.saveAssignmentInsightsFeedback)

  const [selfRating, setSelfRating] = useState(existingRating ?? 0)
  const [gradeRevealed, setGradeRevealed] = useState(!!existingGrade)
  const [isSaving, setIsSaving] = useState(false)

  // Sync state when modal opens for a new task (or review of an old one)
  useEffect(() => {
    if (open) {
      setSelfRating(existingRating ?? 0)
      setGradeRevealed(!!existingGrade)
    }
  }, [open, taskId, existingRating, existingGrade])

  // Review mode = task already has a saved grade; "Done" becomes "Close" without re-saving
  const isReviewMode = !!existingGrade

  const resolvedSubmittedAt = canvasSubmittedAt ?? submittedAt
  const resolvedMaxPossible = maxPossiblePoints && maxPossiblePoints > 0 ? maxPossiblePoints : undefined
  const lateness = computeLateness(resolvedSubmittedAt, originalDueDate)

  const gradeResult: InsightsGradeResult | null = useMemo(() => {
    if (!selfRating) return null
    return calculateInsightsGrade(
      resolvedSubmittedAt ?? Date.now(), // safety net: treat missing time as now (on-time)
      originalDueDate,
      dueDateHistory,
      pointsEarned,
      resolvedMaxPossible ?? pointsEarned, // if maxPossible unknown, treat efficiency as 100%
      selfRating,
    )
  }, [selfRating, resolvedSubmittedAt, originalDueDate, dueDateHistory, pointsEarned, resolvedMaxPossible])

  const handleDone = async () => {
    if (isReviewMode) { handleClose(); return }
    if (!gradeResult) return
    setIsSaving(true)
    try {
      if (isCanvas) {
        await saveAssignmentInsightsFeedback({
          assignmentId: taskId as any,
          clerkId: supabaseUserId,
          selfFeedbackRating: selfRating,
          insightsGrade: gradeResult.grade,
          insightsSubmittedAt: resolvedSubmittedAt ?? Date.now(),
        })
      } else {
        await saveInsightsFeedback({
          taskId,
          clerkId: supabaseUserId,
          selfFeedbackRating: selfRating,
          insightsGrade: gradeResult.grade,
        })
      }
    } catch (e) {
      console.error('[insights] Failed to save feedback:', e)
    } finally {
      setIsSaving(false)
      handleClose()
    }
  }

  const handleClose = () => {
    setSelfRating(0)
    setGradeRevealed(false)
    onClose()
  }

  if (!open || typeof document === 'undefined') return null

  const gradeColor = gradeResult ? GRADE_COLORS[gradeResult.grade] : ''
  const gradeBg = gradeResult ? GRADE_BG[gradeResult.grade] : ''
  const gradeComment = gradeResult ? GRADE_COMMENTS[gradeResult.grade] : null

  // Stat card helpers
  const assignedValue = originalDueDate ? formatDate(originalDueDate) : 'No due date set'
  const submittedValue = resolvedSubmittedAt ? formatDate(resolvedSubmittedAt) : 'Unknown'
  const statusIcon = lateness.isLate ? AlertTriangle : CheckCircle2
  const statusIconClass = lateness.isLate ? 'text-amber-400' : 'text-green-400'
  const statusValueClass = lateness.isLate ? 'text-amber-400' : 'text-green-400'

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="insights-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Card */}
          <motion.div
            key="insights-modal"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-md rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-1 bg-gradient-to-r from-purple-600 via-violet-500 to-purple-600" />

              <div className="max-h-[85vh] overflow-y-auto px-6 py-5 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <h2 className="text-base font-black text-[var(--text-primary)]">
                        Submission Insights
                      </h2>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] leading-snug pl-6 line-clamp-2">
                      {taskTitle}
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="shrink-0 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <StatCard
                    icon={CalendarDays}
                    iconClass="text-purple-400"
                    label="Original Due"
                    value={assignedValue}
                  />
                  <StatCard
                    icon={CalendarCheck}
                    iconClass="text-green-400"
                    label="Submitted"
                    value={submittedValue}
                  />
                  {!isCanvas && (
                    <StatCard
                      icon={History}
                      iconClass="text-blue-400"
                      label="Due Date Changes"
                      value={dueDateHistory.length}
                    />
                  )}
                  <StatCard
                    icon={statusIcon}
                    iconClass={statusIconClass}
                    label="Status"
                    value={lateness.label}
                    valueClass={statusValueClass}
                    colSpan={isCanvas}
                  />
                  <StatCard
                    icon={Zap}
                    iconClass="text-yellow-400"
                    label="Points Earned"
                    value={pointsEarned}
                  />
                  <StatCard
                    icon={Trophy}
                    iconClass="text-purple-400"
                    label="Max Possible"
                    value={resolvedMaxPossible ?? '—'}
                  />
                </div>

                {/* Self-feedback */}
                <div className="space-y-3">
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    How well did you work on this?
                  </p>
                  <StarRating value={selfRating} onChange={setSelfRating} locked={isReviewMode} />
                  {!isReviewMode && (
                    <p className="text-xs text-[var(--text-muted)]">
                      Be honest — this factors into your grade
                    </p>
                  )}
                </div>

                {/* Reveal Grade button — only shown when not review mode */}
                <AnimatePresence>
                  {selfRating > 0 && !gradeRevealed && !isReviewMode && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.25 }}
                    >
                      <Button
                        onClick={() => setGradeRevealed(true)}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold gap-2"
                      >
                        Reveal Grade
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Grade reveal */}
                <AnimatePresence>
                  {gradeRevealed && gradeResult && gradeComment && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.88 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.88 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                      className="space-y-4"
                    >
                      {/* Grade letter */}
                      <div className={`flex flex-col items-center py-6 rounded-2xl border ${gradeBg}`}>
                        <span className={`text-7xl font-black leading-none ${gradeColor}`}>
                          {gradeResult.grade}
                        </span>
                        <span className="mt-2 text-sm text-[var(--text-muted)] tabular-nums">
                          {gradeResult.score} / 100
                        </span>
                        <div className={`mt-3 flex items-center gap-1.5 text-sm font-semibold ${gradeColor}`}>
                          <gradeComment.Icon className="w-4 h-4" />
                          {gradeComment.text}
                        </div>
                      </div>

                      {/* Breakdown */}
                      <div className="space-y-3 px-1">
                        <BreakdownBar label="Timeliness"   score={gradeResult.breakdown.timeliness}   max={40} delay={0} />
                        <BreakdownBar label="Efficiency"   score={gradeResult.breakdown.efficiency}   max={30} delay={0.1} />
                        <BreakdownBar label="Consistency"  score={gradeResult.breakdown.consistency}  max={15} delay={0.2} />
                        <BreakdownBar label="Self-Score"   score={gradeResult.breakdown.selfScore}    max={15} delay={0.3} />
                      </div>

                      {/* Done / Close */}
                      <Button
                        onClick={handleDone}
                        disabled={isSaving}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold"
                      >
                        {isSaving ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />Saving…
                          </span>
                        ) : isReviewMode ? 'Close' : 'Done'}
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
