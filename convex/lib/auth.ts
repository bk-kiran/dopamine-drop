import { QueryCtx, MutationCtx } from '../_generated/server'
import { Id } from '../_generated/dataModel'

/**
 * Look up the authenticated user by Clerk ID.
 * Throws 'Unauthorized' if the user is not found.
 */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
  clerkId: string
) {
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
    .first()

  if (!user) throw new Error('Unauthorized')
  return user
}

/**
 * Verify that a document's userId matches the authenticated user.
 * Throws 'Forbidden' if they don't match.
 */
export function requireOwnership(
  ownerId: Id<'users'>,
  requesterId: Id<'users'>
) {
  if (ownerId !== requesterId) throw new Error('Forbidden')
}
