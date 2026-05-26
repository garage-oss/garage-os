import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { presetId: string } },
) {
  const ctx = await requireOrg()
  if (ctx.memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  const { presetId } = params
  const existing = await prisma.migrationPreset.findFirst({
    where: { id: presetId, organizationId: ctx.orgId },
  })
  if (!existing) {
    return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })
  }

  await prisma.migrationPreset.delete({ where: { id: presetId } })
  return NextResponse.json({ ok: true })
}
