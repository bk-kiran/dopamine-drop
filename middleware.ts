import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/signup(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/join(.*)',
  '/api/webhooks(.*)',
])

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)'])

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth()

  // Redirect unauthenticated users away from dashboard
  if (isProtectedRoute(request) && !userId) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages
  const isAuthPage =
    request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup'
  if (isAuthPage && userId) {
    const dashboardUrl = new URL('/dashboard', request.url)
    return NextResponse.redirect(dashboardUrl)
  }
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
