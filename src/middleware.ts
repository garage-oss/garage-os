/**
 * Next.js middleware — runs on the Edge before every matched request.
 *
 * Responsibilities:
 *  1. Authentication guard — redirect unauthenticated users to /login
 *  2. Security response headers (belt-and-suspenders alongside next.config.js)
 *
 * Rate limiting lives in individual API route handlers to keep this
 * module edge-compatible (no Node.js APIs).
 */

import { withAuth }    from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default withAuth(
  function middleware(req: NextRequest) {
    const res = NextResponse.next()

    // ── Belt-and-suspenders security headers ─────────────────────────────────
    // (next.config.js headers() runs first; these catch any gaps)
    res.headers.set('X-Frame-Options',        'SAMEORIGIN')
    res.headers.set('X-Content-Type-Options', 'nosniff')
    res.headers.set('Referrer-Policy',        'strict-origin-when-cross-origin')

    return res
  },
  {
    callbacks: {
      /** Allow the request only when a valid JWT token exists */
      authorized({ token }) {
        return !!token
      },
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/onboarding',
  ],
}
