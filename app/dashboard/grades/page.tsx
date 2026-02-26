'use client'

import { useEffect, useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Calculator,
  RotateCcw,
  BookOpen,
  EyeOff,
} from 'lucide-react'
import { DashboardNavbar } from '@/components/dashboard-navbar'

// ─── Grade helpers ────────────────────────────────────────────────────────────

function gradeToLetter(pct: number): string {
  if (pct >= 93) return 'A'
  if (pct >= 90) return 'A-'
  if (pct >= 87) return 'B+'
  if (pct >= 83) return 'B'
  if (pct >= 80) return 'B-'
  if (pct >= 77) return 'C+'
  if (pct >= 73) return 'C'
  if (pct >= 70) return 'C-'
  if (pct >= 67) return 'D+'
  if (pct >= 60) return 'D'
  return 'F'
}

function gradeTo4Scale(pct: number): number {
  if (pct >= 93) return 4.0
  if (pct >= 90) return 3.7
  if (pct >= 87) return 3.3
  if (pct >= 83) return 3.0
  if (pct >= 80) return 2.7
  if (pct >= 77) return 2.3
  if (pct >= 73) return 2.0
  if (pct >= 70) return 1.7
  if (pct >= 67) return 1.3
  if (pct >= 60) return 1.0
  return 0.0
}

function gradeColor(pct: number): string {
  if (pct >= 90) return 'text-green-400'
  if (pct >= 80) return 'text-yellow-400'
  if (pct >= 70) return 'text-orange-400'
  return 'text-red-400'
}

function gradeBorder(pct: number): string {
  if (pct >= 90) return 'border-l-green-500'
  if (pct >= 80) return 'border-l-yellow-500'
  if (pct >= 70) return 'border-l-orange-500'
  return 'border-l-red-500'
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Course = {
  _id: string
  canvasCourseId: string
  name: string
  courseCode: string
  currentGrade?: number
  currentScore?: number
  finalGrade?: number
}

type Assignment = {
  _id: string
  title: string
  dueAt?: string
  pointsPossible: number
  status: string
  gradeReceived?: number
  assignmentGroupName?: string
}

// ─── Group breakdown ──────────────────────────────────────────────────────────

function groupBreakdown(assignments: Assignment[]) {
  const groups: Record<string, { earned: number; max: number }> = {}
  for (const a of assignments) {
    if (a.gradeReceived == null) continue
    const name = a.assignmentGroupName || 'Other'
    if (!groups[name]) groups[name] = { earned: 0, max: 0 }
    groups[name].earned += a.gradeReceived
    groups[name].max += a.pointsPossible
  }
  return Object.entries(groups).map(([name, { earned, max }]) => ({
    name,
    earned,
    max,
    pct: max > 0 ? (earned / max) * 100 : 0,
  }))
}

// ─── Course Card ──────────────────────────────────────────────────────────────

function CourseGradeCard({
  course,
  supabaseId,
}: {
  course: Course
  supabaseId: string
}) {
  const [expanded, setExpanded] = useState(false)

  const assignments = useQuery(
    api.courses.getAssignmentsForGrades,
    expanded ? { supabaseId, canvasCourseId: course.canvasCourseId } : 'skip'
  ) as Assignment[] | undefined

  const graded = assignments?.filter((a) => a.gradeReceived != null) ?? []
  const ungraded = assignments?.filter((a) => a.gradeReceived == null) ?? []
  const groups = useMemo(() => groupBreakdown(graded), [graded])

  const hasGrade = course.currentGrade != null
  const pct = course.currentGrade ?? 0

  const totalEarned = graded.reduce((s, a) => s + (a.gradeReceived ?? 0), 0)
  const totalMax = graded.reduce((s, a) => s + a.pointsPossible, 0)

  const shortName = (name: string) =>
    name.replace(/\s*(Spring|Fall|Summer|Winter)\s+\d{4}/i, '').trim() || name

  return (
    <div
      className={`rounded-2xl bg-white/5 border border-white/10 border-l-4 overflow-hidden transition-all ${
        hasGrade ? gradeBorder(pct) : 'border-l-white/20'
      }`}
    >
      {/* Card header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] bg-white/5 px-2 py-0.5 rounded">
              {course.courseCode}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-snug">
            {shortName(course.name)}
          </h3>
          {hasGrade && (
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {totalMax > 0
                ? `${totalEarned.toFixed(1)} / ${totalMax.toFixed(0)} pts graded`
                : 'Sync to see details'}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {hasGrade ? (
            <>
              <span className={`text-2xl font-black ${gradeColor(pct)}`}>
                {pct.toFixed(1)}%
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  pct >= 90
                    ? 'bg-green-500/20 text-green-400'
                    : pct >= 80
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : pct >= 70
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {gradeToLetter(pct)}
              </span>
            </>
          ) : (
            <span className="text-xl font-black text-[var(--text-muted)]">— %</span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[var(--text-muted)] mt-1" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)] mt-1" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
              {!assignments ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-2">Loading…</p>
              ) : !hasGrade ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-2">
                  No grade data yet — sync Canvas to see your grades.
                </p>
              ) : (
                <>
                  {/* Group breakdown */}
                  {groups.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                        By Group
                      </p>
                      <div className="space-y-1">
                        {groups.map((g) => (
                          <div key={g.name} className="flex items-center justify-between text-xs">
                            <span className="text-[var(--text-muted)] truncate max-w-[140px]">{g.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[var(--text-primary)]">
                                {g.earned.toFixed(1)} / {g.max.toFixed(0)} pts
                              </span>
                              <span className={`font-semibold w-12 text-right ${gradeColor(g.pct)}`}>
                                {g.pct.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Graded assignments */}
                  {graded.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                        Graded ({graded.length})
                      </p>
                      <div className="space-y-1.5">
                        {graded.map((a) => {
                          const pctA =
                            a.pointsPossible > 0
                              ? ((a.gradeReceived ?? 0) / a.pointsPossible) * 100
                              : 0
                          return (
                            <div key={a._id} className="flex items-center justify-between text-xs gap-2">
                              <span className="text-[var(--text-primary)] truncate flex-1">{a.title}</span>
                              <span className="text-[var(--text-muted)] whitespace-nowrap">
                                {(a.gradeReceived ?? 0).toFixed(1)} / {a.pointsPossible} pts
                              </span>
                              <span className={`font-semibold w-12 text-right ${gradeColor(pctA)}`}>
                                {pctA.toFixed(1)}%
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Ungraded assignments */}
                  {ungraded.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 h-px bg-white/10" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                          Ungraded ({ungraded.length})
                        </p>
                        <div className="flex-1 h-px bg-white/10" />
                      </div>
                      <div className="space-y-1.5">
                        {ungraded.map((a) => (
                          <div key={a._id} className="flex items-center justify-between text-xs gap-2">
                            <span className="text-[var(--text-muted)] truncate flex-1">{a.title}</span>
                            <span className="text-[var(--text-muted)] whitespace-nowrap">
                              — / {a.pointsPossible} pts
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold w-16 text-center ${
                                a.status === 'submitted'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : a.status === 'missing'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-white/5 text-[var(--text-muted)]'
                              }`}
                            >
                              {a.status === 'submitted'
                                ? 'Submitted'
                                : a.status === 'missing'
                                ? 'Missing'
                                : 'Pending'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── What-If Calculator ───────────────────────────────────────────────────────

function WhatIfCalculator({
  supabaseId,
  visibleCourses,
}: {
  supabaseId: string
  visibleCourses: Course[]
}) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    visibleCourses[0]?.canvasCourseId ?? ''
  )

  const assignments = useQuery(
    api.courses.getAssignmentsForGrades,
    selectedCourseId ? { supabaseId, canvasCourseId: selectedCourseId } : 'skip'
  ) as Assignment[] | undefined

  const [hypotheticalScores, setHypotheticalScores] = useState<Record<string, string>>({})

  const ungraded = assignments?.filter((a) => a.gradeReceived == null && a.pointsPossible > 0) ?? []
  const graded = assignments?.filter((a) => a.gradeReceived != null) ?? []

  const gradedEarned = graded.reduce((s, a) => s + (a.gradeReceived ?? 0), 0)
  const gradedMax = graded.reduce((s, a) => s + a.pointsPossible, 0)

  const hypoEarned = ungraded.reduce((s, a) => {
    const val = parseFloat(hypotheticalScores[a._id] ?? '')
    return isNaN(val) ? s : s + Math.min(val, a.pointsPossible)
  }, 0)
  const hypoMax = ungraded
    .filter((a) => hypotheticalScores[a._id] !== undefined && hypotheticalScores[a._id] !== '')
    .reduce((s, a) => s + a.pointsPossible, 0)

  const totalEarned = gradedEarned + hypoEarned
  const totalMax = gradedMax + hypoMax
  const projectedPct = totalMax > 0 ? (totalEarned / totalMax) * 100 : null
  const hasAnyInput = Object.values(hypotheticalScores).some((v) => v !== '')

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
      <div className="flex items-center gap-2 mb-5">
        <Calculator className="w-5 h-5 text-purple-400" />
        <h2 className="text-base font-bold text-[var(--text-primary)]">What-If Calculator</h2>
      </div>

      {/* Course selector — only visible courses */}
      <div className="mb-5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block mb-1.5">
          Select course
        </label>
        <select
          value={selectedCourseId}
          onChange={(e) => {
            setSelectedCourseId(e.target.value)
            setHypotheticalScores({})
          }}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-purple-500/50"
        >
          {visibleCourses.map((c) => (
            <option key={c.canvasCourseId} value={c.canvasCourseId} className="bg-[#1a1a2e]">
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Projected grade display */}
      {hasAnyInput && projectedPct !== null && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-0.5">
              Projected Grade
            </p>
            <p className={`text-2xl font-black ${gradeColor(projectedPct)}`}>
              {projectedPct.toFixed(1)}% · {gradeToLetter(projectedPct)}
            </p>
          </div>
          <button
            onClick={() => setHypotheticalScores({})}
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-purple-400 transition-colors px-2 py-1 rounded-lg hover:bg-purple-500/10"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </motion.div>
      )}

      {/* Ungraded assignment inputs */}
      {!assignments ? (
        <p className="text-xs text-[var(--text-muted)] text-center py-4">Loading assignments…</p>
      ) : ungraded.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] text-center py-4">
          {graded.length > 0
            ? 'All assignments are graded.'
            : 'No assignments found. Sync Canvas first.'}
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Enter hypothetical scores
          </p>
          {ungraded.map((a) => {
            const inputVal = hypotheticalScores[a._id] ?? ''
            const numVal = parseFloat(inputVal)
            const pctPreview =
              !isNaN(numVal) && a.pointsPossible > 0
                ? (Math.min(numVal, a.pointsPossible) / a.pointsPossible) * 100
                : null

            return (
              <div key={a._id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--text-primary)] truncate">{a.title}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">out of {a.pointsPossible} pts</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    type="number"
                    min={0}
                    max={a.pointsPossible}
                    step={0.1}
                    placeholder="—"
                    value={inputVal}
                    onChange={(e) =>
                      setHypotheticalScores((prev) => ({ ...prev, [a._id]: e.target.value }))
                    }
                    className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-right text-[var(--text-primary)] focus:outline-none focus:border-purple-500/50"
                  />
                  {pctPreview !== null && (
                    <span className={`text-xs font-semibold w-12 text-right ${gradeColor(pctPreview)}`}>
                      {pctPreview.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[10px] text-[var(--text-muted)] mt-4">
        Points-based estimate — may differ if Canvas uses weighted assignment groups.
      </p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GradesPage() {
  const [supabaseUserId, setSupabaseUserId] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setSupabaseUserId(user?.id ?? null)
    })
  }, [])

  const allCourses = useQuery(
    api.courses.getCoursesBySupabaseId,
    supabaseUserId ? { supabaseId: supabaseUserId } : 'skip'
  ) as Course[] | undefined

  const userData = useQuery(
    api.users.getUser,
    supabaseUserId ? { authUserId: supabaseUserId } : 'skip'
  )

  // Loading
  if (supabaseUserId === undefined || allCourses === undefined || userData === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!supabaseUserId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-[var(--text-muted)]">Please log in to view grades.</p>
      </div>
    )
  }

  // Filter to visible courses only
  const hiddenCourseIds: string[] = userData?.hiddenCourses ?? []
  const visibleCourses = allCourses.filter(
    (c) => !hiddenCourseIds.includes(c.canvasCourseId)
  )
  const hiddenCount = allCourses.length - visibleCourses.length

  // All-hidden empty state
  if (allCourses.length > 0 && visibleCourses.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-8">
          <GraduationCap className="w-6 h-6 text-purple-400" />
          <h1 className="text-2xl font-black text-[var(--text-primary)]">Grades</h1>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
          <EyeOff className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
            No visible courses
          </p>
          <p className="text-xs text-[var(--text-muted)] mb-4">
            All {allCourses.length} courses are hidden. Manage visibility in the Courses tab.
          </p>
          <a
            href="/dashboard/courses"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 text-sm font-semibold hover:bg-purple-500/30 transition-all"
          >
            Manage Courses
          </a>
        </div>
      </div>
    )
  }

  // Grade stats (visible courses only)
  const gradedCourses = visibleCourses.filter((c) => c.currentGrade != null)
  const hasAnyGrades = gradedCourses.length > 0

  const avgGPA =
    gradedCourses.length > 0
      ? gradedCourses.reduce((s, c) => s + gradeTo4Scale(c.currentGrade!), 0) /
        gradedCourses.length
      : null

  const highest = gradedCourses.reduce<Course | null>(
    (best, c) => (best == null || c.currentGrade! > best.currentGrade! ? c : best),
    null
  )
  const lowest = gradedCourses.reduce<Course | null>(
    (worst, c) => (worst == null || c.currentGrade! < worst.currentGrade! ? c : worst),
    null
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-purple-400" />
            Grades
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {hasAnyGrades
              ? `Tracking ${gradedCourses.length} of ${visibleCourses.length} visible course${visibleCourses.length !== 1 ? 's' : ''}`
              : 'Sync Canvas to load your grades'}
          </p>
        </div>
        <DashboardNavbar />
      </div>

      {/* Hidden courses notice */}
      {hiddenCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10">
          <EyeOff className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
          <p className="text-xs text-[var(--text-muted)]">
            Grades shown for{' '}
            <span className="font-semibold text-[var(--text-primary)]">
              {visibleCourses.length} visible course{visibleCourses.length !== 1 ? 's' : ''}
            </span>
            {' '}—{' '}
            <a href="/dashboard/courses" className="text-purple-400 hover:underline">
              {hiddenCount} course{hiddenCount !== 1 ? 's' : ''} hidden
            </a>
          </p>
        </div>
      )}

      {/* Empty state — no grades yet */}
      {!hasAnyGrades && (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
          <BookOpen className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">No grade data yet</p>
          <p className="text-xs text-[var(--text-muted)]">
            Sync your Canvas account to pull in your current grades and assignment scores.
          </p>
        </div>
      )}

      {hasAnyGrades && (
        <>
          {/* Overview cards — visible courses only */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* GPA */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                GPA
              </p>
              <p className="text-2xl font-black text-[var(--text-primary)]">
                {avgGPA != null ? avgGPA.toFixed(2) : '—'}
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">out of 4.0</p>
            </div>

            {/* Highest */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-green-400" /> Highest
              </p>
              {highest ? (
                <>
                  <p className={`text-2xl font-black ${gradeColor(highest.currentGrade!)}`}>
                    {highest.currentGrade!.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">{highest.courseCode}</p>
                </>
              ) : (
                <p className="text-xl font-black text-[var(--text-muted)]">—</p>
              )}
            </div>

            {/* Lowest */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-red-400" /> Lowest
              </p>
              {lowest ? (
                <>
                  <p className={`text-2xl font-black ${gradeColor(lowest.currentGrade!)}`}>
                    {lowest.currentGrade!.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">{lowest.courseCode}</p>
                </>
              ) : (
                <p className="text-xl font-black text-[var(--text-muted)]">—</p>
              )}
            </div>

            {/* At Risk */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" /> At Risk
              </p>
              <p className="text-2xl font-black text-[var(--text-primary)]">
                {gradedCourses.filter((c) => c.currentGrade! < 70).length}
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">courses below 70%</p>
            </div>
          </div>

          {/* Course grade cards — visible courses only */}
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3">Course Grades</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleCourses.map((course) => (
                <CourseGradeCard
                  key={course._id}
                  course={course}
                  supabaseId={supabaseUserId}
                />
              ))}
            </div>
          </div>

          {/* What-If calculator — visible courses only */}
          {visibleCourses.length > 0 && (
            <WhatIfCalculator supabaseId={supabaseUserId} visibleCourses={visibleCourses} />
          )}
        </>
      )}
    </div>
  )
}
