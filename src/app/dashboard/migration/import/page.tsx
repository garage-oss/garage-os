import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { ImportRunner } from '@/components/migration/ImportRunner'
import type { MappingPreset } from '@/lib/migration/types'

export default async function ImportPage() {
  const ctx = await requireOrg()

  const [dbPresets, dbBatches] = await Promise.all([
    prisma.migrationPreset.findMany({
      where:   { organizationId: ctx.orgId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.migrationBatch.findMany({
      where:   { organizationId: ctx.orgId },
      orderBy: { createdAt: 'desc' },
      take:    20,
      select: {
        id: true, status: true, isDryRun: true, isIncremental: true,
        presetsUsed: true, totalRows: true, imported: true, skipped: true,
        failed: true, rolledBack: true, startedAt: true, completedAt: true,
        createdAt: true, userName: true,
      },
    }),
  ])

  const presets: MappingPreset[] = dbPresets.map((p) => ({
    id:                p.id,
    name:              p.name,
    sourceTable:       p.sourceTable,
    targetEntity:      p.targetEntity as MappingPreset['targetEntity'],
    columnMappings:    p.columnMappings as MappingPreset['columnMappings'],
    filterSql:         p.filterSql ?? undefined,
    incrementalColumn: p.incrementalColumn ?? undefined,
  }))

  return <ImportRunner presets={presets} initialBatches={dbBatches} />
}
