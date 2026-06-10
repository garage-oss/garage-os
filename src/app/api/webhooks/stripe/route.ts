/**
 * Stripe webhook — POST /api/webhooks/stripe
 *
 * Handles:
 *   checkout.session.completed → mark payment link as paid
 *
 * Stripe sends raw body — MUST NOT use body parsers (bodyParser: false).
 * The raw buffer is needed to verify the webhook signature.
 */

import { NextRequest, NextResponse } from 'next/server'
import { constructStripeEvent, tokenFromSession } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import type Stripe from 'stripe'

export const dynamic = 'force-dynamic'
// Note: App Router always provides the raw body via req.arrayBuffer() —
// the Pages Router `config.api.bodyParser` export is not used here.

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let rawBody: Buffer
  try {
    rawBody = Buffer.from(await req.arrayBuffer())
  } catch {
    return NextResponse.json({ error: 'Failed to read body' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = constructStripeEvent(rawBody, signature)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    logger.error('Stripe webhook signature invalid', err instanceof Error ? err : new Error(msg), { msg })
    return NextResponse.json({ error: `Webhook error: ${msg}` }, { status: 400 })
  }

  logger.info('Stripe webhook received', { type: event.type, id: event.id })

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }

      case 'checkout.session.expired':
        logger.info('Stripe checkout expired', { sessionId: (event.data.object as Stripe.Checkout.Session).id })
        break

      default:
        // Ignore unhandled event types
        logger.info('Stripe event ignored', { type: event.type })
    }
  } catch (err) {
    logger.error('Stripe webhook handler error', err instanceof Error ? err : undefined, {
      type: event.type,
      msg:  err instanceof Error ? err.message : 'unknown',
    })
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const token = tokenFromSession(session)
  if (!token) {
    logger.warn('Stripe session has no token metadata', { sessionId: session.id })
    return
  }

  const link = await prisma.paymentLink.findUnique({
    where:   { token },
    include: { invoice: true, workOrder: true },
  })

  if (!link) {
    logger.warn('Payment link not found for Stripe session', { token })
    return
  }

  if (link.paidAt) {
    logger.info('Payment already marked as paid', { token })
    return
  }

  const now = new Date()

  // Mark link as paid and store Stripe IDs
  await prisma.paymentLink.update({
    where: { token },
    data:  {
      paidAt:              now,
      stripeSessionId:     session.id,
      stripePaymentIntent: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : null,
    },
  })

  // Update invoice status if linked
  if (link.invoiceId) {
    await prisma.invoice.update({
      where: { id: link.invoiceId },
      data:  { status: 'PAID', updatedAt: now },
    })
  }

  // Update WO status to COMPLETED if still open
  if (link.workOrderId && link.workOrder?.status !== 'COMPLETED') {
    await prisma.workOrder.update({
      where: { id: link.workOrderId },
      data:  { status: 'COMPLETED', completedAt: now },
    })
  }

  logger.info('Payment confirmed via Stripe', {
    token,
    sessionId: session.id,
    amount:    session.amount_total,
  })
}
