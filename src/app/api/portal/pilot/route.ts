/**
 * /api/portal/pilot — OWNER-only pilot allowlist management
 *
 * GET  — list all pilot customers with rich stats
 * POST — add a NESHER customer to the pilot (by cli_no)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/prisma'
import { requireOrg }                from '@/lib/org'
import { nesherCustomer }            from '@/lib/nesher-connector'
import { phoneVariants }             from '@/lib/sms'

export const dynamic = 'force-dynamic'

// ── GET — list pilot customers with rich data ─────────────────────────────────

export async function GET(_req: NextRequest) {
  const { memberRole, orgId } = await requireOrg()
  if (memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'OWNER בלבד' }, { status: 403 })
  }

  const pilots = await prisma.customerPilot.findMany({
    where:   { organizationId: orgId },
    orderBy: { addedAt: 'desc' },
    include: {
      customer: {
        select: {
          id: true, name: true, phone: true, mobile: true,
          importSource: true, importId: true,
          vehicles: {
            select: { id: true, plate: true, make: true, model: true, year: true },
          },
          sessions: {
            orderBy: { createdAt: 'desc' },
            take:    500,
            select:  { id: true, createdAt: true, lastActiveAt: true },
          },
          quotes: {
            select: { id: true, status: true, createdAt: true, quoteNumber: true },
          },
          appointments: {
            orderBy: { scheduledAt: 'desc' },
            select:  {
              id: true, scheduledAt: true, status: true,
              vehicle: { select: { plate: true, make: true, model: true } },
            },
          },
        },
      },
    },
  })

  return NextResponse.json({ pilots })
}

// ── POST — add customer to pilot ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { memberRole, orgId, userId } = await requireOrg()
  if (memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'OWNER בלבד' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    customerId?: string
    cliNo?:      string
    notes?:      string
  }

  let customer: { id: string; name: string } | null = null

  if (body.customerId) {
    customer = await prisma.customer.findFirst({
      where:  { id: body.customerId, organizationId: orgId },
      select: { id: true, name: true },
    })
    if (!customer) return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 })

  } else if (body.cliNo) {
    const cliNo = String(body.cliNo).trim()

    customer = await prisma.customer.findFirst({
      where:  { importSource: 'nesher', importId: cliNo, organizationId: orgId },
      select: { id: true, name: true },
    })

    if (!customer) {
      const nesherData = await nesherCustomer(cliNo)
      if (!nesherData) {
        return NextResponse.json(
          { error: 'לא ניתן לאחזר לקוח מ-NESHER — ודא שהקונקטור פועל' },
          { status: 502 },
        )
      }
      const nc = nesherData.customer
      customer = await prisma.customer.upsert({
        where:  { organizationId_importSource_importId: { organizationId: orgId, importSource: 'nesher', importId: String(nc.cli_no) } },
        create: { organizationId: orgId, name: nc.cli_name, phone: nc.phone ?? '', importSource: 'nesher', importId: String(nc.cli_no) },
        update: { name: nc.cli_name, phone: nc.phone ?? undefined },
        select: { id: true, name: true },
      })
    }

  } else {
    return NextResponse.json({ error: 'נדרש customerId או cliNo' }, { status: 400 })
  }

  const pilot = await prisma.customerPilot.upsert({
    where:  { customerId: customer.id },
    create: { customerId: customer.id, organizationId: orgId, addedByUserId: userId, notes: body.notes },
    update: { disabledAt: null, notes: body.notes ?? undefined, addedByUserId: userId },
  })

  return NextResponse.json({ success: true, pilot, customer })
}
