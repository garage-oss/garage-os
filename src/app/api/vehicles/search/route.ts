import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/org'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const plate = req.nextUrl.searchParams.get('plate')?.trim()
  if (!plate || plate.length < 2) {
    return NextResponse.json({ vehicle: null, customer: null, matches: [] })
  }

  // Exact match first, then partial
  const vehicles = await prisma.vehicle.findMany({
    where: {
      organizationId: ctx.orgId,
      plate: { contains: plate, mode: 'insensitive' },
    },
    include: { customer: { select: { id: true, name: true, phone: true, email: true } } },
    orderBy: { updatedAt: 'desc' },
    take:    5,
  })

  if (vehicles.length === 0) {
    return NextResponse.json({ vehicle: null, customer: null, matches: [] })
  }

  // If only one result, return it as the primary match
  const primary   = vehicles[0]
  const remainder = vehicles.slice(1)

  return NextResponse.json({
    vehicle:  { id: primary.id, plate: primary.plate, make: primary.make, model: primary.model, year: primary.year, color: primary.color, vin: primary.vin, mileage: primary.mileage },
    customer: primary.customer,
    matches:  remainder.map((v) => ({
      vehicle:  { id: v.id, plate: v.plate, make: v.make, model: v.model, year: v.year },
      customer: v.customer,
    })),
  })
}
