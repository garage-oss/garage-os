/**
 * Twilio integration — WhatsApp & SMS sending via REST API.
 *
 * Uses plain fetch (no SDK) to keep the bundle lean.
 * Toggle with FLAG_TWILIO_WHATSAPP=true + required env vars.
 *
 * When disabled, falls back silently so callers can still use wa.me links.
 */

import { env } from './env'
import { logger } from './logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TwilioMessageResult {
  success:   boolean
  sid?:      string
  error?:    string
}

export interface SendWhatsAppOptions {
  to:      string   // E.164 phone, e.g. "+972501234567"
  body:    string
}

export interface SendSMSOptions {
  to:      string
  body:    string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('972')) return `+${digits}`
  if (digits.startsWith('0'))   return `+972${digits.slice(1)}`
  return `+${digits}`
}

function twilioAuthHeader(): string {
  const creds = `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`
  return `Basic ${Buffer.from(creds).toString('base64')}`
}

async function sendMessage(
  from: string,
  to:   string,
  body: string,
): Promise<TwilioMessageResult> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`

  const params = new URLSearchParams({ From: from, To: to, Body: body })

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        Authorization:  twilioAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const data = await res.json() as { sid?: string; message?: string; error_message?: string }

    if (!res.ok) {
      const msg = data.message ?? data.error_message ?? `HTTP ${res.status}`
      logger.error('Twilio send failed', new Error(msg), { to })
      return { success: false, error: msg }
    }

    logger.info('Twilio message sent', { sid: data.sid, to })
    return { success: true, sid: data.sid }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    logger.error('Twilio fetch error', err instanceof Error ? err : new Error(msg), { to })
    return { success: false, error: msg }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns true if Twilio WhatsApp is enabled and configured */
export function isTwilioEnabled(): boolean {
  return env.FLAG_TWILIO_WHATSAPP === 'true' &&
    !!env.TWILIO_ACCOUNT_SID &&
    !!env.TWILIO_AUTH_TOKEN &&
    !!env.TWILIO_WHATSAPP_FROM
}

/**
 * Send a WhatsApp message via Twilio.
 * Returns { success: false } with no throw when Twilio is disabled.
 */
export async function sendWhatsApp({
  to,
  body,
}: SendWhatsAppOptions): Promise<TwilioMessageResult> {
  if (!isTwilioEnabled()) {
    return { success: false, error: 'Twilio WhatsApp not enabled' }
  }

  const waTo   = `whatsapp:${toE164(to)}`
  const waFrom = env.TWILIO_WHATSAPP_FROM!

  return sendMessage(waFrom, waTo, body)
}

/**
 * Send an SMS via Twilio.
 * Note: Twilio SMS requires a separate non-WhatsApp number.
 */
export async function sendSMS({
  to,
  body,
}: SendSMSOptions): Promise<TwilioMessageResult> {
  if (!isTwilioEnabled()) {
    return { success: false, error: 'Twilio not enabled' }
  }

  // SMS sender: use phone number version (strip "whatsapp:" prefix if present)
  const from = (env.TWILIO_WHATSAPP_FROM ?? '').replace(/^whatsapp:/, '')

  return sendMessage(from, toE164(to), body)
}

/** Parse incoming Twilio webhook body (application/x-www-form-urlencoded) */
export function parseTwilioWebhook(formData: FormData): {
  from:    string
  body:    string
  waId:    string
  numMedia: number
} {
  const raw     = formData.get('From')?.toString() ?? ''
  const from    = raw.replace(/^whatsapp:/, '')
  const body    = formData.get('Body')?.toString() ?? ''
  const waId    = formData.get('WaId')?.toString() ?? ''
  const numMedia = parseInt(formData.get('NumMedia')?.toString() ?? '0', 10)

  return { from, body, waId, numMedia }
}
