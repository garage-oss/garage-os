import { NextResponse } from 'next/server'
import { getCustomerSession } from '@/lib/customer-auth'
import { prisma }             from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await getCustomerSession()
  if (!ctx) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const vehicles = await prisma.vehicle.findMany({
    where:   { customerId: ctx.customerId, organizationId: ctx.organizationId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, plate: true, make: true, model: true, year: true,
      color: true, vin: true, mileage: true, importSource: true, importId: true,
      createdAt: true, updatedAt: true,
    },
  })

  return NextResponse.json({ vehicles })
}
