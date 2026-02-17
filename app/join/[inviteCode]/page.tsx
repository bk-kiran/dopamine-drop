'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { Trophy, Users, Zap, ArrowRight, Loader2, UserPlus } from 'lucide-react'

export default function JoinLeaderboardPage() {
  const params = useParams()
  const router = useRouter()
  const inviteCode = (params.inviteCode as string).toUpperCase()

  const [supabaseUserId, setSupabaseUserId] = useState<string | null | undefined>(undefined)
  const [isJoining, setIsJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [hasAutoJoined, setHasAutoJoined] = useState(false)

  // Check Supabase auth
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setSupabaseUserId(user?.id ?? null)
    })
  }, [])

  // Fetch leaderboard info (public — no auth needed)
  const leaderboard = useQuery(api.leaderboard.getLeaderboardByInviteCode, { inviteCode })
  const joinLeaderboard = useMutation(api.leaderboard.joinLeaderboard)

  // Auto-join when user is logged in
  useEffect(() => {
    if (supabaseUserId && leaderboard && !hasAutoJoined) {
      setHasAutoJoined(true)
      setIsJoining(true)
      joinLeaderboard({ supabaseId: supabaseUserId, inviteCode })
        .then(() => {
          router.push('/dashboard/leaderboard')
        })
        .catch((err: any) => {
          setJoinError(err.message || 'Failed to join leaderboard')
          setIsJoining(false)
        })
    }
  }, [supabaseUserId, leaderboard, hasAutoJoined])

  // Loading auth check
  if (supabaseUserId === undefined || leaderboard === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  // Leaderboard not found
  if (leaderboard === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-red-400/50" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Leaderboard not found</h1>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            This invite link may be invalid or expired. Ask your friend for a new one.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 text-sm font-semibold hover:bg-purple-500/30 transition-all"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Card */}
        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 overflow-hidden">
          {/* Purple top bar */}
          <div className="h-1.5 bg-gradient-to-r from-purple-600 via-violet-500 to-purple-600" />

          <div className="px-8 py-8">
            {/* Icon */}
            <div className="w-14 h-14 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-5">
              <Trophy className="w-7 h-7 text-purple-400" />
            </div>

            {/* You've been invited */}
            <p className="text-xs font-bold uppercase tracking-widest text-purple-400 text-center mb-2">
              You've been invited to
            </p>
            <h1 className="text-2xl font-black text-[var(--text-primary)] text-center mb-1">
              {leaderboard.name}
            </h1>
            <p className="text-xs text-[var(--text-muted)] text-center mb-6">
              Created by {leaderboard.creatorName}
            </p>

            {/* Stats */}
            <div className="flex items-center justify-center gap-6 mb-8">
              <div className="text-center">
                <div className="flex items-center gap-1 justify-center mb-0.5">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span className="text-xl font-bold text-[var(--text-primary)]">{leaderboard.memberCount}</span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Members</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <div className="flex items-center gap-1 justify-center mb-0.5">
                  <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="text-xl font-bold text-[var(--text-primary)]">Points</span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Based ranking</p>
              </div>
            </div>

            {/* Error */}
            {joinError && (
              <p className="text-xs text-red-400 text-center mb-4 px-2">{joinError}</p>
            )}

            {/* CTA */}
            {supabaseUserId ? (
              /* Logged in — auto-joining */
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-purple-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Joining leaderboard…</span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)]">You'll be redirected in a moment</p>
              </div>
            ) : (
              /* Not logged in */
              <div className="space-y-3">
                <a
                  href={`/signup?redirect=/join/${inviteCode}`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-purple-500/30 border border-purple-400/50 text-purple-300 font-semibold text-sm hover:bg-purple-500/40 transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  Sign up to join
                </a>
                <a
                  href={`/login?redirect=/join/${inviteCode}`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white/5 border border-white/10 text-[var(--text-muted)] font-semibold text-sm hover:border-purple-500/30 hover:text-purple-400 transition-all"
                >
                  Already have an account?
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* App brand */}
        <p className="text-center mt-4 text-xs text-[var(--text-muted)]">
          <span className="font-black bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">
            dopamine drop
          </span>
          {' '}· academic gamification
        </p>
      </motion.div>
    </div>
  )
}
