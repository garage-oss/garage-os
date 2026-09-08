import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = process.env.INTERNAL_RESET_SECRET
  if (!secret || req.headers.get('x-reset-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const cid = new URL(req.url).searchParams.get('cid') ?? 'cmrp6qx9m003p8ahxhxta9yfl'

  try {
    const customer = await prisma.customer.findFirst({
      where: { id: cid },
      include: {
        vehicles: {
          include: { _count: { select: { workOrders: true } } },
          orderBy: { createdAt: 'desc' },
        },
        workOrders: {
          include: { vehicle: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { vehicles: true, workOrders: true } },
        pilotRecord: true,
      },
    })
    return NextResponse.json({ ok: true, found: !!customer, name: customer?.name ?? null })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
