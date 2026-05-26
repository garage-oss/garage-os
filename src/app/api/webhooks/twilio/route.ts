/**
 * Twilio inbound WhatsApp webhook — POST /api/webhooks/twilio
 *
 * Twilio sends a POST with application/x-www-form-urlencoded body.
 * We log the inbound message and (future) trigger auto-replies.
 *
 * No auth guard — Twilio signs requests via X-Twilio-Signature header.
 * TODO: Validate Twilio signature for production hardening.
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseTwilioWebhook } from '@/lib/twilio'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const { from, body, waId, numMedia } = parseTwilioWebhook(formData)

    logger.info('Twilio inbound WhatsApp', { from, waId, numMedia, body: body.slice(0, 100) })

    // Find customer by phone (normalize: strip leading "+"972" or "0")
    const digits = from.replace(/\D/g, '')
    const localPhone = digits.startsWith('972')
      ? `0${digits.slice(3)}`
      : digits

    // Look up the customer across any org that has this phone
    const customer = await prisma.customer.findFirst({
      where: { phone: { in: [from, localPhone, `+${digits}`, `0${digits.slice(3)}`] } },
      include: { organization: { select: { id: true } } },
    })

    if (customer) {
      // Log inbound message
      await prisma.commLog.create({
        data: {
          organizationId: customer.organizationId,
          customerId:     customer.id,
          channel:        'WHATSAPP',
          direction:      'INBOUND',
          message:        body,
          recipientPhone: from,
        },
      })
      logger.info('Inbound message logged', { customerId: customer.id })
    }

    // Twilio expects a TwiML response (empty = no auto-reply)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      {
        status:  200,
        headers: { 'Content-Type': 'text/xml' },
      }
    )
  } catch (err) {
    logger.error('Twilio webhook error', err instanceof Error ? err : undefined, {
      msg: err instanceof Error ? err.message : 'unknown',
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
