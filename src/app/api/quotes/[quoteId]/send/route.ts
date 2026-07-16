import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: { quoteId: string } }
) {
  const { orgId } = await requireOrg()

  const quote = await prisma.quote.findFirst({
    where: { id: params.quoteId, organizationId: orgId },
    select: { id: true, portalToken: true },
  })

  if (!quote) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })

  const updated = await prisma.quote.update({
    where: { id: quote.id },
    data: {
      status: 'SENT',
      portalTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    select: { portalToken: true },
  })

  return NextResponse.json({ portalToken: updated.portalToken })
}
