import { cache } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'
import { redirect } from 'next/navigation'
import { MemberRole, PlanType } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrgContext = {
  orgId: string
  orgName: string
  orgSlug: string
  orgPlan: PlanType
  memberRole: MemberRole
  userId: string
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

/** Per-request memoised org lookup — safe to call from multiple server components. */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: {
      organization: { select: { id: true, name: true, slug: true, plan: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (!membership) return null

  return {
    orgId: membership.organizationId,
    orgName: membership.organization.name,
    orgSlug: membership.organization.slug,
    orgPlan: membership.organization.plan,
    memberRole: membership.role,
    userId: session.user.id,
  }
})

/** Redirect to /onboarding if user has no org. Use in dashboard server components & actions. */
export async function requireOrg(): Promise<OrgContext> {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/onboarding')
  return ctx
}

// ─── Team helpers ─────────────────────────────────────────────────────────────

export async function getOrgMembers(orgId: string) {
  return prisma.membership.findMany({
    where: { organizationId: orgId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  })
}

export async function getOrgInvitations(orgId: string) {
  return prisma.invitation.findMany({
    where: { organizationId: orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
}

// ─── Plan limits ──────────────────────────────────────────────────────────────

const PLAN_LIMITS: Record<PlanType, Record<string, number>> = {
  FREE:       { members: 3,  customers: 50,  workOrders: 200 },
  PRO:        { members: 15, customers: -1,  workOrders: -1  },
  ENTERPRISE: { members: -1, customers: -1,  workOrders: -1  },
}

export function getPlanLimit(plan: PlanType, resource: string): number {
  return PLAN_LIMITS[plan][resource] ?? -1
}

export function isAtLimit(plan: PlanType, resource: string, count: number): boolean {
  const limit = getPlanLimit(plan, resource)
  return limit !== -1 && count >= limit
}

// ─── Label maps ───────────────────────────────────────────────────────────────

export const PLAN_LABELS: Record<PlanType, string> = {
  FREE:       'חינמי',
  PRO:        'Pro',
  ENTERPRISE: 'Enterprise',
}

export const PLAN_COLORS: Record<PlanType, string> = {
  FREE:       'text-[#8892a4] bg-[#8892a4]/10',
  PRO:        'text-[#6366f1] bg-[#6366f1]/10',
  ENTERPRISE: 'text-amber-400 bg-amber-400/10',
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  OWNER:      'בעלים',
  ADMIN:      'מנהל',
  TECHNICIAN: 'טכנאי',
  VIEWER:     'צפייה',
}

export const ROLE_COLORS: Record<MemberRole, string> = {
  OWNER:      'text-amber-400 bg-amber-400/10',
  ADMIN:      'text-[#6366f1] bg-[#6366f1]/10',
  TECHNICIAN: 'text-emerald-400 bg-emerald-400/10',
  VIEWER:     'text-[#8892a4] bg-[#8892a4]/10',
}
