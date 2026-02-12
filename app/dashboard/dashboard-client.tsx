'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CourseSection } from './course-section'

interface Assignment {
  id: string
  title: string
  due_at: string | null
  points_possible: number
  status?: 'pending' | 'submitted' | 'missing'
  submitted_at?: string | null
}

interface Course {
  id: string
  name: string
  course_code: string
  canvas_course_id: string
  assignments: Assignment[]
}

interface DashboardClientProps {
  courses: Course[]
  hiddenCourses: string[]
}

export function DashboardClient({ courses, hiddenCourses }: DashboardClientProps) {
  const router = useRouter()

  const handleToggleHide = async (courseId: string, hide: boolean) => {
    try {
      const response = await fetch('/api/user/hidden-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          action: hide ? 'hide' : 'show',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update hidden courses')
      }

      router.refresh()
    } catch (error) {
      console.error('Error toggling course visibility:', error)
    }
  }

  const handleShowAll = async () => {
    try {
      const response = await fetch('/api/user/hidden-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: '',
          action: 'clear',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to show all courses')
      }

      router.refresh()
    } catch (error) {
      console.error('Error showing all courses:', error)
    }
  }

  const visibleCourses = courses.filter(
    (course) => !hiddenCourses.includes(course.canvas_course_id)
  )
  const hiddenCount = courses.length - visibleCourses.length

  return (
    <>
      <div className="space-y-6">
        {visibleCourses.map((course) => (
          <CourseSection
            key={course.canvas_course_id}
            course={course}
            assignments={course.assignments}
            isHidden={hiddenCourses.includes(course.canvas_course_id)}
            onToggleHide={handleToggleHide}
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
  )
}
