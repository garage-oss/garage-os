'use server'

import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { isAdmin } from '@/lib/rbac'
import { revalidatePath } from 'next/cache'

export type PaymentResult = { error: string } | { success: true; token: string }

/** Generate a payment link for a work order. Admins + service advisors only. */
export async function generatePaymentLink(
  workOrderId: string
): Promise<PaymentResult> {
  const { orgId, memberRole } = await requireOrg()

  // Only OWNER / MANAGER / SERVICE_ADVISOR can create payment links
  if (!isAdmin(memberRole) && memberRole !== 'SERVICE_ADVISOR' && memberRole !== 'ACCOUNTANT') {
    return { error: 'אין הרשאה' }
  }

  const wo = await prisma.workOrder.findFirst({
    where:  { id: workOrderId, organizationId: orgId },
    select: { totalPrice: true, workOrderNumber: true, customerId: true },
  })
  if (!wo) return { error: 'פקודת עבודה לא נמצאה' }

  // Check if an unpaid link already exists
  const existing = await prisma.paymentLink.findFirst({
    where: { workOrderId, organizationId: orgId, paidAt: null },
  })
  if (existing) return { success: true, token: existing.token }

  // 7-day expiry
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const link = await prisma.paymentLink.create({
    data: {
      organizationId: orgId,
      workOrderId,
      amount:      wo.totalPrice,
      currency:    'ILS',
      description: `תשלום עבור פקודה ${wo.workOrderNumber}`,
      expiresAt,
    },
  })

  revalidatePath(`/dashboard/work-orders/${workOrderId}`)
  return { success: true, token: link.token }
}

/** Mark a payment link as paid (called from public pay page). */
export async function markPaymentPaid(token: string): Promise<{ error?: string }> {
  const link = await prisma.paymentLink.findUnique({ where: { token } })
  if (!link)        return { error: 'קישור לא נמצא' }
  if (link.paidAt)  return {} // already paid — idempotent
  if (link.expiresAt && link.expiresAt < new Date()) return { error: 'קישור פג תוקף' }

  await prisma.paymentLink.update({
    where: { token },
    data:  { paidAt: new Date() },
  })

  // Optionally update invoice status
  if (link.invoiceId) {
    await prisma.invoice.update({
      where: { id: link.invoiceId },
      data:  { status: 'PAID' },
    }).catch(() => {})
  }

  if (link.workOrderId) {
    revalidatePath(`/dashboard/work-orders/${link.workOrderId}`)
  }
  return {}
}

/** Get open payment links for a work order. */
export async function getWorkOrderPaymentLinks(workOrderId: string) {
  const { orgId } = await requireOrg()
  return prisma.paymentLink.findMany({
    where:   { organizationId: orgId, workOrderId },
    orderBy: { createdAt: 'desc' },
  })
}
