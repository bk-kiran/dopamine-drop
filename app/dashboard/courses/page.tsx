'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, BookOpen, CheckCircle2, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import { redirect } from 'next/navigation'
import { DashboardNavbar } from '@/components/dashboard-navbar'

interface Course {
  _id: string
  name: string
  courseCode: string
  canvasCourseId: string
}

interface Assignment {
  _id: string
  canvasCourseId: string
  status: 'pending' | 'submitted' | 'missing'
  manuallyCompleted?: boolean
}

export default function CoursesPage() {
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null)

  // Get Supabase user ID
  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        redirect('/login')
      }

      if (user) {
        setSupabaseUserId(user.id)
      }
    }
    getUser()
  }, [])

  // Get dashboard data
  const dashboardData = useQuery(
    api.users.getDashboardData,
    supabaseUserId ? { supabaseId: supabaseUserId } : 'skip'
  )

  // Get ALL assignments (no date filtering - courses page shows all-time stats)
  const assignments = useQuery(
    api.assignments.getAssignmentsBySupabaseId,
    supabaseUserId ? {
      supabaseId: supabaseUserId,
      includeSubmittedSince: undefined, // No date filter - show all assignments
    } : 'skip'
  )

  const toggleHiddenCourse = useMutation(api.users.toggleHiddenCourse)

  // Loading state
  if (!dashboardData || !assignments || !supabaseUserId) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mb-4"></div>
            <p className="text-[var(--text-muted)]">Loading courses...</p>
          </div>
        </div>
      </div>
    )
  }

  const courses = dashboardData.courses || []
  const hiddenCourses = dashboardData.user?.hiddenCourses || []

  // Parse course name to remove Canvas IDs and semester codes
  const parseCourseName = (name: string) => {
    return name.split('(')[0].trim()
  }

  // Group assignments by course
  const assignmentsByCourse = assignments.reduce((acc, assignment) => {
    const courseId = assignment.canvasCourseId
    if (!acc[courseId]) {
      acc[courseId] = []
    }
    acc[courseId].push(assignment)
    return acc
  }, {} as Record<string, Assignment[]>)

  // Calculate stats for each course
  const coursesWithStats = courses.map((course) => {
    const courseAssignments = assignmentsByCourse[course.canvasCourseId] || []
    const total = courseAssignments.length
    const pending = courseAssignments.filter(a => a.status === 'pending' || a.status === 'missing').length
    const submitted = courseAssignments.filter(a => a.status === 'submitted' || a.manuallyCompleted).length
    const progress = total > 0 ? (submitted / total) * 100 : 0

    return {
      ...course,
      total,
      pending,
      submitted,
      progress,
      isHidden: hiddenCourses.includes(course.canvasCourseId),
    }
  })

  // Sort: visible courses first, then hidden courses
  const sortedCourses = [...coursesWithStats].sort((a, b) => {
    if (a.isHidden === b.isHidden) return 0
    return a.isHidden ? 1 : -1
  })

  // Filter to only visible courses for summary stats
  const visibleCourses = courses.filter(c => !hiddenCourses.includes(c.canvasCourseId))

  // Calculate summary stats from visible courses only
  const totalCourses = visibleCourses.length
  const visibleCourseIds = new Set(visibleCourses.map(c => c.canvasCourseId))
  const visibleAssignments = Object.entries(assignmentsByCourse)
    .filter(([courseId]) => visibleCourseIds.has(courseId))
    .flatMap(([_, assignments]) => assignments)

  const totalPending = visibleAssignments.filter(a => a.status === 'pending' || a.status === 'missing').length
  const totalSubmitted = visibleAssignments.filter(a => a.status === 'submitted' || a.manuallyCompleted).length

  // Handle toggle hide/show
  const handleToggleCourse = async (canvasCourseId: string, currentlyHidden: boolean) => {
    try {
      await toggleHiddenCourse({
        supabaseId: supabaseUserId,
        canvasCourseId,
        hide: !currentlyHidden,
      })
    } catch (error) {
      console.error('Error toggling course visibility:', error)
    }
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Courses</h1>
          <p className="text-[var(--text-muted)]">
            Manage your enrolled courses and track progress
            <span className="ml-2 text-xs opacity-75">• Showing all-time stats for {totalCourses} visible {totalCourses === 1 ? 'course' : 'courses'}</span>
          </p>
        </div>
        <DashboardNavbar />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Total Courses */}
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <BookOpen className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{totalCourses}</p>
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Total Courses</p>
          </div>
        </div>

        {/* Total Pending */}
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
          <div className="p-2 rounded-lg bg-yellow-500/10">
            <Clock className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{totalPending}</p>
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Pending</p>
          </div>
        </div>

        {/* Total Submitted */}
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
          <div className="p-2 rounded-lg bg-green-500/10">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{totalSubmitted}</p>
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Submitted</p>
          </div>
        </div>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedCourses.map((course) => (
          <motion.div
            key={course._id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: course.isHidden ? 0.4 : 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className={`relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:border-purple-500/30 transition-all duration-300 ${
              course.isHidden ? 'overflow-hidden' : ''
            }`}
          >
            {/* Diagonal strikethrough overlay for hidden courses */}
            {course.isHidden && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-0.5 bg-red-400/50 rotate-[-25deg]" />
                </div>
              </div>
            )}

            {/* Header with course name and hide button */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 pr-2">
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                  {parseCourseName(course.name)}
                </h3>
                <div className="inline-flex items-center px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-wider border border-purple-500/30">
                  {course.courseCode}
                </div>
              </div>

              {/* Hide/Show toggle button */}
              <button
                onClick={() => handleToggleCourse(course.canvasCourseId, course.isHidden)}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                title={course.isHidden ? 'Show course' : 'Hide course'}
              >
                {course.isHidden ? (
                  <Eye className="w-4 h-4 text-[var(--text-muted)]" />
                ) : (
                  <EyeOff className="w-4 h-4 text-[var(--text-muted)]" />
                )}
              </button>
            </div>

            {/* Assignment counts */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center">
                <p className="text-xl font-bold text-[var(--text-primary)]">{course.total}</p>
                <p className="text-xs text-[var(--text-muted)]">Total</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-yellow-400">{course.pending}</p>
                <p className="text-xs text-[var(--text-muted)]">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-green-400">{course.submitted}</p>
                <p className="text-xs text-[var(--text-muted)]">Submitted</p>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--text-muted)]">Progress</span>
                <span className="text-xs font-bold text-purple-400">{Math.round(course.progress)}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${course.progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full"
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Empty state */}
      {courses.length === 0 && (
        <div className="text-center py-16">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)] opacity-30" />
          <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No courses found</h3>
          <p className="text-[var(--text-muted)]">
            Sync your Canvas account to see your courses here
          </p>
        </div>
      )}
    </div>
  )
}
