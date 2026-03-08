import { NextResponse } from 'next/server'

// DEBUG ONLY — remove this file after identifying the missing env var
export async function GET() {
  return NextResponse.json({
    environment: process.env.NODE_ENV,
    vercel_env: process.env.VERCEL_ENV ?? 'not set (local?)',
    variables: {
      NEXT_PUBLIC_CANVAS_BASE_URL: process.env.NEXT_PUBLIC_CANVAS_BASE_URL || 'MISSING',
      CANVAS_ENCRYPTION_SECRET: process.env.CANVAS_ENCRYPTION_SECRET
        ? `SET (length: ${process.env.CANVAS_ENCRYPTION_SECRET.length})`
        : 'MISSING',
      NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL
        ? 'SET'
        : 'MISSING',
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ? 'SET' : 'MISSING',
      CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET ? 'SET' : 'MISSING',
    },
    timestamp: new Date().toISOString(),
  })
}
