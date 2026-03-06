'use client'

import { useState, useEffect } from 'react'
import { X, Flame, AlertTriangle, Calendar, CalendarClock, CalendarRange, BookOpen, ListTodo } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface DashboardSettings {
  showUrgent: boolean
  showOverdue: boolean
  showToday: boolean
  showTomorrow: boolean
  showThisWeek: boolean
  groupByCourse: boolean
  separateCustomTasks: boolean
}

export const DEFAULT_SETTINGS: DashboardSettings = {
  showUrgent: true,
  showOverdue: true,
  showToday: true,
  showTomorrow: true,
  showThisWeek: true,
  groupByCourse: false,
  separateCustomTasks: false,
}

const STORAGE_KEY = 'dopamine_dashboard_settings'

export function useDashboardSettings() {
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) })
    } catch {}
  }, [])

  const saveSettings = (next: DashboardSettings) => {
    setSettings(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {}
  }

  return { settings, saveSettings }
}

interface Props {
  isOpen: boolean
  onClose: () => void
  settings: DashboardSettings
  onSave: (s: DashboardSettings) => void
}

export function DashboardSettingsModal({ isOpen, onClose, settings, onSave }: Props) {
  const [local, setLocal] = useState(settings)

  useEffect(() => {
    if (isOpen) setLocal(settings)
  }, [isOpen, settings])

  const toggle = (key: keyof DashboardSettings) =>
    setLocal((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--bg-secondary,#0F0A1E)] border border-white/10 rounded-2xl w-full max-w-sm p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[var(--text-primary,white)]">Dashboard Settings</h2>
              <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-[var(--text-muted,#9ca3af)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted,#9ca3af)] mb-3">
              Timeline Sections
            </p>
            <div className="space-y-1 mb-5">
              <SettingRow icon={<Flame className="w-4 h-4 text-orange-500" />}     label="Urgent"     description="Tasks marked as urgent"         enabled={local.showUrgent}    onToggle={() => toggle('showUrgent')} />
              <SettingRow icon={<AlertTriangle className="w-4 h-4 text-red-500" />} label="Overdue"    description="Past due and not completed"      enabled={local.showOverdue}   onToggle={() => toggle('showOverdue')} />
              <SettingRow icon={<Calendar className="w-4 h-4 text-yellow-500" />}   label="Today"      description="Due today"                       enabled={local.showToday}     onToggle={() => toggle('showToday')} />
              <SettingRow icon={<CalendarClock className="w-4 h-4 text-green-500" />} label="Tomorrow" description="Due tomorrow"                    enabled={local.showTomorrow}  onToggle={() => toggle('showTomorrow')} />
              <SettingRow icon={<CalendarRange className="w-4 h-4 text-blue-500" />}  label="This Week" description="Due within the next 7 days"    enabled={local.showThisWeek}  onToggle={() => toggle('showThisWeek')} />
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted,#9ca3af)] mb-3">
              Layout
            </p>
            <div className="space-y-1 mb-6">
              <SettingRow icon={<BookOpen className="w-4 h-4 text-purple-400" />}  label="Group by Course"      description="Show course badge on each task"            enabled={local.groupByCourse}       onToggle={() => toggle('groupByCourse')} />
              <SettingRow icon={<ListTodo className="w-4 h-4 text-pink-400" />}    label="Separate My Tasks"    description="Divider between Canvas and custom tasks"   enabled={local.separateCustomTasks} onToggle={() => toggle('separateCustomTasks')} />
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-[var(--text-primary,white)] rounded-xl text-sm font-medium transition-colors">
                Cancel
              </button>
              <button onClick={() => { onSave(local); onClose() }} className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-medium transition-colors">
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function SettingRow({
  icon, label, description, enabled, onToggle,
}: {
  icon: React.ReactNode
  label: string
  description: string
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <div
      onClick={onToggle}
      className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/[0.08] rounded-xl cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-3 flex-1 mr-4">
        <span className="shrink-0">{icon}</span>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary,white)]">{label}</p>
          <p className="text-xs text-[var(--text-muted,#9ca3af)] mt-0.5">{description}</p>
        </div>
      </div>
      <div className={cn('relative w-11 h-6 rounded-full transition-colors shrink-0', enabled ? 'bg-purple-600' : 'bg-white/10')}>
        <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all', enabled ? 'left-5' : 'left-0.5')} />
      </div>
    </div>
  )
}
