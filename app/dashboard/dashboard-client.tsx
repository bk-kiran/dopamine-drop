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

import { useMemo, useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent } from '@/components/ui/card'
import { CourseSection } from './course-section'
import { AutoSync } from './auto-sync'
import { AddTaskModal } from '@/components/add-task-modal'
import { SortableSection } from '@/components/sortable-section'
import { StreakShieldIndicator } from '@/components/streak-shield-indicator'
import { Flame, Zap, RefreshCw, Sun, Moon, Plus, BookOpen, Users, Briefcase, Heart, Circle, CheckCircle2, Loader2, Trash2, Pencil, Check, ShieldCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
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
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'

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

interface Course {
  _id: string
  name: string
  courseCode: string
  canvasCourseId: string
  assignments: Assignment[]
}

type Category = 'academic' | 'club' | 'work' | 'personal'

const CATEGORY_CONFIG: Record<Category, { label: string; icon: React.ElementType; color: string; borderColor: string }> = {
  academic: { label: 'Academic', icon: BookOpen, color: 'text-purple-400', borderColor: 'border-purple-500/40' },
  club: { label: 'Club', icon: Users, color: 'text-blue-400', borderColor: 'border-blue-500/40' },
  work: { label: 'Work', icon: Briefcase, color: 'text-green-400', borderColor: 'border-green-500/40' },
  personal: { label: 'Personal', icon: Heart, color: 'text-pink-400', borderColor: 'border-pink-500/40' },
}

interface DashboardClientProps {
  supabaseUserId: string
}

export function DashboardClient({ supabaseUserId }: DashboardClientProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [editTask, setEditTask] = useState<any>(null)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [uncompletingTaskId, setUncompletingTaskId] = useState<string | null>(null)
  const [taskToUntick, setTaskToUntick] = useState<{ id: string; title: string } | null>(null)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()

  // Consolidated dashboard query (reduces 3 queries to 1)
  const dashboardData = useQuery(api.users.getDashboardData, {
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

  // Custom tasks query
  const customTasks = useQuery(api.customTasks.getCustomTasks, { supabaseId: supabaseUserId })

  // Mutations
  const completeCustomTask = useMutation(api.customTasks.completeCustomTask)
  const uncompleteCustomTask = useMutation(api.customTasks.uncompleteCustomTask)
  const deleteCustomTask = useMutation(api.customTasks.deleteCustomTask)
  const toggleUrgentCustomTask = useMutation(api.customTasks.toggleUrgentCustomTask)
  const updateChallengeProgress = useMutation(api.challenges.updateChallengeProgress)
  const checkAndAwardAchievements = useMutation(api.achievements.checkAndAwardAchievements)

  // DnD section ordering
  const [sectionOrder, setSectionOrder] = useState<string[]>([])
  const [isDraggingActive, setIsDraggingActive] = useState(false)
  const savedSectionOrder = useQuery(api.users.getDashboardSectionOrder, { supabaseId: supabaseUserId })
  const updateDashboardSectionOrderMutation = useMutation(api.users.updateDashboardSectionOrder)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Initialize / sync section order from DB data
  useEffect(() => {
    if (savedSectionOrder === undefined || dashboardData === undefined) return
    const allCoursesList = dashboardData.courses || []
    const hiddenList = dashboardData.user?.hiddenCourses || []
    const visibleCourseIds = allCoursesList
      .filter((c: any) => !hiddenList.includes(c.canvasCourseId))
      .map((c: any) => `course_${c.canvasCourseId}`)
    const allSectionIds = [...visibleCourseIds, 'my_tasks']
    if (!savedSectionOrder) {
      setSectionOrder(allSectionIds)
      return
    }
    const validSaved = savedSectionOrder.filter((id: string) => allSectionIds.includes(id))
    const newItems = allSectionIds.filter((id) => !savedSectionOrder.includes(id))
    setSectionOrder([...validSaved, ...newItems])
  }, [savedSectionOrder, dashboardData])

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

  const hiddenCourses: string[] = userData?.hiddenCourses || []

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

  // Only show visible (non-hidden) courses
  const visibleCourses = courses.filter(
    (course) => !hiddenCourses.includes(course.canvasCourseId)
  )

  // Check if 2x XP multiplier is active today
  const isMultiplierActive =
    !!userData?.xpMultiplierDay &&
    userData.xpMultiplierDay === String(new Date().getDay())

  // Get dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  // Get user's first name
  const getFirstName = () => {
    if (!userData?.displayName) return ''
    return userData.displayName.split(' ')[0]
  }

  // Custom task handlers
  const handleCompleteTask = async (taskId: string, taskTitle: string) => {
    setCompletingTaskId(taskId)
    try {
      const result = await completeCustomTask({ taskId: taskId as any, supabaseId: supabaseUserId })
      toast({
        title: `+${result.pointsAwarded} pts — ${taskTitle}`,
        description: result.multiplierActive ? '2× XP multiplier applied!' : undefined,
        className: result.multiplierActive ? 'bg-purple-50 border-purple-200' : 'bg-green-50 border-green-200',
        duration: 4000,
      })
      if (result.shieldUsed && result.protectedStreak) {
        toast({
          title: `Shield used! Your ${result.protectedStreak}-day streak is protected`,
          description: 'A streak shield absorbed the missed day.',
          className: 'bg-purple-50 border-purple-200',
          duration: 5000,
        })
      }
      // Update daily challenge progress + check achievements (fire and forget)
      updateChallengeProgress({ supabaseId: supabaseUserId }).catch(console.error)
      checkAndAwardAchievements({ supabaseId: supabaseUserId }).catch(console.error)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive', duration: 3000 })
    } finally {
      setCompletingTaskId(null)
    }
  }

  const handleConfirmUntickTask = async () => {
    if (!taskToUntick) return
    setUncompletingTaskId(taskToUntick.id)
    setTaskToUntick(null)
    try {
      const result = await uncompleteCustomTask({ taskId: taskToUntick.id as any, supabaseId: supabaseUserId })
      toast({
        title: `Task unticked — ${result.pointsRemoved} pts removed`,
        description: taskToUntick.title,
        className: 'bg-orange-50 border-orange-200',
        duration: 4000,
      })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive', duration: 3000 })
    } finally {
      setUncompletingTaskId(null)
    }
  }

  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    setDeletingTaskId(taskId)
    try {
      await deleteCustomTask({ taskId: taskId as any, supabaseId: supabaseUserId })
      toast({ title: `"${taskTitle}" deleted`, duration: 3000 })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive', duration: 3000 })
    } finally {
      setDeletingTaskId(null)
    }
  }

  const handleToggleUrgentTask = async (taskId: string) => {
    try {
      const result = await toggleUrgentCustomTask({ taskId: taskId as any, supabaseId: supabaseUserId })
      toast({
        description: result.isUrgent ? (
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
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive', duration: 3000 })
    }
  }

  // Handle manual sync
  const handleSync = async () => {
    setIsSyncing(true)
    localStorage.removeItem('lastSyncTime')

    try {
      const response = await fetch('/api/canvas/sync', {
        method: 'POST',
      })
      const data = await response.json()

      if (response.ok) {
        // Success - data will be automatically updated via Convex reactivity
        console.log(`Synced ${data.synced} assignments from ${data.courses} courses`)
      }
    } catch (error) {
      console.error('Sync error:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  // Handle drag end for section reordering
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setIsDraggingActive(false)
    if (!over || active.id === over.id) return
    const oldIndex = sectionOrder.indexOf(active.id as string)
    const newIndex = sectionOrder.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(sectionOrder, oldIndex, newIndex)
    setSectionOrder(newOrder)
    try {
      await updateDashboardSectionOrderMutation({
        supabaseId: supabaseUserId,
        sectionOrder: newOrder,
      })
    } catch {
      setSectionOrder(sectionOrder)
    }
  }

  // My Tasks section content (rendered inside SortableSection)
  const myTasksContent = (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">MY TASKS</h3>
        <button
          onClick={() => { setEditTask(null); setIsAddTaskOpen(true) }}
          className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
        >
          <Plus className="w-3 h-3" /> Add task
        </button>
      </div>

      {!customTasks || customTasks.length === 0 ? (
        <Card className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/8">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-[var(--text-muted)]">No custom tasks yet.</p>
            <button
              onClick={() => { setEditTask(null); setIsAddTaskOpen(true) }}
              className="mt-3 text-xs text-purple-400 hover:text-purple-300 underline underline-offset-2"
            >
              Add your first task →
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {(Object.keys(CATEGORY_CONFIG) as Category[]).map(cat => {
            const catTasks = customTasks.filter((t: any) => t.category === cat)
            if (catTasks.length === 0) return null
            const { label, icon: Icon, color, borderColor } = CATEGORY_CONFIG[cat]

            const pendingTasks = catTasks.filter((t: any) => t.status === 'pending')
            const completedTasks = catTasks.filter((t: any) => t.status === 'completed')

            return (
              <Card key={cat} className={`rounded-2xl bg-white/5 backdrop-blur-md border border-white/8 hover:border-purple-400/20 transition-all duration-300 border-l-4 ${borderColor}`}>
                <div className="px-6 pt-4 pb-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className={`text-xs font-bold uppercase tracking-widest ${color}`}>{label}</span>
                    {pendingTasks.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold uppercase tracking-wider border border-purple-500/30">
                        {pendingTasks.length} PENDING
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <AnimatePresence mode="popLayout">
                      {pendingTasks.map((task: any) => {
                        const isCompleting = completingTaskId === task._id

                        return (
                          <motion.div
                            key={task._id}
                            layout="position"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-500/5 transition-colors duration-200 group/task"
                          >
                            <button
                              onClick={() => handleCompleteTask(task._id, task.title)}
                              disabled={isCompleting}
                              className="flex-shrink-0 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50 opacity-0 group-hover/task:opacity-100"
                            >
                              {isCompleting ? (
                                <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                              ) : (
                                <Circle className="h-6 w-6" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-[var(--text-primary)] text-sm truncate">{task.title}</h3>
                              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
                                {task.dueAt && (
                                  <>
                                    <span>{new Date(task.dueAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                    <span>•</span>
                                  </>
                                )}
                                <span>{task.pointsValue} pts</span>
                              </div>
                            </div>

                            {/* Flame urgent button */}
                            <button
                              onClick={() => handleToggleUrgentTask(task._id)}
                              className={`p-1 rounded hover:bg-orange-50 transition-colors ${task.isUrgent ? '' : 'opacity-0 group-hover/task:opacity-100'}`}
                            >
                              <Flame className={`w-4 h-4 ${task.isUrgent ? 'text-orange-500 fill-orange-500' : 'text-gray-300'}`} />
                            </button>

                            {/* Edit button */}
                            <button
                              onClick={() => { setEditTask(task); setIsAddTaskOpen(true) }}
                              className="p-1 rounded hover:bg-purple-500/10 text-[var(--text-muted)] hover:text-purple-400 opacity-0 group-hover/task:opacity-100 transition-all"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete button */}
                            <button
                              onClick={() => handleDeleteTask(task._id, task.title)}
                              disabled={deletingTaskId === task._id}
                              className="p-1 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover/task:opacity-100 transition-all"
                            >
                              {deletingTaskId === task._id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Due date dot */}
                            {task.dueAt && (() => {
                              const hours = (new Date(task.dueAt).getTime() - new Date().getTime()) / (1000 * 60 * 60)
                              if (hours < 0) return <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                              if (hours < 24) return <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                              if (hours / 24 <= 3) return <div className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
                              return <div className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />
                            })()}
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>

                    {/* Divider */}
                    {pendingTasks.length > 0 && completedTasks.length > 0 && (
                      <div className="flex items-center gap-3 my-3">
                        <div className="flex-1 border-t border-[var(--glass-border)]" />
                        <span className="text-xs text-[var(--text-muted)]">Completed</span>
                        <div className="flex-1 border-t border-[var(--glass-border)]" />
                      </div>
                    )}

                    {/* Completed tasks */}
                    <AnimatePresence mode="popLayout">
                      {completedTasks.map((task: any) => {
                        const isUncompleting = uncompletingTaskId === task._id
                        return (
                          <motion.div
                            key={task._id}
                            layout="position"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl opacity-50 group/task"
                          >
                            <button
                              onClick={() => setTaskToUntick({ id: task._id, title: task.title })}
                              disabled={isUncompleting}
                              className="flex-shrink-0 text-green-600 hover:text-orange-600 transition-colors opacity-0 group-hover/task:opacity-100"
                            >
                              {isUncompleting ? (
                                <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
                              ) : (
                                <CheckCircle2 className="h-6 w-6" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-[var(--text-primary)] text-sm truncate line-through">{task.title}</h3>
                              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
                                {task.dueAt && (
                                  <>
                                    <span>{new Date(task.dueAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                    <span>•</span>
                                  </>
                                )}
                                <span>{task.pointsValue} pts</span>
                              </div>
                            </div>

                            {/* Delete completed task */}
                            <button
                              onClick={() => handleDeleteTask(task._id, task.title)}
                              disabled={deletingTaskId === task._id}
                              className="p-1 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover/task:opacity-100 transition-all"
                            >
                              {deletingTaskId === task._id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6">
      {/* Slim header strip */}
      <div className="flex items-center justify-between mb-6 py-4">
        <div>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-1">
            ACADEMIC WORKSPACE
          </p>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            Welcome back{getFirstName() && `, ${getFirstName()}`}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Streak chip */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
            <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              {pointsData.streakCount} DAY STREAK
            </span>
            {(userData?.streakShields ?? 0) > 0 && (
              <StreakShieldIndicator shields={userData?.streakShields ?? 0} />
            )}
          </div>

          {/* Points chip */}
          <div className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--glass-bg)] backdrop-blur-md border transition-all duration-300 ${
            isMultiplierActive ? 'border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.25)]' : 'border-[var(--glass-border)]'
          }`}>
            <Zap className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              {pointsData.totalPoints} PTS
            </span>
            {isMultiplierActive && (
              <span className="absolute -top-2 -right-2 px-1 py-0.5 rounded-full bg-purple-500 text-[9px] font-black text-white leading-none border border-purple-300/30 shadow-lg">
                2×
              </span>
            )}
          </div>

          {/* Add Task button */}
          <button
            onClick={() => { setEditTask(null); setIsAddTaskOpen(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/30 hover:border-purple-400/50 transition-all duration-200 text-purple-400"
            title="Add custom task"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">ADD TASK</span>
          </button>

          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="p-1.5 rounded-full bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] hover:border-purple-400/30 transition-all duration-200 disabled:opacity-50"
            title="Sync with Canvas"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[var(--text-primary)] ${isSyncing ? 'animate-spin' : ''}`} />
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-full bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] hover:border-purple-400/30 transition-all duration-200"
            title="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-[var(--text-primary)]" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-[var(--text-primary)]" />
            )}
          </button>
        </div>
      </div>

      {/* 2x XP Active Banner */}
      <AnimatePresence>
        {isMultiplierActive && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="mb-4 relative overflow-hidden rounded-2xl px-5 py-3 flex items-center gap-3 bg-gradient-to-r from-purple-600/20 via-purple-500/15 to-purple-600/20 border border-purple-500/30"
          >
            {/* Subtle animated shimmer */}
            <motion.div
              animate={{ x: ['0%', '100%', '0%'] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400/10 to-transparent pointer-events-none"
            />
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Zap className="w-4 h-4 text-purple-400 fill-purple-400/50 flex-shrink-0" />
            </motion.div>
            <div className="flex-1">
              <span className="text-sm font-bold text-purple-300">2× XP Active Today</span>
              <span className="text-xs text-purple-400/80 ml-2">— All points doubled!</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-400/40 text-[11px] font-black text-purple-300">
              2×
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content: DnD sortable sections */}
      {sectionOrder.length === 0 && courses.length === 0 && (!customTasks || customTasks.length === 0) ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground mb-4">
              No assignments found. Click &quot;Sync Canvas&quot; to fetch your latest assignments.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={() => setIsDraggingActive(true)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setIsDraggingActive(false)}
        >
          <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
            <div className="space-y-6">
              {sectionOrder.map((sectionId) => {
                if (sectionId === 'my_tasks') {
                  return (
                    <SortableSection key="my_tasks" id="my_tasks" isDraggingAny={isDraggingActive}>
                      {myTasksContent}
                    </SortableSection>
                  )
                }

                // Course section
                const canvasCourseId = sectionId.slice('course_'.length)
                const course = visibleCourses.find(c => c.canvasCourseId === canvasCourseId)
                if (!course) return null

                return (
                  <SortableSection key={sectionId} id={sectionId} isDraggingAny={isDraggingActive}>
                    <CourseSection
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
                      supabaseUserId={supabaseUserId}
                    />
                  </SortableSection>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AutoSync />

      {/* Add/Edit Task Modal */}
      <AddTaskModal
        open={isAddTaskOpen}
        onClose={() => { setIsAddTaskOpen(false); setEditTask(null) }}
        supabaseUserId={supabaseUserId}
        editTask={editTask ? {
          id: editTask._id,
          title: editTask.title,
          description: editTask.description,
          category: editTask.category,
          pointsValue: editTask.pointsValue,
          dueAt: editTask.dueAt,
        } : undefined}
      />

      {/* Untick confirmation dialog */}
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
