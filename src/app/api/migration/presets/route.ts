import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import type { MappingPreset } from '@/lib/migration/types'

// GET — list all presets for this org
export async function GET() {
  const ctx = await requireOrg()
  if (ctx.memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  const presets = await prisma.migrationPreset.findMany({
    where:   { organizationId: ctx.orgId },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ presets })
}

// POST — create or update a preset
export async function POST(req: NextRequest) {
  const ctx = await requireOrg()
  if (ctx.memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  const body = await req.json() as Partial<MappingPreset> & { id?: string }

  const { id, name, sourceTable, targetEntity, columnMappings, filterSql, incrementalColumn } = body

  if (!name || !sourceTable || !targetEntity || !columnMappings?.length) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }

  if (id) {
    // Update existing
    const existing = await prisma.migrationPreset.findFirst({
      where: { id, organizationId: ctx.orgId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })
    }
    const updated = await prisma.migrationPreset.update({
      where: { id },
      data: {
        name, sourceTable, targetEntity,
        columnMappings: columnMappings as object[],
        filterSql: filterSql ?? null,
        incrementalColumn: incrementalColumn ?? null,
      },
    })
    return NextResponse.json({ preset: updated })
  }

  // Create new
  const preset = await prisma.migrationPreset.create({
    data: {
      organizationId: ctx.orgId,
      name, sourceTable, targetEntity,
      columnMappings: columnMappings as object[],
      filterSql: filterSql ?? null,
      incrementalColumn: incrementalColumn ?? null,
    },
  })
  return NextResponse.json({ preset }, { status: 201 })
}
