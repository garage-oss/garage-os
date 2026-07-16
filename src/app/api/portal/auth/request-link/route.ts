import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { email, phone } = await req.json().catch(() => ({})) as { email?: string; phone?: string }

  const identifier = (email ?? '').trim().toLowerCase() || (phone ?? '').trim()
  if (!identifier) return NextResponse.json({ error: 'נדרש אימייל או טלפון' }, { status: 400 })

  // Find customer by email or phone/mobile
  const customer = await prisma.customer.findFirst({
    where: email
      ? { email: identifier }
      : { OR: [{ phone: identifier }, { mobile: identifier }] },
    select: { id: true, name: true, email: true },
  })

  // Return success regardless — don't leak whether customer exists
  if (!customer) {
    return NextResponse.json({ success: true, demo: null })
  }

  // Invalidate any existing unused links
  await prisma.customerMagicLink.deleteMany({
    where: { customerId: customer.id, usedAt: null },
  })

  const link = await prisma.customerMagicLink.create({
    data: {
      email:      customer.email ?? identifier,
      customerId: customer.id,
      expiresAt:  new Date(Date.now() + 15 * 60 * 1000), // 15 min
    },
  })

  // In production: send email. For demo: return the link directly.
  const verifyUrl = `/portal/auth/verify?token=${link.token}`

  return NextResponse.json({ success: true, demo: verifyUrl, name: customer.name })
}
