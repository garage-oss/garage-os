/**
 * Server-side only — API key never reaches browser.
 *
 * The remote connector (GarageOS-Connector on WIN-P8FLBRLS3T0) exposes only:
 *   GET /health
 *   GET /api/workorders?limit=N
 *
 * All customer / vehicle / history queries are derived by fetching workorders
 * and aggregating them in-process. The connector response shape varies between
 * versions: new = { rows, total }  /  old = { success, count, data }.
 */

const CONNECTOR_URL = process.env.NESHER_CONNECTOR_URL  ?? ''
const CONNECTOR_KEY = process.env.NESHER_CONNECTOR_API_KEY ?? ''

// ─── Raw workorder row (superset of both connector versions) ──────────────────

type WORow = {
  card_id?:   number | null
  card_no?:   number | null
  open_dt?:   string | null
  close_dt?:  string | null
  car_no?:    string | null
  cli_no?:    number | null
  cli_name?:  string | null
  car_desc?:  string | null
  prod_dt?:   string | null
  part_tot?:  number | null
  work_tot?:  number | null
  outw_tot?:  number | null
  tarif?:     number | null
  card_st?:   string | null
  card_km?:   number | null
  cli_comp1?: string | null
  cli_comp2?: string | null
  cli_comp3?: string | null
  cli_comp4?: string | null
  cli_comp5?: string | null
  drv_name?:  string | null
  drv_phone?: string | null
  cli_email?: string | null
  cli_type?:  string | null
  [key: string]: unknown
}

// ─── Fetch all workorders from the connector ──────────────────────────────────
// Cached per-request via a module-level singleton so multiple callers in the
// same server request don't each do a round-trip.
//
// Note: Next.js server components share module state within a request in dev.
// For production edge correctness this is intentionally a fresh call each request.

async function fetchWorkorders(limit = 2000): Promise<WORow[]> {
  if (!CONNECTOR_URL || !CONNECTOR_KEY) return []
  try {
    const r = await fetch(`${CONNECTOR_URL}/api/workorders?limit=${limit}`, {
      headers: { 'x-api-key': CONNECTOR_KEY },
      signal:  AbortSignal.timeout(30000),
      cache:   'no-store',
    })
    if (!r.ok) return []
    const body = await r.json()
    // Handle both connector response formats
    const rows: WORow[] = body.rows ?? body.data ?? []
    return rows
  } catch {
    return []
  }
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface NesherCustomerSummary {
  cli_no:        number
  cli_name:      string
  phone:         string | null
  order_count:   number
  vehicle_count: number
  last_visit_dt: string | null
}

export interface NesherVehicle {
  car_no:        string
  car_desc:      string | null
  prod_dt:       string | null
  last_km:       number | null
  last_visit_dt: string | null
  order_count:   number
}

export interface NesherHistoryRow {
  card_no:   number | null
  open_dt:   string | null
  car_no:    string | null
  cli_comp1: string | null
  card_km:   number | null
  total:     number
  card_st:   string | null
}

// ─── Search customers ─────────────────────────────────────────────────────────

export async function searchNesherCustomers(
  search: string,
  limit = 50,
): Promise<NesherCustomerSummary[]> {
  const rows = await fetchWorkorders(3000)
  return aggregateCustomers(rows, search, limit)
}

// ─── Single customer by cli_no ────────────────────────────────────────────────

export async function nesherCustomer(cliNo: string): Promise<{
  customer: { cli_no: number; cli_name: string; cli_type: string | null; cli_email: string | null; phone: string | null; last_visit_dt: string | null; order_count: number }
  vehicles: NesherVehicle[]
  history:  NesherHistoryRow[]
} | null> {
  const cliNoInt = parseInt(cliNo, 10)
  if (isNaN(cliNoInt)) return null

  const rows = await fetchWorkorders(3000)
  const mine = rows.filter(r => r.cli_no === cliNoInt)
  if (!mine.length) return null

  const first = mine[0]
  const phones = mine.map(r => r.drv_phone).filter(Boolean) as string[]

  // Aggregate vehicles
  const vMap = new Map<string, NesherVehicle>()
  for (const r of mine) {
    const plate = (r.car_no ?? '').trim()
    if (!plate) continue
    const v = vMap.get(plate)
    if (!v) {
      vMap.set(plate, {
        car_no:        plate,
        car_desc:      r.car_desc ?? null,
        prod_dt:       r.prod_dt   ?? null,
        last_km:       r.card_km   ?? null,
        last_visit_dt: r.open_dt   ?? null,
        order_count:   1,
      })
    } else {
      v.order_count++
      if (r.card_km) v.last_km = r.card_km
      if (r.open_dt && (!v.last_visit_dt || r.open_dt > v.last_visit_dt)) {
        v.last_visit_dt = r.open_dt
      }
    }
  }

  const vehicles: NesherVehicle[] = []
  vMap.forEach(v => vehicles.push(v))

  // Sort history by card_id desc (most recent first)
  const sortedMine: WORow[] = []
  mine.forEach(r => sortedMine.push(r))
  const sorted = sortedMine.sort((a, b) => (b.card_id ?? 0) - (a.card_id ?? 0)).slice(0, 30)
  const history: NesherHistoryRow[] = sorted.map(r => ({
    card_no:   r.card_no  ?? null,
    open_dt:   r.open_dt  ?? null,
    car_no:    r.car_no   ?? null,
    cli_comp1: r.cli_comp1 ?? null,
    card_km:   r.card_km  ?? null,
    total:     (r.part_tot ?? 0) + (r.work_tot ?? 0) + (r.outw_tot ?? 0),
    card_st:   r.card_st  ?? null,
  }))

  return {
    customer: {
      cli_no:        cliNoInt,
      cli_name:      first.cli_name ?? '',
      cli_type:      first.cli_type  ?? null,
      cli_email:     first.cli_email ?? null,
      phone:         phones[0]       ?? null,
      last_visit_dt: mine.map(r => r.open_dt ?? '').filter(Boolean).sort().at(-1) ?? null,
      order_count:   mine.length,
    },
    vehicles,
    history,
  }
}

// ─── Vehicle history by plate ─────────────────────────────────────────────────

export async function nesherVehicleHistory(plate: string): Promise<NesherHistoryRow[] | null> {
  if (!plate) return null
  const norm = plate.trim().toUpperCase()
  const rows  = await fetchWorkorders(3000)
  const mine  = rows
    .filter(r => (r.car_no ?? '').trim().toUpperCase() === norm)
    .sort((a, b) => (b.card_id ?? 0) - (a.card_id ?? 0))
    .slice(0, 50)

  if (!mine.length) return null

  return mine.map(r => ({
    card_no:   r.card_no  ?? null,
    open_dt:   r.open_dt  ?? null,
    car_no:    r.car_no   ?? null,
    cli_comp1: r.cli_comp1 ?? null,
    card_km:   r.card_km  ?? null,
    total:     (r.part_tot ?? 0) + (r.work_tot ?? 0) + (r.outw_tot ?? 0),
    card_st:   r.card_st  ?? null,
  }))
}

// ─── Aggregation helper ───────────────────────────────────────────────────────

function aggregateCustomers(
  rows: WORow[],
  search: string,
  limit: number,
): NesherCustomerSummary[] {
  const map  = new Map<number, NesherCustomerSummary>()
  const vmap = new Map<number, Set<string>>()

  for (const r of rows) {
    const cliNo = r.cli_no
    if (!cliNo) continue

    const existing = map.get(cliNo)
    if (!existing) {
      map.set(cliNo, {
        cli_no:        cliNo,
        cli_name:      r.cli_name   ?? '',
        phone:         r.drv_phone  ?? null,
        order_count:   1,
        vehicle_count: 0,
        last_visit_dt: r.open_dt    ?? null,
      })
      vmap.set(cliNo, new Set())
    } else {
      existing.order_count++
      if (!existing.phone && r.drv_phone) existing.phone = r.drv_phone
      if (r.open_dt && (!existing.last_visit_dt || r.open_dt > existing.last_visit_dt)) {
        existing.last_visit_dt = r.open_dt
      }
    }

    const plate = (r.car_no ?? '').trim()
    if (plate) vmap.get(cliNo)!.add(plate)
  }

  // Attach vehicle counts
  vmap.forEach((plates, cliNo) => {
    const c = map.get(cliNo)
    if (c) c.vehicle_count = plates.size
  })

  const results2: NesherCustomerSummary[] = []
  map.forEach(v => results2.push(v))
  let results = results2

  if (search) {
    const q = search.toLowerCase().replace(/[^0-9a-zא-ת]/g, '')
    results = results.filter(c => {
      const nameNorm  = c.cli_name.toLowerCase().replace(/[^0-9a-zא-ת]/g, '')
      const phoneNorm = (c.phone ?? '').replace(/\D/g, '')
      return (
        nameNorm.includes(q) ||
        String(c.cli_no).includes(search) ||
        phoneNorm.includes(search.replace(/\D/g, ''))
      )
    })
  }

  return results
    .sort((a, b) => (b.last_visit_dt ?? '') > (a.last_visit_dt ?? '') ? 1 : -1)
    .slice(0, limit)
}
