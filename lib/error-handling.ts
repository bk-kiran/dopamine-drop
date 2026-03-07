export class CanvasError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public retryable: boolean = true
  ) {
    super(message)
    this.name = 'CanvasError'
  }
}

export const CanvasErrorCodes = {
  INVALID_TOKEN: 'INVALID_TOKEN',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  CANVAS_DOWN: 'CANVAS_DOWN',
  SYNC_FAILED: 'SYNC_FAILED',
} as const

/**
 * Converts a raw error (from Canvas API throws, network errors, etc.)
 * into a structured CanvasError with a user-friendly message.
 */
export function handleCanvasError(error: any): CanvasError {
  const message: string = error?.message || ''

  // Parse HTTP status from thrown Canvas API errors like:
  // "Canvas API error: 401 Unauthorized - ..."
  const statusMatch = message.match(/Canvas API error:\s*(\d+)/)
  const status: number = statusMatch ? parseInt(statusMatch[1]) : (error?.status ?? 0)

  if (status === 401 || message.toLowerCase().includes('unauthorized') || message.includes('Invalid access token')) {
    return new CanvasError(
      'Canvas token is invalid or expired',
      CanvasErrorCodes.INVALID_TOKEN,
      'Your Canvas token has expired. Please disconnect and reconnect your Canvas account.',
      false // Not retryable — user needs to provide a new token
    )
  }

  if (status === 429) {
    return new CanvasError(
      'Canvas API rate limit exceeded',
      CanvasErrorCodes.RATE_LIMITED,
      'Canvas is temporarily busy. Please try again in a few minutes.',
      true
    )
  }

  if (status === 502 || status === 503 || status === 504) {
    return new CanvasError(
      'Canvas is temporarily unavailable',
      CanvasErrorCodes.CANVAS_DOWN,
      'Canvas is currently down. Please try again later.',
      true
    )
  }

  if (
    error?.name === 'AbortError' ||
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT')
  ) {
    return new CanvasError(
      'Network error connecting to Canvas',
      CanvasErrorCodes.NETWORK_ERROR,
      'Unable to connect to Canvas. Check your internet connection and try again.',
      true
    )
  }

  return new CanvasError(
    message || 'Unknown error',
    CanvasErrorCodes.SYNC_FAILED,
    'Failed to sync with Canvas. Please try again.',
    true
  )
}
