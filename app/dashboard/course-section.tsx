'use client'

import { useState, useEffect } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Circle, CheckCircle2, Loader2, Flame, Check } from 'lucide-react'
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

export function CourseSection({ course, assignments, supabaseUserId }: CourseSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [uncompletingId, setUncompletingId] = useState<string | null>(null)
  const [assignmentToUntick, setAssignmentToUntick] = useState<{ id: string; title: string } | null>(null)
  const { toast } = useToast()

  // Use Convex mutations directly
  const manuallyCompleteAssignment = useMutation(api.assignments.manuallyCompleteAssignment)
  const unCompleteAssignment = useMutation(api.assignments.unCompleteAssignment)
  const toggleUrgent = useMutation(api.assignments.toggleUrgent)
  const updateChallengeProgress = useMutation(api.challenges.updateChallengeProgress)

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

      // Update daily challenge progress (fire and forget)
      updateChallengeProgress({ supabaseId: supabaseUserId }).catch(console.error)
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

  // Parse course name to remove Canvas IDs and semester codes
  const parseCourseName = (name: string) => {
    // Take everything before the first opening parenthesis
    return name.split('(')[0].trim()
  }

  return (
    <Card className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/8 hover:border-purple-400/20 transition-all duration-300 mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between group">
          <div className="flex items-center gap-3 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapse}
              className="p-0 h-auto hover:bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              {isCollapsed ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronUp className="h-5 w-5" />
              )}
            </Button>
            <span className="text-[var(--text-primary)] font-bold text-lg">
              {parseCourseName(course.name)} — {course.course_code}
            </span>
            <Badge
              className={`px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold uppercase tracking-wider border border-purple-500/30 ${
                pendingAssignments.length === 0 ? 'opacity-40' : ''
              }`}
            >
              {pendingAssignments.length} PENDING
            </Badge>
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

                    // Calculate if due soon (within 3 days)
                    const isDueSoon = assignment.due_at
                      ? (new Date(assignment.due_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24) <= 3
                      : false

                    return (
                      <motion.div
                        key={assignment.id}
                        layout="position"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-500/5 dark:hover:bg-purple-500/10 transition-colors duration-200 group/assignment"
                      >
                        {/* State 1: PENDING - Empty circle, clickable */}
                        {checkboxState === 'pending' && (
                          <button
                            onClick={() => handleCompleteAssignment(assignment.id, assignment.title)}
                            disabled={isCompleting}
                            className="flex-shrink-0 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50 opacity-0 group-hover/assignment:opacity-100"
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
                                <div className="flex-shrink-0 text-green-600 cursor-not-allowed opacity-0 group-hover/assignment:opacity-75">
                                  <CheckCircle2 className="h-6 w-6" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="right" sideOffset={8} avoidCollisions={true} collisionPadding={16}>
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
                            className="flex-shrink-0 text-green-600 hover:text-orange-600 transition-colors disabled:opacity-50 opacity-0 group-hover/assignment:opacity-100"
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
                            className="flex-shrink-0 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50 opacity-0 group-hover/assignment:opacity-100"
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
                          <h3 className="font-medium text-[var(--text-primary)] text-sm truncate">
                            {assignment.title}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-1">
                            <span>{formatDate(assignment.due_at)}</span>
                            <span>•</span>
                            <span>{assignment.points_possible} pts</span>
                          </div>
                        </div>

                        {/* Urgent flame icon - only for pending/missing assignments, shown on hover */}
                        {(checkboxState === 'pending' || checkboxState === 'missing') && (
                          <button
                            onClick={() => handleToggleUrgent(assignment.id, assignment.isUrgent || false)}
                            className={`p-1 rounded hover:bg-orange-50 transition-colors duration-200 ${
                              assignment.isUrgent ? '' : 'opacity-0 group-hover/assignment:opacity-100'
                            }`}
                          >
                            <Flame
                              className={`w-4 h-4 transition-colors duration-200 ${
                                assignment.isUrgent
                                  ? 'text-orange-500 fill-orange-500'
                                  : 'text-gray-300 fill-none hover:text-orange-400'
                              }`}
                            />
                          </button>
                        )}

                        {/* Dot indicator with dynamic colors */}
                        <div className="flex items-center gap-2">
                          {status === 'missing' && (
                            <>
                              <div className="w-2 h-2 rounded-full bg-red-400" />
                              <span className="text-xs text-red-400">Missing</span>
                            </>
                          )}
                          {status === 'pending' && assignment.due_at && (() => {
                            const hoursUntilDue = (new Date(assignment.due_at).getTime() - new Date().getTime()) / (1000 * 60 * 60)
                            const daysUntilDue = hoursUntilDue / 24

                            if (hoursUntilDue < 24) {
                              return <div className="w-2 h-2 rounded-full bg-red-400" />
                            } else if (daysUntilDue <= 3) {
                              return <div className="w-2 h-2 rounded-full bg-yellow-400" />
                            } else {
                              return <div className="w-2 h-2 rounded-full bg-gray-400" />
                            }
                          })()}
                          {status === 'pending' && !assignment.due_at && (
                            <div className="w-2 h-2 rounded-full bg-gray-400" />
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                  </AnimatePresence>

                  {/* Divider between pending and completed */}
                  {pendingAssignments.length > 0 && completedAssignments.length > 0 && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 border-t border-[var(--glass-border)]" />
                      <span className="text-xs text-[var(--text-muted)]">Completed</span>
                      <div className="flex-1 border-t border-[var(--glass-border)]" />
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
                          className="flex items-center gap-3 px-4 py-3 rounded-xl opacity-50 group/assignment"
                        >
                          {/* Manually completed: clickable to untick */}
                          {assignment.manuallyCompleted ? (
                            <button
                              onClick={() => handleClickCompleted(assignment.id, assignment.title, assignment)}
                              disabled={isUncompleting}
                              className="flex-shrink-0 text-green-600 hover:text-orange-600 transition-colors disabled:opacity-50 opacity-0 group-hover/assignment:opacity-100"
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
                                  <div className="flex-shrink-0 text-green-600 cursor-not-allowed opacity-0 group-hover/assignment:opacity-75">
                                    <CheckCircle2 className="h-6 w-6" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" sideOffset={8} avoidCollisions={true} collisionPadding={16}>
                                  <p>Submitted on Canvas — cannot untick</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}

                          <div className="flex-1 min-w-0 mr-4">
                            <h3 className="font-medium text-[var(--text-primary)] text-sm truncate line-through">
                              {assignment.title}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-1">
                              <span>{formatDate(assignment.due_at)}</span>
                              <span>•</span>
                              <span>{assignment.points_possible} pts</span>
                            </div>
                          </div>

                          {/* Green dot indicator for submitted */}
                          <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
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
