'use client'

import { useState } from 'react'
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

function SortableAssignment({ assignment }: { assignment: UrgentAssignment }) {
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
      className="flex items-center gap-3 p-4 bg-white border rounded-lg hover:bg-muted/50 transition-colors"
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-5 w-5" />
      </div>

      {/* Checkbox (non-interactive in this panel) */}
      <div className="flex-shrink-0">
        {isCompleted ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <Circle className="h-5 w-5 text-gray-400" />
        )}
      </div>

      {/* Assignment info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate">{assignment.title}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <span className="font-mono">{assignment.courseCode}</span>
          <span>•</span>
          <span>{formatDate(assignment.dueAt)}</span>
          <span>•</span>
          <span>{assignment.pointsPossible} pts</span>
        </div>
      </div>

      {/* Status badge */}
      {assignment.status === 'missing' && (
        <Badge variant="destructive" className="flex-shrink-0">
          Missing
        </Badge>
      )}
    </div>
  )
}

export function UrgentPanel({ supabaseUserId, isOpen, onClose }: UrgentPanelProps) {
  const urgentAssignments = useQuery(api.assignments.getUrgentAssignments, {
    supabaseId: supabaseUserId,
  })

  const reorderUrgentAssignments = useMutation(api.assignments.reorderUrgentAssignments)

  // Local state for optimistic reordering
  const [localAssignments, setLocalAssignments] = useState<UrgentAssignment[]>([])

  // Sync with Convex data
  const assignments = urgentAssignments || localAssignments

  // Update local state when Convex data changes
  if (urgentAssignments && urgentAssignments.length !== localAssignments.length) {
    setLocalAssignments(urgentAssignments as UrgentAssignment[])
  }

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = assignments.findIndex((a) => a._id === active.id)
    const newIndex = assignments.findIndex((a) => a._id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    // Optimistic update
    const reordered = arrayMove(assignments, oldIndex, newIndex)
    setLocalAssignments(reordered)

    // Persist to Convex
    try {
      await reorderUrgentAssignments({
        supabaseId: supabaseUserId,
        assignmentIds: reordered.map((a) => a._id) as any,
      })
    } catch (error) {
      console.error('Error reordering urgent assignments:', error)
      // Revert on error
      setLocalAssignments(urgentAssignments as UrgentAssignment[])
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
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* Slide-out panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Flame className="w-6 h-6 text-orange-500 fill-orange-500" />
                  Urgent Tasks
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
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
                  <Target className="w-16 h-16 mb-4 text-gray-300" />
                  <h3 className="text-lg font-semibold mb-2">No urgent tasks</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Mark assignments as urgent using the flame icon to see them here.
                  </p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={assignments.map((a) => a._id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {assignments.map((assignment) => (
                        <SortableAssignment
                          key={assignment._id}
                          assignment={assignment}
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
