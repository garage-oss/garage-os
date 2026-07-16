import { NextRequest, NextResponse } from 'next/server'
import { getCustomerSession }       from '@/lib/customer-auth'
import { prisma }                   from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await getCustomerSession()
  if (!ctx) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const bookings = await prisma.serviceBooking.findMany({
    where:   { customerId: ctx.customerId },
    orderBy: { createdAt: 'desc' },
    include: {
      vehicle:      { select: { plate: true, make: true, model: true } },
      appointments: { select: { id: true, scheduledAt: true, status: true, durationMinutes: true } },
    },
  })

  return NextResponse.json({ bookings })
}

export async function POST(req: NextRequest) {
  const ctx = await getCustomerSession()
  if (!ctx) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const body = await req.json() as {
    vehicleId:   string
    serviceType: string
    complaint:   string
    mileage:     number
    notes:       string
  }

  const { vehicleId, serviceType, complaint, mileage, notes } = body
  if (!vehicleId || !serviceType) {
    return NextResponse.json({ error: 'נדרשים רכב וסוג שירות' }, { status: 400 })
  }

  // Verify vehicle belongs to customer
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, customerId: ctx.customerId },
  })
  if (!vehicle) return NextResponse.json({ error: 'רכב לא נמצא' }, { status: 404 })

  const booking = await prisma.serviceBooking.create({
    data: {
      organizationId: ctx.organizationId,
      customerId:     ctx.customerId,
      vehicleId,
      serviceType,
      complaint:      complaint || null,
      mileage:        mileage   || null,
      notes:          notes     || null,
      status:         'PENDING',
    },
  })

  return NextResponse.json({ bookingId: booking.id })
}
