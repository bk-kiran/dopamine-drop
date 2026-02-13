'use client'

import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { ReactNode } from 'react'

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

if (!convexUrl) {
  console.error('[ConvexClientProvider] NEXT_PUBLIC_CONVEX_URL is not set!')
  throw new Error('NEXT_PUBLIC_CONVEX_URL environment variable is required')
}

console.log('[ConvexClientProvider] Initializing with URL:', convexUrl)

const convex = new ConvexReactClient(convexUrl)

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  console.log('[ConvexClientProvider] Rendering provider')
  return <ConvexProvider client={convex}>{children}</ConvexProvider>
}
