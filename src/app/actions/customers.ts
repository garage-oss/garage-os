'use server'

import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { revalidatePath } from 'next/cache'

export type ActionResult = { error: string } | { success: true; id: string }

export async function createCustomer(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg()

  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()
  const email = (formData.get('email') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!name) return { error: 'שם הוא שדה חובה' }
  if (!phone) return { error: 'טלפון הוא שדה חובה' }

  try {
    const customer = await prisma.customer.create({
      data: { organizationId: orgId, name, phone, email, address, notes },
    })
    revalidatePath('/dashboard/customers')
    revalidatePath('/dashboard')
    return { success: true, id: customer.id }
  } catch (e) {
    console.error(e)
    return { error: 'שגיאה ביצירת לקוח' }
  }
}

export async function updateCustomer(id: string, formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg()

  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()
  const email = (formData.get('email') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!name) return { error: 'שם הוא שדה חובה' }
  if (!phone) return { error: 'טלפון הוא שדה חובה' }

  try {
    await prisma.customer.update({
      where: { id, organizationId: orgId },
      data: { name, phone, email, address, notes },
    })
    revalidatePath('/dashboard/customers')
    revalidatePath(`/dashboard/customers/${id}`)
    return { success: true, id }
  } catch (e) {
    console.error(e)
    return { error: 'שגיאה בעדכון לקוח' }
  }
}

export async function deleteCustomer(id: string): Promise<{ error?: string }> {
  const { orgId } = await requireOrg()
  try {
    await prisma.customer.delete({ where: { id, organizationId: orgId } })
    revalidatePath('/dashboard/customers')
    revalidatePath('/dashboard')
    return {}
  } catch (e) {
    console.error(e)
    return { error: 'לא ניתן למחוק לקוח עם רכבים או פקודות עבודה קיימות' }
  }
}
