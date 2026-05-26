import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const ctx = await requireOrg()
  if (ctx.memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  const batches = await prisma.migrationBatch.findMany({
    where:   { organizationId: ctx.orgId },
    orderBy: { createdAt: 'desc' },
    take:    50,
    select: {
      id: true, status: true, isDryRun: true, isIncremental: true,
      presetsUsed: true, totalRows: true, imported: true, skipped: true,
      failed: true, rolledBack: true, startedAt: true, completedAt: true,
      createdAt: true, userName: true,
    },
  })

  return NextResponse.json({ batches })
}
