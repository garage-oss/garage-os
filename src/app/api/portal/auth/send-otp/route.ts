import { NextRequest, NextResponse }          from 'next/server'
import { prisma }                             from '@/lib/prisma'
import { normalizePhone, phoneVariants,
         hashOtpCode, generateOtpCode,
         getSmsProvider, isDemoMode,
         isTestMode, TEST_PHONE, TEST_OTP }   from '@/lib/sms'
import { checkRateLimit }                     from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const WINDOW_MS = 15 * 60 * 1000   // 15 minutes
const SMS_LIMIT = 3                 // max OTP sends per phone per window
const IP_LIMIT  = 10                // looser per-IP bound (shared NAT / wifi)

// Generic response — never reveals whether the phone exists in the system
const GENERIC = { success: true, message: 'אם המספר קיים במערכת, נשלח אליו קוד' }

export async function POST(req: NextRequest) {
  const body       = await req.json().catch(() => ({})) as { phone?: string }
  const normalized = normalizePhone(body.phone ?? '')

  if (normalized.length < 9 || normalized.length > 12) {
    return NextResponse.json({ error: 'מספר טלפון לא תקין' }, { status: 400 })
  }

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const ipRaw   = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
               ?? req.headers.get('x-real-ip')
               ?? 'unknown'

  const phoneRL = checkRateLimit(`sms:phone:${normalized}`, SMS_LIMIT, WINDOW_MS)
  const ipRL    = checkRateLimit(`sms:ip:${ipRaw}`,         IP_LIMIT,  WINDOW_MS)

  if (!phoneRL.allowed || !ipRL.allowed) {
    return NextResponse.json(
      { error: 'יותר מדי בקשות — נסה שוב בעוד 15 דקות' },
      { status: 429 }
    )
  }

  const demo      = isDemoMode()
  const testPhone = isTestMode() && normalized === normalizePhone(TEST_PHONE)

  // ── Pilot allowlist check ──────────────────────────────────────────────────
  // Skipped in demo mode and for the designated test phone in test mode.
  if (!demo && !testPhone) {
    const variants = phoneVariants(normalized)
    const pilotOk  = await prisma.customerPilot.findFirst({
      where: {
        disabledAt: null,
        customer: {
          OR: [
            ...variants.map(v => ({ phone:  v })),
            ...variants.map(v => ({ mobile: v })),
          ],
        },
      },
    })

    if (!pilotOk) {
      // Do not reveal that the phone is not in the pilot — return generic OK
      return NextResponse.json(GENERIC)
    }
  }

  // ── Generate and hash OTP ─────────────────────────────────────────────────
  // Demo: always 123456 (shown on screen). Test phone: always TEST_OTP (123456).
  const code     = testPhone ? TEST_OTP : demo ? '123456' : generateOtpCode()
  const codeHash = hashOtpCode(normalized, code)

  await prisma.customerOtp.deleteMany({ where: { phone: normalized } })
  await prisma.customerOtp.create({
    data: {
      phone:    normalized,
      codeHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  })

  // ── Send SMS (skipped in demo mode and for test phone) ────────────────────
  if (!demo && !testPhone) {
    const result = await getSmsProvider().sendOtp(normalized, code)
    if (!result.success) {
      console.error('[send-otp] SMS provider error:', result.error)
      return NextResponse.json({ error: 'שגיאה בשליחת SMS — נסה שוב' }, { status: 502 })
    }
  }

  // Expose OTP in response for demo/test so it can be shown on screen.
  const payload: Record<string, unknown> = { ...GENERIC }
  if (demo || testPhone) payload.demo = code

  return NextResponse.json(payload)
}
