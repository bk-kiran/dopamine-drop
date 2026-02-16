'use client'

/*
 * CONVEX FREE TIER OPTIMIZATION NOTES (Development Only):
 *
 * To stay within Convex free tier limits during development:
 * 1. Avoid rapid page reloading - each reload triggers new WebSocket connections and initial query batch
 * 2. Use the manual "Sync Canvas" button sparingly - it triggers expensive Canvas API calls
 * 3. Keep the dashboard tab open rather than repeatedly closing/opening - saves connection overhead
 * 4. Auto-sync has a 30-minute cooldown to prevent excessive syncing
 * 5. Dashboard data is consolidated into single query to reduce function calls from 3→1
 * 6. Assignment sync uses diff checks to skip unchanged assignments (90%+ reduction in writes)
 */

import { useMemo, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CourseSection } from './course-section'
import { SyncButton } from './sync-button'
import { AutoSync } from './auto-sync'
import { Eye, EyeOff, ChevronDown, ChevronUp, Flame, Zap, RefreshCw, Sun, Moon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'

interface Assignment {
  _id: string
  canvasAssignmentId: string
  canvasCourseId: string
  title: string
  description: string | null
  dueAt: string | null
  pointsPossible: number
  status: 'pending' | 'submitted' | 'missing'
  submittedAt: string | null
  courseName: string
  courseCode: string
  manuallyCompleted?: boolean
}

interface Course {
  _id: string
  name: string
  courseCode: string
  canvasCourseId: string
  assignments: Assignment[]
}

interface DashboardClientProps {
  supabaseUserId: string
}

export function DashboardClient({ supabaseUserId }: DashboardClientProps) {
  const [isTrayExpanded, setIsTrayExpanded] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const { theme, setTheme } = useTheme()

  // Consolidated dashboard query (reduces 3 queries to 1)
  const dashboardData = useQuery(api.users.getDashboardData, {
    supabaseId: supabaseUserId,
  })

  // Get assignments from last 7 days - memoize to prevent infinite re-renders
  const sevenDaysAgoISO = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return date.toISOString()
  }, [])

  const assignments = useQuery(api.assignments.getAssignmentsBySupabaseId, {
    supabaseId: supabaseUserId,
    includeSubmittedSince: sevenDaysAgoISO,
  })

  // Mutations
  const toggleHiddenCourse = useMutation(api.users.toggleHiddenCourse)
  const showAllCourses = useMutation(api.users.showAllCourses)

  // Debug logging
  console.log('[Dashboard] Supabase User ID:', supabaseUserId)
  console.log('[Dashboard] dashboardData:', dashboardData)
  console.log('[Dashboard] assignments:', assignments)

  // Loading state - check if queries are still loading
  if (dashboardData === undefined || assignments === undefined) {
    console.log('[Dashboard] Still loading...')
    return (
      <div className="container max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
            <p className="text-xs text-muted-foreground mt-2">
              dashboardData: {dashboardData === undefined ? 'loading' : 'loaded'} |
              assignments: {assignments === undefined ? 'loading' : 'loaded'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Extract data from consolidated query
  const userData = dashboardData.user
  const allCourses = dashboardData.courses
  const pointsData = dashboardData.visiblePoints

  // Note: Canvas token check is handled in the server component (page.tsx)
  // so we don't need to redirect here

  const hiddenCourses = userData?.hiddenCourses || []

  // Create a map of courses with their assignments
  const courseMap = new Map<string, Course>()

  // First, add ALL courses to the map (even those with no assignments)
  if (allCourses) {
    allCourses.forEach((course: any) => {
      courseMap.set(course.canvasCourseId, {
        _id: course._id,
        name: course.name,
        courseCode: course.courseCode,
        canvasCourseId: course.canvasCourseId,
        assignments: [],
      })
    })
  }

  // Then, add assignments to their respective courses
  if (assignments) {
    assignments.forEach((assignment: any) => {
      const canvasCourseId = assignment.canvasCourseId
      const course = courseMap.get(canvasCourseId)

      if (course) {
        course.assignments.push({
          _id: assignment._id,
          canvasAssignmentId: assignment.canvasAssignmentId,
          canvasCourseId: assignment.canvasCourseId,
          title: assignment.title,
          description: assignment.description,
          dueAt: assignment.dueAt,
          pointsPossible: assignment.pointsPossible,
          status: assignment.status,
          submittedAt: assignment.submittedAt,
          courseName: assignment.courseName,
          courseCode: assignment.courseCode,
          manuallyCompleted: assignment.manuallyCompleted,
          isUrgent: assignment.isUrgent,
          urgentOrder: assignment.urgentOrder,
        })
      }
    })
  }

  const courses = Array.from(courseMap.values())

  // Filter visible and hidden courses
  const visibleCourses = courses.filter(
    (course) => !hiddenCourses.includes(course.canvasCourseId)
  )
  const hiddenCoursesData = courses.filter(
    (course) => hiddenCourses.includes(course.canvasCourseId)
  )
  const hiddenCount = hiddenCoursesData.length

  // Handle show all
  const handleShowAll = async () => {
    try {
      await showAllCourses({ supabaseId: supabaseUserId })
      setIsTrayExpanded(false)
    } catch (error) {
      console.error('Error showing all courses:', error)
    }
  }

  // Handle toggle individual course
  const handleToggleIndividualCourse = async (canvasCourseId: string) => {
    try {
      await toggleHiddenCourse({
        supabaseId: supabaseUserId,
        canvasCourseId,
        hide: false,
      })
    } catch (error) {
      console.error('Error unhiding course:', error)
    }
  }

  // Get dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  // Get user's first name
  const getFirstName = () => {
    if (!userData?.displayName) return ''
    return userData.displayName.split(' ')[0]
  }

  // Handle manual sync
  const handleSync = async () => {
    setIsSyncing(true)
    localStorage.removeItem('lastSyncTime')

    try {
      const response = await fetch('/api/canvas/sync', {
        method: 'POST',
      })
      const data = await response.json()

      if (response.ok) {
        // Success - data will be automatically updated via Convex reactivity
        console.log(`Synced ${data.synced} assignments from ${data.courses} courses`)
      }
    } catch (error) {
      console.error('Sync error:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6">
      {/* Slim header strip */}
      <div className="flex items-center justify-between mb-6 py-4">
        <div>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-1">
            ACADEMIC WORKSPACE
          </p>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            Welcome back{getFirstName() && `, ${getFirstName()}`}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Streak chip */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
            <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              {pointsData.streakCount} DAY STREAK
            </span>
          </div>

          {/* Points chip */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
            <Zap className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              {pointsData.totalPoints} PTS
            </span>
          </div>

          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="p-1.5 rounded-full bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] hover:border-purple-400/30 transition-all duration-200 disabled:opacity-50"
            title="Sync with Canvas"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[var(--text-primary)] ${isSyncing ? 'animate-spin' : ''}`} />
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-full bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] hover:border-purple-400/30 transition-all duration-200"
            title="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-[var(--text-primary)]" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-[var(--text-primary)]" />
            )}
          </button>
        </div>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground mb-4">
              No assignments found. Click &quot;Sync Canvas&quot; to fetch your latest assignments.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-6">
            {visibleCourses.map((course) => (
              <CourseSection
                key={course.canvasCourseId}
                course={{
                  id: course._id,
                  name: course.name,
                  course_code: course.courseCode,
                  canvas_course_id: course.canvasCourseId,
                }}
                assignments={course.assignments.map((a) => ({
                  id: a._id,
                  title: a.title,
                  due_at: a.dueAt,
                  points_possible: a.pointsPossible,
                  status: a.status,
                  submitted_at: a.submittedAt,
                  manuallyCompleted: a.manuallyCompleted,
                  isUrgent: a.isUrgent,
                }))}
                isHidden={hiddenCourses.includes(course.canvasCourseId)}
                supabaseUserId={supabaseUserId}
              />
            ))}
          </div>

          {hiddenCount > 0 && (
            <Card className="mt-6 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] shadow-[var(--glass-shadow)]">
              {/* Collapsed tray header */}
              <button
                onClick={() => setIsTrayExpanded(!isTrayExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-purple-500/5 dark:hover:bg-purple-500/10 transition-colors rounded-2xl"
              >
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <EyeOff className="w-4 h-4" />
                  <span>{hiddenCount} hidden course{hiddenCount > 1 ? 's' : ''}</span>
                </div>
                {isTrayExpanded ? (
                  <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
                )}
              </button>

              {/* Expanded tray content */}
              <AnimatePresence initial={false}>
                {isTrayExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <CardContent className="pt-0 pb-4">
                      <div className="space-y-2">
                        {hiddenCoursesData.map((course) => (
                          <div
                            key={course.canvasCourseId}
                            className="flex items-center justify-between p-3 rounded-xl hover:bg-purple-500/5 dark:hover:bg-purple-500/10 transition-colors group"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <EyeOff className="h-4 w-4 text-[var(--text-muted)] flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-[var(--text-primary)] truncate">{course.name}</p>
                                <p className="text-xs text-[var(--text-muted)]">{course.courseCode}</p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleIndividualCourse(course.canvasCourseId)}
                              className="flex-shrink-0 hover:text-purple-500"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      {/* Show all button */}
                      <div className="mt-4 pt-4 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleShowAll}
                          className="w-full"
                        >
                          Show all courses
                        </Button>
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          )}
        </>
      )}

      <AutoSync />
    </div>
  )
}
