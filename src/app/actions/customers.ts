'use server'

import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { revalidatePath } from 'next/cache'
import { createAuditLog } from '@/lib/audit'

export type ActionResult = { error: string } | { success: true; id: string }

export async function createCustomer(formData: FormData): Promise<ActionResult> {
  const { orgId, userId, memberRole } = await requireOrg()

  const name    = (formData.get('name')    as string)?.trim()
  const phone   = (formData.get('phone')   as string)?.trim()
  const email   = (formData.get('email')   as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const notes   = (formData.get('notes')   as string)?.trim() || null

  if (!name)  return { error: 'שם הוא שדה חובה' }
  if (!phone) return { error: 'טלפון הוא שדה חובה' }

  try {
    const customer = await prisma.customer.create({
      data: { organizationId: orgId, name, phone, email, address, notes },
    })
    revalidatePath('/dashboard/customers')
    revalidatePath('/dashboard')

    void createAuditLog({ orgId, userId, action: 'CREATE', entityType: 'customer', entityId: customer.id, entityLabel: name, afterData: { name, phone, email } })

    return { success: true, id: customer.id }
  } catch (e) {
    console.error(e)
    return { error: 'שגיאה ביצירת לקוח' }
  }
}

export async function updateCustomer(id: string, formData: FormData): Promise<ActionResult> {
  const { orgId, userId } = await requireOrg()

  const name    = (formData.get('name')    as string)?.trim()
  const phone   = (formData.get('phone')   as string)?.trim()
  const email   = (formData.get('email')   as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const notes   = (formData.get('notes')   as string)?.trim() || null

  if (!name)  return { error: 'שם הוא שדה חובה' }
  if (!phone) return { error: 'טלפון הוא שדה חובה' }

  try {
    const before = await prisma.customer.findUnique({ where: { id, organizationId: orgId }, select: { name: true, phone: true, email: true } })
    if (!before) return { error: 'לקוח לא נמצא' }

    await prisma.customer.update({ where: { id, organizationId: orgId }, data: { name, phone, email, address, notes } })
    revalidatePath('/dashboard/customers')
    revalidatePath(`/dashboard/customers/${id}`)

    void createAuditLog({ orgId, userId, action: 'UPDATE', entityType: 'customer', entityId: id, entityLabel: name, beforeData: before as Record<string, unknown>, afterData: { name, phone, email } })

    return { success: true, id }
  } catch (e) {
    console.error(e)
    return { error: 'שגיאה בעדכון לקוח' }
  }
}

export async function deleteCustomer(id: string): Promise<{ error?: string }> {
  const { orgId, userId } = await requireOrg()
  try {
    const customer = await prisma.customer.findUnique({ where: { id, organizationId: orgId }, select: { name: true } })
    await prisma.customer.delete({ where: { id, organizationId: orgId } })
    revalidatePath('/dashboard/customers')
    revalidatePath('/dashboard')

    void createAuditLog({ orgId, userId, action: 'DELETE', entityType: 'customer', entityId: id, entityLabel: customer?.name })

    return {}
  } catch (e) {
    console.error(e)
    return { error: 'לא ניתן למחוק לקוח עם רכבים או פקודות עבודה קיימות' }
  }
}
