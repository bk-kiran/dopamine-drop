'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Circle, GripVertical, Flame, Trophy, Zap } from 'lucide-react'
import { LevelCard } from '@/components/level-card'
import { DailyChallenges } from '@/components/daily-challenges'
import { cn } from '@/lib/utils'
import {
  RightSidebar,
  RightSidebarBody,
  RightSidebarSection,
} from '@/components/ui/right-sidebar'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function formatDueDate(dateString: string | null): string {
  if (!dateString) return 'NO DUE DATE'

  const now = new Date()
  const dueDate = new Date(dateString)
  const diffMs = dueDate.getTime() - now.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMs < 0) return 'OVERDUE'
  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    return `DUE IN ${diffMinutes} MIN${diffMinutes !== 1 ? 'S' : ''}`
  }
  if (diffHours < 24) return `DUE IN ${diffHours} HOUR${diffHours !== 1 ? 'S' : ''}`
  if (diffDays === 1) return 'DUE TOMORROW'
  if (diffDays < 7) return `DUE IN ${diffDays} DAYS`
  return dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function SortableUrgentItem({ item }: { item: { _id: string; title: string; dueAt: string | null; isCustomTask: boolean } }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item._id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const dueText = formatDueDate(item.dueAt)
  const isOverdue = dueText === 'OVERDUE'
  const isUrgentTime = dueText.includes('HOUR') || dueText === 'DUE TOMORROW'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-3 rounded-xl border-l-4 border-orange-500 transition-all duration-200 group",
        "bg-orange-50 hover:bg-orange-100 border border-orange-200",
        "dark:bg-orange-500/10 dark:hover:bg-orange-500/20 dark:border-orange-500/20"
      )}
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors mt-0.5"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1 truncate">
            {item.title}
          </h4>
          <p className={cn(
            "text-xs font-bold uppercase tracking-wide",
            isOverdue ? 'text-red-500 dark:text-red-400' :
            isUrgentTime ? 'text-orange-500 dark:text-orange-400' :
            'text-yellow-600 dark:text-yellow-400'
          )}>
            {dueText}
          </p>
        </div>

        {item.isCustomTask && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30 shrink-0">
            CUSTOM
          </span>
        )}
      </div>
    </div>
  )
}

function UrgentTasksContent({ supabaseUserId }: { supabaseUserId: string }) {
  const [localUrgentItems, setLocalUrgentItems] = useState<any[]>([])

  const urgentAssignments = useQuery(
    api.assignments.getUrgentAssignments,
    { supabaseId: supabaseUserId }
  )
  const urgentCustomTasks = useQuery(
    api.customTasks.getUrgentCustomTasks,
    { supabaseId: supabaseUserId }
  )
  const reorderUrgentAssignments = useMutation(api.assignments.reorderUrgentAssignments)
  const reorderUrgentCustomTasks = useMutation(api.customTasks.reorderUrgentCustomTasks)

  const mergedUrgentItems = [
    ...(urgentAssignments || []).map((a: any) => ({
      _id: a._id, title: a.title, dueAt: a.dueAt,
      urgentOrder: a.urgentOrder, isCustomTask: false,
    })),
    ...(urgentCustomTasks || []).map((t: any) => ({
      _id: t._id, title: t.title, dueAt: t.dueAt,
      urgentOrder: t.urgentOrder, isCustomTask: true,
    })),
  ].sort((a, b) => (a.urgentOrder ?? 0) - (b.urgentOrder ?? 0))

  useEffect(() => {
    setLocalUrgentItems(mergedUrgentItems)
  }, [urgentAssignments, urgentCustomTasks])

  const displayItems = localUrgentItems.length > 0 ? localUrgentItems : mergedUrgentItems

  const sensors = useSensors(useSensor(PointerSensor))

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = displayItems.findIndex((item) => item._id === active.id)
    const newIndex = displayItems.findIndex((item) => item._id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(displayItems, oldIndex, newIndex)
    setLocalUrgentItems(reordered)

    try {
      const assignmentIds = reordered.filter((i) => !i.isCustomTask).map((i) => i._id)
      const customTaskIds = reordered.filter((i) => i.isCustomTask).map((i) => i._id)
      if (assignmentIds.length > 0) {
        await reorderUrgentAssignments({ supabaseId: supabaseUserId, assignmentIds: assignmentIds as any })
      }
      if (customTaskIds.length > 0) {
        await reorderUrgentCustomTasks({ supabaseId: supabaseUserId, customTaskIds: customTaskIds as any })
      }
    } catch {
      setLocalUrgentItems(mergedUrgentItems)
    }
  }

  if (urgentAssignments === undefined || urgentCustomTasks === undefined) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-xl animate-pulse bg-gray-200 dark:bg-neutral-800" />
        ))}
      </div>
    )
  }

  if (displayItems.length === 0) {
    return (
      <div className="text-center py-8">
        <Circle className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-neutral-600" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No urgent tasks</p>
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={displayItems.map((i) => i._id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {displayItems.map((item) => (
            <SortableUrgentItem key={item._id} item={item} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function RightPanelContent({ supabaseUserId }: { supabaseUserId: string }) {
  const urgentAssignments = useQuery(api.assignments.getUrgentAssignments, { supabaseId: supabaseUserId })
  const urgentCustomTasks = useQuery(api.customTasks.getUrgentCustomTasks, { supabaseId: supabaseUserId })
  const urgentCount = (urgentAssignments?.length || 0) + (urgentCustomTasks?.length || 0)

  return (
    <RightSidebarBody>
      {urgentCount > 0 && (
        <Badge className="mb-3 bg-red-100 text-red-600 border border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40 text-[10px] font-bold uppercase">
          {urgentCount} ALERT
        </Badge>
      )}

      <RightSidebarSection
        icon={<Flame className="h-5 w-5" />}
        title="Urgent Tasks"
      >
        <UrgentTasksContent supabaseUserId={supabaseUserId} />
      </RightSidebarSection>

      <RightSidebarSection
        icon={<Trophy className="h-5 w-5" />}
        title="Daily Challenges"
      >
        <DailyChallenges supabaseUserId={supabaseUserId} />
      </RightSidebarSection>

      <RightSidebarSection
        icon={<Zap className="h-5 w-5 fill-purple-500 dark:fill-purple-400" />}
        title="Level Progress"
      >
        <LevelCard supabaseUserId={supabaseUserId} />
      </RightSidebarSection>
    </RightSidebarBody>
  )
}


export function RightPanel() {
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null)
  const [rightOpen, setRightOpen] = useState(true)

  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setSupabaseUserId(user.id)
    }
    getUser()
  }, [])

  return (
    <RightSidebar open={rightOpen} setOpen={setRightOpen}>
      {supabaseUserId ? (
        <RightPanelContent supabaseUserId={supabaseUserId} />
      ) : (
        <RightSidebarBody className="items-center justify-start gap-4">
          <div className="w-8 h-8 rounded-full animate-pulse bg-gray-200 dark:bg-neutral-700" />
        </RightSidebarBody>
      )}
    </RightSidebar>
  )
}
