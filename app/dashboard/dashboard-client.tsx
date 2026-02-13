'use client'

import { useMemo } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CourseSection } from './course-section'
import { SyncButton } from './sync-button'
import { AutoSync } from './auto-sync'

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
  // Real-time queries
  const userData = useQuery(api.users.getUserBySupabaseId, {
    supabaseId: supabaseUserId,
  })

  const pointsData = useQuery(api.users.getVisiblePoints, {
    supabaseId: supabaseUserId,
  })

  const allCourses = useQuery(api.courses.getCoursesBySupabaseId, {
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

  // Debug logging
  console.log('[Dashboard] Supabase User ID:', supabaseUserId)
  console.log('[Dashboard] userData:', userData)
  console.log('[Dashboard] pointsData:', pointsData)
  console.log('[Dashboard] allCourses:', allCourses)
  console.log('[Dashboard] assignments:', assignments)

  // Mutation for showing all courses
  const showAllCourses = useMutation(api.users.showAllCourses)

  // Loading state - check if queries are still loading
  if (userData === undefined || pointsData === undefined || allCourses === undefined || assignments === undefined) {
    console.log('[Dashboard] Still loading...')
    return (
      <div className="container max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
            <p className="text-xs text-muted-foreground mt-2">
              userData: {userData === undefined ? 'loading' : 'loaded'} |
              pointsData: {pointsData === undefined ? 'loading' : 'loaded'} |
              courses: {allCourses === undefined ? 'loading' : 'loaded'} |
              assignments: {assignments === undefined ? 'loading' : 'loaded'}
            </p>
          </div>
        </div>
      </div>
    )
  }

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
        })
      }
    })
  }

  const courses = Array.from(courseMap.values())

  // Filter visible courses
  const visibleCourses = courses.filter(
    (course) => !hiddenCourses.includes(course.canvasCourseId)
  )
  const hiddenCount = courses.length - visibleCourses.length

  // Handle show all
  const handleShowAll = async () => {
    try {
      await showAllCourses({ supabaseId: supabaseUserId })
    } catch (error) {
      console.error('Error showing all courses:', error)
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
            <span className="text-lg">🔥</span>
            <span className="text-sm font-semibold text-orange-900">
              {pointsData.streakCount} day streak
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-full">
            <span className="text-lg">⚡</span>
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
                }))}
                isHidden={hiddenCourses.includes(course.canvasCourseId)}
                supabaseUserId={supabaseUserId}
              />
            ))}
          </div>

          {hiddenCount > 0 && (
            <div className="mt-6 flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <span>{hiddenCount} hidden course{hiddenCount > 1 ? 's' : ''}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShowAll}
              >
                Show all
              </Button>
            </div>
          )}
        </>
      )}

      <AutoSync />
    </div>
  )
}
