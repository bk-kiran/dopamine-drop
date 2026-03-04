'use client'

import { SignUp } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { Users, FileText, Star } from 'lucide-react'

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

export default function SignupPage() {
  return (
    <div
      className="min-h-screen relative overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0a0118 0%, #1a1030 50%, #0a0118 100%)' }}
    >
      <PageBackground />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-8 py-5 shrink-0">
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
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex min-h-0">
        {/* ── LEFT COLUMN (desktop only) ──────────────────────────────────── */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 xl:px-24 py-8">
          <div className="mb-6">
            <h1 className="text-6xl font-black leading-none text-white mb-1">Start your</h1>
            <h1
              className="text-6xl font-black leading-none bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(to right, #a855f7, #7c3aed)' }}
            >
              journey
            </h1>
          </div>

          <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-sm">
            Join thousands of students gamifying their productivity and reclaiming their focus with
            our science-backed rewards system.
          </p>

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

          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[
                { bg: '#7c3aed', initials: 'AJ' },
                { bg: '#0891b2', initials: 'MK' },
                { bg: '#d97706', initials: 'SR' },
              ].map(({ bg, initials }) => (
                <div
                  key={initials}
                  className="w-8 h-8 rounded-full border-2 border-[#1a1030] flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: bg }}
                >
                  {initials}
                </div>
              ))}
            </div>
            <span className="text-white/40 text-sm">Recently joined the drop</span>
          </div>
        </div>

        {/* ── RIGHT COLUMN (Clerk SignUp) ──────────────────────────────── */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-8">
          <SignUp
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

      <div className="relative z-10 flex items-center justify-between px-8 py-5 border-t border-white/5 shrink-0">
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
