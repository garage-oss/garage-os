import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { runImport } from '@/lib/migration/importer'
import { createAuditLog } from "@/lib/audit"
import type { MappingPreset } from '@/lib/migration/types'

export async function POST(req: NextRequest) {
  const ctx = await requireOrg()
  if (ctx.memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  const {
    presetIds,
    isDryRun     = true,
    isIncremental = false,
    lastSyncAt,
  } = await req.json() as {
    presetIds:     string[]
    isDryRun?:     boolean
    isIncremental?: boolean
    lastSyncAt?:   string
  }

  if (!presetIds?.length) {
    return NextResponse.json({ error: 'presetIds required' }, { status: 400 })
  }

  // Load presets
  const dbPresets = await prisma.migrationPreset.findMany({
    where: { id: { in: presetIds }, organizationId: ctx.orgId },
  })
  if (!dbPresets.length) {
    return NextResponse.json({ error: 'פריסטים לא נמצאו' }, { status: 404 })
  }

  const presets: MappingPreset[] = dbPresets.map((p) => ({
    id:                p.id,
    name:              p.name,
    sourceTable:       p.sourceTable,
    targetEntity:      p.targetEntity as MappingPreset['targetEntity'],
    columnMappings:    p.columnMappings as MappingPreset['columnMappings'],
    filterSql:         p.filterSql ?? undefined,
    incrementalColumn: p.incrementalColumn ?? undefined,
  }))

  try {
    const summary = await runImport(presets, {
      orgId:         ctx.orgId,
      userId:        ctx.userId,
      userName:      ctx.userName ?? ctx.userEmail ?? 'מנהל',
      isDryRun,
      isIncremental,
      lastSyncAt:    lastSyncAt ? new Date(lastSyncAt) : undefined,
    })

    // Audit log (always, even for dry-runs)
    await createAuditLog({
      orgId:       ctx.orgId,
      userId:      ctx.userId,
      userEmail:   ctx.userEmail,
      userName:    ctx.userName,
      action:      'CREATE',
      entityType:  'MigrationBatch',
      entityId:    summary.batchId,
      entityLabel: isDryRun
        ? `Dry-run: ${summary.imported} ייבוא, ${summary.skipped} דילוג, ${summary.failed} שגיאה`
        : `ייבוא: ${summary.imported} נוצרו, ${summary.skipped} קיימים, ${summary.failed} שגיאות`,
    })

    return NextResponse.json({ summary })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'שגיאת ייבוא' },
      { status: 500 },
    )
  }
}
