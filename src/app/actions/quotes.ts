'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { QuoteStatus } from '@prisma/client'
import { generateQuoteNumber } from '@/lib/quotes'

export type ActionResult = { error: string } | { success: true; id: string }

type LineItem = { description: string; quantity: number; unitPrice: number }

export async function createQuote(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg()

  try {
    const customerId = formData.get('customerId') as string
    const vehicleId = (formData.get('vehicleId') as string) || null
    const laborHours = parseFloat(formData.get('laborHours') as string) || 0
    const laborRate = parseFloat(formData.get('laborRate') as string) || 150
    const notes = (formData.get('notes') as string)?.trim() || null
    const validUntilStr = formData.get('validUntil') as string
    const itemsJson = formData.get('items') as string

    if (!customerId) return { error: 'יש לבחור לקוח' }

    let items: LineItem[] = []
    try { items = JSON.parse(itemsJson || '[]') } catch { return { error: 'פריטי ההצעה אינם תקינים' } }

    const partsTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    const totalPrice = partsTotal + laborHours * laborRate
    const quoteNumber = await generateQuoteNumber(orgId)

    const quote = await prisma.quote.create({
      data: {
        organizationId: orgId,
        quoteNumber,
        status: 'DRAFT',
        laborHours,
        laborRate,
        partsTotal,
        totalPrice,
        notes,
        validUntil: validUntilStr ? new Date(validUntilStr) : null,
        customerId,
        vehicleId,
        items: {
          create: items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.quantity * i.unitPrice,
          })),
        },
      },
    })

    revalidatePath('/dashboard/quotes')
    return { success: true, id: quote.id }
  } catch {
    return { error: 'שגיאה ביצירת ההצעה' }
  }
}

export async function updateQuote(id: string, formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg()

  try {
    const laborHours = parseFloat(formData.get('laborHours') as string) || 0
    const laborRate = parseFloat(formData.get('laborRate') as string) || 150
    const notes = (formData.get('notes') as string)?.trim() || null
    const validUntilStr = formData.get('validUntil') as string
    const itemsJson = formData.get('items') as string
    const vehicleId = (formData.get('vehicleId') as string) || null

    let items: LineItem[] = []
    try { items = JSON.parse(itemsJson || '[]') } catch { return { error: 'פריטי ההצעה אינם תקינים' } }

    const existing = await prisma.quote.findFirst({ where: { id, organizationId: orgId } })
    if (!existing) return { error: 'הצעה לא נמצאה' }

    const partsTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    const totalPrice = partsTotal + laborHours * laborRate

    await prisma.$transaction([
      prisma.quoteItem.deleteMany({ where: { quoteId: id } }),
      prisma.quote.update({
        where: { id },
        data: {
          laborHours, laborRate, partsTotal, totalPrice, notes, vehicleId,
          validUntil: validUntilStr ? new Date(validUntilStr) : null,
          items: {
            create: items.map((i) => ({
              description: i.description, quantity: i.quantity,
              unitPrice: i.unitPrice, total: i.quantity * i.unitPrice,
            })),
          },
        },
      }),
    ])

    revalidatePath('/dashboard/quotes')
    revalidatePath(`/dashboard/quotes/${id}`)
    return { success: true, id }
  } catch {
    return { error: 'שגיאה בעדכון ההצעה' }
  }
}

export async function updateQuoteStatus(id: string, status: QuoteStatus): Promise<void> {
  await prisma.quote.update({ where: { id }, data: { status } })
  revalidatePath(`/dashboard/quotes/${id}`)
  revalidatePath('/dashboard/quotes')
}

export async function deleteQuote(id: string): Promise<{ error?: string }> {
  const { orgId } = await requireOrg()
  try {
    await prisma.quote.delete({ where: { id, organizationId: orgId } })
    revalidatePath('/dashboard/quotes')
    return {}
  } catch {
    return { error: 'שגיאה במחיקת ההצעה' }
  }
}
