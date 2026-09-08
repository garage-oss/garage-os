import { NextRequest, NextResponse } from 'next/server'
import { getCustomerSession }        from '@/lib/customer-auth'
import { prisma }                    from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { vehicleId: string } }
) {
  const ctx = await getCustomerSession()
  if (!ctx) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const prefs = await prisma.documentReminderPreference.findMany({
    where: { customerId: ctx.customerId, vehicleId: params.vehicleId },
  })
  return NextResponse.json({ preferences: prefs })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { vehicleId: string } }
) {
  const ctx = await getCustomerSession()
  if (!ctx) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  // Confirm customer owns this vehicle
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: params.vehicleId, customerId: ctx.customerId, organizationId: ctx.organizationId },
    select: { id: true },
  })
  if (!vehicle) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { reminderType, enabled, snoozedUntil } = body as {
    reminderType?: string
    enabled?: boolean
    snoozedUntil?: string | null
  }
  if (!reminderType) return NextResponse.json({ error: 'reminderType נדרש' }, { status: 400 })

  const pref = await prisma.documentReminderPreference.upsert({
    where:  { customerId_vehicleId_reminderType: { customerId: ctx.customerId, vehicleId: vehicle.id, reminderType } },
    create: { customerId: ctx.customerId, vehicleId: vehicle.id, reminderType, enabled: enabled ?? true, snoozedUntil: snoozedUntil ? new Date(snoozedUntil) : null },
    update: { enabled: enabled ?? true, snoozedUntil: snoozedUntil ? new Date(snoozedUntil) : null },
  })
  return NextResponse.json({ preference: pref })
}
