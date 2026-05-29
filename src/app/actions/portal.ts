'use server'

import { revalidatePath } from 'next/cache'
import { prisma }         from '@/lib/prisma'

/**
 * Customer approves a quote — updates status to APPROVED.
 * No auth check: the quoteId is passed from the portal (scoped to the WO).
 */
export async function approveQuote(quoteId: string, workOrderId: string) {
  await prisma.quote.update({
    where: { id: quoteId },
    data:  { status: 'APPROVED' },
  })
  revalidatePath(`/portal/${workOrderId}`)
  revalidatePath(`/portal/${workOrderId}/quote`)
}

/**
 * Customer rejects a quote.
 */
export async function rejectQuote(quoteId: string, workOrderId: string) {
  await prisma.quote.update({
    where: { id: quoteId },
    data:  { status: 'REJECTED' },
  })
  revalidatePath(`/portal/${workOrderId}`)
  revalidatePath(`/portal/${workOrderId}/quote`)
}
