'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Plus, Hash, Copy, Check, Flame, Zap, Users, LogOut, X } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

type View = 'list' | 'create' | 'join'

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function LeaderboardPage() {
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null)
  const [view, setView] = useState<View>('list')
  const [activeLeaderboardId, setActiveLeaderboardId] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [newlyCreatedCode, setNewlyCreatedCode] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) setSupabaseUserId(user.id)
    })
  }, [])

  // Get Convex user ID for row highlighting
  const dashboardData = useQuery(
    api.users.getDashboardData,
    supabaseUserId ? { supabaseId: supabaseUserId } : 'skip'
  )
  const convexUserId = dashboardData?.user?._id as string | undefined

  const myLeaderboards = useQuery(
    api.leaderboard.getMyLeaderboards,
    supabaseUserId ? { supabaseId: supabaseUserId } : 'skip'
  )
  const rankings = useQuery(
    api.leaderboard.getLeaderboardRankings,
    activeLeaderboardId ? { leaderboardId: activeLeaderboardId as any } : 'skip'
  )

  const createLeaderboard = useMutation(api.leaderboard.createLeaderboard)
  const joinLeaderboard = useMutation(api.leaderboard.joinLeaderboard)
  const leaveLeaderboard = useMutation(api.leaderboard.leaveLeaderboard)

  // Auto-select first leaderboard when data loads
  useEffect(() => {
    if (myLeaderboards && myLeaderboards.length > 0 && !activeLeaderboardId) {
      setActiveLeaderboardId((myLeaderboards[0] as any)._id)
    }
  }, [myLeaderboards, activeLeaderboardId])

  const handleCreate = async () => {
    if (!supabaseUserId || !nameInput.trim()) return
    setIsCreating(true)
    try {
      const result = await createLeaderboard({ supabaseId: supabaseUserId, name: nameInput.trim() })
      setNewlyCreatedCode(result.inviteCode)
      setActiveLeaderboardId(result.leaderboardId as string)
      setNameInput('')
      setView('list')
      toast({ title: 'Leaderboard created!', className: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950/30 dark:border-green-800 dark:text-green-100', duration: 3000 })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive', duration: 3000 })
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoin = async () => {
    if (!supabaseUserId || codeInput.length !== 8) return
    setIsJoining(true)
    try {
      const result = await joinLeaderboard({ supabaseId: supabaseUserId, inviteCode: codeInput.toUpperCase() })
      if (result.alreadyMember) {
        toast({ title: "You're already in this leaderboard", duration: 3000 })
      } else {
        setActiveLeaderboardId(result.leaderboardId as string)
        toast({ title: 'Joined!', className: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950/30 dark:border-green-800 dark:text-green-100', duration: 3000 })
      }
      setCodeInput('')
      setView('list')
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive', duration: 3000 })
    } finally {
      setIsJoining(false)
    }
  }

  const handleLeave = async (leaderboardId: string) => {
    if (!supabaseUserId) return
    try {
      await leaveLeaderboard({ supabaseId: supabaseUserId, leaderboardId: leaderboardId as any })
      if (activeLeaderboardId === leaderboardId) setActiveLeaderboardId(null)
      setNewlyCreatedCode(null)
      toast({ title: 'Left leaderboard', duration: 3000 })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive', duration: 3000 })
    }
  }

  const copyInviteLink = (inviteCode: string) => {
    const link = `${window.location.origin}/join/${inviteCode}`
    navigator.clipboard.writeText(link)
    setCopiedCode(inviteCode)
    setTimeout(() => setCopiedCode(null), 2000)
    toast({ title: 'Invite link copied!', className: 'bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-100', duration: 2500 })
  }

  const hasLeaderboards = myLeaderboards && myLeaderboards.length > 0
  const isLoaded = myLeaderboards !== undefined

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">Leaderboards</h1>
          <p className="text-sm text-[var(--text-muted)]">Compete with friends — invite only</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(view === 'join' ? 'list' : 'join')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 ${
              view === 'join'
                ? 'bg-[var(--glass-bg)] border-purple-500/40 text-purple-400'
                : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-muted)] hover:border-purple-500/30 hover:text-purple-400'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            Join with code
          </button>
          <button
            onClick={() => setView(view === 'create' ? 'list' : 'create')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 ${
              view === 'create'
                ? 'bg-purple-500/30 border-purple-400/60 text-purple-300'
                : 'bg-purple-500/20 border-purple-500/30 text-purple-400 hover:border-purple-400/50'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Create
          </button>
        </div>
      </div>

      {/* ── Create flow ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {view === 'create' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="px-6 py-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-purple-500/30"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Create a Leaderboard</h3>
              <button onClick={() => setView('list')} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-3">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="e.g. CS 2025 Grind Squad"
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-purple-500/50"
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={isCreating || !nameInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-purple-500/30 border border-purple-400/50 text-purple-300 text-sm font-semibold hover:bg-purple-500/40 transition-all disabled:opacity-50"
              >
                {isCreating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Join flow ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {view === 'join' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="px-6 py-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Join with Invite Code</h3>
              <button onClick={() => setView('list')} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-3">
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="8-character code"
                maxLength={8}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-purple-500/50 font-mono tracking-[0.3em] uppercase"
                autoFocus
              />
              <button
                onClick={handleJoin}
                disabled={isJoining || codeInput.length !== 8}
                className="px-4 py-2.5 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-primary)] text-sm font-semibold hover:border-purple-500/40 transition-all disabled:opacity-50"
              >
                {isJoining ? 'Joining…' : 'Join'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Newly created invite banner ───────────────────────────────────── */}
      <AnimatePresence>
        {newlyCreatedCode && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="px-5 py-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center gap-4"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mb-1">Share invite link</p>
              <p className="text-sm font-mono text-[var(--text-primary)] truncate">
                {typeof window !== 'undefined' ? window.location.origin : ''}/join/{newlyCreatedCode}
              </p>
            </div>
            <button
              onClick={() => copyInviteLink(newlyCreatedCode)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/20 border border-purple-400/40 text-purple-300 text-xs font-semibold hover:bg-purple-500/30 transition-all flex-shrink-0"
            >
              {copiedCode === newlyCreatedCode ? <><Check className="w-3.5 h-3.5" />Copied!</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
            </button>
            <button onClick={() => setNewlyCreatedCode(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {isLoaded && !hasLeaderboards && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
            <Trophy className="w-8 h-8 text-purple-400/40" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">No leaderboards yet</h2>
          <p className="text-sm text-[var(--text-muted)] mb-8 max-w-xs">
            Create a private leaderboard and invite friends, or join one with an invite code.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('create')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 text-sm font-semibold hover:bg-purple-500/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              Create a Leaderboard
            </button>
            <button
              onClick={() => setView('join')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-muted)] text-sm font-semibold hover:border-purple-500/30 hover:text-purple-400 transition-all"
            >
              <Hash className="w-4 h-4" />
              Join with Code
            </button>
          </div>
        </div>
      )}

      {/* ── Leaderboard tabs + rankings ──────────────────────────────────── */}
      {hasLeaderboards && (
        <div className="space-y-4">
          {/* Tab row — only show when in multiple leaderboards */}
          {myLeaderboards.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {myLeaderboards.map((lb: any) => (
                <button
                  key={lb._id}
                  onClick={() => { setActiveLeaderboardId(lb._id); setNewlyCreatedCode(null) }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 border ${
                    activeLeaderboardId === lb._id
                      ? 'bg-purple-500/20 border-purple-400/50 text-purple-300'
                      : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-muted)] hover:border-purple-500/30 hover:text-purple-400'
                  }`}
                >
                  <Trophy className="w-3 h-3" />
                  {lb.name}
                  <span className="opacity-60">· {lb.memberCount}</span>
                </button>
              ))}
            </div>
          )}

          {/* Rankings panel */}
          {rankings && activeLeaderboardId && (
            <RankingsPanel
              rankings={rankings}
              convexUserId={convexUserId}
              copiedCode={copiedCode}
              onCopyInvite={copyInviteLink}
              onLeave={handleLeave}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Rankings Panel ───────────────────────────────────────────────────────────

interface RankingsPanelProps {
  rankings: any
  convexUserId: string | undefined
  copiedCode: string | null
  onCopyInvite: (code: string) => void
  onLeave: (id: string) => void
}

function RankingsPanel({ rankings, convexUserId, copiedCode, onCopyInvite, onLeave }: RankingsPanelProps) {
  return (
    <div className="rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-3">
          <Trophy className="w-4 h-4 text-purple-400" />
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">{rankings.name}</h2>
            <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mt-0.5">
              <Users className="w-3 h-3" />
              {rankings.members.length} member{rankings.members.length !== 1 ? 's' : ''}
              <span className="mx-1">·</span>
              <span className="font-mono tracking-widest text-purple-400">{rankings.inviteCode}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCopyInvite(rankings.inviteCode)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold hover:bg-purple-500/20 transition-all"
          >
            {copiedCode === rankings.inviteCode
              ? <><Check className="w-3 h-3" />Copied!</>
              : <><Copy className="w-3 h-3" />Invite</>
            }
          </button>
          <button
            onClick={() => onLeave(rankings._id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-all"
          >
            <LogOut className="w-3 h-3" />
            Leave
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[2rem_1fr_auto] gap-4 px-6 py-2 border-b border-[var(--glass-border)] bg-white/2">
        <div />
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Member</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] text-right">Points · Streak</span>
      </div>

      {/* Member rows */}
      <div className="divide-y divide-white/5">
        {rankings.members.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--text-muted)]">No members yet</div>
        ) : (
          rankings.members.map((member: any, index: number) => {
            const isMe = !!convexUserId && member.userId === convexUserId
            const medal = MEDALS[member.rank]

            return (
              <motion.div
                key={member.userId}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`flex items-center gap-4 px-6 py-4 transition-colors ${
                  isMe
                    ? 'bg-purple-500/10 border-l-2 border-purple-500 -ml-0.5 pl-[calc(1.5rem_-_2px)]'
                    : 'hover:bg-white/2'
                }`}
              >
                {/* Rank */}
                <div className="w-8 text-center flex-shrink-0">
                  {medal ? (
                    <span className="text-xl leading-none">{medal}</span>
                  ) : (
                    <span className="text-sm font-bold text-[var(--text-muted)]">#{member.rank}</span>
                  )}
                </div>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt={member.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-purple-400">{member.initials}</span>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {member.displayName}
                  </p>
                  {isMe && (
                    <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">You</span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{member.streakCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                    <span className="text-sm font-bold text-[var(--text-primary)]">{member.totalPoints.toLocaleString()}</span>
                  </div>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
