'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { MovementType } from '@prisma/client'
import { notifyAdmins } from '@/lib/notifications'
import { getOrgSettings } from '@/lib/org-settings'

export type ActionResult = { error: string } | { success: true; id: string }

export async function createPart(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg()

  try {
    const sku = (formData.get('sku') as string).trim()
    const name = (formData.get('name') as string).trim()
    const costPrice = parseFloat(formData.get('costPrice') as string)
    const salePrice = parseFloat(formData.get('salePrice') as string)
    const quantity = parseInt(formData.get('quantity') as string) || 0
    const minQuantity = parseInt(formData.get('minQuantity') as string) || 5

    if (!sku || !name) return { error: 'מק"ט ושם חובה' }
    if (isNaN(costPrice) || isNaN(salePrice)) return { error: 'מחיר לא תקין' }

    const part = await prisma.part.create({
      data: {
        organizationId: orgId,
        sku,
        name,
        category: (formData.get('category') as string)?.trim() || null,
        manufacturer: (formData.get('manufacturer') as string)?.trim() || null,
        supplierId: (formData.get('supplierId') as string) || null,
        costPrice,
        salePrice,
        quantity,
        minQuantity,
        location: (formData.get('location') as string)?.trim() || null,
        notes: (formData.get('notes') as string)?.trim() || null,
      },
    })

    if (quantity > 0) {
      await prisma.stockMovement.create({
        data: { partId: part.id, type: 'IN', quantity, reason: 'יתרה פתיחה' },
      })
    }

    revalidatePath('/dashboard/inventory')
    return { success: true, id: part.id }
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('Unique constraint')) {
      return { error: 'מק"ט זה כבר קיים במערכת' }
    }
    return { error: 'שגיאה בשמירת החלק' }
  }
}

export async function updatePart(id: string, formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg()

  try {
    const sku = (formData.get('sku') as string).trim()
    const name = (formData.get('name') as string).trim()
    const costPrice = parseFloat(formData.get('costPrice') as string)
    const salePrice = parseFloat(formData.get('salePrice') as string)

    if (!sku || !name) return { error: 'מק"ט ושם חובה' }
    if (isNaN(costPrice) || isNaN(salePrice)) return { error: 'מחיר לא תקין' }

    const existing = await prisma.part.findFirst({ where: { id, organizationId: orgId } })
    if (!existing) return { error: 'חלק לא נמצא' }

    await prisma.part.update({
      where: { id },
      data: {
        sku,
        name,
        category: (formData.get('category') as string)?.trim() || null,
        manufacturer: (formData.get('manufacturer') as string)?.trim() || null,
        supplierId: (formData.get('supplierId') as string) || null,
        costPrice,
        salePrice,
        minQuantity: parseInt(formData.get('minQuantity') as string) || 5,
        location: (formData.get('location') as string)?.trim() || null,
        notes: (formData.get('notes') as string)?.trim() || null,
      },
    })

    revalidatePath('/dashboard/inventory')
    revalidatePath(`/dashboard/inventory/${id}`)
    return { success: true, id }
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('Unique constraint')) {
      return { error: 'מק"ט זה כבר קיים במערכת' }
    }
    return { error: 'שגיאה בעדכון החלק' }
  }
}

export async function deletePart(id: string): Promise<{ error?: string }> {
  const { orgId } = await requireOrg()
  try {
    await prisma.part.delete({ where: { id, organizationId: orgId } })
    revalidatePath('/dashboard/inventory')
    return {}
  } catch {
    return { error: 'לא ניתן למחוק — החלק מקושר לפקודות עבודה' }
  }
}

export async function adjustStock(
  partId: string,
  type: MovementType,
  quantity: number,
  reason: string
): Promise<ActionResult> {
  const { orgId } = await requireOrg()
  try {
    const part = await prisma.part.findFirst({ where: { id: partId, organizationId: orgId } })
    if (!part) return { error: 'חלק לא נמצא' }

    const delta = type === 'OUT' ? -Math.abs(quantity) : type === 'IN' ? Math.abs(quantity) : quantity
    const newQty = part.quantity + delta
    if (newQty < 0) return { error: 'לא ניתן להפחית מעל הכמות הקיימת' }

    await prisma.$transaction([
      prisma.part.update({ where: { id: partId }, data: { quantity: newQty } }),
      prisma.stockMovement.create({
        data: { partId, type, quantity: Math.abs(quantity), reason: reason || null },
      }),
    ])

    revalidatePath(`/dashboard/inventory/${partId}`)
    revalidatePath('/dashboard/inventory')

    // Low-stock notification (fire-and-forget, uses org settings threshold)
    const settings = await getOrgSettings(orgId).catch(() => null)
    const threshold = settings?.lowStockThreshold ?? 5
    if (settings?.notifyLowStock !== false && newQty <= threshold && newQty >= 0) {
      void notifyAdmins(orgId, {
        type:       'LOW_STOCK',
        title:      `מלאי נמוך: ${part.name}`,
        message:    `נותרו ${newQty} יחידות (סף: ${threshold}). מומלץ להזמין.`,
        entityType: 'part',
        entityId:   partId,
        actionUrl:  `/dashboard/inventory/${partId}`,
      })
    }

    return { success: true, id: partId }
  } catch {
    return { error: 'שגיאה בעדכון המלאי' }
  }
}
