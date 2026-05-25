'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { isAdmin, hasPermission } from '@/lib/rbac'
import { createAuditLog } from '@/lib/audit'
import { MemberRole } from '@prisma/client'

export type ActionResult = { error: string } | { success: true }

// ── Update staff profile (name, phone, department, position) ──────────────────

export async function updateStaffProfile(
  membershipId: string,
  formData: FormData
): Promise<ActionResult> {
  const { orgId, memberRole, userId } = await requireOrg()
  if (!hasPermission(memberRole, 'users', 'update')) return { error: 'אין הרשאה' }

  const name       = (formData.get('name')       as string)?.trim()
  const phone      = (formData.get('phone')      as string)?.trim() || null
  const department = (formData.get('department') as string)?.trim() || null
  const position   = (formData.get('position')   as string)?.trim() || null

  if (!name) return { error: 'שם הוא שדה חובה' }

  try {
    const membership = await prisma.membership.findFirst({
      where: { id: membershipId, organizationId: orgId },
      include: { user: { select: { id: true, name: true } } },
    })
    if (!membership) return { error: 'עובד לא נמצא' }

    // Non-owners can only edit their own profile unless they are admin
    if (!isAdmin(memberRole) && membership.userId !== userId) return { error: 'אין הרשאה לעריכת פרופיל זה' }

    await prisma.user.update({
      where: { id: membership.userId },
      data: { name, phone, department, position },
    })

    revalidatePath('/dashboard/staff')
    revalidatePath(`/dashboard/staff/${membershipId}`)

    void createAuditLog({ orgId, userId, action: 'UPDATE', entityType: 'user', entityId: membership.userId, entityLabel: name })

    return { success: true }
  } catch {
    return { error: 'שגיאה בעדכון הפרופיל' }
  }
}

// ── Change role ───────────────────────────────────────────────────────────────

export async function changeStaffRole(membershipId: string, role: MemberRole): Promise<ActionResult> {
  const { orgId, memberRole, userId } = await requireOrg()
  if (!isAdmin(memberRole)) return { error: 'אין הרשאה' }

  try {
    const membership = await prisma.membership.findFirst({ where: { id: membershipId, organizationId: orgId } })
    if (!membership) return { error: 'עובד לא נמצא' }
    if (membership.userId === userId && membership.role === 'OWNER') return { error: 'לא ניתן לשנות את תפקיד הבעלים' }

    await prisma.membership.update({ where: { id: membershipId }, data: { role } })

    revalidatePath('/dashboard/staff')
    revalidatePath(`/dashboard/staff/${membershipId}`)

    void createAuditLog({ orgId, userId, action: 'ROLE_CHANGED', entityType: 'member', entityId: membership.userId, beforeData: { role: membership.role }, afterData: { role } })

    return { success: true }
  } catch {
    return { error: 'שגיאה בעדכון התפקיד' }
  }
}

// ── Toggle active ─────────────────────────────────────────────────────────────

export async function toggleStaffActive(membershipId: string, active: boolean): Promise<ActionResult> {
  const { orgId, memberRole, userId } = await requireOrg()
  if (!isAdmin(memberRole)) return { error: 'אין הרשאה' }

  try {
    const membership = await prisma.membership.findFirst({ where: { id: membershipId, organizationId: orgId } })
    if (!membership) return { error: 'עובד לא נמצא' }
    if (membership.userId === userId) return { error: 'לא ניתן לשנות את הסטטוס שלך' }
    if (membership.role === 'OWNER') return { error: 'לא ניתן להשבית את הבעלים' }

    await prisma.membership.update({ where: { id: membershipId }, data: { isActive: active } })

    revalidatePath('/dashboard/staff')
    revalidatePath(`/dashboard/staff/${membershipId}`)

    void createAuditLog({ orgId, userId, action: active ? 'MEMBER_ACTIVATED' : 'MEMBER_DEACTIVATED', entityType: 'member', entityId: membership.userId })

    return { success: true }
  } catch {
    return { error: 'שגיאה בעדכון הסטטוס' }
  }
}

// ── Remove from org ───────────────────────────────────────────────────────────

export async function removeStaffMember(membershipId: string): Promise<ActionResult> {
  const { orgId, memberRole, userId } = await requireOrg()
  if (!isAdmin(memberRole)) return { error: 'אין הרשאה' }

  try {
    const membership = await prisma.membership.findFirst({ where: { id: membershipId, organizationId: orgId } })
    if (!membership) return { error: 'עובד לא נמצא' }
    if (membership.userId === userId) return { error: 'לא ניתן להסיר את עצמך' }
    if (membership.role === 'OWNER') return { error: 'לא ניתן להסיר את הבעלים' }

    await prisma.membership.delete({ where: { id: membershipId } })

    revalidatePath('/dashboard/staff')

    void createAuditLog({ orgId, userId, action: 'MEMBER_REMOVED', entityType: 'member', entityId: membership.userId })

    return { success: true }
  } catch {
    return { error: 'שגיאה בהסרת העובד' }
  }
}
