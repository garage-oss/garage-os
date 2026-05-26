import { NextRequest, NextResponse } from 'next/server'
import { requireOrg } from '@/lib/org'
import { previewRows } from '@/lib/migration/detector'

export async function GET(req: NextRequest) {
  const ctx = await requireOrg()
  if (ctx.memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  const params    = req.nextUrl.searchParams
  const table     = params.get('table')     ?? ''
  const schema    = params.get('schema')    ?? 'dbo'
  const filterSql = params.get('filter')    ?? undefined
  const limit     = Math.min(parseInt(params.get('limit') ?? '20'), 100)

  if (!table) {
    return NextResponse.json({ error: 'table param required' }, { status: 400 })
  }

  try {
    const rows = await previewRows(schema, table, limit, filterSql)
    return NextResponse.json({ rows })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'שגיאת שאילתה' },
      { status: 500 },
    )
  }
}
