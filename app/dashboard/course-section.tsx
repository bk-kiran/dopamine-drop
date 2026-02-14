'use client'

import { useState, useEffect } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Eye, EyeOff, Circle, CheckCircle2, Loader2, Flame, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/components/ui/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface Assignment {
  id: string
  title: string
  due_at: string | null
  points_possible: number
  status?: 'pending' | 'submitted' | 'missing'
  submitted_at?: string | null
  manuallyCompleted?: boolean
  isUrgent?: boolean
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
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [uncompletingId, setUncompletingId] = useState<string | null>(null)
  const [assignmentToUntick, setAssignmentToUntick] = useState<{ id: string; title: string } | null>(null)
  const { toast } = useToast()

  // Use Convex mutations directly
  const toggleHiddenCourse = useMutation(api.users.toggleHiddenCourse)
  const manuallyCompleteAssignment = useMutation(api.assignments.manuallyCompleteAssignment)
  const unCompleteAssignment = useMutation(api.assignments.unCompleteAssignment)
  const toggleUrgent = useMutation(api.assignments.toggleUrgent)

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

  const handleCompleteAssignment = async (assignmentId: string, assignmentTitle: string) => {
    setCompletingId(assignmentId)
    try {
      const result = await manuallyCompleteAssignment({
        assignmentId: assignmentId as any, // Convex ID
        supabaseId: supabaseUserId,
      })

      // Show success toast with points awarded
      toast({
        title: `+${result.pointsAwarded} pts — ${assignmentTitle}`,
        description: result.reason.replace('_', ' '),
        className: 'bg-green-50 border-green-200',
        duration: 4000,
      })
    } catch (error: any) {
      console.error('Error completing assignment:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete assignment',
        variant: 'destructive',
        duration: 3000,
      })
    } finally {
      setCompletingId(null)
    }
  }

  const handleClickCompleted = (assignmentId: string, assignmentTitle: string, assignment: Assignment) => {
    // If it's a Canvas-submitted assignment (not manually completed), do nothing
    if (!assignment.manuallyCompleted) {
      return
    }

    // Open the confirmation dialog
    setAssignmentToUntick({ id: assignmentId, title: assignmentTitle })
  }

  const handleConfirmUntick = async () => {
    if (!assignmentToUntick) return

    setUncompletingId(assignmentToUntick.id)
    setAssignmentToUntick(null) // Close dialog

    try {
      const result = await unCompleteAssignment({
        assignmentId: assignmentToUntick.id as any,
        supabaseId: supabaseUserId,
      })

      // Show simple success toast
      toast({
        title: `Assignment unticked — ${result.pointsRemoved} pts removed`,
        description: assignmentToUntick.title,
        className: 'bg-orange-50 border-orange-200',
        duration: 4000,
      })
    } catch (error: any) {
      console.error('Error uncompleting assignment:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to untick assignment',
        variant: 'destructive',
        duration: 3000,
      })
    } finally {
      setUncompletingId(null)
    }
  }

  const handleToggleUrgent = async (assignmentId: string, currentlyUrgent: boolean) => {
    try {
      const result = await toggleUrgent({
        assignmentId: assignmentId as any,
        supabaseId: supabaseUserId,
      })

      // Show toast based on new state
      const nowUrgent = result.isUrgent
      toast({
        description: nowUrgent ? (
          <span className="flex items-center gap-1.5">
            <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
            Marked as urgent
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <Check className="w-3 h-3 text-gray-500" />
            No longer urgent
          </span>
        ),
        duration: 2000,
      })
    } catch (error: any) {
      console.error('Error toggling urgent status:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to update urgent status',
        variant: 'destructive',
        duration: 3000,
      })
    }
  }

  if (isHidden) {
    return null
  }

  // Split assignments into pending and completed
  const pendingAssignments = assignments
    .filter((a) => a.status !== 'submitted' && !a.manuallyCompleted)
    .sort((a, b) => {
      // Sort by due date ascending (soonest first)
      if (!a.due_at) return 1
      if (!b.due_at) return -1
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
    })

  const completedAssignments = assignments
    .filter((a) => a.status === 'submitted' || a.manuallyCompleted)
    .sort((a, b) => {
      // Sort by submitted date descending (most recent first)
      if (!a.submitted_at) return 1
      if (!b.submitted_at) return -1
      return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    })

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
              className={pendingAssignments.length === 0 ? 'opacity-50' : ''}
            >
              {pendingAssignments.length}
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
              {pendingAssignments.length === 0 && completedAssignments.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No upcoming assignments
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Pending assignments */}
                  <AnimatePresence mode="popLayout">
                    {pendingAssignments.map((assignment) => {
                    const status = getAssignmentStatus(assignment)
                    const isCompleting = completingId === assignment.id
                    const isUncompleting = uncompletingId === assignment.id

                    // Determine state based on priority order
                    let checkboxState: 'manually_ticked' | 'canvas_submitted' | 'missing' | 'pending'

                    if (assignment.manuallyCompleted === true) {
                      // State 3: Manually ticked (highest priority)
                      checkboxState = 'manually_ticked'
                    } else if (status === 'submitted') {
                      // State 2: Canvas-submitted
                      checkboxState = 'canvas_submitted'
                    } else if (status === 'missing') {
                      // State 4: Missing (still tickable)
                      checkboxState = 'missing'
                    } else {
                      // State 1: Pending
                      checkboxState = 'pending'
                    }

                    return (
                      <motion.div
                        key={assignment.id}
                        layout="position"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        {/* State 1: PENDING - Empty circle, clickable */}
                        {checkboxState === 'pending' && (
                          <button
                            onClick={() => handleCompleteAssignment(assignment.id, assignment.title)}
                            disabled={isCompleting}
                            className="flex-shrink-0 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50"
                            title="Mark as complete"
                          >
                            {isCompleting ? (
                              <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                            ) : (
                              <Circle className="h-6 w-6" />
                            )}
                          </button>
                        )}

                        {/* State 2: CANVAS SUBMITTED - Filled checkmark, non-clickable with tooltip */}
                        {checkboxState === 'canvas_submitted' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex-shrink-0 text-green-600 cursor-not-allowed opacity-75">
                                  <CheckCircle2 className="h-6 w-6" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Submitted on Canvas — cannot untick</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {/* State 3: MANUALLY TICKED - Filled checkmark, clickable to untick */}
                        {checkboxState === 'manually_ticked' && (
                          <button
                            onClick={() => handleClickCompleted(assignment.id, assignment.title, assignment)}
                            disabled={isUncompleting}
                            className="flex-shrink-0 text-green-600 hover:text-orange-600 transition-colors disabled:opacity-50"
                            title="Click to untick (will remove points)"
                          >
                            {isUncompleting ? (
                              <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
                            ) : (
                              <CheckCircle2 className="h-6 w-6" />
                            )}
                          </button>
                        )}

                        {/* State 4: MISSING - Empty circle, clickable (same as pending) */}
                        {checkboxState === 'missing' && (
                          <button
                            onClick={() => handleCompleteAssignment(assignment.id, assignment.title)}
                            disabled={isCompleting}
                            className="flex-shrink-0 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50"
                            title="Mark as complete"
                          >
                            {isCompleting ? (
                              <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                            ) : (
                              <Circle className="h-6 w-6" />
                            )}
                          </button>
                        )}

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

                        {/* Urgent flame icon - only for pending/missing assignments */}
                        {(checkboxState === 'pending' || checkboxState === 'missing') && (() => {
                          console.log('assignment urgent state:', assignment.id, assignment.isUrgent)
                          return (
                            <button
                              onClick={() => handleToggleUrgent(assignment.id, assignment.isUrgent || false)}
                              className="p-1 rounded hover:bg-orange-50 transition-colors duration-200"
                            >
                              <Flame
                                className={`w-4 h-4 transition-colors duration-200 ${
                                  assignment.isUrgent
                                    ? 'text-orange-500 fill-orange-500'
                                    : 'text-gray-300 fill-none hover:text-orange-400'
                                }`}
                              />
                            </button>
                          )
                        })()}

                        <StatusBadge status={status} />
                      </motion.div>
                    )
                  })}
                  </AnimatePresence>

                  {/* Divider between pending and completed */}
                  {pendingAssignments.length > 0 && completedAssignments.length > 0 && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 border-t" />
                      <span className="text-xs text-muted-foreground">Completed</span>
                      <div className="flex-1 border-t" />
                    </div>
                  )}

                  {/* Completed assignments */}
                  <AnimatePresence mode="popLayout">
                    {completedAssignments.map((assignment) => {
                      const isUncompleting = uncompletingId === assignment.id

                      return (
                        <motion.div
                          key={assignment.id}
                          layout="position"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center gap-3 p-4 border rounded-lg opacity-50"
                        >
                          {/* Manually completed: clickable to untick */}
                          {assignment.manuallyCompleted ? (
                            <button
                              onClick={() => handleClickCompleted(assignment.id, assignment.title, assignment)}
                              disabled={isUncompleting}
                              className="flex-shrink-0 text-green-600 hover:text-orange-600 transition-colors disabled:opacity-50"
                              title="Click to untick (will remove points)"
                            >
                              {isUncompleting ? (
                                <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
                              ) : (
                                <CheckCircle2 className="h-6 w-6" />
                              )}
                            </button>
                          ) : (
                            /* Canvas submitted: non-clickable with tooltip */
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex-shrink-0 text-green-600 cursor-not-allowed opacity-75">
                                    <CheckCircle2 className="h-6 w-6" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Submitted on Canvas — cannot untick</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}

                          <div className="flex-1 min-w-0 mr-4">
                            <h3 className="font-semibold text-lg mb-1 truncate line-through">
                              {assignment.title}
                            </h3>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span>Due: {formatDate(assignment.due_at)}</span>
                              <span>•</span>
                              <span>{assignment.points_possible} points</span>
                            </div>
                          </div>

                          <Badge variant="default" className="bg-green-600 flex-shrink-0">
                            Submitted
                          </Badge>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation dialog for unticking assignments */}
      <AlertDialog open={assignmentToUntick !== null} onOpenChange={(open) => !open && setAssignmentToUntick(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Completion?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove points from your total for "{assignmentToUntick?.title}". This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAssignmentToUntick(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmUntick}
            >
              Confirm & Remove Points
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
