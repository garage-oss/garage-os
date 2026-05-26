/**
 * Billing & subscription utilities.
 *
 * Current implementation uses the Organization.plan field only.
 * When Stripe is integrated:
 *   1. npm install stripe
 *   2. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to env
 *   3. Implement createCheckoutSession(), createPortalSession(), handleWebhook()
 *   4. Sync plan changes via Stripe webhooks → updateOrgPlan()
 */

import { PlanType } from '@prisma/client'
import { prisma }   from '@/lib/prisma'

// ─── Plan feature matrix ──────────────────────────────────────────────────────

export interface PlanLimits {
  /** Max team members. -1 = unlimited */
  maxMembers:         number
  /** Max vehicles tracked. -1 = unlimited */
  maxVehicles:        number
  /** Max work orders per month. -1 = unlimited */
  maxWorkOrdersMonth: number
  /** Max file storage in MB. -1 = unlimited */
  maxStorageMb:       number
  hasAIDiagnostics:   boolean
  hasAuditLog:        boolean
  hasAdvancedReports: boolean
  hasCustomBranding:  boolean
  hasPrioritySupport: boolean
  hasApiAccess:       boolean
  /** Free trial days when org is first created. 0 = no trial */
  trialDays:          number
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  FREE: {
    maxMembers:         3,
    maxVehicles:        50,
    maxWorkOrdersMonth: 30,
    maxStorageMb:       500,
    hasAIDiagnostics:   false,
    hasAuditLog:        false,
    hasAdvancedReports: false,
    hasCustomBranding:  false,
    hasPrioritySupport: false,
    hasApiAccess:       false,
    trialDays:          14,
  },
  PRO: {
    maxMembers:         15,
    maxVehicles:        500,
    maxWorkOrdersMonth: -1,
    maxStorageMb:       10_000,
    hasAIDiagnostics:   true,
    hasAuditLog:        true,
    hasAdvancedReports: true,
    hasCustomBranding:  false,
    hasPrioritySupport: false,
    hasApiAccess:       false,
    trialDays:          14,
  },
  ENTERPRISE: {
    maxMembers:         -1,
    maxVehicles:        -1,
    maxWorkOrdersMonth: -1,
    maxStorageMb:       -1,
    hasAIDiagnostics:   true,
    hasAuditLog:        true,
    hasAdvancedReports: true,
    hasCustomBranding:  true,
    hasPrioritySupport: true,
    hasApiAccess:       true,
    trialDays:          30,
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if `current` is within the plan limit */
export function withinLimit(current: number, limit: number): boolean {
  return limit === -1 || current < limit
}

/** Returns true if a plan feature is enabled */
export function planHasFeature(plan: PlanType, feature: keyof PlanLimits): boolean {
  const val = PLAN_LIMITS[plan][feature]
  return typeof val === 'boolean' ? val : (val as number) !== 0
}

// ─── Trial management ─────────────────────────────────────────────────────────

/**
 * Checks whether the org's trial period has expired.
 * Returns false if trialEndsAt is null (org converted or never on trial).
 */
export async function isTrialExpired(orgId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where:  { id: orgId },
    select: { trialEndsAt: true, plan: true },
  })
  if (!org || !org.trialEndsAt) return false
  if (org.plan !== 'FREE') return false           // paid plans ignore trial
  return new Date() > org.trialEndsAt
}

/**
 * Returns how many trial days remain, or null if not on trial.
 */
export async function trialDaysRemaining(orgId: string): Promise<number | null> {
  const org = await prisma.organization.findUnique({
    where:  { id: orgId },
    select: { trialEndsAt: true, plan: true },
  })
  if (!org?.trialEndsAt || org.plan !== 'FREE') return null
  const ms = org.trialEndsAt.getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

/**
 * Activates a free trial for a newly created org.
 * Call once from the onboarding flow.
 */
export async function activateTrial(orgId: string): Promise<void> {
  const days = PLAN_LIMITS.FREE.trialDays
  if (days === 0) return

  await prisma.organization.update({
    where: { id: orgId },
    data:  { trialEndsAt: new Date(Date.now() + days * 86_400_000) },
  })
}

// ─── Stripe placeholders ──────────────────────────────────────────────────────
//
// TODO: implement these when Stripe is integrated
//
// export async function createCheckoutSession(orgId: string, plan: 'PRO' | 'ENTERPRISE'): Promise<string> {
//   const stripe = new Stripe(env.STRIPE_SECRET_KEY)
//   const org    = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })
//   const session = await stripe.checkout.sessions.create({
//     mode:        'subscription',
//     line_items:  [{ price: STRIPE_PRICE_IDS[plan], quantity: 1 }],
//     success_url: `${env.NEXTAUTH_URL}/dashboard/settings/billing?success=1`,
//     cancel_url:  `${env.NEXTAUTH_URL}/dashboard/settings/billing`,
//     customer_email: org.billingEmail ?? undefined,
//     metadata:    { orgId },
//   })
//   return session.url!
// }
//
// export async function handleWebhook(body: string, sig: string): Promise<void> {
//   const event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET)
//   // Handle customer.subscription.updated / deleted / ...
// }
