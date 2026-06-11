import { NextRequest, NextResponse } from 'next/server'
import { requireOrg }               from '@/lib/org'
import { hanesherConfigured }        from '@/lib/mssql'
import { fetchClients, fetchCars, fetchCards } from '@/lib/nesher/queries'

export const dynamic = 'force-dynamic'

const PREVIEW_LIMIT = 20

export async function GET(req: NextRequest) {
  const { memberRole } = await requireOrg()
  if (memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  if (!hanesherConfigured()) {
    return NextResponse.json({ error: 'חיבור לא מוגדר' }, { status: 503 })
  }

  const table = req.nextUrl.searchParams.get('table') as
    | 'ca_clients' | 'ca_cars' | 'ca_cards' | null

  if (!table || !['ca_clients', 'ca_cars', 'ca_cards'].includes(table)) {
    return NextResponse.json({ error: 'table must be ca_clients | ca_cars | ca_cards' }, { status: 400 })
  }

  try {
    let rows: Record<string, unknown>[]
    if (table === 'ca_clients') rows = (await fetchClients(PREVIEW_LIMIT)) as unknown as Record<string, unknown>[]
    else if (table === 'ca_cars') rows = (await fetchCars(PREVIEW_LIMIT)) as unknown as Record<string, unknown>[]
    else rows = (await fetchCards(PREVIEW_LIMIT)) as unknown as Record<string, unknown>[]

    const columns = rows.length > 0 ? Object.keys(rows[0]) : []

    return NextResponse.json({ table, columns, rows })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }
}
