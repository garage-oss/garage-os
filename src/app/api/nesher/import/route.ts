import { NextRequest, NextResponse }               from 'next/server'
import { requireOrg }                             from '@/lib/org'
import { hanesherConfigured }                     from '@/lib/mssql'
import { dryRunNesherImport, runNesherImport }    from '@/lib/nesher/importer'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { orgId, memberRole } = await requireOrg()
  if (memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  if (!hanesherConfigured()) {
    return NextResponse.json({ error: 'חיבור לא מוגדר' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const { dryRun, limit } = body as { dryRun?: boolean; limit?: number }

  try {
    if (dryRun) {
      const result = await dryRunNesherImport(orgId, limit)
      return NextResponse.json(result)
    } else {
      const result = await runNesherImport(orgId, limit)
      return NextResponse.json(result)
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }
}
