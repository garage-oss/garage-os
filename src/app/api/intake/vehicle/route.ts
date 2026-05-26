import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { FuelType } from '@prisma/client'

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { customerId, plate, make, model, year, mileage, fuelType, engine } = await req.json() as {
    customerId: string; plate: string; make: string; model: string; year: number
    mileage?: number; fuelType?: FuelType; engine?: string
  }
  if (!customerId || !plate || !make || !model || !year) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Upsert by plate + org
  const existing = await prisma.vehicle.findFirst({
    where: { organizationId: ctx.orgId, plate: plate.trim().toUpperCase() },
  })
  if (existing) {
    // Update mileage + technical fields if provided
    await prisma.vehicle.update({
      where: { id: existing.id },
      data: {
        ...(mileage   ? { mileage }   : {}),
        ...(fuelType  ? { fuelType }  : {}),
        ...(engine    ? { engine }    : {}),
      },
    })
    return NextResponse.json({ id: existing.id })
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      organizationId: ctx.orgId,
      customerId,
      plate:    plate.trim().toUpperCase(),
      make:     make.trim(),
      model:    model.trim(),
      year,
      mileage:  mileage  ?? null,
      fuelType: fuelType ?? null,
      engine:   engine   ?? null,
    },
  })
  return NextResponse.json({ id: vehicle.id })
}
