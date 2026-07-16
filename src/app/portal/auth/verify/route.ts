import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/prisma'
import { createCustomerSession, getSessionCookieConfig } from '@/lib/customer-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim()

  if (!token) {
    return NextResponse.redirect(new URL('/portal/login?error=missing-token', req.url))
  }

  const link = await prisma.customerMagicLink.findUnique({
    where:  { token },
    select: { id: true, customerId: true, expiresAt: true, usedAt: true },
  })

  if (!link || link.usedAt || link.expiresAt < new Date()) {
    return NextResponse.redirect(new URL('/portal/login?error=invalid-token', req.url))
  }

  await prisma.customerMagicLink.update({
    where: { id: link.id },
    data:  { usedAt: new Date() },
  })

  const sessionToken = await createCustomerSession(link.customerId)
  const cfg          = getSessionCookieConfig(sessionToken)

  const res = NextResponse.redirect(new URL('/portal', req.url))
  res.cookies.set(cfg.name, cfg.value, {
    httpOnly: cfg.httpOnly,
    secure:   cfg.secure,
    sameSite: cfg.sameSite,
    path:     cfg.path,
    maxAge:   cfg.maxAge,
  })

  return res
}
