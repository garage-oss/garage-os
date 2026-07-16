import { NextRequest, NextResponse } from 'next/server'
import { headers }                   from 'next/headers'
import { getCustomerSession }        from '@/lib/customer-auth'
import { prisma }                    from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { quoteId: string } }
) {
  const ctx = await getCustomerSession()
  if (!ctx) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const { action, comment } = await req.json() as { action: string; comment?: string }

  if (!['APPROVED', 'REJECTED', 'CALL_REQUESTED'].includes(action)) {
    return NextResponse.json({ error: 'פעולה לא תקינה' }, { status: 400 })
  }

  const quote = await prisma.quote.findFirst({
    where: { id: params.quoteId, customerId: ctx.customerId },
    select: { id: true, status: true, portalTokenExpiresAt: true },
  })

  if (!quote) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })
  if (quote.portalTokenExpiresAt && quote.portalTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: 'הצעה פגה תוקף' }, { status: 410 })
  }

  const headersList = headers()
  const ip          = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? null
  const userAgent   = headersList.get('user-agent') ?? null

  const newStatus = action === 'APPROVED' ? 'APPROVED' : action === 'REJECTED' ? 'REJECTED' : quote.status

  await prisma.$transaction([
    prisma.quote.update({
      where: { id: quote.id },
      data:  { status: newStatus as 'APPROVED' | 'REJECTED' | 'SENT' | 'DRAFT' },
    }),
    prisma.quotePortalResponse.create({
      data: { quoteId: quote.id, action, ip, userAgent, notes: comment || null },
    }),
  ])

  return NextResponse.json({ success: true })
}
