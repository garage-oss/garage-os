import { createHmac, timingSafeEqual } from 'crypto'

// ─── OTP secret ───────────────────────────────────────────────────────────────
// In production set OTP_SECRET to a random 32+ byte hex string:
//   openssl rand -hex 32
const OTP_SECRET = process.env.OTP_SECRET ?? 'dev-otp-secret-change-in-production'

// ─── Demo mode ────────────────────────────────────────────────────────────────
// Only active when CUSTOMER_PORTAL_DEMO_MODE=true AND NODE_ENV !== production.
// Never enable in production — the build will still compile but the flag is
// ignored at runtime so real SMS is always used.
export function isDemoMode(): boolean {
  return (
    process.env.CUSTOMER_PORTAL_DEMO_MODE === 'true' &&
    process.env.NODE_ENV !== 'production'
  )
}

// ─── OTP hashing ─────────────────────────────────────────────────────────────
// Stores HMAC-SHA256(secret, "phone:code") — never the plaintext code.
// The secret makes stored hashes useless without the key even if the DB leaks.

export function hashOtpCode(phone: string, code: string): string {
  return createHmac('sha256', OTP_SECRET)
    .update(`${phone}:${code}`)
    .digest('hex')
}

export function verifyOtpCode(phone: string, code: string, storedHash: string): boolean {
  const expected = hashOtpCode(phone, code)
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(storedHash, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// ─── SMS provider interface ───────────────────────────────────────────────────

export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<{ success: boolean; error?: string }>
}

class DemoSmsProvider implements SmsProvider {
  async sendOtp(_phone: string, _code: string) {
    // In demo mode the code is shown in the UI; no real send needed.
    return { success: true }
  }
}

// Swap in a real Israeli SMS provider here.
// Supported providers (uncomment and configure the relevant one):
//
// Inforu (recommended for Israel):
//   SMS_INFORU_USERNAME + SMS_INFORU_API_KEY
//
// 019 SMS / D-Messaging:
//   SMS_019_USERNAME + SMS_019_PASSWORD
//
// Vonage (formerly Nexmo):
//   SMS_VONAGE_API_KEY + SMS_VONAGE_API_SECRET + SMS_VONAGE_FROM
//
function buildProvider(): SmsProvider | null {
  // if (process.env.SMS_INFORU_USERNAME && process.env.SMS_INFORU_API_KEY) {
  //   return new InForuProvider(process.env.SMS_INFORU_USERNAME, process.env.SMS_INFORU_API_KEY)
  // }
  return null
}

export function getSmsProvider(): SmsProvider {
  return buildProvider() ?? new DemoSmsProvider()
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function generateOtpCode(): string {
  // Cryptographically random 6-digit code
  const { randomInt } = require('crypto') as typeof import('crypto')
  return String(randomInt(100000, 1000000))
}

export function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, '')
}

/** All plausible stored formats for an Israeli mobile number */
export function phoneVariants(normalized: string): string[] {
  const withZero = normalized.startsWith('0') ? normalized : '0' + normalized.slice(-9)
  const bare9    = normalized.slice(-9)
  const intl     = '972' + bare9
  const dash7    = withZero.slice(0, 3) + '-' + withZero.slice(3)            // 050-1234567
  const dash34   = withZero.slice(0, 3) + '-' + withZero.slice(3, 6) + '-' + withZero.slice(6) // 050-123-4567
  const plus972  = '+972' + bare9
  const seen = new Set<string>()
  const result: string[] = []
  for (const v of [normalized, withZero, bare9, intl, dash7, dash34, plus972]) {
    if (!seen.has(v)) { seen.add(v); result.push(v) }
  }
  return result
}

export function toWhatsAppUrl(phone: string): string {
  const d   = normalizePhone(phone)
  const intl = d.startsWith('972') ? d : d.startsWith('0') ? '972' + d.slice(1) : '972' + d
  return `https://wa.me/${intl}`
}

/** Send an arbitrary (non-OTP) SMS message. Returns success/error. */
export async function sendSmsMessage(
  phone: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) {
    console.log(`[Demo SMS] To: ${phone}\n${message}`)
    return { success: true }
  }
  // TODO: extend SmsProvider with sendMessage() when a real provider is wired up
  console.warn('[SMS] sendSmsMessage: no provider configured')
  return { success: false, error: 'ספק SMS לא מוגדר' }
}
