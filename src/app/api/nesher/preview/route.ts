/**
 * Preview raw NESHER data — reads from the REST connector, no direct SQL.
 * The `table` parameter maps legacy SQL table names to connector data:
 *   ca_cards   → /api/workorders (actual work-order rows)
 *   ca_clients → aggregated customer summary from workorders
 *   ca_cars    → aggregated vehicle summary from workorders
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireOrg }               from '@/lib/org'

export const dynamic = 'force-dynamic'

const PREVIEW_LIMIT  = 20
const CONNECTOR_URL  = () => process.env.NESHER_CONNECTOR_URL  ?? ''
const CONNECTOR_KEY  = () => process.env.NESHER_CONNECTOR_API_KEY ?? ''

export async function GET(req: NextRequest) {
  const { memberRole } = await requireOrg()
  if (memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  const url = CONNECTOR_URL()
  const key = CONNECTOR_KEY()

  if (!url || !key) {
    return NextResponse.json({ error: 'Connector not configured' }, { status: 503 })
  }

  const table = req.nextUrl.searchParams.get('table') as
    | 'ca_clients' | 'ca_cars' | 'ca_cards' | null

  if (!table || !['ca_clients', 'ca_cars', 'ca_cards'].includes(table)) {
    return NextResponse.json({ error: 'table must be ca_clients | ca_cars | ca_cards' }, { status: 400 })
  }

  try {
    // All data comes from the /api/workorders endpoint — aggregate as needed
    const res = await fetch(`${url}/api/workorders?limit=100`, {
      headers: { 'x-api-key': key },
      signal:  AbortSignal.timeout(15000),
      cache:   'no-store',
    })
    if (!res.ok) {
      return NextResponse.json({ error: `Connector ${res.status}` }, { status: 502 })
    }
    const body = await res.json()
    const allRows = (body.rows ?? body.data ?? []) as Record<string, unknown>[]

    let rows: Record<string, unknown>[]

    if (table === 'ca_cards') {
      rows = allRows.slice(0, PREVIEW_LIMIT)
    } else if (table === 'ca_clients') {
      // Aggregate unique customers
      const map = new Map<number, Record<string, unknown>>()
      for (const r of allRows) {
        const cliNo = r.cli_no as number | null
        if (!cliNo) continue
        if (!map.has(cliNo)) {
          map.set(cliNo, {
            cli_no:    cliNo,
            cli_name:  r.cli_name,
            cli_email: r.cli_email,
            cli_type:  r.cli_type,
          })
        }
      }
      rows = Array.from(map.values()).slice(0, PREVIEW_LIMIT)
    } else {
      // ca_cars — aggregate unique vehicles
      const map = new Map<string, Record<string, unknown>>()
      for (const r of allRows) {
        const plate = ((r.car_no as string) ?? '').trim().toUpperCase()
        if (!plate) continue
        if (!map.has(plate)) {
          map.set(plate, {
            car_no:    plate,
            car_code:  r.car_code,
            car_model: r.car_model,
            car_desc:  r.car_desc,
            prod_dt:   r.prod_dt,
            car_color: r.car_color,
            cli_no:    r.cli_no,
          })
        }
      }
      rows = Array.from(map.values()).slice(0, PREVIEW_LIMIT)
    }

    const columns = rows.length > 0 ? Object.keys(rows[0]) : []
    return NextResponse.json({ table, columns, rows })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }
}
