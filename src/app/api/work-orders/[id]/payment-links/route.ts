import { NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { toNum } from '@/lib/utils'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const links = await prisma.paymentLink.findMany({
    where:   { organizationId: org.orgId, workOrderId: params.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(
    links.map((l) => ({
      id:        l.id,
      token:     l.token,
      amount:    toNum(l.amount),
      paidAt:    l.paidAt?.toISOString() ?? null,
      expiresAt: l.expiresAt?.toISOString() ?? null,
      createdAt: l.createdAt.toISOString(),
    }))
  )
}
