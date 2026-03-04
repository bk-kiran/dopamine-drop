import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

type ClerkEmailAddress = { email_address: string; id: string }

type ClerkUserPayload = {
  id: string
  email_addresses: ClerkEmailAddress[]
  first_name: string | null
  last_name: string | null
  image_url: string
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[Clerk Webhook] CLERK_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // Get svix headers for verification
  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  // Verify the webhook signature
  const body = await request.text()
  const wh = new Webhook(webhookSecret)

  let event: { type: string; data: ClerkUserPayload }
  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as { type: string; data: ClerkUserPayload }
  } catch (err) {
    console.error('[Clerk Webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const convex = getConvexClient()
  const { type, data } = event

  try {
    if (type === 'user.created') {
      const primaryEmail = data.email_addresses?.[0]?.email_address
      await convex.mutation(api.users.createFromClerk, {
        clerkId: data.id,
        email: primaryEmail,
        firstName: data.first_name ?? undefined,
        lastName: data.last_name ?? undefined,
        imageUrl: data.image_url ?? undefined,
      })
      console.log(`[Clerk Webhook] Created user ${data.id}`)
    } else if (type === 'user.updated') {
      const primaryEmail = data.email_addresses?.[0]?.email_address
      await convex.mutation(api.users.updateFromClerk, {
        clerkId: data.id,
        email: primaryEmail,
        firstName: data.first_name ?? undefined,
        lastName: data.last_name ?? undefined,
        imageUrl: data.image_url ?? undefined,
      })
      console.log(`[Clerk Webhook] Updated user ${data.id}`)
    } else if (type === 'user.deleted') {
      await convex.mutation(api.users.deleteFromClerk, {
        clerkId: data.id,
      })
      console.log(`[Clerk Webhook] Deleted user ${data.id}`)
    }
  } catch (err) {
    console.error(`[Clerk Webhook] Failed to process ${type}:`, err)
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
