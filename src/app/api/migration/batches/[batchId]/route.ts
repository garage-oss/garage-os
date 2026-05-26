import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: { batchId: string } },
) {
  const ctx = await requireOrg()
  if (ctx.memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  const batch = await prisma.migrationBatch.findFirst({
    where: { id: params.batchId, organizationId: ctx.orgId },
    include: {
      logs: {
        orderBy: { createdAt: 'desc' },
        take:    500,
      },
    },
  })

  if (!batch) {
    return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })
  }

  return NextResponse.json({ batch })
}
