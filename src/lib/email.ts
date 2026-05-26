/**
 * Email sending via Nodemailer (SMTP).
 *
 * Configure via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 * Falls back gracefully (logs only) when not configured.
 *
 * Supports HTML + plain-text variants for all transactional emails.
 */

import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { env } from './env'
import { logger } from './logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to:      string | string[]
  subject: string
  html:    string
  text?:   string   // auto-derived from html if omitted
  replyTo?: string
  cc?:     string | string[]
}

export interface EmailResult {
  success:  boolean
  messageId?: string
  error?:   string
}

// ─── Transport ────────────────────────────────────────────────────────────────

let _transport: Transporter | null = null

function getTransport(): Transporter {
  if (!_transport) {
    const secure = env.SMTP_SECURE === 'true'
    _transport = nodemailer.createTransport({
      host:   env.SMTP_HOST,
      port:   env.SMTP_PORT,
      secure,
      auth:   env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
      tls: { rejectUnauthorized: env.NODE_ENV === 'production' },
    })
  }
  return _transport
}

export function isEmailEnabled(): boolean {
  return !!env.SMTP_HOST && !!env.SMTP_FROM
}

// ─── HTML → plain text (minimal) ─────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Send a transactional email. Returns { success: false } when SMTP is not configured. */
export async function sendEmail(opts: SendEmailOptions): Promise<EmailResult> {
  if (!isEmailEnabled()) {
    logger.warn('Email not configured — skipping send', { to: opts.to, subject: opts.subject })
    return { success: false, error: 'SMTP not configured' }
  }

  try {
    const transport = getTransport()
    const info = await transport.sendMail({
      from:    env.SMTP_FROM,
      to:      Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
      subject: opts.subject,
      html:    opts.html,
      text:    opts.text ?? htmlToText(opts.html),
      replyTo: opts.replyTo,
      cc:      opts.cc,
    })

    logger.info('Email sent', { messageId: info.messageId, to: opts.to })
    return { success: true, messageId: info.messageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    logger.error('Email send failed', err instanceof Error ? err : new Error(msg), { to: opts.to, subject: opts.subject })
    return { success: false, error: msg }
  }
}

// ─── Template helpers ─────────────────────────────────────────────────────────

function baseLayout(content: string, orgName: string): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin:0; padding:0; background:#f4f5f7; font-family:Arial,sans-serif; direction:rtl; }
    .wrap { max-width:600px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; }
    .header { background:#6366f1; padding:24px 32px; color:#fff; }
    .header h1 { margin:0; font-size:20px; }
    .body { padding:32px; color:#1a1d27; line-height:1.6; }
    .footer { padding:16px 32px; background:#f4f5f7; color:#8892a4; font-size:12px; text-align:center; }
    .btn { display:inline-block; background:#6366f1; color:#fff!important; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:bold; margin-top:16px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header"><h1>${orgName}</h1></div>
    <div class="body">${content}</div>
    <div class="footer">הודעה זו נשלחה אוטומטית ממערכת GarageOS</div>
  </div>
</body>
</html>`
}

export function workOrderReadyEmail(opts: {
  orgName:       string
  customerName:  string
  plate:         string
  makeModel:     string
  paymentUrl?:   string
}): { subject: string; html: string } {
  const subject = `הרכב שלך מוכן לאיסוף — ${opts.plate}`
  const html = baseLayout(`
    <p>שלום ${opts.customerName},</p>
    <p>הרכב שלך <strong>${opts.makeModel} (${opts.plate})</strong> סיים טיפול ומוכן לאיסוף.</p>
    ${opts.paymentUrl ? `<p><a class="btn" href="${opts.paymentUrl}">לתשלום מקוון</a></p>` : ''}
    <p>נשמח לראותך בקרוב!</p>
  `, opts.orgName)
  return { subject, html }
}

export function paymentConfirmedEmail(opts: {
  orgName:      string
  customerName: string
  amount:       number
  plate:        string
}): { subject: string; html: string } {
  const subject = `אישור תשלום — ${opts.plate}`
  const html = baseLayout(`
    <p>שלום ${opts.customerName},</p>
    <p>קיבלנו את תשלומך בסך <strong>₪${opts.amount.toLocaleString('he-IL')}</strong> עבור הרכב <strong>${opts.plate}</strong>.</p>
    <p>תודה!</p>
  `, opts.orgName)
  return { subject, html }
}

export function quoteReadyEmail(opts: {
  orgName:      string
  customerName: string
  total:        number
  quoteUrl:     string
}): { subject: string; html: string } {
  const subject = `הצעת מחיר ממוכנה — ${opts.orgName}`
  const html = baseLayout(`
    <p>שלום ${opts.customerName},</p>
    <p>הכנו עבורך הצעת מחיר בסך <strong>₪${opts.total.toLocaleString('he-IL')}</strong>.</p>
    <a class="btn" href="${opts.quoteUrl}">לצפייה ואישור ההצעה</a>
  `, opts.orgName)
  return { subject, html }
}
