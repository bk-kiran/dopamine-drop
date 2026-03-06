'use client'

import { useState } from 'react'
import { X, Loader2, Check, AlertCircle, Link as LinkIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/components/ui/use-toast'

type SyncStep = 'connecting' | 'syncing' | 'complete'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function ConnectCanvasModal({ isOpen, onClose }: Props) {
  const { toast } = useToast()
  const [token, setToken] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [syncStep, setSyncStep] = useState<SyncStep | null>(null)
  const [syncSummary, setSyncSummary] = useState<string | null>(null)

  const handleConnect = async () => {
    if (!token.trim()) return

    setIsConnecting(true)
    setSyncStep('connecting')

    try {
      // Step 1: Connect Canvas account
      const connectRes = await fetch('/api/canvas/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      })

      if (!connectRes.ok) {
        const err = await connectRes.json()
        throw new Error(err.error || 'Failed to connect Canvas')
      }

      // Step 2: Sync data
      setSyncStep('syncing')

      const syncRes = await fetch('/api/canvas/sync', { method: 'POST' })
      const syncData = await syncRes.json()

      if (!syncRes.ok) throw new Error(syncData.error || 'Sync failed')

      // Step 3: Complete
      setSyncStep('complete')
      const courses = syncData.courses ?? 0
      const assignments = syncData.assignments ?? syncData.assignmentsCreated ?? 0
      setSyncSummary(`Synced ${courses} courses and ${assignments} assignments`)

      // Close after a short delay — Convex reactive queries update automatically
      await new Promise((r) => setTimeout(r, 2000))
      handleClose()
      toast({ description: 'Canvas connected and synced!', duration: 3000 })
    } catch (err: any) {
      toast({ description: err.message || 'Failed to connect Canvas', variant: 'destructive', duration: 4000 })
      setIsConnecting(false)
      setSyncStep(null)
    }
  }

  const handleClose = () => {
    if (isConnecting && syncStep !== 'complete') return // Prevent closing during sync
    setToken('')
    setIsConnecting(false)
    setSyncStep(null)
    setSyncSummary(null)
    onClose()
  }

  const steps: { key: SyncStep; label: string }[] = [
    { key: 'connecting', label: 'Connecting to Canvas' },
    { key: 'syncing', label: 'Syncing courses & assignments' },
    { key: 'complete', label: 'All done!' },
  ]

  const stepIndex = syncStep ? steps.findIndex((s) => s.key === syncStep) : -1

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={syncStep === null ? handleClose : undefined}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--bg-secondary,#0F0A1E)] border border-white/10 rounded-2xl w-full max-w-md"
          >
            {syncStep ? (
              /* ── Progress view ── */
              <div className="p-8 text-center">
                <div className="w-14 h-14 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                  {syncStep === 'complete'
                    ? <Check className="w-7 h-7 text-green-400" />
                    : <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />}
                </div>

                <h2 className="text-xl font-bold text-white mb-6">
                  {syncStep === 'complete' ? 'Canvas Connected!' : 'Connecting Canvas…'}
                </h2>

                <div className="space-y-3 text-left mb-6">
                  {steps.map((step, i) => {
                    const isDone = i < stepIndex
                    const isActive = i === stepIndex
                    return (
                      <div key={step.key} className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isDone ? 'bg-green-500' : isActive ? 'bg-purple-500' : 'bg-white/10'
                        }`}>
                          {isDone
                            ? <Check className="w-3.5 h-3.5 text-white" />
                            : isActive
                            ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                            : null}
                        </div>
                        <span className={`text-sm ${isActive ? 'text-white font-medium' : isDone ? 'text-green-400' : 'text-white/30'}`}>
                          {step.label}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {syncSummary && (
                  <p className="text-sm text-green-400">{syncSummary}</p>
                )}
              </div>
            ) : (
              /* ── Form view ── */
              <>
                <div className="flex items-center justify-between p-5 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-5 h-5 text-purple-400" />
                    <h2 className="text-lg font-bold text-white">Connect Canvas</h2>
                  </div>
                  <button onClick={handleClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-5 h-5 text-[var(--text-muted,#9ca3af)]" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted,#9ca3af)] mb-1.5">
                      Canvas API Token
                    </label>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                      placeholder="1234~abcdefghijklmnop"
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 text-sm"
                    />
                    <p className="text-xs text-[var(--text-muted,#9ca3af)] mt-2">
                      Canvas → Account → Settings → New Access Token
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-300">
                      Your token is encrypted before storage. We'll auto-sync your courses and assignments.
                    </p>
                  </div>

                  <button
                    onClick={handleConnect}
                    disabled={!token.trim()}
                    className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <LinkIcon className="w-4 h-4" />
                    Connect & Sync Canvas
                  </button>

                  <button
                    onClick={handleClose}
                    className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-[var(--text-muted,#9ca3af)] hover:text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    Maybe Later
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
