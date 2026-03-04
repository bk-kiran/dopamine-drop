'use client'

import { SignIn } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { Flame, Trophy, Zap } from 'lucide-react'

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

export default function LoginPage() {
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

          <div className="mb-6">
            <h1 className="text-6xl font-black leading-none text-white mb-1">Welcome</h1>
            <h1
              className="text-6xl font-black leading-none bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(to right, #a855f7, #7c3aed)' }}
            >
              back.
            </h1>
          </div>

          <p className="text-gray-400 text-lg leading-relaxed mb-12 max-w-sm">
            Continue your academic journey. Your streak is waiting for you to conquer the day.
          </p>

          <div className="space-y-4">
            {[
              { icon: Flame, iconBg: 'rgba(249,115,22,0.2)', iconColor: '#f97316', label: 'CURRENT STREAK', value: '12 Days' },
              { icon: Trophy, iconBg: 'rgba(234,179,8,0.2)', iconColor: '#eab308', label: 'GLOBAL RANK', value: 'Top 2%' },
              { icon: Zap, iconBg: 'rgba(59,130,246,0.2)', iconColor: '#3b82f6', label: 'XP LEVEL', value: 'Level 42' },
            ].map(({ icon: Icon, iconBg, iconColor, label, value }) => (
              <div
                key={label}
                className="flex items-center gap-4 rounded-2xl px-5 py-4 border border-white/10"
                style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(8px)' }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: iconBg }}>
                  <Icon className="w-5 h-5" style={{ color: iconColor }} />
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-widest text-white/40 uppercase mb-0.5">{label}</p>
                  <p className="text-white font-bold text-lg leading-none">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT COLUMN (Clerk SignIn) ──────────────────────────────── */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
          <SignIn
            appearance={{
              baseTheme: dark,
              variables: {
                colorPrimary: '#a855f7',
                colorBackground: 'rgba(26,19,48,0.85)',
                colorInputBackground: 'rgba(255,255,255,0.05)',
                colorInputText: '#ffffff',
                colorText: '#ffffff',
                colorTextSecondary: 'rgba(255,255,255,0.4)',
                borderRadius: '16px',
              },
              elements: {
                card: {
                  border: '1px solid rgba(168,85,247,0.2)',
                  boxShadow: '0 0 40px rgba(168,85,247,0.15)',
                  backdropFilter: 'blur(24px)',
                },
                headerTitle: { color: '#ffffff', fontSize: '1.875rem', fontWeight: '700' },
                headerSubtitle: { color: 'rgba(255,255,255,0.4)' },
                socialButtonsBlockButton: {
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.7)',
                },
                formButtonPrimary: {
                  background: 'linear-gradient(to right, #7c3aed, #a855f7)',
                },
                footerActionLink: { color: '#a855f7' },
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}
