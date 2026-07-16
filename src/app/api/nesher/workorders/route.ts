/**
 * Server-side proxy for the GarageOS-Connector work orders endpoint.
 *
 * Architecture: Browser → this route → GarageOS-Connector (localhost:4000) → SQL
 * The Next.js application never connects to SQL directly.
 *
 * Security: OWNER role required. The x-api-key never reaches the browser.
 * Read-only: performs only GET requests to the connector.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireOrg }               from '@/lib/org'

export const dynamic = 'force-dynamic'

export interface NesherWorkOrder {
  card_id?:   number | null
  card_no?:   string | null
  open_dt?:   string | null
  close_dt?:  string | null
  car_no?:    string | null
  cli_name?:  string | null
  car_desc?:  string | null
  cli_comp1?: string | null
  tarif?:     number | null
  part_tot?:  number | null
  work_tot?:  number | null
  total?:     number | null
  [key: string]: unknown
}

export async function GET(req: NextRequest) {
  const { memberRole } = await requireOrg()
  if (memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  const connectorUrl = process.env.NESHER_CONNECTOR_URL || 'http://localhost:4000'
  const apiKey       = process.env.NESHER_CONNECTOR_API_KEY || ''

  if (!apiKey) {
    return NextResponse.json(
      { error: 'NESHER_CONNECTOR_API_KEY לא מוגדר. הוסף את המפתח ל-.env.local ואתחל את השרת.' },
      { status: 503 },
    )
  }

  const limit = req.nextUrl.searchParams.get('limit') ?? '100'

  try {
    const upstream = await fetch(
      `${connectorUrl}/api/workorders?limit=${encodeURIComponent(limit)}`,
      {
        headers: { 'x-api-key': apiKey, 'Accept': 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(30000),
      },
    )

    // Pass through the connector's exact body and status — no modification
    const body = await upstream.text()
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: `לא ניתן להגיע לקונקטור: ${msg}` },
      { status: 502 },
    )
  }
}
