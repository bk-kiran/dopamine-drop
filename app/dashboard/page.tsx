import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { DashboardClient } from './dashboard-client'

export const metadata: Metadata = {
  title: 'Dashboard',
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const convexUser = await convex.query(api.users.getUserBySupabaseId, {
    supabaseId: user.id,
  })

  if (!convexUser?.canvasTokenEncrypted) redirect('/dashboard/setup')

  return <DashboardClient supabaseUserId={user.id} />
}
