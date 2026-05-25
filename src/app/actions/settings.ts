'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { MemberRole } from '@prisma/client'

export type ActionResult = { error: string } | { success: true }

// ── Org profile ───────────────────────────────────────────────────────────────

export async function updateOrgProfile(formData: FormData): Promise<ActionResult> {
  const { orgId, memberRole } = await requireOrg()
  if (memberRole !== 'OWNER' && memberRole !== 'ADMIN') return { error: 'אין הרשאה' }

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'שם המוסך הוא שדה חובה' }

  try {
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        name,
        phone: (formData.get('phone') as string)?.trim() || null,
        address: (formData.get('address') as string)?.trim() || null,
        city: (formData.get('city') as string)?.trim() || null,
      },
    })
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard')
    return { success: true }
  } catch {
    return { error: 'שגיאה בעדכון הפרופיל' }
  }
}

// ── Team / invitations ────────────────────────────────────────────────────────

export async function inviteMember(formData: FormData): Promise<ActionResult> {
  const { orgId, memberRole } = await requireOrg()
  if (memberRole !== 'OWNER' && memberRole !== 'ADMIN') return { error: 'אין הרשאה' }

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const role = (formData.get('role') as MemberRole) || 'TECHNICIAN'

  if (!email) return { error: 'כתובת אימייל חובה' }

  try {
    // Check if already a member
    const user = await prisma.user.findUnique({ where: { email } })
    if (user) {
      const alreadyMember = await prisma.membership.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
      })
      if (alreadyMember) return { error: 'משתמש זה כבר חבר בצוות' }
    }

    // Upsert invite (replace any existing pending invite for same email)
    await prisma.invitation.deleteMany({
      where: { organizationId: orgId, email, acceptedAt: null },
    })

    await prisma.invitation.create({
      data: {
        organizationId: orgId,
        email,
        role,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    })

    revalidatePath('/dashboard/settings/team')
    return { success: true }
  } catch {
    return { error: 'שגיאה בשליחת ההזמנה' }
  }
}

export async function updateMemberRole(memberId: string, role: MemberRole): Promise<ActionResult> {
  const { orgId, memberRole, userId } = await requireOrg()
  if (memberRole !== 'OWNER' && memberRole !== 'ADMIN') return { error: 'אין הרשאה' }

  try {
    const membership = await prisma.membership.findFirst({
      where: { id: memberId, organizationId: orgId },
    })
    if (!membership) return { error: 'חבר צוות לא נמצא' }
    if (membership.userId === userId && membership.role === 'OWNER') {
      return { error: 'לא ניתן לשנות את תפקיד הבעלים' }
    }

    await prisma.membership.update({ where: { id: memberId }, data: { role } })
    revalidatePath('/dashboard/settings/team')
    return { success: true }
  } catch {
    return { error: 'שגיאה בעדכון התפקיד' }
  }
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  const { orgId, memberRole, userId } = await requireOrg()
  if (memberRole !== 'OWNER' && memberRole !== 'ADMIN') return { error: 'אין הרשאה' }

  try {
    const membership = await prisma.membership.findFirst({
      where: { id: memberId, organizationId: orgId },
    })
    if (!membership) return { error: 'חבר צוות לא נמצא' }
    if (membership.userId === userId) return { error: 'לא ניתן להסיר את עצמך' }
    if (membership.role === 'OWNER') return { error: 'לא ניתן להסיר את הבעלים' }

    await prisma.membership.delete({ where: { id: memberId } })
    revalidatePath('/dashboard/settings/team')
    return { success: true }
  } catch {
    return { error: 'שגיאה בהסרת חבר הצוות' }
  }
}

export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  const { orgId, memberRole } = await requireOrg()
  if (memberRole !== 'OWNER' && memberRole !== 'ADMIN') return { error: 'אין הרשאה' }

  try {
    await prisma.invitation.delete({
      where: { id: invitationId, organizationId: orgId },
    })
    revalidatePath('/dashboard/settings/team')
    return { success: true }
  } catch {
    return { error: 'שגיאה בביטול ההזמנה' }
  }
}

// ── Accept invite ─────────────────────────────────────────────────────────────

export async function acceptInvitation(token: string): Promise<{ error?: string }> {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { organization: true },
    })

    if (!invitation) return { error: 'הזמנה לא נמצאה' }
    if (invitation.acceptedAt) return { error: 'הזמנה זו כבר נוספה' }
    if (invitation.expiresAt < new Date()) return { error: 'תוקף ההזמנה פג' }

    const user = await prisma.user.findUnique({ where: { email: invitation.email } })
    if (!user) return { error: 'יש ליצור חשבון עם כתובת ' + invitation.email + ' תחילה' }

    // Check not already a member
    const existing = await prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } },
    })
    if (existing) return { error: 'כבר חבר בצוות זה' }

    await prisma.$transaction([
      prisma.membership.create({
        data: { organizationId: invitation.organizationId, userId: user.id, role: invitation.role },
      }),
      prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
    ])

    return {}
  } catch {
    return { error: 'שגיאה בקבלת ההזמנה' }
  }
}
