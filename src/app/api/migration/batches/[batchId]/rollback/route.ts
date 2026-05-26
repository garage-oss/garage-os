import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { rollbackBatch } from '@/lib/migration/importer'
import { createAuditLog } from "@/lib/audit"

export async function POST(
  _req: NextRequest,
  { params }: { params: { batchId: string } },
) {
  const ctx = await requireOrg()
  if (ctx.memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  const batch = await prisma.migrationBatch.findFirst({
    where: { id: params.batchId, organizationId: ctx.orgId },
  })
  if (!batch) {
    return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })
  }
  if (batch.rolledBack) {
    return NextResponse.json({ error: 'כבר בוצע ביטול' }, { status: 400 })
  }
  if (batch.isDryRun) {
    return NextResponse.json({ error: 'לא ניתן לבטל dry-run' }, { status: 400 })
  }

  await rollbackBatch(params.batchId, ctx.orgId)

  await createAuditLog({
    orgId:       ctx.orgId,
    userId:      ctx.userId,
    userEmail:   ctx.userEmail,
    userName:    ctx.userName,
    action:      'DELETE',
    entityType:  'MigrationBatch',
    entityId:    params.batchId,
    entityLabel: `Rollback batch — ${batch.imported} רשומות נמחקו`,
  })

  return NextResponse.json({ ok: true })
}
