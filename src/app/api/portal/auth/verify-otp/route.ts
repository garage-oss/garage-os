import { NextRequest, NextResponse }                    from 'next/server'
import { prisma }                                       from '@/lib/prisma'
import { normalizePhone, phoneVariants, verifyOtpCode,
         isTestMode, TEST_PHONE, TEST_OTP }             from '@/lib/sms'
import { createCustomerSession, getSessionCookieConfig } from '@/lib/customer-auth'
import { checkRateLimit }                               from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const WINDOW_MS  = 15 * 60 * 1000  // 15-minute window
const MAX_TRIES  = 5                // max verify attempts per phone per window
const LOCK_AFTER = 5                // OTP-level hard lock after N failed attempts

// Generic errors — no information about whether the phone is known
const ERR_INVALID = { error: 'הקוד שגוי או פג תוקף' }
const ERR_LOCKED  = { error: 'יותר מדי ניסיונות — בקש קוד חדש' }

export async function POST(req: NextRequest) {
  const body       = await req.json().catch(() => ({})) as { phone?: string; code?: string }
  const normalized = normalizePhone(body.phone ?? '')
  const code       = body.code?.replace(/\s/g, '') ?? ''

  if (!normalized || !code || code.length !== 6) {
    return NextResponse.json(ERR_INVALID, { status: 401 })
  }

  // ── Rate limit verify attempts per phone ───────────────────────────────────
  const rl = checkRateLimit(`otp:verify:${normalized}`, MAX_TRIES, WINDOW_MS)
  if (!rl.allowed) {
    return NextResponse.json(ERR_LOCKED, { status: 429 })
  }

  // ── Load OTP ───────────────────────────────────────────────────────────────
  const otp = await prisma.customerOtp.findFirst({
    where:   { phone: normalized, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })

  if (!otp || otp.lockedAt) {
    return NextResponse.json(
      otp?.lockedAt ? ERR_LOCKED : ERR_INVALID,
      { status: 401 }
    )
  }

  // ── Verify hash ────────────────────────────────────────────────────────────
  const valid = verifyOtpCode(normalized, code, otp.codeHash)

  if (!valid) {
    const newAttempts = otp.attempts + 1
    await prisma.customerOtp.update({
      where: { id: otp.id },
      data: {
        attempts: newAttempts,
        lockedAt: newAttempts >= LOCK_AFTER ? new Date() : undefined,
      },
    })
    return NextResponse.json(
      newAttempts >= LOCK_AFTER ? ERR_LOCKED : ERR_INVALID,
      { status: 401 }
    )
  }

  // ── Test mode: create/find a dedicated test customer and skip real lookup ──
  if (isTestMode() && normalized === normalizePhone(TEST_PHONE)) {
    await prisma.customerOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } })

    const firstOrg = await prisma.organization.findFirst({ select: { id: true } })
    const orgId    = firstOrg?.id ?? ''

    // Find or create the test customer (idempotent across logins)
    let testCustomer = await prisma.customer.findFirst({
      where:  { importSource: 'test', importId: 'test-portal-user' },
      select: { id: true },
    })

    if (!testCustomer) {
      testCustomer = await prisma.customer.create({
        data: {
          name:           'לקוח בדיקה',
          phone:          TEST_PHONE,
          organizationId: orgId,
          importSource:   'test',
          importId:       'test-portal-user',
        },
        select: { id: true },
      })
      // Give the test customer one vehicle so the full booking flow is testable
      await prisma.vehicle.create({
        data: {
          customerId:     testCustomer.id,
          organizationId: orgId,
          plate:          '12-345-67',
          make:           'טויוטה',
          model:          'קאמרי',
          year:           2020,
          mileage:        50000,
        },
      })
    }

    const sessionToken = await createCustomerSession(testCustomer.id)
    const cfg          = getSessionCookieConfig(sessionToken)
    const res          = NextResponse.json({ success: true })
    res.cookies.set(cfg.name, cfg.value, {
      httpOnly: cfg.httpOnly, secure: cfg.secure,
      sameSite: cfg.sameSite, path:   cfg.path, maxAge: cfg.maxAge,
    })
    return res
  }

  // ── Find customer — check for duplicate phones ────────────────────────────
  const variants  = phoneVariants(normalized)
  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        ...variants.map(v => ({ phone:  v })),
        ...variants.map(v => ({ mobile: v })),
      ],
    },
    select: { id: true, name: true, organizationId: true },
    take:   5,
  })

  if (customers.length === 0) {
    // Consume the OTP so it can't be retried, but return a generic error
    await prisma.customerOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } })
    return NextResponse.json(ERR_INVALID, { status: 401 })
  }

  if (customers.length > 1) {
    // Duplicate phone — require garage assistance (do not log which customers)
    await prisma.customerOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } })
    return NextResponse.json(
      { error: 'מספר הטלפון קיים ביותר מלקוח אחד — אנא פנה למוסך לבירור' },
      { status: 409 }
    )
  }

  const customer = customers[0]

  // ── Mark OTP used ─────────────────────────────────────────────────────────
  await prisma.customerOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } })

  // ── Create session ────────────────────────────────────────────────────────
  const sessionToken = await createCustomerSession(customer.id)
  const cfg          = getSessionCookieConfig(sessionToken)

  const res = NextResponse.json({ success: true })
  res.cookies.set(cfg.name, cfg.value, {
    httpOnly: cfg.httpOnly,
    secure:   cfg.secure,
    sameSite: cfg.sameSite,
    path:     cfg.path,
    maxAge:   cfg.maxAge,
  })
  return res
}
