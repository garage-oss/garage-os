import { NextRequest, NextResponse }                     from 'next/server'
import { requireOrg }                                   from '@/lib/org'
import { hanesherConfigured }                           from '@/lib/mssql'
import { dryRunNesherImport, runNesherImport }          from '@/lib/nesher/importer'
import { runNesherImportViaConnector }                  from '@/lib/nesher/connector-importer'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60  // seconds — needed for bulk upserts on Hobby plan

export async function POST(req: NextRequest) {
  const { orgId, memberRole } = await requireOrg()
  if (memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { dryRun, limit } = body as { dryRun?: boolean; limit?: number }

  try {
    if (dryRun) {
      // Dry-run requires direct MSSQL access
      if (!hanesherConfigured()) {
        return NextResponse.json({ error: 'חיבור ישיר ל-SQL לא מוגדר' }, { status: 503 })
      }
      const result = await dryRunNesherImport(orgId, limit)
      return NextResponse.json(result)
    } else {
      // Real import: prefer direct MSSQL if configured, fall back to REST connector
      const useConnector = !hanesherConfigured() || !!process.env.NESHER_CONNECTOR_URL
      const result = useConnector
        ? await runNesherImportViaConnector(orgId)
        : await runNesherImport(orgId, limit)
      return NextResponse.json(result)
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }
}
