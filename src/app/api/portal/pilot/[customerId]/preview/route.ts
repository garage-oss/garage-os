import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/prisma'
import { requireOrg }                from '@/lib/org'
import { randomBytes }               from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: { customerId: string } },
) {
  const { memberRole, orgId, userId, userName } = await requireOrg()
  if (memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'OWNER בלבד' }, { status: 403 })
  }

  const pilot = await prisma.customerPilot.findFirst({
    where:   { customerId: params.customerId, organizationId: orgId },
    include: { customer: { select: { name: true, importId: true } } },
  })
  if (!pilot)            return NextResponse.json({ error: 'לא נמצא בפיילוט' }, { status: 404 })
  if (pilot.disabledAt)  return NextResponse.json({ error: 'גישה מושבתת' },     { status: 403 })

  const token     = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.customerPreviewToken.create({
    data: { token, customerId: params.customerId, organizationId: orgId, createdById: userId, expiresAt },
  })

  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      userId,
      userName,
      action:      'CREATE',
      entityType:  'CustomerPreviewToken',
      entityId:    params.customerId,
      entityLabel: pilot.customer.name,
      afterData:   { previewedBy: userName, customerName: pilot.customer.name, expiresAt },
    },
  })

  const base = process.env.CUSTOMER_PORTAL_BASE_URL ?? 'http://localhost:3000'
  return NextResponse.json({ url: `${base}/portal/preview/${token}`, expiresAt, expiresInMinutes: 10 })
}
