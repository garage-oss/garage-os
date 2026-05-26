import { requireOrg }           from '@/lib/org'
import { prisma }               from '@/lib/prisma'
import { MappingPageClient }    from '@/components/migration/MappingPageClient'
import type { MappingPreset }   from '@/lib/migration/types'

export default async function MappingPage() {
  const ctx = await requireOrg()

  const dbPresets = await prisma.migrationPreset.findMany({
    where:   { organizationId: ctx.orgId },
    orderBy: { createdAt: 'asc' },
  })

  const presets: MappingPreset[] = dbPresets.map(p => ({
    id:                p.id,
    name:              p.name,
    sourceTable:       p.sourceTable,
    targetEntity:      p.targetEntity as MappingPreset['targetEntity'],
    columnMappings:    p.columnMappings as MappingPreset['columnMappings'],
    filterSql:         p.filterSql         ?? undefined,
    incrementalColumn: p.incrementalColumn ?? undefined,
  }))

  return <MappingPageClient initialPresets={presets} />
}
