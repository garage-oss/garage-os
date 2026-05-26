import { NextResponse } from 'next/server'
import { getWorkOrder } from '@/lib/work-orders'
import { toNum } from '@/lib/utils'
import { getOrgContext } from '@/lib/org'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wo = await getWorkOrder(org.orgId, params.id)
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Serialize Decimal → number so client can receive it
  return NextResponse.json({
    ...wo,
    laborHours: toNum(wo.laborHours),
    laborRate: toNum(wo.laborRate),
    partsTotal: toNum(wo.partsTotal),
    totalPrice: toNum(wo.totalPrice),
    createdAt: wo.createdAt.toISOString(),
    updatedAt: wo.updatedAt.toISOString(),
    orgName:   org.orgName,
    items: wo.items.map((item) => ({
      ...item,
      unitPrice: toNum(item.unitPrice),
    })),
  })
}
