import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Rate limiting is optional: if Upstash env vars are not set (e.g. local dev),
// all checkRateLimit calls are no-ops and return null (allowed).
let rateLimiters: {
  auth:      Ratelimit
  sync:      Ratelimit
  mutations: Ratelimit
  api:       Ratelimit
} | null = null

if (
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
) {
  const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })

  rateLimiters = {
    // Public auth endpoints: 5 requests per 15 minutes per IP
    auth: new Ratelimit({
      redis,
      limiter:   Ratelimit.slidingWindow(5, '15 m'),
      analytics: true,
      prefix:    'ratelimit:auth',
    }),

    // Canvas sync: 10 requests per hour per user
    sync: new Ratelimit({
      redis,
      limiter:   Ratelimit.slidingWindow(10, '60 m'),
      analytics: true,
      prefix:    'ratelimit:sync',
    }),

    // Mutations (complete, uncomplete, reveal reward): 100 per hour per user
    mutations: new Ratelimit({
      redis,
      limiter:   Ratelimit.slidingWindow(100, '60 m'),
      analytics: true,
      prefix:    'ratelimit:mutations',
    }),

    // General API calls: 300 per hour per user
    api: new Ratelimit({
      redis,
      limiter:   Ratelimit.slidingWindow(300, '60 m'),
      analytics: true,
      prefix:    'ratelimit:api',
    }),
  }
}

/**
 * Apply rate limit and return a 429 Response if exceeded, null if allowed.
 * No-ops (returns null) when Upstash is not configured.
 */
export async function checkRateLimit(
  identifier: string,
  limiter: 'auth' | 'sync' | 'mutations' | 'api'
): Promise<Response | null> {
  if (!rateLimiters) return null

  const { success, limit, remaining, reset } =
    await rateLimiters[limiter].limit(identifier)

  if (!success) {
    return new Response(
      JSON.stringify({
        error:   'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        limit,
        remaining,
        resetAt: new Date(reset).toISOString(),
      }),
      {
        status: 429,
        headers: {
          'Content-Type':        'application/json',
          'X-RateLimit-Limit':   limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset':   reset.toString(),
          'Retry-After':         Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    )
  }

  return null
}

/** Extract the client IP from standard forwarding headers. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp    = request.headers.get('x-real-ip')
  return forwarded?.split(',')[0].trim() ?? realIp ?? 'unknown'
}
