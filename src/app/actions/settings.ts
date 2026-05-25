'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { isAdmin } from '@/lib/rbac'
import { MemberRole } from '@prisma/client'
import { createAuditLog } from '@/lib/audit'

export type ActionResult = { error: string } | { success: true }

// ── Org profile ───────────────────────────────────────────────────────────────

export async function updateOrgProfile(formData: FormData): Promise<ActionResult> {
  const { orgId, memberRole, userId } = await requireOrg()
  if (!isAdmin(memberRole)) return { error: 'אין הרשאה' }

  const name    = (formData.get('name')    as string)?.trim()
  const phone   = (formData.get('phone')   as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const city    = (formData.get('city')    as string)?.trim() || null
  const vatId   = (formData.get('vatId')   as string)?.trim() || null
  const website = (formData.get('website') as string)?.trim() || null

  if (!name) return { error: 'שם המוסך הוא שדה חובה' }

  try {
    await prisma.organization.update({
      where: { id: orgId },
      data: { name, phone, address, city, vatId, website },
    })
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard')

    void createAuditLog({ orgId, userId, action: 'SETTINGS_UPDATED', entityType: 'organization', entityId: orgId, entityLabel: name })

    return { success: true }
  } catch {
    return { error: 'שגיאה בעדכון הפרופיל' }
  }
}

// ── Team / invitations ────────────────────────────────────────────────────────

export async function inviteMember(formData: FormData): Promise<ActionResult> {
  const { orgId, memberRole, userId } = await requireOrg()
  if (!isAdmin(memberRole)) return { error: 'אין הרשאה' }

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const role  = (formData.get('role')  as MemberRole) || 'TECHNICIAN'

  if (!email) return { error: 'כתובת אימייל חובה' }

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (user) {
      const alreadyMember = await prisma.membership.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
      })
      if (alreadyMember) return { error: 'משתמש זה כבר חבר בצוות' }
    }

    await prisma.invitation.deleteMany({ where: { organizationId: orgId, email, acceptedAt: null } })
    await prisma.invitation.create({
      data: { organizationId: orgId, email, role, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    })

    revalidatePath('/dashboard/settings/team')
    revalidatePath('/dashboard/staff')

    void createAuditLog({ orgId, userId, action: 'INVITE_SENT', entityType: 'invitation', entityLabel: email, afterData: { email, role } })

    return { success: true }
  } catch {
    return { error: 'שגיאה בשליחת ההזמנה' }
  }
}

export async function updateMemberRole(memberId: string, role: MemberRole): Promise<ActionResult> {
  const { orgId, memberRole, userId } = await requireOrg()
  if (!isAdmin(memberRole)) return { error: 'אין הרשאה' }

  try {
    const membership = await prisma.membership.findFirst({ where: { id: memberId, organizationId: orgId } })
    if (!membership) return { error: 'חבר צוות לא נמצא' }
    if (membership.userId === userId && membership.role === 'OWNER') return { error: 'לא ניתן לשנות את תפקיד הבעלים' }

    await prisma.membership.update({ where: { id: memberId }, data: { role } })
    revalidatePath('/dashboard/settings/team')
    revalidatePath('/dashboard/staff')

    void createAuditLog({ orgId, userId, action: 'ROLE_CHANGED', entityType: 'member', entityId: membership.userId, beforeData: { role: membership.role }, afterData: { role } })

    return { success: true }
  } catch {
    return { error: 'שגיאה בעדכון התפקיד' }
  }
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  const { orgId, memberRole, userId } = await requireOrg()
  if (!isAdmin(memberRole)) return { error: 'אין הרשאה' }

  try {
    const membership = await prisma.membership.findFirst({ where: { id: memberId, organizationId: orgId } })
    if (!membership) return { error: 'חבר צוות לא נמצא' }
    if (membership.userId === userId) return { error: 'לא ניתן להסיר את עצמך' }
    if (membership.role === 'OWNER') return { error: 'לא ניתן להסיר את הבעלים' }

    await prisma.membership.delete({ where: { id: memberId } })
    revalidatePath('/dashboard/settings/team')
    revalidatePath('/dashboard/staff')

    void createAuditLog({ orgId, userId, action: 'MEMBER_REMOVED', entityType: 'member', entityId: membership.userId })

    return { success: true }
  } catch {
    return { error: 'שגיאה בהסרת חבר הצוות' }
  }
}

export async function toggleMemberActive(memberId: string, active: boolean): Promise<ActionResult> {
  const { orgId, memberRole, userId } = await requireOrg()
  if (!isAdmin(memberRole)) return { error: 'אין הרשאה' }

  try {
    const membership = await prisma.membership.findFirst({ where: { id: memberId, organizationId: orgId } })
    if (!membership) return { error: 'חבר צוות לא נמצא' }
    if (membership.userId === userId) return { error: 'לא ניתן לשנות את הסטטוס שלך' }
    if (membership.role === 'OWNER') return { error: 'לא ניתן להשבית את הבעלים' }

    await prisma.membership.update({ where: { id: memberId }, data: { isActive: active } })
    revalidatePath('/dashboard/staff')
    revalidatePath('/dashboard/settings/team')

    void createAuditLog({ orgId, userId, action: active ? 'MEMBER_ACTIVATED' : 'MEMBER_DEACTIVATED', entityType: 'member', entityId: membership.userId })

    return { success: true }
  } catch {
    return { error: 'שגיאה בעדכון הסטטוס' }
  }
}

export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  const { orgId, memberRole, userId } = await requireOrg()
  if (!isAdmin(memberRole)) return { error: 'אין הרשאה' }

  try {
    const inv = await prisma.invitation.findUnique({ where: { id: invitationId, organizationId: orgId } })
    if (!inv) return { error: 'הזמנה לא נמצאה' }

    await prisma.invitation.delete({ where: { id: invitationId, organizationId: orgId } })
    revalidatePath('/dashboard/settings/team')
    revalidatePath('/dashboard/staff')

    void createAuditLog({ orgId, userId, action: 'INVITE_REVOKED', entityType: 'invitation', entityId: invitationId, entityLabel: inv.email })

    return { success: true }
  } catch {
    return { error: 'שגיאה בביטול ההזמנה' }
  }
}

// ── Accept invite (called from /invite/[token] page) ─────────────────────────

export async function acceptInvitation(token: string): Promise<{ error?: string }> {
  try {
    const invitation = await prisma.invitation.findUnique({ where: { token }, include: { organization: true } })
    if (!invitation)             return { error: 'הזמנה לא נמצאה' }
    if (invitation.acceptedAt)   return { error: 'הזמנה זו כבר נוספה' }
    if (invitation.expiresAt < new Date()) return { error: 'תוקף ההזמנה פג' }

    const user = await prisma.user.findUnique({ where: { email: invitation.email } })
    if (!user) return { error: 'יש ליצור חשבון עם כתובת ' + invitation.email + ' תחילה' }

    const existing = await prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } },
    })
    if (existing) return { error: 'כבר חבר בצוות זה' }

    await prisma.$transaction([
      prisma.membership.create({ data: { organizationId: invitation.organizationId, userId: user.id, role: invitation.role, joinedAt: new Date() } }),
      prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
    ])

    void createAuditLog({ orgId: invitation.organizationId, userId: user.id, userEmail: user.email, userName: user.name, action: 'INVITE_ACCEPTED', entityType: 'member', entityId: user.id, entityLabel: user.name, afterData: { role: invitation.role } })

    return {}
  } catch {
    return { error: 'שגיאה בקבלת ההזמנה' }
  }
}
