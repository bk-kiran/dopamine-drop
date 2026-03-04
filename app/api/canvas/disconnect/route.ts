import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function POST() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const convex = getConvexClient()

  const result = await convex.mutation(api.users.disconnectCanvas, {
    clerkId: userId,
  })

  return NextResponse.json({
    success: true,
    message: 'Canvas disconnected. Your points and progress are safe!',
    assignmentsArchived: result.assignmentsArchived,
  })
}
