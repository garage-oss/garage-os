import { NextRequest, NextResponse } from 'next/server'
import { getCustomerSession }       from '@/lib/customer-auth'
import { prisma }                   from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await getCustomerSession()
  if (!ctx) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const appointments = await prisma.appointment.findMany({
    where:   { customerId: ctx.customerId, scheduledAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    orderBy: { scheduledAt: 'asc' },
    include: { vehicle: { select: { plate: true, make: true, model: true } } },
  })

  return NextResponse.json({ appointments })
}

export async function POST(req: NextRequest) {
  const ctx = await getCustomerSession()
  if (!ctx) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const body = await req.json() as {
    bookingId:   string
    vehicleId:   string
    scheduledAt: string
    notes:       string
  }

  const { bookingId, vehicleId, scheduledAt, notes } = body
  if (!scheduledAt) return NextResponse.json({ error: 'נדרש תאריך' }, { status: 400 })

  const appt = await prisma.appointment.create({
    data: {
      organizationId:  ctx.organizationId,
      customerId:      ctx.customerId,
      vehicleId:       vehicleId || null,
      bookingId:       bookingId || null,
      scheduledAt:     new Date(scheduledAt),
      durationMinutes: 60,
      status:          'PENDING_CONFIRMATION',
      notes:           notes || null,
    },
  })

  // Update booking status if present
  if (bookingId) {
    await prisma.serviceBooking.update({
      where: { id: bookingId },
      data:  { status: 'CONFIRMED' },
    }).catch(() => null)
  }

  return NextResponse.json({ appointmentId: appt.id })
}
