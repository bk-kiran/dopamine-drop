'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Users, FileText, Star, Github } from 'lucide-react'

// ─── Shared background orbs ────────────────────────────────────────────────────

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

// ─── Signup Page ───────────────────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      router.push('/dashboard/setup')
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  const inputClass =
    'w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all duration-200 border border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50 text-sm'
  const inputStyle = { background: 'rgba(255,255,255,0.05)' }

  return (
    <div
      className="min-h-screen relative overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0a0118 0%, #1a1030 50%, #0a0118 100%)' }}
    >
      <PageBackground />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-8 py-5 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #9333ea, #7c3aed)' }}
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
              <path d="M12 2C12 2 5 10.5 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 10.5 12 2 12 2Z" />
            </svg>
          </div>
          <span
            className="text-base font-black lowercase bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(to right, #e9d5ff, #c084fc)' }}
          >
            dopamine drop
          </span>
        </div>
        {/* Sign in link */}
        <p className="text-sm text-white/40">
          Already have an account?{' '}
          <Link href="/login" className="text-purple-400 hover:text-purple-300 transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex min-h-0">
        {/* ── LEFT COLUMN (desktop only) ──────────────────────────────────── */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 xl:px-24 py-8">
          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-6xl font-black leading-none text-white mb-1">Start your</h1>
            <h1
              className="text-6xl font-black leading-none bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(to right, #a855f7, #7c3aed)' }}
            >
              journey
            </h1>
          </div>

          {/* Subheading */}
          <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-sm">
            Join thousands of students gamifying their productivity and reclaiming their focus with
            our science-backed rewards system.
          </p>

          {/* Stat badges */}
          <div className="flex gap-3 mb-10">
            {[
              { icon: Users, label: 'STUDENTS', value: '500+' },
              { icon: FileText, label: 'ASSIGNMENTS', value: '10K+' },
              { icon: Star, label: 'POINTS', value: '50K+' },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="flex-1 rounded-2xl p-4 border border-white/10 text-center"
                style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(8px)' }}
              >
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-2">
                  <Icon className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-white font-black text-xl leading-none mb-1">{value}</p>
                <p className="text-white/30 text-xs tracking-widest font-medium">{label}</p>
              </div>
            ))}
          </div>

          {/* Recently joined */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[
                { bg: '#7c3aed', initials: 'AJ' },
                { bg: '#0891b2', initials: 'MK' },
                { bg: '#d97706', initials: 'SR' },
              ].map(({ bg, initials }) => (
                <div
                  key={initials}
                  className="w-8 h-8 rounded-full border-2 border-[#1a1030] flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: bg }}
                >
                  {initials}
                </div>
              ))}
            </div>
            <span className="text-white/40 text-sm">Recently joined the drop</span>
          </div>
        </div>

        {/* ── RIGHT COLUMN (form) ─────────────────────────────────────────── */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-md">
            <div
              className="rounded-3xl p-8 border border-purple-500/20"
              style={{
                background: 'rgba(26,19,48,0.85)',
                backdropFilter: 'blur(24px)',
                boxShadow: '0 0 40px rgba(168,85,247,0.15)',
              }}
            >
              {/* Title */}
              <h2 className="text-3xl font-bold text-white mb-1">Create your account</h2>
              <p className="text-sm text-white/40 mb-7">Level up your academic performance today.</p>

              <form onSubmit={handleSignup} className="space-y-4">
                {/* Name + Email row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold tracking-wider text-white/60 uppercase mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={loading}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold tracking-wider text-white/60 uppercase mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="john@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold tracking-wider text-white/60 uppercase mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      minLength={6}
                      className={`${inputClass} pr-11`}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold tracking-wider text-white/60 uppercase mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      className={`${inputClass} pr-11`}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Terms checkbox */}
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setAgreedToTerms(!agreedToTerms)}
                    className="mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border transition-all duration-200"
                    style={{
                      background: agreedToTerms
                        ? 'linear-gradient(to right, #7c3aed, #a855f7)'
                        : 'rgba(255,255,255,0.05)',
                      borderColor: agreedToTerms ? '#a855f7' : 'rgba(255,255,255,0.15)',
                    }}
                  >
                    {agreedToTerms && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className="text-sm text-white/40 leading-snug">
                    I agree to the{' '}
                    <span className="text-purple-400 hover:text-purple-300 cursor-pointer transition-colors">
                      Terms and Conditions
                    </span>
                  </span>
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
                  style={{ background: 'linear-gradient(to right, #7c3aed, #a855f7)' }}
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
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-5">
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

              {/* Social icon buttons */}
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors duration-200"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                  title="Continue with Google"
                >
                  <GoogleIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors duration-200"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                  title="Continue with GitHub"
                >
                  <Github className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors duration-200"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                  title="Continue with Apple"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.54 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex items-center justify-between px-8 py-5 border-t border-white/5 flex-shrink-0">
        <p className="text-white/20 text-xs tracking-wider uppercase">
          © 2024 dopamine drop. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          {['Privacy', 'Terms', 'Contact'].map((item) => (
            <span
              key={item}
              className="text-white/25 text-xs tracking-wider uppercase hover:text-purple-400 cursor-pointer transition-colors"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
