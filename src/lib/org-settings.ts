/**
 * Per-organisation settings stored as a JSON blob in Organization.settings.
 *
 * This allows pilot customers to customise behaviour without a full feature-flag
 * infrastructure. Settings layer on top of global feature flags (src/lib/flags.ts)
 * and the static RBAC matrix (src/lib/rbac.ts).
 *
 * Upgrade path: replace the JSON-field backend with a dedicated OrgSettings table
 * or a remote flag service (LaunchDarkly, Posthog) without touching call-sites.
 */

import { Prisma }   from '@prisma/client'
import { prisma }   from '@/lib/prisma'
import type { AppModule } from '@/lib/rbac'

// ─── Schema ───────────────────────────────────────────────────────────────────

export interface OrgSettings {
  /**
   * Modules disabled for this org.
   * Hides the nav item and blocks access to the module for all roles.
   * e.g. ['diagnostics'] disables AI Diagnostics for this org.
   */
  disabledModules?: AppModule[]

  /** Send notifications when part stock falls below threshold */
  notifyLowStock?: boolean
  /** Quantity at which a low-stock notification is triggered */
  lowStockThreshold?: number

  /** ISO 4217 currency code shown in prices */
  defaultCurrency?: string
  /** Prefix for auto-generated invoice numbers */
  invoicePrefix?: string
  /** Default hourly labour rate (ILS) */
  defaultLaborRate?: number

  /** Require manager approval before a work order moves to IN_PROGRESS */
  requireJobApproval?: boolean

  /**
   * Custom welcome message shown on the dashboard.
   * Useful for pilot orgs during onboarding.
   */
  welcomeMessage?: string
}

export const DEFAULT_ORG_SETTINGS: Required<OrgSettings> = {
  disabledModules:    [],
  notifyLowStock:     true,
  lowStockThreshold:  5,
  defaultCurrency:    'ILS',
  invoicePrefix:      'INV',
  defaultLaborRate:   150,
  requireJobApproval: false,
  welcomeMessage:     '',
}

// ─── Accessors ────────────────────────────────────────────────────────────────

export async function getOrgSettings(orgId: string): Promise<Required<OrgSettings>> {
  try {
    const org = await prisma.organization.findUnique({
      where:  { id: orgId },
      select: { settings: true },
    })
    if (!org) return DEFAULT_ORG_SETTINGS
    const stored = (org.settings ?? {}) as Partial<OrgSettings>
    return { ...DEFAULT_ORG_SETTINGS, ...stored }
  } catch {
    return DEFAULT_ORG_SETTINGS
  }
}

export async function updateOrgSettings(
  orgId:   string,
  updates: Partial<OrgSettings>,
): Promise<void> {
  const current = await getOrgSettings(orgId)
  const merged  = { ...current, ...updates }
  await prisma.organization.update({
    where: { id: orgId },
    data:  { settings: merged as Prisma.InputJsonValue },
  })
}

// ─── Module gating ────────────────────────────────────────────────────────────

/**
 * Returns true if the module is NOT in the org's disabled list.
 * Use this in server pages to block access at the data layer.
 */
export function isModuleEnabled(
  settings: OrgSettings,
  module:   AppModule,
): boolean {
  return !(settings.disabledModules ?? []).includes(module)
}

/**
 * Convenience: fetch settings and check a single module in one call.
 */
export async function checkModuleEnabled(
  orgId:  string,
  module: AppModule,
): Promise<boolean> {
  const settings = await getOrgSettings(orgId)
  return isModuleEnabled(settings, module)
}
