import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { DashboardClient } from './dashboard-client'

export const metadata: Metadata = {
  title: 'Dashboard',
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export default async function DashboardPage() {
  const { userId } = await auth()

  if (!userId) redirect('/login')

  const convexUser = await convex.query(api.users.getUserBySupabaseId, {
    clerkId: userId,
  })

  if (!convexUser?.canvasTokenEncrypted) redirect('/dashboard/setup')

  return <DashboardClient supabaseUserId={userId} />
}
