import { NextRequest, NextResponse } from 'next/server'
import { getCustomerSession }       from '@/lib/customer-auth'
import { prisma }                   from '@/lib/prisma'
import { nesherVehicleHistory }     from '@/lib/nesher-connector'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { vehicleId: string } }
) {
  const ctx = await getCustomerSession()
  if (!ctx) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: params.vehicleId, customerId: ctx.customerId, organizationId: ctx.organizationId },
    select: { id: true, plate: true, make: true, model: true, year: true, color: true, vin: true, mileage: true, importSource: true },
  })

  if (!vehicle) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })

  // Pull NESHER history if vehicle came from NESHER
  const nesherHistory = vehicle.importSource === 'nesher'
    ? await nesherVehicleHistory(vehicle.plate)
    : null

  // Also fetch GarageOS work orders for this vehicle
  const workOrders = await prisma.workOrder.findMany({
    where:   { vehicleId: vehicle.id, organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    take:    30,
    select: {
      id: true, workOrderNumber: true, status: true, complaint: true,
      mileage: true, totalPrice: true, completedAt: true, createdAt: true,
      items: { select: { description: true, quantity: true, unitPrice: true } },
    },
  })

  return NextResponse.json({ vehicle, nesherHistory, workOrders })
}
