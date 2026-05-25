'use server'

import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { generateWorkOrderNumber } from '@/lib/work-orders'
import { revalidatePath } from 'next/cache'
import { WorkOrderStatus } from '@prisma/client'
import { createAuditLog } from '@/lib/audit'

export type ActionResult = { error: string } | { success: true; id: string }

export async function createWorkOrder(formData: FormData): Promise<ActionResult> {
  const { orgId, userId } = await requireOrg()

  const customerId          = (formData.get('customerId')          as string)?.trim()
  const vehicleId           = (formData.get('vehicleId')           as string)?.trim()
  const complaint           = (formData.get('complaint')           as string)?.trim()
  const diagnosis           = (formData.get('diagnosis')           as string)?.trim() || null
  const assignedTechnician  = (formData.get('assignedTechnician')  as string)?.trim() || null
  const laborHours          = parseFloat(formData.get('laborHours') as string) || 0
  const laborRate           = parseFloat(formData.get('laborRate')  as string) || 150
  const mileageRaw          = formData.get('mileage') as string
  const mileage             = mileageRaw ? parseInt(mileageRaw) : null
  const notes               = (formData.get('notes')               as string)?.trim() || null

  if (!customerId) return { error: 'יש לבחור לקוח' }
  if (!vehicleId)  return { error: 'יש לבחור רכב' }
  if (!complaint)  return { error: 'יש להזין תלונת לקוח' }

  try {
    const workOrderNumber = await generateWorkOrderNumber(orgId)
    const totalPrice = laborHours * laborRate

    const wo = await prisma.workOrder.create({
      data: { organizationId: orgId, workOrderNumber, customerId, vehicleId, complaint, diagnosis, assignedTechnician, laborHours, laborRate, partsTotal: 0, totalPrice, mileage, notes },
    })

    revalidatePath('/dashboard/work-orders')
    revalidatePath('/dashboard')

    void createAuditLog({ orgId, userId, action: 'CREATE', entityType: 'workOrder', entityId: wo.id, entityLabel: workOrderNumber, afterData: { workOrderNumber, complaint, assignedTechnician } })

    return { success: true, id: wo.id }
  } catch (e) {
    console.error(e)
    return { error: 'שגיאה ביצירת פקודת עבודה' }
  }
}

export async function updateWorkOrder(id: string, formData: FormData): Promise<ActionResult> {
  const { orgId, userId } = await requireOrg()

  const complaint          = (formData.get('complaint')          as string)?.trim()
  const diagnosis          = (formData.get('diagnosis')          as string)?.trim() || null
  const assignedTechnician = (formData.get('assignedTechnician') as string)?.trim() || null
  const laborHours         = parseFloat(formData.get('laborHours') as string) || 0
  const laborRate          = parseFloat(formData.get('laborRate')  as string) || 150
  const mileageRaw         = formData.get('mileage') as string
  const mileage            = mileageRaw ? parseInt(mileageRaw) : null
  const notes              = (formData.get('notes') as string)?.trim() || null

  if (!complaint) return { error: 'יש להזין תלונת לקוח' }

  try {
    const existing = await prisma.workOrder.findFirst({ where: { id, organizationId: orgId }, select: { partsTotal: true, workOrderNumber: true, complaint: true, assignedTechnician: true } })
    if (!existing) return { error: 'פקודת עבודה לא נמצאה' }

    const partsTotal = Number(existing.partsTotal)
    const totalPrice = laborHours * laborRate + partsTotal

    await prisma.workOrder.update({ where: { id }, data: { complaint, diagnosis, assignedTechnician, laborHours, laborRate, totalPrice, mileage, notes } })

    revalidatePath('/dashboard/work-orders')
    revalidatePath(`/dashboard/work-orders/${id}`)
    revalidatePath('/dashboard')

    void createAuditLog({ orgId, userId, action: 'UPDATE', entityType: 'workOrder', entityId: id, entityLabel: existing.workOrderNumber, beforeData: { complaint: existing.complaint, assignedTechnician: existing.assignedTechnician }, afterData: { complaint, assignedTechnician } })

    return { success: true, id }
  } catch (e) {
    console.error(e)
    return { error: 'שגיאה בעדכון פקודת עבודה' }
  }
}

export async function updateWorkOrderStatus(id: string, status: WorkOrderStatus): Promise<void> {
  await prisma.workOrder.update({ where: { id }, data: { status } })
  revalidatePath('/dashboard/work-orders')
  revalidatePath(`/dashboard/work-orders/${id}`)
  revalidatePath('/dashboard')
}

export async function deleteWorkOrder(id: string): Promise<{ error?: string }> {
  const { orgId, userId } = await requireOrg()
  try {
    const wo = await prisma.workOrder.findUnique({ where: { id, organizationId: orgId }, select: { workOrderNumber: true } })
    await prisma.workOrder.delete({ where: { id, organizationId: orgId } })
    revalidatePath('/dashboard/work-orders')
    revalidatePath('/dashboard')

    void createAuditLog({ orgId, userId, action: 'DELETE', entityType: 'workOrder', entityId: id, entityLabel: wo?.workOrderNumber })

    return {}
  } catch (e) {
    console.error(e)
    return { error: 'שגיאה במחיקת פקודת עבודה' }
  }
}
