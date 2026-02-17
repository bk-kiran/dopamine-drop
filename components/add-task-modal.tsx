'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { BookOpen, Users, Briefcase, Heart, Calendar } from 'lucide-react'

type Category = 'academic' | 'club' | 'work' | 'personal'

interface TaskData {
  title: string
  description?: string
  category: Category
  pointsValue: number
  dueAt?: string
}

interface AddTaskModalProps {
  open: boolean
  onClose: () => void
  supabaseUserId: string
  editTask?: {
    id: Id<'customTasks'>
    title: string
    description?: string
    category: Category
    pointsValue: number
    dueAt?: string
  }
}

const CATEGORIES: { value: Category; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'academic', label: 'Academic', icon: BookOpen, color: 'text-purple-400' },
  { value: 'club', label: 'Club', icon: Users, color: 'text-blue-400' },
  { value: 'work', label: 'Work', icon: Briefcase, color: 'text-green-400' },
  { value: 'personal', label: 'Personal', icon: Heart, color: 'text-pink-400' },
]

export function AddTaskModal({ open, onClose, supabaseUserId, editTask }: AddTaskModalProps) {
  const { toast } = useToast()
  const isEditing = !!editTask

  const [title, setTitle] = useState(editTask?.title || '')
  const [description, setDescription] = useState(editTask?.description || '')
  const [category, setCategory] = useState<Category>(editTask?.category || 'academic')
  const [pointsValue, setPointsValue] = useState(editTask?.pointsValue?.toString() || '10')
  const [dueAt, setDueAt] = useState(
    editTask?.dueAt ? new Date(editTask.dueAt).toISOString().slice(0, 16) : ''
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createCustomTask = useMutation(api.customTasks.createCustomTask)
  const updateCustomTask = useMutation(api.customTasks.updateCustomTask)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    const pts = Math.min(100, Math.max(1, parseInt(pointsValue) || 10))

    setIsSubmitting(true)
    try {
      if (isEditing && editTask) {
        await updateCustomTask({
          taskId: editTask.id,
          supabaseId: supabaseUserId,
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          pointsValue: pts,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        })
        toast({
          title: 'Task updated',
          duration: 3000,
        })
      } else {
        await createCustomTask({
          supabaseId: supabaseUserId,
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          pointsValue: pts,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        })
        toast({
          title: `Task added — ${pts} pts available`,
          duration: 3000,
        })
      }
      handleClose()
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to save task',
        variant: 'destructive',
        duration: 3000,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setTitle('')
    setDescription('')
    setCategory('academic')
    setPointsValue('10')
    setDueAt('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)]">
            {isEditing ? 'Edit Task' : 'Add Task'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you need to do?"
              required
              autoFocus
              className="bg-white/5 border-white/10"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details..."
              rows={2}
              className="bg-white/5 border-white/10 resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">
              Category
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 ${
                    category === value
                      ? 'bg-purple-500/20 border-purple-500/50'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${category === value ? 'text-purple-400' : color}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${
                    category === value ? 'text-purple-400' : 'text-[var(--text-muted)]'
                  }`}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Points Value */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">
              Points Value
            </label>
            <Input
              type="number"
              min={1}
              max={100}
              value={pointsValue}
              onChange={(e) => setPointsValue(e.target.value)}
              className="bg-white/5 border-white/10"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              How many points is this worth? (1–100)
            </p>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">
              Due Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <Input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="bg-white/5 border-white/10 pl-9"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="flex-1 bg-purple-500 hover:bg-purple-600 text-white"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : isEditing ? 'Update Task' : 'Add Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
