'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent } from '@/components/ui/card'
import { AutoSync } from './auto-sync'
import { AddTaskModal } from '@/components/add-task-modal'
import { AssignmentDetailsModal, type ModalItem } from '@/components/assignment-details-modal'
import { StreakShieldIndicator } from '@/components/streak-shield-indicator'
import { DashboardNavbar } from '@/components/dashboard-navbar'
import { DashboardSettingsModal, useDashboardSettings } from '@/components/dashboard-settings-modal'
import { DailyChallenges } from '@/components/daily-challenges'
import { ConnectCanvasModal } from '@/components/connect-canvas-modal'
import {
  Flame, Zap, Plus, BookOpen, Users, Briefcase, Heart,
  Circle, CheckCircle2, Loader2, Trash2, Pencil, Check,
  Settings, ChevronDown, ChevronRight, Calendar,
  AlertTriangle, CalendarClock, CalendarRange, Trophy, ClipboardList,
  Link as LinkIcon,
} from 'lucide-react'
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
import { formatCourseName } from '@/lib/course-utils'
import { cn } from '@/lib/utils'

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
  isUrgent?: boolean
  urgentOrder?: number
}

type Category = 'academic' | 'club' | 'work' | 'personal'

const CATEGORY_CONFIG: Record<Category, { label: string; icon: React.ElementType; color: string }> = {
  academic: { label: 'Academic', icon: BookOpen, color: 'text-purple-400' },
  club: { label: 'Club', icon: Users, color: 'text-blue-400' },
  work: { label: 'Work', icon: Briefcase, color: 'text-green-400' },
  personal: { label: 'Personal', icon: Heart, color: 'text-pink-400' },
}

type BucketId = 'urgent' | 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later' | 'completed' | 'challenges'

interface TimelineBucket {
  id: BucketId
  label: string
  Icon: React.ElementType
  iconColor: string
  borderColor: string
  bgColor: string
  badgeColor: string
}

const BUCKETS: TimelineBucket[] = [
  { id: 'urgent',    label: 'Urgent',     Icon: Flame,         iconColor: 'text-orange-500', borderColor: 'border-orange-500/30', bgColor: 'bg-orange-500/5',  badgeColor: 'bg-orange-500/20 text-orange-400' },
  { id: 'overdue',   label: 'Overdue',    Icon: AlertTriangle, iconColor: 'text-red-500',    borderColor: 'border-red-500/30',    bgColor: 'bg-red-500/5',     badgeColor: 'bg-red-500/20 text-red-400' },
  { id: 'today',     label: 'Today',      Icon: Calendar,      iconColor: 'text-yellow-500', borderColor: 'border-yellow-500/30', bgColor: 'bg-yellow-500/5',  badgeColor: 'bg-yellow-500/20 text-yellow-400' },
  { id: 'tomorrow',  label: 'Tomorrow',   Icon: CalendarClock, iconColor: 'text-green-500',  borderColor: 'border-green-500/30',  bgColor: 'bg-green-500/5',   badgeColor: 'bg-green-500/20 text-green-400' },
  { id: 'this_week', label: 'This Week',  Icon: CalendarRange, iconColor: 'text-blue-500',   borderColor: 'border-blue-500/30',   bgColor: 'bg-blue-500/5',    badgeColor: 'bg-blue-500/20 text-blue-400' },
  { id: 'later',     label: 'Later',      Icon: ClipboardList, iconColor: 'text-gray-400',   borderColor: 'border-white/10',      bgColor: 'bg-white/[0.02]',  badgeColor: 'bg-white/10 text-gray-400' },
]

interface UnifiedTask {
  id: string
  type: 'canvas' | 'custom'
  title: string
  dueAt: string | null
  isUrgent: boolean
  isCompleted: boolean
  canvasData?: Assignment
  customData?: any
}

function classifyToBucket(task: UnifiedTask, now: Date): BucketId {
  if (task.isCompleted) return 'completed'
  if (task.isUrgent) return 'urgent'
  if (!task.dueAt) return 'later'

  const due = new Date(task.dueAt)
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1)
  const tomorrowEnd = new Date(tomorrowStart); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1)
  const weekEnd = new Date(todayStart); weekEnd.setDate(weekEnd.getDate() + 7)

  if (due < now) return 'overdue'
  if (due < tomorrowStart) return 'today'
  if (due < tomorrowEnd) return 'tomorrow'
  if (due < weekEnd) return 'this_week'
  return 'later'
}

interface DashboardClientProps {
  supabaseUserId: string
}

export function DashboardClient({ supabaseUserId }: DashboardClientProps) {
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [editTask, setEditTask] = useState<any>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [showConnectCanvas, setShowConnectCanvas] = useState(false)
  const { settings: dashSettings, saveSettings: saveDashSettings } = useDashboardSettings()
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [uncompletingTaskId, setUncompletingTaskId] = useState<string | null>(null)
  const [taskToUntick, setTaskToUntick] = useState<{ id: string; title: string } | null>(null)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const [taskModalItem, setTaskModalItem] = useState<ModalItem | null>(null)
  const [showAllCompleted, setShowAllCompleted] = useState(false)
  // Each bucket manages its own collapsed state independently
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(
    new Set(['later', 'completed'])
  )
  const { toast } = useToast()

  const dashboardData = useQuery(api.users.getDashboardData, { clerkId: supabaseUserId })

  const sevenDaysAgoISO = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString()
  }, [])

  const assignments = useQuery(api.assignments.getAssignmentsBySupabaseId, {
    clerkId: supabaseUserId,
    includeSubmittedSince: showAllCompleted ? undefined : sevenDaysAgoISO,
  })

  const customTasks = useQuery(api.customTasks.getCustomTasks, { clerkId: supabaseUserId })

  const completeCustomTask = useMutation(api.customTasks.completeCustomTask)
  const uncompleteCustomTask = useMutation(api.customTasks.uncompleteCustomTask)
  const deleteCustomTask = useMutation(api.customTasks.deleteCustomTask)
  const toggleUrgentCustomTask = useMutation(api.customTasks.toggleUrgentCustomTask)
  const manuallyCompleteAssignment = useMutation(api.assignments.manuallyCompleteAssignment)
  const toggleUrgentAssignment = useMutation(api.assignments.toggleUrgent)
  const updateChallengeProgress = useMutation(api.challenges.updateChallengeProgress)
  const checkAndAwardAchievements = useMutation(api.achievements.checkAndAwardAchievements)

  if (dashboardData === undefined || assignments === undefined) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mb-4" />
            <p className="text-[var(--text-muted)]">Loading dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  const userData = dashboardData.user
  const allCourses = dashboardData.courses
  const isCanvasConnected = !!(userData?.canvasTokenEncrypted)
  const pointsData = dashboardData.visiblePoints
  const hiddenCourses: string[] = userData?.hiddenCourses || []

  const isMultiplierActive =
    !!userData?.xpMultiplierDay &&
    userData.xpMultiplierDay === String(new Date().getDay())

  const getGreeting = () => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  }

  const getFirstName = () =>
    userData?.displayName ? userData.displayName.split(' ')[0] : ''

  const now = new Date()

  const canvasTasks: UnifiedTask[] = (assignments || [])
    .filter((a: any) => !hiddenCourses.includes(a.canvasCourseId))
    .map((a: any) => ({
      id: a._id, type: 'canvas' as const,
      title: a.title, dueAt: a.dueAt,
      isUrgent: a.isUrgent ?? false,
      isCompleted: a.status === 'submitted' || a.manuallyCompleted === true,
      canvasData: a,
    }))

  const customUnifiedTasks: UnifiedTask[] = (customTasks || []).map((t: any) => ({
    id: t._id, type: 'custom' as const,
    title: t.title, dueAt: t.dueAt,
    isUrgent: t.isUrgent ?? false,
    isCompleted: t.status === 'completed',
    customData: t,
  }))

  const allTasks = [...canvasTasks, ...customUnifiedTasks]

  const bucketMap = new Map<string, UnifiedTask[]>()
  for (const b of [...BUCKETS, { id: 'completed' }, { id: 'challenges' }]) {
    bucketMap.set(b.id, [])
  }
  for (const task of allTasks) {
    const bid = classifyToBucket(task, now)
    bucketMap.get(bid)!.push(task)
  }
  for (const [, tasks] of bucketMap) {
    tasks.sort((a, b) => {
      if (!a.dueAt && !b.dueAt) return 0
      if (!a.dueAt) return 1; if (!b.dueAt) return -1
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    })
  }

  const bucketSettingsVisible: Record<string, boolean> = {
    urgent: dashSettings.showUrgent,
    overdue: dashSettings.showOverdue,
    today: dashSettings.showToday,
    tomorrow: dashSettings.showTomorrow,
    this_week: dashSettings.showThisWeek,
    later: true, completed: true, challenges: true,
  }

  const toggleBucket = (id: string) => {
    setCollapsedBuckets(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCompleteCustomTask = async (taskId: string, taskTitle: string) => {
    setCompletingTaskId(taskId)
    try {
      const result = await completeCustomTask({ taskId: taskId as any, clerkId: supabaseUserId })
      toast({
        title: `+${result.pointsAwarded} pts — ${taskTitle}`,
        description: result.multiplierActive ? '2× XP multiplier applied!' : undefined,
        className: result.multiplierActive
          ? 'bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-100'
          : 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950/30 dark:border-green-800 dark:text-green-100',
        duration: 4000,
      })
      updateChallengeProgress({ clerkId: supabaseUserId }).catch(console.error)
      checkAndAwardAchievements({ clerkId: supabaseUserId }).catch(console.error)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive', duration: 3000 })
    } finally { setCompletingTaskId(null) }
  }

  const handleCompleteCanvasTask = async (assignmentId: string, title: string) => {
    setCompletingTaskId(assignmentId)
    try {
      await manuallyCompleteAssignment({ assignmentId: assignmentId as any, clerkId: supabaseUserId })
      toast({
        title: 'Assignment completed!', description: title,
        className: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950/30 dark:border-green-800 dark:text-green-100',
        duration: 3000,
      })
      updateChallengeProgress({ clerkId: supabaseUserId }).catch(console.error)
      checkAndAwardAchievements({ clerkId: supabaseUserId }).catch(console.error)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive', duration: 3000 })
    } finally { setCompletingTaskId(null) }
  }

  const handleConfirmUntickTask = async () => {
    if (!taskToUntick) return
    setUncompletingTaskId(taskToUntick.id)
    setTaskToUntick(null)
    try {
      const result = await uncompleteCustomTask({ taskId: taskToUntick.id as any, clerkId: supabaseUserId })
      toast({
        title: `Task unticked — ${result.pointsRemoved} pts removed`,
        description: taskToUntick.title,
        className: 'bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-100',
        duration: 4000,
      })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive', duration: 3000 })
    } finally { setUncompletingTaskId(null) }
  }

  const handleDeleteCustomTask = async (taskId: string, taskTitle: string) => {
    setDeletingTaskId(taskId)
    try {
      await deleteCustomTask({ taskId: taskId as any, clerkId: supabaseUserId })
      toast({ title: `"${taskTitle}" deleted`, duration: 3000 })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive', duration: 3000 })
    } finally { setDeletingTaskId(null) }
  }

  const handleToggleUrgentCustom = async (taskId: string) => {
    try {
      const result = await toggleUrgentCustomTask({ taskId: taskId as any, clerkId: supabaseUserId })
      toast({
        description: result.isUrgent
          ? <span className="flex items-center gap-1.5"><Flame className="w-3 h-3 text-orange-500 fill-orange-500" /> Marked as urgent</span>
          : <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-gray-500" /> No longer urgent</span>,
        duration: 2000,
      })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive', duration: 3000 })
    }
  }

  const handleToggleUrgentCanvas = async (assignmentId: string) => {
    try {
      await toggleUrgentAssignment({ assignmentId: assignmentId as any, clerkId: supabaseUserId })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive', duration: 3000 })
    }
  }

  const courseNameMap = new Map<string, string>()
  if (allCourses) {
    for (const c of allCourses) courseNameMap.set(c.canvasCourseId, formatCourseName(c.name))
  }

  const formatDueLabel = (dueAt: string | null) => {
    if (!dueAt) return null
    const due = new Date(dueAt)
    const diffH = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60))
    if (diffH < 0) {
      const abs = Math.abs(diffH)
      return abs < 24 ? `${abs}h overdue` : `${Math.floor(abs / 24)}d overdue`
    }
    if (diffH < 1) return 'Due very soon'
    if (diffH < 24) return `Due in ${diffH}h`
    const diffD = Math.floor(diffH / 24)
    if (diffD === 1) return 'Due tomorrow'
    return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // ── TaskRow ──────────────────────────────────────────────────────────────────

  const TaskRow = ({ task, bucketId }: { task: UnifiedTask; bucketId: string }) => {
    const isCompleting = completingTaskId === task.id
    const isDeleting = deletingTaskId === task.id
    const isUncompleting = uncompletingTaskId === task.id
    const catConfig = task.type === 'custom' && task.customData?.category
      ? CATEGORY_CONFIG[task.customData.category as Category]
      : null
    const CatIcon = catConfig?.icon

    return (
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors group/task',
        task.isCompleted ? 'opacity-50 hover:opacity-70 hover:bg-white/[0.03]' : 'hover:bg-white/[0.05]'
      )}>
        {/* Checkbox */}
        <button
          onClick={() => {
            if (task.isCompleted) {
              if (task.type === 'custom') setTaskToUntick({ id: task.id, title: task.title })
            } else {
              if (task.type === 'custom') handleCompleteCustomTask(task.id, task.title)
              else handleCompleteCanvasTask(task.id, task.title)
            }
          }}
          disabled={isCompleting || isUncompleting}
          className={cn(
            'flex-shrink-0 transition-colors opacity-0 group-hover/task:opacity-100',
            task.isCompleted ? 'text-green-500 hover:text-orange-400' : 'text-gray-500 hover:text-green-500'
          )}
        >
          {isCompleting || isUncompleting
            ? <Loader2 className="h-5 w-5 animate-spin" />
            : task.isCompleted
              ? <CheckCircle2 className="h-5 w-5" />
              : <Circle className="h-5 w-5" />}
        </button>

        {/* Info */}
        <button
          onClick={() => {
            if (task.type === 'canvas' && task.canvasData) {
              setTaskModalItem({
                type: 'assignment',
                id: task.id, title: task.title,
                description: task.canvasData.description,
                dueAt: task.dueAt,
                pointsPossible: task.canvasData.pointsPossible,
                status: task.canvasData.status,
                isUrgent: task.isUrgent,
                courseName: task.canvasData.courseName,
              })
            } else if (task.type === 'custom' && task.customData) {
              setTaskModalItem({
                type: 'customTask',
                id: task.id, title: task.title,
                description: task.customData.description,
                dueAt: task.dueAt,
                pointsValue: task.customData.pointsValue,
                status: task.customData.status,
                isUrgent: task.isUrgent,
                category: task.customData.category,
                userNotes: task.customData.userNotes,
              })
            }
          }}
          className="flex-1 min-w-0 text-left"
        >
          <p className={cn(
            'text-sm font-medium leading-snug truncate',
            task.isCompleted ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
          )}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {dashSettings.groupByCourse && task.type === 'canvas' && task.canvasData?.canvasCourseId && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 font-medium shrink-0">
                {courseNameMap.get(task.canvasData.canvasCourseId) || task.canvasData.courseCode}
              </span>
            )}
            {task.type === 'custom' && CatIcon && (
              <span className={cn('flex items-center gap-0.5 text-[10px] font-medium', catConfig?.color)}>
                <CatIcon className="w-3 h-3" />{catConfig?.label}
              </span>
            )}
            {task.dueAt && (
              <span className={cn(
                'text-xs flex items-center gap-0.5',
                bucketId === 'overdue' ? 'text-red-400' : 'text-[var(--text-muted)]'
              )}>
                <Calendar className="w-3 h-3" />{formatDueLabel(task.dueAt)}
              </span>
            )}
            {task.type === 'custom' && task.customData?.pointsValue && (
              <span className="text-[10px] text-purple-400 font-semibold">{task.customData.pointsValue} pts</span>
            )}
            {task.type === 'canvas' && (task.canvasData?.pointsPossible ?? 0) > 0 && (
              <span className="text-[10px] text-purple-400 font-semibold">{task.canvasData!.pointsPossible} pts</span>
            )}
          </div>
        </button>

        {/* Urgent */}
        {!task.isCompleted && (
          <button
            onClick={() => task.type === 'custom' ? handleToggleUrgentCustom(task.id) : handleToggleUrgentCanvas(task.id)}
            className={cn(
              'p-1 rounded transition-all shrink-0',
              task.isUrgent ? 'text-orange-400' : 'opacity-0 group-hover/task:opacity-100 text-[var(--text-muted)] hover:text-orange-400'
            )}
          >
            <Flame className={cn('w-4 h-4', task.isUrgent && 'fill-orange-400')} />
          </button>
        )}

        {/* Edit (custom only) */}
        {task.type === 'custom' && !task.isCompleted && (
          <button
            onClick={() => { setEditTask(task.customData); setIsAddTaskOpen(true) }}
            className="p-1 rounded text-[var(--text-muted)] hover:text-purple-400 opacity-0 group-hover/task:opacity-100 transition-all"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Delete (custom only) */}
        {task.type === 'custom' && (
          <button
            onClick={() => handleDeleteCustomTask(task.id, task.title)}
            disabled={isDeleting}
            className="p-1 rounded text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover/task:opacity-100 transition-all"
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Status dot */}
        {task.isCompleted
          ? <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          : task.dueAt && (() => {
              const hrs = (new Date(task.dueAt).getTime() - now.getTime()) / 3600000
              if (hrs < 0 || hrs < 24) return <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
              if (hrs / 24 <= 3) return <div className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
              return <div className="w-2 h-2 rounded-full bg-gray-600 shrink-0" />
            })()
        }
      </div>
    )
  }

  // ── BucketSection ────────────────────────────────────────────────────────────
  // Each section gets its own AnimatePresence so collapsing one never
  // triggers animations in sibling sections.

  const BucketSection = ({ bucket }: { bucket: TimelineBucket }) => {
    if (!bucketSettingsVisible[bucket.id]) return null
    const tasks = bucketMap.get(bucket.id) || []
    if (tasks.length === 0) return null

    const isCollapsed = collapsedBuckets.has(bucket.id)
    const { Icon, iconColor, borderColor, bgColor, badgeColor } = bucket

    const canvasTasks = tasks.filter(t => t.type === 'canvas')
    const customTasksInBucket = tasks.filter(t => t.type === 'custom')

    return (
      <div className={cn('rounded-2xl border overflow-hidden', borderColor, bgColor)}>
        <button
          onClick={() => toggleBucket(bucket.id)}
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors"
        >
          <Icon className={cn('w-4 h-4 shrink-0', iconColor)} />
          <span className="text-sm font-bold text-[var(--text-primary)]">{bucket.label}</span>
          <span className={cn('ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold', badgeColor)}>
            {tasks.length}
          </span>
          <div className="flex-1" />
          {isCollapsed
            ? <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
        </button>

        {/* Isolated AnimatePresence — only this section animates */}
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              key={`${bucket.id}-content`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="px-1 pb-2">
                {dashSettings.separateCustomTasks && canvasTasks.length > 0 && customTasksInBucket.length > 0 ? (
                  <>
                    {canvasTasks.map(t => <TaskRow key={t.id} task={t} bucketId={bucket.id} />)}
                    <div className="flex items-center gap-3 px-4 my-2">
                      <div className="flex-1 border-t border-white/10" />
                      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold">My Tasks</span>
                      <div className="flex-1 border-t border-white/10" />
                    </div>
                    {customTasksInBucket.map(t => <TaskRow key={t.id} task={t} bucketId={bucket.id} />)}
                  </>
                ) : (
                  tasks.map(t => <TaskRow key={t.id} task={t} bucketId={bucket.id} />)
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ── Challenges section ───────────────────────────────────────────────────────

  const ChallengesSection = () => {
    const isCollapsed = collapsedBuckets.has('challenges')
    return (
      <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 overflow-hidden">
        <button
          onClick={() => toggleBucket('challenges')}
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors"
        >
          <Trophy className="w-4 h-4 shrink-0 text-purple-500" />
          <span className="text-sm font-bold text-[var(--text-primary)]">Daily Challenges</span>
          <div className="flex-1" />
          {isCollapsed
            ? <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
        </button>
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              key="challenges-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="px-5 pb-5">
                <DailyChallenges supabaseUserId={supabaseUserId} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  const totalPending = allTasks.filter(t => !t.isCompleted).length
  const totalCompleted = allTasks.filter(t => t.isCompleted).length
  const completedTasks = bucketMap.get('completed') || []

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 py-4">
        <div>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-1">
            ACADEMIC WORKSPACE
          </p>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {getGreeting()}{getFirstName() && `, ${getFirstName()}`}
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Streak */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
            <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              {pointsData.streakCount} DAY STREAK
            </span>
            {(userData?.streakShields ?? 0) > 0 && (
              <StreakShieldIndicator shields={userData?.streakShields ?? 0} />
            )}
          </div>

          {/* Points */}
          <div className={cn(
            'relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--glass-bg)] backdrop-blur-md border transition-all',
            isMultiplierActive ? 'border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.25)]' : 'border-[var(--glass-border)]'
          )}>
            <Zap className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
            <span className="text-xs font-semibold text-[var(--text-primary)]">{pointsData.totalPoints} PTS</span>
            {isMultiplierActive && (
              <span className="absolute -top-2 -right-2 px-1 py-0.5 rounded-full bg-purple-500 text-[9px] font-black text-white leading-none border border-purple-300/30 shadow-lg">2×</span>
            )}
          </div>

          {/* Pending / done */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
            <span className="text-xs font-semibold text-[var(--text-primary)]">{totalPending} pending</span>
            <span className="text-[var(--text-muted)] text-xs">·</span>
            <span className="text-xs text-green-400 font-semibold">{totalCompleted} done</span>
          </div>

          {/* All/7D toggle */}
          <button
            onClick={() => setShowAllCompleted(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all',
              showAllCompleted
                ? 'bg-green-500/20 border-green-500/30 text-green-400'
                : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-muted)]'
            )}
            title={showAllCompleted ? 'Showing all completed' : 'Showing recent only (7 days)'}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{showAllCompleted ? 'ALL' : '7D'}</span>
          </button>

          {/* Settings icon-only */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
            title="Dashboard settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <DashboardNavbar
            isCanvasConnected={isCanvasConnected}
            onConnectCanvas={() => setShowConnectCanvas(true)}
          />
        </div>
      </div>

      {/* 2× XP Banner */}
      <AnimatePresence>
        {isMultiplierActive && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}
            className="mb-4 relative overflow-hidden rounded-2xl px-5 py-3 flex items-center gap-3 bg-gradient-to-r from-purple-600/20 via-purple-500/15 to-purple-600/20 border border-purple-500/30"
          >
            <motion.div
              animate={{ x: ['0%', '100%', '0%'] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400/10 to-transparent pointer-events-none"
            />
            <Zap className="w-4 h-4 text-purple-400 fill-purple-400/50 flex-shrink-0" />
            <span className="text-sm font-bold text-purple-300">2× XP Active Today</span>
            <span className="text-xs text-purple-400/80 ml-1">— All points doubled!</span>
            <span className="ml-auto px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-400/40 text-[11px] font-black text-purple-300">2×</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas Not Connected — CTA */}
      {!isCanvasConnected && (
        <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-violet-500/10 p-6 mb-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <LinkIcon className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-[var(--text-primary)] mb-0.5">Connect Canvas to import assignments</h3>
              <p className="text-xs text-[var(--text-muted)]">
                Auto-sync courses, grades, and deadlines. Custom tasks work without Canvas.
              </p>
            </div>
            <button
              onClick={() => setShowConnectCanvas(true)}
              className="flex-shrink-0 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Connect Canvas
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {allTasks.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-[var(--text-muted)] mb-3">
              {isCanvasConnected
                ? 'No tasks yet. Add a custom task to get started.'
                : 'Connect Canvas or add a custom task to see tasks here.'}
            </p>
            {!isCanvasConnected && (
              <button
                onClick={() => setShowConnectCanvas(true)}
                className="text-sm text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
              >
                Connect Canvas
              </button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {BUCKETS.map(bucket => (
            <BucketSection key={bucket.id} bucket={bucket} />
          ))}

          {/* Completed */}
          {completedTasks.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <button
                onClick={() => toggleBucket('completed')}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500" />
                <span className="text-sm font-bold text-[var(--text-primary)]">Completed</span>
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400">
                  {completedTasks.length}
                </span>
                <div className="flex-1" />
                {collapsedBuckets.has('completed')
                  ? <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                  : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
              </button>
              <AnimatePresence initial={false}>
                {!collapsedBuckets.has('completed') && (
                  <motion.div
                    key="completed-content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="px-1 pb-2">
                      {completedTasks.map(t => <TaskRow key={t.id} task={t} bucketId="completed" />)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Daily Challenges */}
          <ChallengesSection />
        </div>
      )}

      <AutoSync />

      {/* Floating Add Task button */}
      <button
        onClick={() => { setEditTask(null); setIsAddTaskOpen(true) }}
        className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-br from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white rounded-full shadow-2xl shadow-purple-500/40 flex items-center justify-center transition-all hover:scale-110 z-40 group"
        title="Add task"
      >
        <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-200" />
      </button>

      <DashboardSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={dashSettings}
        onSave={saveDashSettings}
      />

      <ConnectCanvasModal
        isOpen={showConnectCanvas}
        onClose={() => setShowConnectCanvas(false)}
      />

      <AddTaskModal
        open={isAddTaskOpen}
        onClose={() => { setIsAddTaskOpen(false); setEditTask(null) }}
        supabaseUserId={supabaseUserId}
        editTask={editTask ? {
          id: editTask._id, title: editTask.title,
          description: editTask.description, category: editTask.category,
          pointsValue: editTask.pointsValue, dueAt: editTask.dueAt,
        } : undefined}
      />

      <AssignmentDetailsModal
        open={taskModalItem !== null}
        onClose={() => setTaskModalItem(null)}
        item={taskModalItem}
        supabaseUserId={supabaseUserId}
      />

      <AlertDialog open={taskToUntick !== null} onOpenChange={(open) => !open && setTaskToUntick(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Completion?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove points from your total for "{taskToUntick?.title}". This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTaskToUntick(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmUntickTask}>
              Confirm & Remove Points
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
