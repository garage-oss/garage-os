/**
 * Next.js middleware — runs on the Edge before every matched request.
 *
 * Responsibilities:
 *  1. Staff auth guard — redirect unauthenticated staff to /login (dashboard routes)
 *  2. Security response headers for both dashboard and customer portal routes
 *
 * Rate limiting lives in individual API route handlers (Node.js runtime).
 * Customer portal session auth lives in requireCustomerSession() server-side.
 */

import { withAuth }     from 'next-auth/middleware'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'

function addSecurityHeaders(res: ReturnType<typeof NextResponse.next>) {
  res.headers.set('X-Frame-Options',           'SAMEORIGIN')
  res.headers.set('X-Content-Type-Options',    'nosniff')
  res.headers.set('Referrer-Policy',           'strict-origin-when-cross-origin')
  res.headers.set('X-XSS-Protection',          '1; mode=block')
  res.headers.set('Permissions-Policy',        'camera=(), microphone=(), geolocation=()')
  // HSTS — only effective over HTTPS; Edge middleware always sets it, browser ignores it on HTTP
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
  return res
}

// ── Customer portal routes — security headers only, no NextAuth guard ─────────
// Session auth is handled server-side by requireCustomerSession().
function portalMiddleware(req: NextRequest) {
  const res = NextResponse.next()
  return addSecurityHeaders(res)
}

// ── Dashboard routes — full NextAuth guard + security headers ─────────────────
export default withAuth(
  function middleware(req: NextRequest) {
    // Portal paths leaked into withAuth matcher (belt-and-suspenders)
    const path = req.nextUrl.pathname
    if (path.startsWith('/portal') || path.startsWith('/api/portal')) {
      return portalMiddleware(req)
    }
    const res = NextResponse.next()
    return addSecurityHeaders(res)
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const path = req.nextUrl.pathname
        // Portal routes don't need a JWT token — allow through
        if (path.startsWith('/portal') || path.startsWith('/api/portal')) return true
        return !!token
      },
    },
    pages: { signIn: '/login' },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/onboarding',
    '/portal/:path*',
    '/api/portal/:path*',
  ],
}
