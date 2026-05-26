/**
 * Feature flags — controlled by environment variables.
 *
 * Default values are the safe production defaults (conservative).
 * In development, override in .env.local.
 *
 * Upgrade path: replace the env-var backend with LaunchDarkly, Posthog
 * feature flags, or Vercel Edge Config without changing call-sites.
 *
 * Usage:
 *   import { flags } from '@/lib/flags'
 *   if (flags.AI_DIAGNOSTICS) { ... }
 */

import { PlanType }    from '@prisma/client'
import { PLAN_LIMITS } from '@/lib/billing'

// ─── Env-var flag reader ──────────────────────────────────────────────────────

function flag(key: string, defaultValue: boolean): boolean {
  const val = process.env[key]
  if (val === undefined || val === '') return defaultValue
  return val !== 'false' && val !== '0'
}

// ─── Global feature flags ─────────────────────────────────────────────────────
//
// Evaluated once at process start. Change env vars + restart to take effect.
// For hot-reloadable flags, integrate a remote flag provider.

export const flags = {
  /** AI-powered diagnostics tab */
  AI_DIAGNOSTICS:   flag('FLAG_AI_DIAGNOSTICS',   true),
  /** Full audit log page */
  AUDIT_LOG:        flag('FLAG_AUDIT_LOG',         true),
  /** Avatar / profile photo upload */
  AVATAR_UPLOAD:    flag('FLAG_AVATAR_UPLOAD',     true),
  /** Advanced reporting dashboard (placeholder) */
  ADVANCED_REPORTS: flag('FLAG_ADVANCED_REPORTS',  false),
  /** Billing / subscription self-serve portal */
  BILLING_PORTAL:   flag('FLAG_BILLING_PORTAL',    false),
  /** Experimental mobile PWA install prompt */
  MOBILE_APP:       flag('FLAG_MOBILE_APP',        true),
} as const

export type FeatureFlag = keyof typeof flags

export function isEnabled(f: FeatureFlag): boolean {
  return flags[f]
}

// ─── Plan-gated features ──────────────────────────────────────────────────────
//
// Combines global flag + plan requirement. A feature must be globally enabled
// AND the org must be on a plan that includes it.

export type PlanFeature = {
  [K in keyof typeof PLAN_LIMITS[PlanType]]: (typeof PLAN_LIMITS[PlanType])[K] extends boolean
    ? K
    : never
}[keyof typeof PLAN_LIMITS[PlanType]]

export function isPlanFeatureEnabled(plan: PlanType, feature: PlanFeature): boolean {
  return !!PLAN_LIMITS[plan][feature]
}

// ─── Gate helpers (for server components / actions) ───────────────────────────

/**
 * Returns true if the feature flag is on AND the org's plan supports it.
 */
export function canUseFeature(
  flag:    FeatureFlag,
  plan:    PlanType,
  feature: PlanFeature,
): boolean {
  return isEnabled(flag) && isPlanFeatureEnabled(plan, feature)
}
