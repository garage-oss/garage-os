/**
 * Stripe integration — Checkout session creation + webhook verification.
 *
 * Toggle with FLAG_STRIPE_PAYMENTS=true + required env vars.
 * When disabled, the manual payment flow (mark-as-paid) remains active.
 */

import Stripe from 'stripe'
import { env } from './env'
import { logger } from './logger'

// ─── Singleton ────────────────────────────────────────────────────────────────

let _stripe: Stripe | null = null

function getStripe(): Stripe {
  if (!_stripe) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-04-22.dahlia',
    })
  }
  return _stripe
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateCheckoutOptions {
  token:       string   // PaymentLink.token — used as success/cancel query param
  amountILS:   number   // Amount in Israeli Shekels (will be converted to agorot)
  description: string
  customerEmail?: string
  orgName:     string
  baseUrl:     string   // e.g. "https://app.garageos.co.il"
}

export interface CheckoutResult {
  success: boolean
  url?:    string   // Stripe hosted page URL
  sessionId?: string
  error?:  string
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function isStripeEnabled(): boolean {
  return env.FLAG_STRIPE_PAYMENTS === 'true' &&
    !!env.STRIPE_SECRET_KEY &&
    !!env.STRIPE_PUBLISHABLE_KEY
}

/**
 * Create a Stripe Checkout session for a payment link.
 * Returns the hosted Stripe payment page URL.
 */
export async function createCheckoutSession(
  opts: CreateCheckoutOptions,
): Promise<CheckoutResult> {
  if (!isStripeEnabled()) {
    return { success: false, error: 'Stripe not enabled' }
  }

  try {
    const stripe = getStripe()

    const session = await stripe.checkout.sessions.create({
      mode:                'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency:     'ils',
            unit_amount:  Math.round(opts.amountILS * 100), // convert to agorot
            product_data: {
              name:        opts.description || `תשלום — ${opts.orgName}`,
              description: `${opts.orgName} | GarageOS`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email:     opts.customerEmail,
      success_url:        `${opts.baseUrl}/pay/${opts.token}?stripe=success`,
      cancel_url:         `${opts.baseUrl}/pay/${opts.token}?stripe=cancel`,
      metadata: {
        token:   opts.token,
        orgName: opts.orgName,
      },
      locale: 'auto',
    })

    logger.info('Stripe session created', { sessionId: session.id, token: opts.token })
    return { success: true, url: session.url!, sessionId: session.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    logger.error('Stripe session error', err instanceof Error ? err : new Error(msg), { token: opts.token })
    return { success: false, error: msg }
  }
}

/**
 * Verify a Stripe webhook signature and return the parsed event.
 * Throws if the signature is invalid.
 */
export function constructStripeEvent(
  rawBody: Buffer,
  signature: string,
): Stripe.Event {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set')
  }
  const stripe = getStripe()
  return stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
}

/** Extract the payment-link token from a Stripe Checkout session's metadata */
export function tokenFromSession(session: Stripe.Checkout.Session): string | null {
  return session.metadata?.token ?? null
}
