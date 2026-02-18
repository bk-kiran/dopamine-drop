'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Flame, Trophy, Zap, Github } from 'lucide-react'

// ─── Shared background component ───────────────────────────────────────────────

function PageBackground() {
  return (
    <>
      <div
        className="fixed top-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl pointer-events-none"
        style={{ background: 'rgba(168,85,247,0.18)', transform: 'translate(20%, -20%)' }}
      />
      <div
        className="fixed bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
        style={{ background: 'rgba(124,58,237,0.12)', transform: 'translate(-20%, 20%)' }}
      />
    </>
  )
}

// ─── Google icon ───────────────────────────────────────────────────────────────

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

// ─── Login Page ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a0118 0%, #1a1030 50%, #0a0118 100%)' }}
    >
      <PageBackground />

      <div className="relative z-10 min-h-screen flex">
        {/* ── LEFT COLUMN (desktop only) ──────────────────────────────────── */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 xl:px-24 py-12">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-16">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #9333ea, #7c3aed)' }}
            >
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M12 2C12 2 5 10.5 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 10.5 12 2 12 2Z" />
              </svg>
            </div>
            <span
              className="text-xl font-black lowercase bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(to right, #e9d5ff, #c084fc)' }}
            >
              dopamine drop
            </span>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-6xl font-black leading-none text-white mb-1">Welcome</h1>
            <h1
              className="text-6xl font-black leading-none bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(to right, #a855f7, #7c3aed)' }}
            >
              back.
            </h1>
          </div>

          {/* Subheading */}
          <p className="text-gray-400 text-lg leading-relaxed mb-12 max-w-sm">
            Continue your academic journey. Your streak is waiting for you to conquer the day.
          </p>

          {/* Stat cards */}
          <div className="space-y-4">
            {[
              {
                icon: Flame,
                iconBg: 'rgba(249,115,22,0.2)',
                iconColor: '#f97316',
                label: 'CURRENT STREAK',
                value: '12 Days',
              },
              {
                icon: Trophy,
                iconBg: 'rgba(234,179,8,0.2)',
                iconColor: '#eab308',
                label: 'GLOBAL RANK',
                value: 'Top 2%',
              },
              {
                icon: Zap,
                iconBg: 'rgba(59,130,246,0.2)',
                iconColor: '#3b82f6',
                label: 'XP LEVEL',
                value: 'Level 42',
              },
            ].map(({ icon: Icon, iconBg, iconColor, label, value }) => (
              <div
                key={label}
                className="flex items-center gap-4 rounded-2xl px-5 py-4 border border-white/10"
                style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(8px)' }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: iconBg }}
                >
                  <Icon className="w-5 h-5" style={{ color: iconColor }} />
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-widest text-white/40 uppercase mb-0.5">
                    {label}
                  </p>
                  <p className="text-white font-bold text-lg leading-none">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT COLUMN (form) ─────────────────────────────────────────── */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            {/* Form card */}
            <div
              className="rounded-3xl p-8 border border-purple-500/20"
              style={{
                background: 'rgba(26,19,48,0.85)',
                backdropFilter: 'blur(24px)',
                boxShadow: '0 0 40px rgba(168,85,247,0.15)',
              }}
            >
              {/* Title */}
              <h2 className="text-3xl font-bold text-white mb-1">Sign In</h2>
              <p className="text-sm text-white/40 mb-7">
                Enter your credentials to access your dashboard
              </p>

              <form onSubmit={handleLogin} className="space-y-5">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-white mb-1.5" htmlFor="email">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all duration-200 border border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-white" htmlFor="password">
                      Password
                    </label>
                    <button
                      type="button"
                      className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full px-4 py-3 pr-11 rounded-xl text-white placeholder-gray-500 outline-none transition-all duration-200 border border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(to right, #7c3aed, #a855f7)',
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(168,85,247,0.4)'
                      e.currentTarget.style.background = 'linear-gradient(to right, #6d28d9, #9333ea)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.background = 'linear-gradient(to right, #7c3aed, #a855f7)'
                  }}
                >
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center">
                  <span
                    className="px-3 text-xs font-medium tracking-wider text-white/25 uppercase"
                    style={{ background: 'rgba(26,19,48,0.85)' }}
                  >
                    Or continue with
                  </span>
                </div>
              </div>

              {/* Social buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="flex items-center justify-center gap-2.5 py-3 rounded-xl border border-white/10 text-white/70 text-sm font-medium hover:bg-white/10 transition-colors duration-200"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <GoogleIcon className="w-4 h-4" />
                  Google
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center gap-2.5 py-3 rounded-xl border border-white/10 text-white/70 text-sm font-medium hover:bg-white/10 transition-colors duration-200"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <Github className="w-4 h-4" />
                  GitHub
                </button>
              </div>

              {/* Footer link */}
              <p className="text-center text-sm text-white/30 mt-6">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="text-purple-400 hover:text-purple-300 transition-colors font-medium">
                  Create one now
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
