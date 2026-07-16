import { NextRequest, NextResponse } from 'next/server'
import { requireOrg }               from '@/lib/org'
import { searchNesherCustomers }    from '@/lib/nesher-connector'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { memberRole } = await requireOrg()
  if (memberRole !== 'OWNER' && memberRole !== 'MANAGER') {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const search = req.nextUrl.searchParams.get('search') ?? ''
  const limit  = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10)

  try {
    const customers = await searchNesherCustomers(search, limit)
    return NextResponse.json({ rows: customers, total: customers.length })
  } catch (e) {
    return NextResponse.json(
      { error: `שגיאה בחיפוש לקוחות: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    )
  }
}
