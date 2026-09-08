import { NextRequest, NextResponse } from 'next/server'
import { requireOrg }               from '@/lib/org'
import { prisma }                   from '@/lib/prisma'

interface Params { params: { id: string } }

const ALLOWED_ROLES = ['OWNER', 'MANAGER']

// POST — enable pilot for customer
export async function POST(req: NextRequest, { params }: Params) {
  const org = await requireOrg()
  if (!ALLOWED_ROLES.includes(org.memberRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const customer = await prisma.customer.findFirst({
    where:  { id: params.id, organizationId: org.orgId },
    select: { id: true },
  })
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))

  const record = await prisma.customerPilot.upsert({
    where:  { customerId: params.id },
    create: {
      customerId:     params.id,
      organizationId: org.orgId,
      addedByUserId:  org.userId,
      disabledAt:     null,
      notes:          body.notes ?? null,
    },
    update: { disabledAt: null },
  })

  return NextResponse.json({ ok: true, record })
}

// DELETE — disable pilot for customer (soft disable)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const org = await requireOrg()
  if (!ALLOWED_ROLES.includes(org.memberRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const customer = await prisma.customer.findFirst({
    where:  { id: params.id, organizationId: org.orgId },
    select: { id: true },
  })
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.customerPilot.updateMany({
    where: { customerId: params.id, organizationId: org.orgId },
    data:  { disabledAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
