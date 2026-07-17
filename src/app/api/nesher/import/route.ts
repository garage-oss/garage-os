import { NextRequest, NextResponse }                     from 'next/server'
import { requireOrg }                                   from '@/lib/org'
import { hanesherConfigured }                           from '@/lib/mssql'
import { dryRunNesherImport, runNesherImport }          from '@/lib/nesher/importer'
import { runNesherImportViaConnector }                  from '@/lib/nesher/connector-importer'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { orgId, memberRole } = await requireOrg()
  if (memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { dryRun, limit, cursor = null, page = 1 } = body as {
    dryRun?:  boolean
    limit?:   number
    cursor?:  number | null
    page?:    number
  }

  try {
    if (dryRun) {
      if (!hanesherConfigured()) {
        return NextResponse.json({ error: 'חיבור ישיר ל-SQL לא מוגדר' }, { status: 503 })
      }
      const result = await dryRunNesherImport(orgId, limit)
      return NextResponse.json(result)
    }

    // Real import: prefer connector path
    const useConnector = !hanesherConfigured() || !!process.env.NESHER_CONNECTOR_URL
    if (useConnector) {
      // Cursor-based: process ONE page per call, return nextCursor for continuation
      const result = await runNesherImportViaConnector(orgId, cursor ?? null, page)
      return NextResponse.json(result)
    }

    const result = await runNesherImport(orgId, limit)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }
}
