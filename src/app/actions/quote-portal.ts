'use server'

import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function respondToQuote(token: string, action: 'APPROVED' | 'REJECTED' | 'CALL_REQUESTED') {
  const headersList = headers()
  const ip        = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? null
  const userAgent = headersList.get('user-agent') ?? null

  const quote = await prisma.quote.findUnique({
    where:  { portalToken: token },
    select: { id: true, status: true, portalTokenExpiresAt: true },
  })

  if (!quote) throw new Error('הצעה לא נמצאה')
  if (quote.portalTokenExpiresAt && quote.portalTokenExpiresAt < new Date()) {
    throw new Error('קישור הצעת המחיר פג תוקף')
  }

  const newStatus = action === 'APPROVED' ? 'APPROVED' : action === 'REJECTED' ? 'REJECTED' : quote.status

  await prisma.$transaction([
    prisma.quote.update({
      where: { id: quote.id },
      data:  { status: newStatus as 'APPROVED' | 'REJECTED' | 'SENT' },
    }),
    prisma.quotePortalResponse.create({
      data: { quoteId: quote.id, action, ip, userAgent },
    }),
  ])

  revalidatePath(`/portal/quote/${token}`)
  redirect(`/portal/quote/${token}`)
}

export async function sendQuoteToCustomer(quoteId: string): Promise<string> {
  const quote = await prisma.quote.update({
    where: { id: quoteId },
    data:  {
      status:              'SENT',
      portalTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    select: { portalToken: true },
  })
  if (!quote.portalToken) throw new Error('שגיאה ביצירת קישור')
  return quote.portalToken
}
