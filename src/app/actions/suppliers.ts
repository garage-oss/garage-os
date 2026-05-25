'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'

export type ActionResult = { error: string } | { success: true; id: string }

export async function createSupplier(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg()

  try {
    const name = (formData.get('name') as string).trim()
    if (!name) return { error: 'שם הספק חובה' }

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: orgId,
        name,
        contactName: (formData.get('contactName') as string)?.trim() || null,
        phone: (formData.get('phone') as string)?.trim() || null,
        email: (formData.get('email') as string)?.trim() || null,
        address: (formData.get('address') as string)?.trim() || null,
        notes: (formData.get('notes') as string)?.trim() || null,
      },
    })

    revalidatePath('/dashboard/suppliers')
    return { success: true, id: supplier.id }
  } catch {
    return { error: 'שגיאה בשמירת הספק' }
  }
}

export async function updateSupplier(id: string, formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg()

  try {
    const name = (formData.get('name') as string).trim()
    if (!name) return { error: 'שם הספק חובה' }

    const existing = await prisma.supplier.findFirst({ where: { id, organizationId: orgId } })
    if (!existing) return { error: 'ספק לא נמצא' }

    await prisma.supplier.update({
      where: { id },
      data: {
        name,
        contactName: (formData.get('contactName') as string)?.trim() || null,
        phone: (formData.get('phone') as string)?.trim() || null,
        email: (formData.get('email') as string)?.trim() || null,
        address: (formData.get('address') as string)?.trim() || null,
        notes: (formData.get('notes') as string)?.trim() || null,
      },
    })

    revalidatePath('/dashboard/suppliers')
    revalidatePath(`/dashboard/suppliers/${id}`)
    return { success: true, id }
  } catch {
    return { error: 'שגיאה בעדכון הספק' }
  }
}

export async function deleteSupplier(id: string): Promise<{ error?: string }> {
  const { orgId } = await requireOrg()
  try {
    await prisma.supplier.delete({ where: { id, organizationId: orgId } })
    revalidatePath('/dashboard/suppliers')
    return {}
  } catch {
    return { error: 'לא ניתן למחוק — הספק מקושר לחלקים' }
  }
}
