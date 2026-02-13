'use client'

import { useState, useEffect } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/components/ui/use-toast'

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
}

interface CourseSectionProps {
  course: Course
  assignments: Assignment[]
  isHidden: boolean
  supabaseUserId: string
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'No due date'

  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function getAssignmentStatus(assignment: Assignment): 'pending' | 'submitted' | 'missing' {
  if (assignment.submitted_at) return 'submitted'
  if (assignment.due_at && new Date(assignment.due_at) < new Date()) return 'missing'
  return 'pending'
}

function StatusBadge({ status }: { status: 'pending' | 'submitted' | 'missing' }) {
  const variants = {
    pending: 'secondary',
    submitted: 'default',
    missing: 'destructive',
  } as const

  const labels = {
    pending: 'Pending',
    submitted: 'Submitted',
    missing: 'Missing',
  }

  return (
    <Badge variant={variants[status]} className="capitalize">
      {labels[status]}
    </Badge>
  )
}

export function CourseSection({ course, assignments, isHidden, supabaseUserId }: CourseSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const { toast } = useToast()

  // Use Convex mutation directly
  const toggleHiddenCourse = useMutation(api.users.toggleHiddenCourse)

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const storageKey = `course-collapsed-${course.canvas_course_id}`
    const stored = localStorage.getItem(storageKey)
    if (stored !== null) {
      setIsCollapsed(stored === 'true')
    }
  }, [course.canvas_course_id])

  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem(`course-collapsed-${course.canvas_course_id}`, String(newState))
  }

  const handleToggleHide = async () => {
    setIsToggling(true)
    const willBeHidden = !isHidden
    try {
      // Call Convex mutation directly
      await toggleHiddenCourse({
        supabaseId: supabaseUserId,
        canvasCourseId: course.canvas_course_id,
        hide: willBeHidden,
      })

      // Show toast notification
      if (willBeHidden) {
        toast({
          title: `${course.course_code} hidden`,
          description: "Click 'Show all' at the bottom to restore.",
          duration: 3000,
        })
      } else {
        toast({
          title: `${course.course_code} restored`,
          duration: 3000,
        })
      }
    } catch (error) {
      console.error('Error toggling course visibility:', error)
      toast({
        title: 'Error',
        description: 'Failed to update course visibility',
        variant: 'destructive',
        duration: 3000,
      })
    } finally {
      setIsToggling(false)
    }
  }

  if (isHidden) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapse}
              className="p-0 h-auto hover:bg-transparent"
            >
              {isCollapsed ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronUp className="h-5 w-5" />
              )}
            </Button>
            <span>{course.name}</span>
            <Badge
              variant="secondary"
              className={assignments.length === 0 ? 'opacity-50' : ''}
            >
              {assignments.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-normal text-muted-foreground">
              {course.course_code}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleHide}
              disabled={isToggling}
              className="p-1 h-auto hover:bg-muted"
            >
              {isHidden ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <CardContent>
              {assignments.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No upcoming assignments
                </div>
              ) : (
                <div className="space-y-3">
                  {assignments.map((assignment) => {
                    const status = getAssignmentStatus(assignment)
                    return (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <h3 className="font-semibold text-lg mb-1 truncate">
                            {assignment.title}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>Due: {formatDate(assignment.due_at)}</span>
                            <span>•</span>
                            <span>{assignment.points_possible} points</span>
                          </div>
                        </div>
                        <StatusBadge status={status} />
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
