import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/org'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { customerId, plate, make, model, year, mileage } = await req.json() as {
    customerId: string; plate: string; make: string; model: string; year: number; mileage?: number
  }
  if (!customerId || !plate || !make || !model || !year) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Upsert by plate + org
  const existing = await prisma.vehicle.findFirst({
    where: { organizationId: ctx.orgId, plate: plate.trim().toUpperCase() },
  })
  if (existing) {
    // Update mileage if provided
    if (mileage) await prisma.vehicle.update({ where: { id: existing.id }, data: { mileage } })
    return NextResponse.json({ id: existing.id })
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      organizationId: ctx.orgId,
      customerId,
      plate: plate.trim().toUpperCase(),
      make:  make.trim(),
      model: model.trim(),
      year,
      mileage: mileage ?? null,
    },
  })
  return NextResponse.json({ id: vehicle.id })
}
