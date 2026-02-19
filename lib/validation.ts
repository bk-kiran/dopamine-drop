import { z } from 'zod'

// ── Schemas ──────────────────────────────────────────────────────────────────

/** Canvas personal access token */
export const canvasTokenSchema = z.object({
  token: z
    .string()
    .min(50, 'Token must be at least 50 characters')
    .max(200, 'Token too long')
    .regex(/^[a-zA-Z0-9~_\-]+$/, 'Invalid token format'),
})

/** Convex document ID (base62-ish, 20–32 chars) */
const convexIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_]{16,40}$/, 'Invalid ID format')

/** Assignment action payload (complete / uncomplete) */
export const assignmentActionSchema = z.object({
  assignmentId: convexIdSchema,
  userId:       convexIdSchema,
})

/** Reward reveal payload */
export const rewardRevealSchema = z.object({
  rewardId: convexIdSchema,
})

/** Hidden-course toggle payload */
export const hiddenCourseSchema = z
  .object({
    courseId: z.string().regex(/^\d+$/, 'Invalid course ID').optional(),
    action:   z.enum(['hide', 'show', 'clear']),
  })
  .refine(
    (data) => {
      if (data.action === 'hide' || data.action === 'show') {
        return !!data.courseId
      }
      return true
    },
    { message: 'courseId is required for hide/show actions' }
  )

/** Custom task creation */
export const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title required')
    .max(200, 'Title too long')
    .trim(),
  description: z.string().max(2000, 'Description too long').trim().optional(),
  category:    z.enum(['academic', 'club', 'work', 'personal']),
  pointsValue: z.number().int().min(1).max(100),
  dueAt:       z.string().datetime().optional(),
})

/** User-authored notes */
export const notesSchema = z.object({
  assignmentId: convexIdSchema,
  notes:        z.string().max(5000, 'Notes too long').trim(),
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse `schema` against `data` and return either the validated value
 * or an error string suitable for a 400 response.
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (result.success) return { success: true, data: result.data }
  return {
    success: false,
    error: result.error.errors[0]?.message ?? 'Validation failed',
  }
}

/**
 * Strip HTML tags and dangerous patterns from user-generated content
 * before display. Prefer not storing raw HTML; this is a last-resort guard.
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript\s*:/gi, '')
    .trim()
}
