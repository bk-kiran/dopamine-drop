'use client'

import { useState } from 'react'
import { Lock, Check } from 'lucide-react'
import { ConnectCanvasModal } from './connect-canvas-modal'

interface Props {
  title: string
  description: string
  unlocks?: string[]
}

const DEFAULT_UNLOCKS = [
  'Course grades & analytics',
  'Assignment tracking',
  'Automatic syncing',
]

export function LockedPage({ title, description, unlocks = DEFAULT_UNLOCKS }: Props) {
  const [showConnect, setShowConnect] = useState(false)

  return (
    <>
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-purple-500/20">
            <Lock className="w-9 h-9 text-purple-400" />
          </div>

          <h2 className="text-2xl font-bold text-[var(--text-primary,white)] mb-2">{title}</h2>
          <p className="text-sm text-[var(--text-muted,#9ca3af)] mb-6">{description}</p>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 text-left">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted,#9ca3af)] mb-3">
              Unlock with Canvas
            </p>
            <div className="space-y-2.5">
              {unlocks.map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-sm text-[var(--text-primary,white)]">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowConnect(true)}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white rounded-xl font-semibold transition-all hover:scale-[1.02] shadow-lg shadow-purple-500/25"
          >
            Connect Canvas
          </button>
        </div>
      </div>

      <ConnectCanvasModal isOpen={showConnect} onClose={() => setShowConnect(false)} />
    </>
  )
}
