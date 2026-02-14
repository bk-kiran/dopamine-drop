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
import { UrgentPanel } from './urgent-panel'
import { Eye, EyeOff, ChevronDown, ChevronUp, Flame, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
  const [isUrgentPanelOpen, setIsUrgentPanelOpen] = useState(false)

  // Consolidated dashboard query (reduces 3 queries to 1)
  const dashboardData = useQuery(api.users.getDashboardData, {
    supabaseId: supabaseUserId,
  })

  // Get urgent assignments count
  const urgentAssignments = useQuery(api.assignments.getUrgentAssignments, {
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
  const urgentCount = urgentAssignments?.length || 0

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

  return (
    <div className="container max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Your Canvas assignments and progress
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Stats chips */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-full">
            <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
            <span className="text-sm font-semibold text-orange-900">
              {pointsData.streakCount} day streak
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-full">
            <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="text-sm font-semibold text-purple-900">
              {pointsData.totalPoints} pts
            </span>
          </div>
          <SyncButton />
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
            <Card className="mt-6">
              {/* Collapsed tray header */}
              <button
                onClick={() => setIsTrayExpanded(!isTrayExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-lg"
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <EyeOff className="w-4 h-4 text-gray-400" />
                  <span>{hiddenCount} hidden course{hiddenCount > 1 ? 's' : ''}</span>
                </div>
                {isTrayExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <EyeOff className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{course.name}</p>
                                <p className="text-xs text-muted-foreground">{course.courseCode}</p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleIndividualCourse(course.canvasCourseId)}
                              className="flex-shrink-0"
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

      {/* Floating action button for urgent tasks */}
      {urgentCount > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="fixed bottom-6 right-6 z-30"
        >
          <Button
            onClick={() => setIsUrgentPanelOpen(true)}
            size="lg"
            className="rounded-full h-14 w-14 shadow-lg relative bg-white hover:bg-gray-50 border-2 border-orange-500"
          >
            <Flame className="h-6 w-6 text-orange-500 fill-orange-500" />
            {urgentCount > 0 && (
              <span className="absolute -top-1 -right-1 h-6 w-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {urgentCount}
              </span>
            )}
          </Button>
        </motion.div>
      )}

      {/* Urgent panel */}
      <UrgentPanel
        supabaseUserId={supabaseUserId}
        isOpen={isUrgentPanelOpen}
        onClose={() => setIsUrgentPanelOpen(false)}
      />
    </div>
  )
}
