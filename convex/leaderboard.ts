import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// Helper: get user by Supabase ID
async function getUserBySupabaseId(ctx: any, supabaseId: string) {
  return await ctx.db
    .query('users')
    .withIndex('by_auth_user_id', (q: any) => q.eq('authUserId', supabaseId))
    .first()
}

// Generate a random 8-character alphanumeric invite code (no ambiguous chars)
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// ─── Create a new leaderboard ────────────────────────────────────────────────

export const createLeaderboard = mutation({
  args: {
    supabaseId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) throw new Error('User not found')

    // Generate a unique invite code
    let inviteCode = generateInviteCode()
    let existing = await ctx.db
      .query('leaderboards')
      .withIndex('by_invite_code', (q: any) => q.eq('inviteCode', inviteCode))
      .first()
    while (existing) {
      inviteCode = generateInviteCode()
      existing = await ctx.db
        .query('leaderboards')
        .withIndex('by_invite_code', (q: any) => q.eq('inviteCode', inviteCode))
        .first()
    }

    const now = new Date().toISOString()

    const leaderboardId = await ctx.db.insert('leaderboards', {
      name: args.name,
      creatorId: user._id,
      inviteCode,
      createdAt: now,
    })

    // Add creator as the first member
    await ctx.db.insert('leaderboardMembers', {
      leaderboardId,
      userId: user._id,
      joinedAt: now,
    })

    return { leaderboardId, inviteCode }
  },
})

// ─── Join a leaderboard by invite code ───────────────────────────────────────

export const joinLeaderboard = mutation({
  args: {
    supabaseId: v.string(),
    inviteCode: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) throw new Error('User not found')

    const leaderboard = await ctx.db
      .query('leaderboards')
      .withIndex('by_invite_code', (q: any) => q.eq('inviteCode', args.inviteCode.toUpperCase()))
      .first()

    if (!leaderboard) throw new Error('Leaderboard not found — check the invite code')

    // Check if already a member
    const members = await ctx.db
      .query('leaderboardMembers')
      .withIndex('by_leaderboard', (q: any) => q.eq('leaderboardId', leaderboard._id))
      .collect()

    const alreadyMember = members.some((m: any) => m.userId === user._id)
    if (alreadyMember) return { leaderboardId: leaderboard._id, alreadyMember: true }

    await ctx.db.insert('leaderboardMembers', {
      leaderboardId: leaderboard._id,
      userId: user._id,
      joinedAt: new Date().toISOString(),
    })

    return { leaderboardId: leaderboard._id, alreadyMember: false }
  },
})

// ─── Get all leaderboards the user is in ─────────────────────────────────────

export const getMyLeaderboards = query({
  args: { supabaseId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) return []

    const memberships = await ctx.db
      .query('leaderboardMembers')
      .withIndex('by_user', (q: any) => q.eq('userId', user._id))
      .collect()

    const result = await Promise.all(
      memberships.map(async (membership: any) => {
        const leaderboard = await ctx.db
          .query('leaderboards')
          .filter((q: any) => q.eq(q.field('_id'), membership.leaderboardId))
          .first()
        if (!leaderboard) return null

        const members = await ctx.db
          .query('leaderboardMembers')
          .withIndex('by_leaderboard', (q: any) => q.eq('leaderboardId', leaderboard._id))
          .collect()

        const creator = await ctx.db
          .query('users')
          .filter((q: any) => q.eq(q.field('_id'), leaderboard.creatorId))
          .first()

        return {
          _id: leaderboard._id,
          name: leaderboard.name,
          inviteCode: leaderboard.inviteCode,
          createdAt: leaderboard.createdAt,
          memberCount: members.length,
          creatorName: creator?.displayName || 'Unknown',
          isCreator: leaderboard.creatorId === user._id,
        }
      })
    )

    return result.filter(Boolean)
  },
})

// ─── Get rankings for a leaderboard ─────────────────────────────────────────

export const getLeaderboardRankings = query({
  args: { leaderboardId: v.id('leaderboards') },
  handler: async (ctx, args) => {
    const leaderboard = await ctx.db
      .query('leaderboards')
      .filter((q: any) => q.eq(q.field('_id'), args.leaderboardId))
      .first()
    if (!leaderboard) return null

    const members = await ctx.db
      .query('leaderboardMembers')
      .withIndex('by_leaderboard', (q: any) => q.eq('leaderboardId', args.leaderboardId))
      .collect()

    const memberData = await Promise.all(
      members.map(async (m: any) => {
        const user = await ctx.db
          .query('users')
          .filter((q: any) => q.eq(q.field('_id'), m.userId))
          .first()
        if (!user) return null

        let avatarUrl: string | null = null
        if (user.avatarStorageId) {
          avatarUrl = await ctx.storage.getUrl(user.avatarStorageId)
        }

        // Compute initials
        const name = user.displayName || 'Student'
        const parts = name.split(' ')
        const initials =
          parts.length >= 2
            ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
            : parts[0][0].toUpperCase()

        return {
          userId: user._id as string,
          displayName: name,
          initials,
          totalPoints: user.totalPoints || 0,
          streakCount: user.streakCount || 0,
          avatarUrl,
          joinedAt: m.joinedAt,
        }
      })
    )

    const ranked = memberData
      .filter(Boolean)
      .sort((a: any, b: any) => b.totalPoints - a.totalPoints)
      .map((member: any, index: number) => ({ ...member, rank: index + 1 }))

    return {
      _id: leaderboard._id as string,
      name: leaderboard.name,
      inviteCode: leaderboard.inviteCode,
      creatorId: leaderboard.creatorId as string,
      members: ranked,
    }
  },
})

// ─── Leave a leaderboard ─────────────────────────────────────────────────────

export const leaveLeaderboard = mutation({
  args: {
    supabaseId: v.string(),
    leaderboardId: v.id('leaderboards'),
  },
  handler: async (ctx, args) => {
    const user = await getUserBySupabaseId(ctx, args.supabaseId)
    if (!user) throw new Error('User not found')

    const members = await ctx.db
      .query('leaderboardMembers')
      .withIndex('by_leaderboard', (q: any) => q.eq('leaderboardId', args.leaderboardId))
      .collect()

    const membership = members.find((m: any) => m.userId === user._id)
    if (!membership) throw new Error('Not a member of this leaderboard')

    await ctx.db.delete(membership._id)
    return { success: true }
  },
})

// ─── Get leaderboard info by invite code (public) ────────────────────────────

export const getLeaderboardByInviteCode = query({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const leaderboard = await ctx.db
      .query('leaderboards')
      .withIndex('by_invite_code', (q: any) => q.eq('inviteCode', args.inviteCode.toUpperCase()))
      .first()

    if (!leaderboard) return null

    const members = await ctx.db
      .query('leaderboardMembers')
      .withIndex('by_leaderboard', (q: any) => q.eq('leaderboardId', leaderboard._id))
      .collect()

    const creator = await ctx.db
      .query('users')
      .filter((q: any) => q.eq(q.field('_id'), leaderboard.creatorId))
      .first()

    return {
      _id: leaderboard._id as string,
      name: leaderboard.name,
      inviteCode: leaderboard.inviteCode,
      memberCount: members.length,
      creatorName: creator?.displayName || 'Someone',
    }
  },
})
