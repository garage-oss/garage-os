import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/org'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workOrderId, dataUrl } = await req.json() as { workOrderId: string; dataUrl: string }
  if (!workOrderId || !dataUrl) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Store data URL as signatureUrl on the work order.
  // In production, upload the data URL to storage and store the CDN URL instead.
  await prisma.workOrder.updateMany({
    where: { id: workOrderId, organizationId: ctx.orgId },
    data:  { signatureUrl: dataUrl },
  })

  return NextResponse.json({ ok: true })
}
