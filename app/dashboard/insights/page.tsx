'use client'

import { useState, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { motion } from 'framer-motion'
import {
  BarChart2, Zap, CheckCircle2, AlertTriangle, Star,
  TrendingUp, Clock, Eye,
} from 'lucide-react'
import { DashboardNavbar } from '@/components/dashboard-navbar'
import { SubmissionInsightsModal, GRADE_COLORS, GRADE_BG } from '@/components/insights/SubmissionInsightsModal'
import { type InsightsViewData } from '@/lib/calculateInsightsGrade'

// ─── Grade helpers ────────────────────────────────────────────────────────────

const GRADE_NUMERIC: Record<string, number> = { A: 100, B: 85, C: 73, D: 62, F: 50 }

function numericToLetter(n: number): string {
  if (n >= 90) return 'A'
  if (n >= 80) return 'B'
  if (n >= 65) return 'C'
  if (n >= 55) return 'D'
  return 'F'
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function latenessLabel(submittedAt: number | undefined, originalDueDate: number | undefined): {
  isLate: boolean
  label: string
} {
  if (!submittedAt || !originalDueDate) return { isLate: false, label: 'No due date' }
  const msLate = submittedAt - originalDueDate
  if (msLate <= 0) return { isLate: false, label: 'On time' }
  const totalHours = Math.floor(msLate / (1000 * 60 * 60))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return {
    isLate: true,
    label: days > 0 ? `${days}d ${hours}h late` : `${hours}h late`,
  }
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryCard({ icon: Icon, iconClass, label, value }: {
  icon: React.ElementType
  iconClass: string
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex-1 min-w-0 p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
      </div>
      <p className="text-lg font-black text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const { user: clerkUser } = useUser()
  const supabaseUserId = clerkUser?.id ?? null

  const tasks = useQuery(
    api.customTasks.getCompletedInsightTasks,
    supabaseUserId ? { clerkId: supabaseUserId } : 'skip'
  )

  const [insightsData, setInsightsData] = useState<InsightsViewData | null>(null)

  const summary = useMemo(() => {
    if (!tasks || tasks.length === 0) return null

    const total = tasks.length
    const avgNumeric = tasks.reduce((acc: number, t: any) => acc + (GRADE_NUMERIC[t.insightsGrade] ?? 0), 0) / total
    const onTimeCount = tasks.filter((t: any) => !t.originalDueDate || (t.submittedAt ?? 0) <= t.originalDueDate).length
    const onTimePct = Math.round((onTimeCount / total) * 100)
    const ratedTasks = tasks.filter((t: any) => t.selfFeedbackRating)
    const avgRating = ratedTasks.length
      ? ratedTasks.reduce((acc: number, t: any) => acc + t.selfFeedbackRating, 0) / ratedTasks.length
      : null

    return {
      avgLetter: numericToLetter(avgNumeric),
      avgNumeric: Math.round(avgNumeric),
      onTimePct,
      avgRating: avgRating !== null ? avgRating.toFixed(1) : null,
    }
  }, [tasks])

  const handleView = (task: any) => {
    setInsightsData({
      taskId: task._id as any,
      taskTitle: task.title,
      isCanvas: task.isCanvas ?? false,
      pointsEarned: task.maxPossiblePoints ?? task.pointsValue ?? 0,
      submittedAt: task.submittedAt,
      originalDueDate: task.originalDueDate,
      dueDateHistory: task.dueDateHistory ?? [],
      maxPossiblePoints: task.maxPossiblePoints,
      existingRating: task.selfFeedbackRating,
      existingGrade: task.insightsGrade,
    })
  }

  const isLoading = tasks === undefined

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 py-4">
        <div>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-1">
            ACADEMIC WORKSPACE
          </p>
          <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-purple-400" />
            Submission Insights
          </h2>
        </div>
        <DashboardNavbar />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!tasks || tasks.length === 0) && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <BarChart2 className="w-14 h-14 text-[var(--text-muted)] mb-4 opacity-40" />
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">No insights yet</h3>
          <p className="text-sm text-[var(--text-muted)] max-w-xs">
            Complete a task and rate yourself to see your submission insights here.
          </p>
        </div>
      )}

      {/* Summary strip */}
      {!isLoading && tasks && tasks.length > 0 && summary && (
        <>
          <div className="flex gap-3 mb-6 flex-wrap">
            <SummaryCard
              icon={TrendingUp}
              iconClass="text-purple-400"
              label="Avg Grade"
              value={
                <span className={GRADE_COLORS[summary.avgLetter]}>
                  {summary.avgLetter}
                  <span className="text-sm font-semibold text-[var(--text-muted)] ml-1.5">
                    {summary.avgNumeric}
                  </span>
                </span>
              }
            />
            <SummaryCard
              icon={Clock}
              iconClass="text-green-400"
              label="On-Time Rate"
              value={`${summary.onTimePct}%`}
            />
            <SummaryCard
              icon={Star}
              iconClass="text-yellow-400"
              label="Avg Self-Score"
              value={
                summary.avgRating !== null
                  ? <span className="flex items-center gap-1">{summary.avgRating} <span className="text-sm text-[var(--text-muted)]">/ 5</span></span>
                  : '—'
              }
            />
          </div>

          {/* Task list */}
          <div className="space-y-2">
            {(tasks as any[]).map((task, i) => {
              const lateness = latenessLabel(task.submittedAt, task.originalDueDate)
              const gradeColor = GRADE_COLORS[task.insightsGrade] ?? 'text-white/50'
              const gradeBg = GRADE_BG[task.insightsGrade] ?? 'bg-white/5 border-white/10'
              const pts = task.maxPossiblePoints ?? task.pointsValue ?? 0

              return (
                <motion.div
                  key={task._id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: i * 0.04 }}
                  className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:border-white/20 transition-colors"
                >
                  {/* Grade badge */}
                  <div className={`w-10 h-10 shrink-0 rounded-xl border flex items-center justify-center font-black text-lg ${gradeBg} ${gradeColor}`}>
                    {task.insightsGrade}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {task.title}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {task.submittedAt && (
                        <span className="text-xs text-[var(--text-muted)]">
                          {formatDate(task.submittedAt)}
                        </span>
                      )}
                      <span className={`flex items-center gap-1 text-xs font-medium ${lateness.isLate ? 'text-amber-400' : 'text-green-400'}`}>
                        {lateness.isLate
                          ? <AlertTriangle className="w-3 h-3" />
                          : <CheckCircle2 className="w-3 h-3" />}
                        {lateness.label}
                      </span>
                      {pts > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-[var(--text-muted)]">
                          <Zap className="w-3 h-3 text-yellow-400" />
                          {pts} pts
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Self-rating stars (compact, read-only) */}
                  {task.selfFeedbackRating && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3 h-3 ${s <= task.selfFeedbackRating ? 'text-yellow-400 fill-yellow-400' : 'text-white/15'}`}
                        />
                      ))}
                    </div>
                  )}

                  {/* View button */}
                  <button
                    onClick={() => handleView(task)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold hover:bg-purple-500/20 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View
                  </button>
                </motion.div>
              )
            })}
          </div>
        </>
      )}

      {/* Insights modal */}
      {insightsData && supabaseUserId && (
        <SubmissionInsightsModal
          open={!!insightsData}
          onClose={() => setInsightsData(null)}
          supabaseUserId={supabaseUserId}
          {...insightsData}
        />
      )}
    </div>
  )
}
