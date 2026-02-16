'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { motion } from 'framer-motion'
import { redirect } from 'next/navigation'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface AssignmentWithCourse {
  _id: string
  title: string
  dueAt: string | null
  pointsPossible: number
  status: 'pending' | 'submitted' | 'missing'
  courseName: string
  courseCode: string
  canvasCourseId: string
}

export default function SchedulePage() {
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()))

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

  // Get user data for hiddenCourses
  const userData = useQuery(
    api.users.getUserBySupabaseId,
    supabaseUserId ? { supabaseId: supabaseUserId } : 'skip'
  )

  // Get all courses
  const allCourses = useQuery(
    api.courses.getCoursesBySupabaseId,
    supabaseUserId ? { supabaseId: supabaseUserId } : 'skip'
  )

  // Get ALL assignments with course info for schedule
  const allAssignments = useQuery(
    api.assignments.getAssignmentsForSchedule,
    supabaseUserId ? { supabaseId: supabaseUserId } : 'skip'
  )

  // Build set of visible course IDs (exclude hidden courses)
  const hiddenCourses = userData?.hiddenCourses || []
  const visibleCourseIds = useMemo(() => {
    if (!allCourses) return new Set()
    return new Set(
      allCourses
        .filter(c => !hiddenCourses.includes(c.canvasCourseId))
        .map(c => c._id)
    )
  }, [allCourses, hiddenCourses])

  // Filter to only visible assignments (single source of truth)
  const assignments = useMemo(() => {
    if (!allAssignments) return []
    return allAssignments.filter(a => visibleCourseIds.has(a.courseId))
  }, [allAssignments, visibleCourseIds])

  // Helper: Get Monday of the week for a given date
  function getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust if Sunday
    return new Date(d.setDate(diff))
  }

  // Week navigation
  const goToPrevWeek = () => {
    const newStart = new Date(currentWeekStart)
    newStart.setDate(newStart.getDate() - 7)
    setCurrentWeekStart(newStart)
  }

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart)
    newStart.setDate(newStart.getDate() + 7)
    setCurrentWeekStart(newStart)
  }

  const goToToday = () => {
    setCurrentWeekStart(getWeekStart(new Date()))
  }

  // Generate week dates (Mon-Sun)
  const weekDates = useMemo(() => {
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart)
      date.setDate(date.getDate() + i)
      dates.push(date)
    }
    return dates
  }, [currentWeekStart])

  // Format week range
  const weekRange = useMemo(() => {
    const start = weekDates[0]
    const end = weekDates[6]
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }, [weekDates])

  // Group assignments by day
  const assignmentsByDay = useMemo(() => {
    if (!assignments) return {}

    const grouped: Record<string, AssignmentWithCourse[]> = {}

    weekDates.forEach(date => {
      const dateKey = date.toISOString().split('T')[0]
      grouped[dateKey] = []
    })

    assignments.forEach(assignment => {
      if (!assignment.dueAt) return

      const dueDate = new Date(assignment.dueAt)
      const dateKey = dueDate.toISOString().split('T')[0]

      if (grouped[dateKey]) {
        grouped[dateKey].push(assignment)
      }
    })

    return grouped
  }, [assignments, weekDates])

  // Upcoming assignments (next 14 days)
  const upcomingAssignments = useMemo(() => {
    if (!assignments) return []

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const twoWeeksFromNow = new Date()
    twoWeeksFromNow.setDate(today.getDate() + 14)
    twoWeeksFromNow.setHours(23, 59, 59, 999)

    return assignments
      .filter(a => {
        if (!a.dueAt) return false
        const dueDate = new Date(a.dueAt)
        return dueDate >= today && dueDate <= twoWeeksFromNow
      })
      .sort((a, b) => {
        if (!a.dueAt || !b.dueAt) return 0
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
      })
  }, [assignments])

  // Group upcoming by date
  const upcomingByDate = useMemo(() => {
    const grouped: Record<string, AssignmentWithCourse[]> = {}

    upcomingAssignments.forEach(assignment => {
      if (!assignment.dueAt) return

      const dateKey = new Date(assignment.dueAt).toISOString().split('T')[0]

      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }

      grouped[dateKey].push(assignment)
    })

    return grouped
  }, [upcomingAssignments])

  // Get border color for assignment
  const getBorderColor = (assignment: AssignmentWithCourse) => {
    if (assignment.status === 'missing') return 'border-l-4 border-red-400'
    if (assignment.status === 'submitted') return 'border-l-4 border-green-400'

    if (assignment.dueAt) {
      const hoursUntilDue = (new Date(assignment.dueAt).getTime() - new Date().getTime()) / (1000 * 60 * 60)
      const daysUntilDue = hoursUntilDue / 24

      if (daysUntilDue <= 3) return 'border-l-4 border-yellow-400'
    }

    return 'border-l-4 border-purple-400'
  }

  // Format days until due
  const formatDaysUntil = (dueAt: string) => {
    const now = new Date()
    const dueDate = new Date(dueAt)
    const diffMs = dueDate.getTime() - now.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMs < 0) {
      const overdueDays = Math.abs(diffDays)
      return { text: `Overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''}`, color: 'text-red-400' }
    } else if (diffDays === 0) {
      return { text: 'Due today', color: 'text-orange-400' }
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', color: 'text-yellow-400' }
    } else {
      return { text: `Due in ${diffDays} days`, color: 'text-[var(--text-muted)]' }
    }
  }

  // Check if date is today
  const isToday = (date: Date) => {
    const today = new Date()
    return date.toISOString().split('T')[0] === today.toISOString().split('T')[0]
  }

  // Loading state
  if (!assignments || !supabaseUserId || !userData || !allCourses) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mb-4"></div>
            <p className="text-[var(--text-muted)]">Loading schedule...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Schedule</h1>
        <p className="text-[var(--text-muted)]">Your weekly assignment calendar</p>

        {/* Hidden courses info note */}
        {hiddenCourses.length > 0 && (
          <div className="mt-3 text-sm text-[var(--text-muted)]">
            {hiddenCourses.length} {hiddenCourses.length === 1 ? 'course' : 'courses'} hidden —{' '}
            <a
              href="/dashboard/courses"
              className="text-purple-400 hover:text-purple-300 underline transition-colors"
            >
              manage in Courses tab
            </a>
          </div>
        )}
      </div>

      {/* Week Navigator */}
      <div className="flex items-center justify-between mb-6 px-5 py-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
        <button
          onClick={goToPrevWeek}
          className="p-2 rounded-lg hover:bg-purple-500/10 text-[var(--text-muted)] hover:text-purple-400 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4">
          <Calendar className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{weekRange}</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-bold uppercase tracking-wider border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
          >
            Today
          </button>
          <button
            onClick={goToNextWeek}
            className="p-2 rounded-lg hover:bg-purple-500/10 text-[var(--text-muted)] hover:text-purple-400 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-3 mb-8">
        {weekDates.map((date, index) => {
          const dateKey = date.toISOString().split('T')[0]
          const dayAssignments = assignmentsByDay[dateKey] || []
          const today = isToday(date)

          return (
            <div key={index} className="flex flex-col">
              {/* Day header */}
              <div className={`text-center py-2 mb-3 rounded-xl ${
                today ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-white/5 border border-white/10'
              }`}>
                <p className={`text-xs font-bold uppercase tracking-wide ${
                  today ? 'text-purple-400' : 'text-[var(--text-muted)]'
                }`}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </p>
                <p className={`text-lg font-bold ${
                  today ? 'text-purple-400' : 'text-[var(--text-primary)]'
                }`}>
                  {date.getDate()}
                </p>
              </div>

              {/* Assignment cards */}
              <div className="space-y-2 flex-1">
                {dayAssignments.map(assignment => (
                  <Popover key={assignment._id}>
                    <PopoverTrigger asChild>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        className={`w-full text-left p-3 rounded-lg bg-white/5 backdrop-blur-md border border-white/10 hover:border-purple-400/30 transition-all ${getBorderColor(assignment)}`}
                      >
                        <h3 className="text-sm font-bold text-[var(--text-primary)] truncate mb-1">
                          {assignment.title}
                        </h3>
                        <p className="text-xs text-[var(--text-muted)]">{assignment.courseCode}</p>
                      </motion.button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-bold text-[var(--text-primary)] mb-1">{assignment.title}</h3>
                          <p className="text-sm text-[var(--text-muted)]">{assignment.courseName}</p>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--text-muted)]">Points:</span>
                          <span className="font-bold text-purple-400">{assignment.pointsPossible} pts</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--text-muted)]">Due:</span>
                          <span className="font-bold text-[var(--text-primary)]">
                            {assignment.dueAt ? new Date(assignment.dueAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            }) : 'No due date'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--text-muted)]">Status:</span>
                          <span className={`font-bold uppercase text-xs ${
                            assignment.status === 'submitted' ? 'text-green-400' :
                            assignment.status === 'missing' ? 'text-red-400' :
                            'text-yellow-400'
                          }`}>
                            {assignment.status}
                          </span>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Upcoming List */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Upcoming</h2>
        <div className="space-y-6">
          {Object.keys(upcomingByDate).length === 0 ? (
            <div className="text-center py-16 px-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)] opacity-30" />
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No upcoming assignments</h3>
              <p className="text-[var(--text-muted)]">
                You're all caught up for the next 2 weeks!
              </p>
            </div>
          ) : (
            Object.entries(upcomingByDate).map(([dateKey, dayAssignments]) => {
              const date = new Date(dateKey)
              const dateHeader = date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })

              return (
                <div key={dateKey}>
                  {/* Date header */}
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">
                    {dateHeader}
                  </h3>

                  {/* Assignment rows */}
                  <div className="space-y-2">
                    {dayAssignments.map(assignment => {
                      const daysUntil = assignment.dueAt ? formatDaysUntil(assignment.dueAt) : null

                      return (
                        <motion.div
                          key={assignment._id}
                          whileHover={{ scale: 1.01 }}
                          className="flex items-center justify-between px-5 py-4 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-purple-400/20 transition-all"
                        >
                          <div className="flex-1 min-w-0 mr-4">
                            <h4 className="text-sm font-bold text-[var(--text-primary)] truncate mb-1">
                              {assignment.title}
                            </h4>
                            <p className="text-xs text-[var(--text-muted)]">{assignment.courseCode}</p>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-sm font-bold text-purple-400">{assignment.pointsPossible} pts</p>
                            </div>

                            {daysUntil && (
                              <div className="text-right min-w-[120px]">
                                <p className={`text-xs font-bold uppercase tracking-wide ${daysUntil.color}`}>
                                  {daysUntil.text}
                                </p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
