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

// ─── Test mode ────────────────────────────────────────────────────────────────
// Enabled via CUSTOMER_PORTAL_TEST_MODE=true (works in any environment).
// The test phone always gets OTP TEST_OTP without real SMS or pilot-allowlist check.
export const TEST_PHONE = '0500000000'
export const TEST_OTP   = '123456'

export function isTestMode(): boolean {
  return process.env.CUSTOMER_PORTAL_TEST_MODE === 'true'
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

class InForuProvider implements SmsProvider {
  constructor(private username: string, private apiKey: string) {}

  async sendOtp(phone: string, code: string): Promise<{ success: boolean; error?: string }> {
    const message = `קוד הכניסה שלך ל-GarageOS: ${code}. תקף ל-5 דקות.`
    // Normalize to Israeli international format
    const digits = phone.replace(/\D/g, '')
    const intl = digits.startsWith('972') ? digits : digits.startsWith('0') ? '972' + digits.slice(1) : '972' + digits

    const xml = `<Inforu><User><Username>${this.username}</Username><ApiKey>${this.apiKey}</ApiKey></User><Content><SmsMessage>${message}</SmsMessage></Content><Recipients><PhoneNumber>${intl}</PhoneNumber></Recipients><Settings><DefaultRegion>IL</DefaultRegion></Settings></Inforu>`

    try {
      const res = await fetch('https://api.inforu.co.il/SendMessageXml.ashx', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `InforuXML=${encodeURIComponent(xml)}`,
      })
      const text = await res.text()
      // Inforu returns XML; success when Status="1"
      if (text.includes('Status="1"') || text.includes('<Status>1</Status>')) {
        return { success: true }
      }
      console.error('[SMS Inforu] unexpected response:', text)
      return { success: false, error: text }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
}

class Provider019 implements SmsProvider {
  constructor(private username: string, private password: string) {}

  async sendOtp(phone: string, code: string): Promise<{ success: boolean; error?: string }> {
    const message = `קוד הכניסה שלך ל-GarageOS: ${code}. תקף ל-5 דקות.`
    const digits = phone.replace(/\D/g, '')
    const intl = digits.startsWith('972') ? digits : digits.startsWith('0') ? '972' + digits.slice(1) : '972' + digits

    try {
      const params = new URLSearchParams({
        UN: this.username,
        PW: this.password,
        SenderID: 'GarageOS',
        PhoneNumber: intl,
        Text: message,
      })
      const res  = await fetch(`https://www.d-messaging.co.il/Api/SendSms/?${params}`)
      const text = await res.text()
      if (res.ok && !text.startsWith('-')) return { success: true }
      return { success: false, error: text }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
}

class VonageProvider implements SmsProvider {
  constructor(
    private apiKey: string,
    private apiSecret: string,
    private from: string,
  ) {}

  async sendOtp(phone: string, code: string): Promise<{ success: boolean; error?: string }> {
    const message = `קוד הכניסה שלך ל-GarageOS: ${code}. תקף ל-5 דקות.`
    const digits = phone.replace(/\D/g, '')
    const to = digits.startsWith('972') ? digits : digits.startsWith('0') ? '972' + digits.slice(1) : '972' + digits

    try {
      const res = await fetch('https://rest.nexmo.com/sms/json', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ api_key: this.apiKey, api_secret: this.apiSecret, from: this.from, to, text: message }),
      })
      const data = await res.json() as { messages?: Array<{ status: string }> }
      if (data.messages?.[0]?.status === '0') return { success: true }
      return { success: false, error: JSON.stringify(data) }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
}

function buildProvider(): SmsProvider | null {
  if (process.env.SMS_INFORU_USERNAME && process.env.SMS_INFORU_API_KEY) {
    return new InForuProvider(process.env.SMS_INFORU_USERNAME, process.env.SMS_INFORU_API_KEY)
  }
  if (process.env.SMS_019_USERNAME && process.env.SMS_019_PASSWORD) {
    return new Provider019(process.env.SMS_019_USERNAME, process.env.SMS_019_PASSWORD)
  }
  if (process.env.SMS_VONAGE_API_KEY && process.env.SMS_VONAGE_API_SECRET) {
    return new VonageProvider(
      process.env.SMS_VONAGE_API_KEY,
      process.env.SMS_VONAGE_API_SECRET,
      process.env.SMS_VONAGE_FROM ?? 'GarageOS',
    )
  }
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
