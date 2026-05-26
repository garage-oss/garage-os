import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/org'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, phone } = await req.json() as { name: string; phone: string }
  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: 'Missing name or phone' }, { status: 400 })
  }

  // Upsert: if customer with same phone exists in org, return them
  const existing = await prisma.customer.findFirst({
    where: { organizationId: ctx.orgId, phone: phone.trim() },
  })
  if (existing) return NextResponse.json({ id: existing.id })

  const customer = await prisma.customer.create({
    data: { organizationId: ctx.orgId, name: name.trim(), phone: phone.trim() },
  })
  return NextResponse.json({ id: customer.id })
}
