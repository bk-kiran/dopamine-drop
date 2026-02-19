/**
 * lib/env.ts — Runtime environment variable validation
 *
 * ⚠️  SERVER-SIDE ONLY — never import this in Client Components.
 *
 * Import `env` wherever you need typed, validated config values
 * instead of accessing `process.env` directly.
 */

const requiredServer = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_CONVEX_URL',
  'CANVAS_ENCRYPTION_SECRET',
] as const

// Only validate on the server (Node.js process); skip during client-side
// bundle evaluation where process.env values are inlined by Next.js.
if (typeof window === 'undefined') {
  for (const key of requiredServer) {
    if (!process.env[key]) {
      throw new Error(
        `[env] Missing required environment variable: ${key}. ` +
          'Add it to .env.local (see .env.local.example).'
      )
    }
  }
}

/** Typed, validated environment configuration. */
export const env = {
  supabase: {
    url:            process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey:        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
  convex: {
    url: process.env.NEXT_PUBLIC_CONVEX_URL!,
  },
  canvas: {
    baseUrl:         process.env.NEXT_PUBLIC_CANVAS_BASE_URL ?? '',
    encryptionSecret: process.env.CANVAS_ENCRYPTION_SECRET!,
  },
  upstash: {
    redisUrl:   process.env.UPSTASH_REDIS_REST_URL,
    redisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  },
} as const
