/**
 * /api/portal/pilot/[customerId]
 *
 * PATCH  — disable/enable, set phone, update checklist
 * DELETE — permanently remove from pilot
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/prisma'
import { requireOrg }                from '@/lib/org'

export const dynamic = 'force-dynamic'

const CHECKLIST_KEYS = [
  'phoneVerified', 'vehiclesVerified', 'historyVerified',
  'loggedIn', 'quoteTested', 'apptTested', 'feedbackReceived',
] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: { customerId: string } },
) {
  const { memberRole, orgId } = await requireOrg()
  if (memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'OWNER בלבד' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    disabled?:      boolean
    notes?:         string
    phone?:         string
    checklist?:     Partial<Record<typeof CHECKLIST_KEYS[number], boolean>> & { checklistNotes?: string }
  }

  const pilot = await prisma.customerPilot.findFirst({
    where: { customerId: params.customerId, organizationId: orgId },
  })
  if (!pilot) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })

  // Update phone on local Customer record
  if (body.phone !== undefined) {
    const norm = body.phone.replace(/[^0-9]/g, '')
    await prisma.customer.update({
      where: { id: params.customerId },
      data:  { phone: norm || body.phone, mobile: norm || body.phone },
    })
  }

  // Build pilot update payload
  const pilotUpdate: Record<string, unknown> = {}

  if (body.disabled === true)  pilotUpdate.disabledAt = new Date()
  if (body.disabled === false) pilotUpdate.disabledAt = null
  if (body.notes !== undefined) pilotUpdate.notes = body.notes

  if (body.checklist) {
    for (const key of CHECKLIST_KEYS) {
      if (key in body.checklist) pilotUpdate[key] = body.checklist[key]
    }
    if ('checklistNotes' in body.checklist) pilotUpdate.checklistNotes = body.checklist.checklistNotes
  }

  const updated = await prisma.customerPilot.update({
    where: { customerId: params.customerId },
    data:  pilotUpdate,
  })

  return NextResponse.json({ success: true, pilot: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { customerId: string } },
) {
  const { memberRole, orgId } = await requireOrg()
  if (memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'OWNER בלבד' }, { status: 403 })
  }

  const pilot = await prisma.customerPilot.findFirst({
    where: { customerId: params.customerId, organizationId: orgId },
  })
  if (!pilot) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })

  await prisma.customerPilot.delete({ where: { customerId: params.customerId } })
  return NextResponse.json({ success: true })
}
