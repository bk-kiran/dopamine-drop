'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, GripVertical, Circle, CheckCircle2, Flame, Target } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface UrgentPanelProps {
  supabaseUserId: string
  isOpen: boolean
  onClose: () => void
}

interface UrgentAssignment {
  _id: string
  title: string
  dueAt: string | null
  pointsPossible: number
  status: 'pending' | 'submitted' | 'missing'
  courseName: string
  courseCode: string
  canvasCourseId: string
  urgentOrder: number
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

function SortableAssignment({
  assignment,
  onToggleComplete,
}: {
  assignment: UrgentAssignment
  onToggleComplete: (assignment: UrgentAssignment) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: assignment._id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isCompleted = assignment.status === 'submitted'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-4 rounded-xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] shadow-[var(--glass-shadow)] hover:border-purple-400/30 hover:shadow-lg hover:scale-[1.01] transition-all duration-200 group"
    >
      {/* Drag handle - always visible with prominent styling */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-purple-400 group-hover:text-purple-300 transition-colors"
        title="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </div>

      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleComplete(assignment)
        }}
        className="flex-shrink-0 hover:scale-110 transition-transform cursor-pointer"
        title={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {isCompleted ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <Circle className="h-5 w-5 text-gray-400 hover:text-green-500" />
        )}
      </button>

      {/* Assignment info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-[var(--text-primary)] text-sm truncate">{assignment.title}</h3>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-1">
          <span className="font-mono">{assignment.courseCode}</span>
          <span>•</span>
          <span>{formatDate(assignment.dueAt)}</span>
          <span>•</span>
          <span>{assignment.pointsPossible} pts</span>
        </div>
      </div>

      {/* Status badge - red dot for missing */}
      {assignment.status === 'missing' && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-xs text-red-400">Missing</span>
        </div>
      )}
    </div>
  )
}

export function UrgentPanel({ supabaseUserId, isOpen, onClose }: UrgentPanelProps) {
  const urgentAssignments = useQuery(api.assignments.getUrgentAssignments, {
    clerkId: supabaseUserId,
  })

  const urgentCustomTasks = useQuery(api.customTasks.getUrgentCustomTasks, {
    clerkId: supabaseUserId,
  })

  const userData = useQuery(api.users.getUserBySupabaseId, {
    clerkId: supabaseUserId,
  })

  const reorderUrgentAssignments = useMutation(api.assignments.reorderUrgentAssignments)
  const reorderUrgentCustomTasks = useMutation(api.customTasks.reorderUrgentCustomTasks)
  const completeAssignment = useMutation(api.assignments.completeAssignment)
  const uncompleteAssignment = useMutation(api.assignments.uncompleteAssignment)
  const completeCustomTask = useMutation(api.customTasks.completeCustomTask)
  const uncompleteCustomTask = useMutation(api.customTasks.uncompleteCustomTask)

  // Local state for drag-and-drop only (no optimistic updates)
  const [localAssignments, setLocalAssignments] = useState<UrgentAssignment[]>([])

  // Filter out hidden courses from Canvas assignments
  const hiddenCourses = userData?.hiddenCourses || []
  const visibleUrgentAssignments = urgentAssignments?.filter(
    (a) => !hiddenCourses.includes(a.canvasCourseId)
  )

  // Convert custom tasks to the same format as assignments
  const formattedCustomTasks = (urgentCustomTasks || []).map((task) => ({
    _id: task._id,
    title: task.title,
    dueAt: task.dueAt || null,
    pointsPossible: task.pointsValue,
    status: 'pending' as const, // Custom tasks only show if pending
    courseName: task.category,
    courseCode: task.category.toUpperCase().slice(0, 4),
    canvasCourseId: '', // Not a Canvas course
    urgentOrder: task.urgentOrder || 0,
  }))

  // Combine Canvas assignments and custom tasks, sorted by urgentOrder
  const combinedUrgent = [
    ...(visibleUrgentAssignments || []),
    ...formattedCustomTasks,
  ].sort((a, b) => (a.urgentOrder || 0) - (b.urgentOrder || 0))

  // Use combined urgent as source of truth, local state only for optimistic drag updates
  const [isDragging, setIsDragging] = useState(false)
  const assignments = isDragging ? localAssignments : combinedUrgent

  // Sync local state with Convex data when not dragging
  useEffect(() => {
    if (!isDragging && combinedUrgent.length > 0) {
      setLocalAssignments(combinedUrgent as UrgentAssignment[])
    }
  }, [combinedUrgent, isDragging])

  // Debug logging - track when Convex queries update
  useEffect(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('[Urgent Panel] 🔄 QUERIES UPDATED at', new Date().toISOString())
    console.log('[Urgent Panel] Canvas assignments query:', visibleUrgentAssignments?.length || 0)
    console.log('[Urgent Panel] Custom tasks query:', urgentCustomTasks?.length || 0)
    console.log('[Urgent Panel] Combined urgent total:', combinedUrgent.length)
    console.log('[Urgent Panel] Task IDs:', combinedUrgent.map(t => t._id))
    console.log('[Urgent Panel] Task details:', combinedUrgent.map(t => ({
      id: t._id,
      title: t.title,
      status: t.status,
      isCustom: !t.canvasCourseId,
      urgentOrder: t.urgentOrder,
    })))
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  }, [visibleUrgentAssignments, urgentCustomTasks, combinedUrgent])

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleToggleComplete = async (assignment: UrgentAssignment) => {
    const isCustomTask = assignment.canvasCourseId === ''
    const isCompleted = assignment.status === 'submitted'

    console.log('[Urgent Panel] Toggling completion:', {
      id: assignment._id,
      title: assignment.title,
      isCustomTask,
      currentStatus: assignment.status,
      isCompleted,
    })

    try {
      if (isCustomTask) {
        // Custom task
        if (isCompleted) {
          console.log('[Urgent Panel] Uncompleting custom task...')
          await uncompleteCustomTask({
            taskId: assignment._id as any,
            clerkId: supabaseUserId,
          })
        } else {
          console.log('[Urgent Panel] Completing custom task...')
          await completeCustomTask({
            taskId: assignment._id as any,
            clerkId: supabaseUserId,
          })
        }
      } else {
        // Canvas assignment
        if (isCompleted) {
          console.log('[Urgent Panel] Uncompleting Canvas assignment...')
          await uncompleteAssignment({
            assignmentId: assignment._id as any,
            clerkId: supabaseUserId,
          })
        } else {
          console.log('[Urgent Panel] Completing Canvas assignment...')
          await completeAssignment({
            assignmentId: assignment._id as any,
            clerkId: supabaseUserId,
          })
        }
      }
      console.log('[Urgent Panel] Completion mutation finished - waiting for Convex to update queries')
    } catch (error) {
      console.error('[Urgent Panel] Error toggling completion:', error)
    }
  }

  const handleDragStart = () => {
    setIsDragging(true)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    setIsDragging(false)

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = assignments.findIndex((a) => a._id === active.id)
    const newIndex = assignments.findIndex((a) => a._id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    // Optimistic update
    const reordered = arrayMove(assignments, oldIndex, newIndex)
    setLocalAssignments(reordered)
    setIsDragging(true) // Keep showing optimistic state until server responds

    // Separate Canvas assignments and custom tasks
    const canvasAssignmentIds = reordered
      .filter((a) => a.canvasCourseId !== '') // Has a Canvas course ID
      .map((a) => a._id)

    const customTaskIds = reordered
      .filter((a) => a.canvasCourseId === '') // No Canvas course ID = custom task
      .map((a) => a._id)

    // Persist to Convex
    try {
      // Reorder Canvas assignments if any
      if (canvasAssignmentIds.length > 0) {
        await reorderUrgentAssignments({
          clerkId: supabaseUserId,
          assignmentIds: canvasAssignmentIds as any,
        })
      }

      // Reorder custom tasks if any
      if (customTaskIds.length > 0) {
        await reorderUrgentCustomTasks({
          clerkId: supabaseUserId,
          customTaskIds: customTaskIds as any,
        })
      }
    } catch (error) {
      console.error('Error reordering urgent items:', error)
      // Revert on error
      setLocalAssignments(combinedUrgent as UrgentAssignment[])
    } finally {
      setIsDragging(false) // Return to reactive state
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Slide-out panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="fixed right-0 top-0 h-full w-80 bg-[var(--bg-primary)] dark:bg-[var(--bg-secondary)] border-l border-[var(--glass-border)] backdrop-blur-xl shadow-[-8px_0_32px_rgba(168,85,247,0.15)] z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--glass-border)]">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
                  <Flame className="w-6 h-6 text-orange-500 fill-orange-500" />
                  Urgent Tasks
                </h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Drag to reorder your priorities
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {assignments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Target className="w-16 h-16 mb-4 text-[var(--text-muted)] opacity-30" />
                  <h3 className="text-lg font-semibold mb-2 text-[var(--text-primary)]">No urgent tasks</h3>
                  <p className="text-sm text-[var(--text-muted)] max-w-xs">
                    Mark assignments as urgent using the flame icon to see them here.
                  </p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={assignments.map((a) => a._id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {/* Drag hint */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3 px-1">
                      <GripVertical className="w-3 h-3" />
                      <span>Drag tasks to reorder priority</span>
                    </div>

                    <div className="space-y-3">
                      {assignments.map((assignment) => (
                        <SortableAssignment
                          key={assignment._id}
                          assignment={assignment}
                          onToggleComplete={handleToggleComplete}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
