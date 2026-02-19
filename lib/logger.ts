/**
 * lib/logger.ts — Security event logging
 *
 * Logs structured security events to the console (visible in Vercel logs).
 * In production, pipe these to a monitoring service (Sentry, Datadog, etc.)
 * by replacing the console.warn call with your telemetry SDK.
 */

type SecurityEventType =
  | 'rate_limit'
  | 'invalid_input'
  | 'unauthorized'
  | 'suspicious'

export function logSecurityEvent(
  event: SecurityEventType,
  details: Record<string, unknown>
): void {
  // Structured log — easy to filter in Vercel / any log aggregator
  console.warn('[SECURITY]', {
    event,
    timestamp: new Date().toISOString(),
    ...details,
  })
}

/**
 * Generic internal error logger that avoids leaking stack traces to clients.
 * Always log internally; return a generic message to the caller.
 */
export function logInternalError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>
): void {
  console.error(`[${context}]`, {
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    ...extra,
  })
}
