'use client'

import { motion, useMotionValue, useTransform, useSpring, useInView } from 'framer-motion'
import CountUp from 'react-countup'
import {
  Trophy,
  Flame,
  Target,
  Award,
  Users,
  BarChart3,
  Github,
  Twitter,
  Crown,
  FileText,
  Star,
  Zap,
} from 'lucide-react'
import { useRef } from 'react'
import Link from 'next/link'

// ─── Feature data ──────────────────────────────────────────────────────────────

const features = [
  {
    icon: Trophy,
    title: 'Points & Levels',
    description:
      'Earn XP for every assignment submitted on time. Watch your level grow as you master your curriculum.',
  },
  {
    icon: Flame,
    title: 'Streak Tracking',
    description:
      "Maintain your momentum with daily study streaks. Don't let the fire go out!",
  },
  {
    icon: Target,
    title: 'Daily Challenges',
    description:
      'Complete special tasks to boost your weekly score. New objectives refreshed every 24 hours.',
  },
  {
    icon: Award,
    title: 'Achievement Badges',
    description:
      'Collect unique digital rewards for your milestones. Display them on your profile with pride.',
  },
  {
    icon: Users,
    title: 'Private Leaderboards',
    description:
      'Compete with friends in secure, private study groups. See who truly reigns supreme.',
  },
  {
    icon: BarChart3,
    title: 'Grade Analytics',
    description:
      'Visualize your progress with deep data insights. Prediction engines for final grade success.',
  },
]

// ─── 3D Mockup Card ─────────────────────────────────────────────────────────────

function MockupCard() {
  const cardRef = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const rotateX = useTransform(mouseY, [-200, 200], [8, -8])
  const rotateY = useTransform(mouseX, [-200, 200], [-8, 8])
  const springRotateX = useSpring(rotateX, { stiffness: 120, damping: 20 })
  const springRotateY = useSpring(rotateY, { stiffness: 120, damping: 20 })

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    mouseX.set(e.clientX - (rect.left + rect.width / 2))
    mouseY.set(e.clientY - (rect.top + rect.height / 2))
  }

  return (
    <motion.div
      ref={cardRef}
      style={{ rotateX: springRotateX, rotateY: springRotateY, transformPerspective: 1200 }}
      onMouseMove={onMouseMove}
      onMouseLeave={() => {
        mouseX.set(0)
        mouseY.set(0)
      }}
      className="hidden md:block max-w-md mx-auto mt-16 cursor-default"
    >
      <div
        className="rounded-2xl p-6 border border-white/10 backdrop-blur-md"
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            KN
          </div>
          <div>
            <p className="text-white font-bold text-sm">Level 24 Academic Warrior</p>
            <p className="text-white/40 text-xs">Rank #142 Globally</p>
          </div>
          <div className="ml-auto flex items-center gap-1 bg-orange-500/20 border border-orange-500/30 rounded-full px-2.5 py-1">
            <Flame className="w-3 h-3 text-orange-400" />
            <span className="text-orange-300 text-xs font-semibold">12</span>
          </div>
        </div>

        {/* XP Bar */}
        <div className="mb-5">
          <div className="flex justify-between mb-1.5">
            <span className="text-white/50 text-xs">XP Required for Level 25</span>
            <span className="text-purple-400 text-xs font-semibold">2,840 / 3,200</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(to right, #9333ea, #a855f7)' }}
              initial={{ width: '0%' }}
              animate={{ width: '88.75%' }}
              transition={{ duration: 1.5, ease: 'easeOut', delay: 0.5 }}
            />
          </div>
        </div>

        {/* Active Quests */}
        <div className="mb-5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Active Quests</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <FileText className="w-3 h-3 text-purple-400" />
                </div>
                <span className="text-white text-xs font-medium">Math Assignment #4</span>
              </div>
              <span className="text-white/40 text-xs">+50 XP</span>
            </div>
            <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Zap className="w-3 h-3 text-green-400" />
                </div>
                <span className="text-white text-xs font-medium">Assignment Completion Velocity</span>
              </div>
              <span className="text-green-400 text-xs font-semibold">+2x</span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <p className="text-white font-bold text-lg">2,840</p>
            <p className="text-white/40 text-xs">Total XP</p>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-center">
            <p className="text-purple-300 font-bold text-lg">Global #142</p>
            <p className="text-white/40 text-xs">Leaderboard</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const featuresRef = useRef<HTMLDivElement>(null)
  const featuresInView = useInView(featuresRef, { once: true, margin: '-100px' })

  const heroVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (delay: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] as const, delay },
    }),
  }

  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{ background: 'linear-gradient(to bottom, #0a0118, #1a1030)' }}
    >
      {/* Ambient orbs */}
      <div
        className="fixed top-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl pointer-events-none"
        style={{ background: 'rgba(168,85,247,0.20)', transform: 'translate(20%, -20%)' }}
      />
      <div
        className="fixed bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
        style={{ background: 'rgba(124,58,237,0.15)', transform: 'translate(-20%, 20%)' }}
      />
      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* ── NAVBAR ───────────────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/10"
        style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)' }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #9333ea, #7c3aed)' }}
            >
              <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                <path d="M12 2C12 2 5 10.5 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 10.5 12 2 12 2Z" />
              </svg>
            </div>
            <span
              className="text-lg font-black lowercase bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(to right, #e9d5ff, #c084fc)' }}
            >
              dopamine drop
            </span>
          </Link>

          {/* Center nav — desktop only */}
          <nav className="hidden md:flex items-center gap-8">
            {[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Features', href: '#features' },
              { label: 'About', href: '#about' },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-sm text-white/50 hover:text-white transition-colors duration-200"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right CTAs */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center px-4 py-2 rounded-full text-sm text-white/70 border border-white/15 hover:border-white/30 hover:text-white transition-all duration-200"
              style={{ backdropFilter: 'blur(8px)' }}
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:scale-105"
              style={{
                background: 'linear-gradient(to right, #7c3aed, #a855f7)',
                boxShadow: '0 0 20px rgba(168,85,247,0.3)',
              }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative pt-40 pb-24 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            custom={0}
            variants={heroVariants}
            initial="hidden"
            animate="visible"
            className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm"
          >
            <Zap className="w-3.5 h-3.5" />
            Gamified academic tracking — now live
          </motion.div>

          {/* Headline */}
          <motion.h1 className="text-6xl sm:text-7xl md:text-8xl font-black leading-none tracking-tight mb-6">
            <motion.span
              custom={0.1}
              variants={heroVariants}
              initial="hidden"
              animate="visible"
              className="text-white inline-block"
            >
              dopamine
            </motion.span>
            {' '}
            <motion.span
              custom={0.25}
              variants={heroVariants}
              initial="hidden"
              animate="visible"
              className="inline-block bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(to right, #a855f7, #6366f1)' }}
            >
              drop
            </motion.span>
          </motion.h1>

          {/* Tagline */}
          <motion.p
            custom={0.4}
            variants={heroVariants}
            initial="hidden"
            animate="visible"
            className="text-lg md:text-xl text-white/50 mb-10 max-w-xl mx-auto leading-relaxed"
          >
            Turn homework into achievements. Your{' '}
            <em className="text-white/70 not-italic font-medium">Canvas</em>{' '}
            assignments, gamified.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            custom={0.55}
            variants={heroVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4"
          >
            <Link
              href="/signup"
              className="flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-white text-base transition-all duration-200 hover:scale-105"
              style={{
                background: 'linear-gradient(to right, #7c3aed, #a855f7)',
                boxShadow: '0 0 30px rgba(168,85,247,0.35)',
              }}
            >
              Get Started
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-white/80 text-base border border-white/15 hover:border-white/30 hover:text-white transition-all duration-200"
              style={{ backdropFilter: 'blur(8px)' }}
            >
              View Demo
            </Link>
          </motion.div>

          {/* Hero mockup card */}
          <motion.div
            custom={0.7}
            variants={heroVariants}
            initial="hidden"
            animate="visible"
          >
            <MockupCard />
          </motion.div>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────────────────────── */}
      <section className="relative py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Crown, end: 500, suffix: '+', label: 'STUDENTS' },
              { icon: FileText, end: 10000, suffix: '+', label: 'ASSIGNMENTS' },
              { icon: Star, end: 50000, suffix: '+', label: 'POINTS' },
            ].map(({ icon: Icon, end, suffix, label }) => (
              <div
                key={label}
                className="rounded-2xl p-5 md:p-7 text-center border border-white/10"
                style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(8px)' }}
              >
                <div
                  className="w-11 h-11 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4"
                  style={{ boxShadow: '0 0 20px rgba(168,85,247,0.2)' }}
                >
                  <Icon className="w-5 h-5 text-purple-400" />
                </div>
                <div className="text-3xl md:text-4xl font-black text-white mb-1">
                  <CountUp end={end} suffix={suffix} enableScrollSpy scrollSpyDelay={200} duration={2} />
                </div>
                <div className="text-xs text-white/30 tracking-widest font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────────── */}
      <section id="features" className="relative py-24 px-6" ref={featuresRef}>
        <div className="max-w-5xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-14">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={featuresInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="text-4xl md:text-5xl font-black text-white mb-4"
            >
              Level Up Your Learning
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={featuresInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-white/40 text-lg max-w-2xl mx-auto leading-relaxed"
            >
              Gamify your academic journey with powerful features designed to keep you motivated
              and on track for greatness.
            </motion.p>
          </div>

          {/* Feature cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 24 }}
                  animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                  className="rounded-2xl p-6 border border-white/10 hover:border-purple-500/30 transition-all duration-300"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    backdropFilter: 'blur(8px)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center mb-4"
                    style={{ boxShadow: '0 0 16px rgba(168,85,247,0.15)' }}
                  >
                    <Icon className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">{feature.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{feature.description}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="relative py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
            Ready to drop some dopamine?
          </h2>
          <p className="text-white/40 text-lg mb-10 leading-relaxed">
            Join hundreds of students turning their Canvas dashboard into a game.{' '}
            Level up today.
          </p>
          <Link href="/signup">
            <motion.span
              animate={{
                boxShadow: [
                  '0 0 20px rgba(168,85,247,0.3)',
                  '0 0 45px rgba(168,85,247,0.65)',
                  '0 0 20px rgba(168,85,247,0.3)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-white font-semibold text-lg cursor-pointer transition-transform duration-200 hover:scale-105"
              style={{
                background: 'linear-gradient(to right, #7c3aed, #a855f7)',
              }}
            >
              Get Started for Free
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </motion.span>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="relative border-t border-white/10 px-6 pt-14 pb-8">
        <div className="max-w-5xl mx-auto">
          {/* Top row */}
          <div className="flex flex-col md:flex-row justify-between gap-10 mb-12">
            {/* Brand */}
            <div className="flex-shrink-0">
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #9333ea, #7c3aed)' }}
                >
                  <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5">
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
              <p className="text-white/30 text-sm">Built with 💜 for students</p>
            </div>

            {/* Link columns */}
            <div className="flex gap-12 md:gap-16">
              <div>
                <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-4">
                  Product
                </h4>
                <ul className="space-y-2.5">
                  <li>
                    <Link
                      href="/dashboard"
                      className="text-white/30 text-sm hover:text-white/70 transition-colors"
                    >
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/login"
                      className="text-white/30 text-sm hover:text-white/70 transition-colors"
                    >
                      Sign In
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-4">
                  Legal
                </h4>
                <ul className="space-y-2.5">
                  <li>
                    <span className="text-white/30 text-sm">Privacy Policy</span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-4">
                  Social
                </h4>
                <div className="flex gap-3">
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-white/30 hover:text-white/70 hover:border-white/25 transition-all duration-200"
                  >
                    <Github className="w-4 h-4" />
                  </a>
                  <a
                    href="https://twitter.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-white/30 hover:text-white/70 hover:border-white/25 transition-all duration-200"
                  >
                    <Twitter className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="border-t border-white/5 pt-6 text-center">
            <p className="text-white/20 text-xs tracking-wide uppercase">
              © 2024 dopamine drop — All Rights Reserved
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
