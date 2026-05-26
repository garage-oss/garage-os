import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/org'
import { detectTables } from '@/lib/migration/detector'
import { hanesherConfigured } from '@/lib/mssql'

export async function GET() {
  const ctx = await requireOrg()
  if (ctx.memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  if (!hanesherConfigured()) {
    return NextResponse.json({ error: 'לא מוגדר' }, { status: 400 })
  }

  try {
    // withRowCounts=true — slightly slower but gives user useful info
    const tables = await detectTables(true)
    return NextResponse.json({ tables })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'שגיאת חיבור' },
      { status: 500 },
    )
  }
}
