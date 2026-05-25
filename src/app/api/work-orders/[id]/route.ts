import { NextResponse } from 'next/server'
import { getWorkOrder } from '@/lib/work-orders'
import { toNum } from '@/lib/utils'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const wo = await getWorkOrder(params.id)
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
    items: wo.items.map((item) => ({
      ...item,
      unitPrice: toNum(item.unitPrice),
    })),
  })
}
