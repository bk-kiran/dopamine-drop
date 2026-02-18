'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ExternalLink,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Lock,
  Zap,
  Check,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'

// ─── Canvas instructions list ──────────────────────────────────────────────────

const instructions = [
  {
    text: "Click 'Approved Integrations' in the left sidebar",
    detail: 'Look for the Settings icon or User Settings section',
  },
  {
    text: "Scroll to the bottom and click '+ New Access Token'",
    detail: 'Under the Approved Integrations heading',
  },
  {
    text: "Purpose: Enter 'dopamine drop'",
    detail: 'Any name works — this is just a label for you',
  },
  {
    text: 'Expires: Leave blank (never expires)',
    detail: 'Or set a date if you prefer an expiry',
  },
  {
    text: "Click 'Generate Token'",
    detail: 'A long token string will appear',
  },
  {
    text: 'Copy the full token — store it safely!',
    detail: "Canvas won't show it again after you close the dialog",
  },
]

// ─── Step content wrapper ──────────────────────────────────────────────────────

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 32 : -32 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -32 : 32 }),
}

// ─── Setup Page ────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Auto-redirect after success
  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => {
      router.push('/dashboard')
      router.refresh()
    }, 2200)
    return () => clearTimeout(timer)
  }, [success, router])

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1)
    setStep(next)
    setError(null)
  }

  const handleConnect = async () => {
    if (!token.trim()) return
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/canvas/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Invalid token. Please check you copied the full token and try again.')
        setLoading(false)
        return
      }

      setSuccess(true)
    } catch {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  const tokenLength = token.trim().length
  const tokenValid = tokenLength > 50
  const tokenWarning = tokenLength > 0 && tokenLength <= 50

  // ── Success state ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'linear-gradient(135deg, #0a0118 0%, #1a1030 50%, #0a0118 100%)' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              boxShadow: '0 0 60px rgba(168,85,247,0.5)',
            }}
          >
            <Check className="w-12 h-12 text-white" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-3xl font-bold text-white mb-3"
          >
            Canvas connected!
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="text-white/50 text-lg"
          >
            Syncing your assignments…
          </motion.p>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.7, duration: 1.5, ease: 'easeInOut' }}
            className="h-1 rounded-full mt-8 mx-auto w-48 origin-left"
            style={{ background: 'linear-gradient(to right, #7c3aed, #a855f7)' }}
          />
        </motion.div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a0118 0%, #1a1030 50%, #0a0118 100%)' }}
    >
      {/* Ambient orbs */}
      <div
        className="fixed top-0 right-0 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
        style={{ background: 'rgba(168,85,247,0.15)', transform: 'translate(20%, -20%)' }}
      />
      <div
        className="fixed bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-3xl pointer-events-none"
        style={{ background: 'rgba(124,58,237,0.10)', transform: 'translate(-20%, 20%)' }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-2xl">
        <div
          className="rounded-3xl border border-purple-500/20 overflow-hidden"
          style={{
            background: 'rgba(26,19,48,0.88)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 0 50px rgba(168,85,247,0.12)',
          }}
        >
          {/* Card header */}
          <div className="px-8 pt-8 pb-6 border-b border-white/5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h1 className="text-2xl font-bold text-white">Connect Your Canvas Account</h1>
                <p className="text-white/40 text-sm mt-1">
                  We'll guide you through getting your access token. It takes about 30 seconds.
                </p>
              </div>
              {/* Step badge */}
              <div
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold text-purple-300 border border-purple-500/30"
                style={{ background: 'rgba(168,85,247,0.15)' }}
              >
                {step} of 3 steps
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mt-4">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(to right, #7c3aed, #a855f7)' }}
                animate={{ width: `${(step / 3) * 100}%` }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
              />
            </div>
          </div>

          {/* Step content */}
          <div className="px-8 py-8 min-h-[340px] relative overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              {/* ── STEP 1: Introduction ─────────────────────────────────── */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  custom={direction}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(168,85,247,0.2)' }}
                    >
                      <Zap className="w-5 h-5 text-purple-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Why do I need this?</h2>
                  </div>

                  <div className="space-y-4 mb-8">
                    <p className="text-white/60 leading-relaxed">
                      dopamine drop needs a personal access token to sync your Canvas assignments.
                      This token is like a password that only works for your Canvas data — it's
                      encrypted and stored securely. You stay in full control.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                      {[
                        { icon: Lock, label: 'AES-256 encrypted', color: '#a855f7' },
                        { icon: CheckCircle, label: 'Never shared with third parties', color: '#22c55e' },
                        { icon: Zap, label: 'Syncs every time you visit', color: '#f59e0b' },
                      ].map(({ icon: Icon, label, color }) => (
                        <div
                          key={label}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 border border-white/10"
                          style={{ background: 'rgba(255,255,255,0.03)' }}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                          <span className="text-white/60 text-xs leading-snug">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => goTo(2)}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 hover:scale-105"
                    style={{
                      background: 'linear-gradient(to right, #7c3aed, #a855f7)',
                      boxShadow: '0 0 24px rgba(168,85,247,0.3)',
                    }}
                  >
                    Get Started
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {/* ── STEP 2: Get your token ────────────────────────────────── */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  custom={direction}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(168,85,247,0.2)' }}
                    >
                      <ExternalLink className="w-5 h-5 text-purple-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Generate Your Access Token</h2>
                  </div>

                  <p className="text-white/50 text-sm mb-5">
                    Click the button below to open your Canvas profile settings in a new tab, then
                    follow the steps.
                  </p>

                  <a
                    href="https://umass.instructure.com/profile/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white text-sm mb-7 transition-all duration-200 hover:scale-105"
                    style={{
                      background: 'linear-gradient(to right, #7c3aed, #a855f7)',
                      boxShadow: '0 0 20px rgba(168,85,247,0.25)',
                    }}
                  >
                    Open Canvas Settings
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {/* Instruction checklist */}
                  <div className="space-y-2.5">
                    {instructions.map(({ text, detail }, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-xl px-4 py-3 border border-white/10"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-purple-300"
                          style={{ background: 'rgba(168,85,247,0.2)' }}
                        >
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white/80 text-sm font-medium">{text}</p>
                          <p className="text-white/35 text-xs mt-0.5">{detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── STEP 3: Paste token ───────────────────────────────────── */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  custom={direction}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(168,85,247,0.2)' }}
                    >
                      <Lock className="w-5 h-5 text-purple-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Paste Your Access Token</h2>
                  </div>

                  <p className="text-white/50 text-sm mb-5">
                    Paste the token you copied from Canvas below. Don't worry — it's encrypted
                    before being saved.
                  </p>

                  {/* Token textarea */}
                  <div className="mb-2">
                    <label
                      htmlFor="canvas-token"
                      className="block text-xs font-semibold tracking-wider text-white/50 uppercase mb-2"
                    >
                      Canvas Access Token
                    </label>
                    <textarea
                      id="canvas-token"
                      aria-describedby="token-hint token-count"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Paste your token here (it looks like: 1770~abcdefghijklmnopqrstuvwxyz...)"
                      rows={3}
                      disabled={loading}
                      className="w-full px-4 py-3 rounded-xl font-mono text-sm text-white placeholder-gray-600 outline-none resize-none transition-all duration-200 border border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    />
                  </div>

                  {/* Character count */}
                  <div
                    id="token-count"
                    className="flex items-center gap-2 mb-1 min-h-[20px]"
                  >
                    {tokenLength === 0 ? (
                      <span className="text-xs text-white/25">Token length: 0 characters</span>
                    ) : tokenValid ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                        <span className="text-xs text-green-400">
                          Token length: {tokenLength} characters — looks good!
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                        <span className="text-xs text-yellow-400">
                          Token length: {tokenLength} characters — valid tokens are usually 60–80+ characters
                        </span>
                      </>
                    )}
                  </div>

                  <p id="token-hint" className="text-xs text-white/25 mb-5">
                    Your token will be encrypted with AES-256 before being stored.
                  </p>

                  {/* Error */}
                  {error && (
                    <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Card footer */}
          <div className="px-8 pb-8 flex items-center justify-between gap-4">
            {/* Back / Skip */}
            <div className="flex items-center gap-4">
              {step > 1 ? (
                <button
                  onClick={() => goTo(step - 1)}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white/50 text-sm font-medium border border-white/10 hover:border-white/20 hover:text-white/80 transition-all duration-200 disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              ) : (
                <Link
                  href="/dashboard"
                  className="text-sm text-white/30 hover:text-white/60 transition-colors"
                >
                  I'll do this later
                </Link>
              )}
            </div>

            {/* Next / Connect */}
            {step === 1 && (
              <button
                onClick={() => goTo(2)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white text-sm transition-all duration-200 hover:scale-105"
                style={{ background: 'linear-gradient(to right, #7c3aed, #a855f7)' }}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 2 && (
              <button
                onClick={() => goTo(3)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white text-sm transition-all duration-200 hover:scale-105"
                style={{ background: 'linear-gradient(to right, #7c3aed, #a855f7)' }}
              >
                Next: Paste Your Token
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 3 && (
              <motion.button
                onClick={handleConnect}
                disabled={loading || !token.trim()}
                animate={
                  tokenValid && !loading
                    ? {
                        boxShadow: [
                          '0 0 16px rgba(168,85,247,0.3)',
                          '0 0 32px rgba(168,85,247,0.6)',
                          '0 0 16px rgba(168,85,247,0.3)',
                        ],
                      }
                    : { boxShadow: '0 0 0px rgba(168,85,247,0)' }
                }
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white text-sm transition-all duration-200 hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{ background: 'linear-gradient(to right, #7c3aed, #a855f7)' }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connecting…
                  </>
                ) : (
                  <>
                    Connect Canvas
                    <CheckCircle className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            )}
          </div>
        </div>

        {/* Below-card skip link (step 1 only) */}
        {step === 1 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center text-xs text-white/20 mt-4"
          >
            You can always connect Canvas later from your profile settings.
          </motion.p>
        )}
      </div>
    </div>
  )
}
