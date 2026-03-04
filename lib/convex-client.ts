import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

let convexClient: ConvexHttpClient | null = null

export function getConvexClient() {
  if (!convexClient) {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!
    convexClient = new ConvexHttpClient(convexUrl)
  }
  return convexClient
}

// Helper to get Convex user ID from Clerk user ID
export async function getConvexUserId(clerkUserId: string): Promise<Id<'users'>> {
  const client = getConvexClient()
  const userId = await client.mutation(api.users.getOrCreateUser, {
    clerkId: clerkUserId,
  })
  return userId
}
