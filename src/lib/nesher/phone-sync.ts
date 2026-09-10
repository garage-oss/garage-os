/**
 * NESHER → GarageOS phone synchronization.
 *
 * Strategy (in order):
 *   1. Try connector GET /api/clients — returns cli_no, cli_phone, cli_pele
 *   2. Fall back: aggregate drv_phone per customer from work orders
 *
 * Phone sources in NESHER (dbo.ca_clients):
 *   cli_phone — landline / main phone
 *   cli_pele  — cellular / mobile (פלאפון)
 *
 * NESHER is READ-ONLY. No write of any kind goes back to NESHER.
 */

import { prisma } from '@/lib/prisma'

const CONNECTOR_URL = process.env.NESHER_CONNECTOR_URL    ?? ''
const CONNECTOR_KEY = process.env.NESHER_CONNECTOR_API_KEY ?? ''

// ─── Wire types ───────────────────────────────────────────────────────────────

interface ConnectorClient {
  cli_no:    number | string | null
  cli_phone: string | null
  cli_pele:  string | null
  [key: string]: unknown
}

interface WORow {
  cli_no:    number | null
  drv_phone: string | null
  [key: string]: unknown
}

// ─── Israeli phone normalizer ─────────────────────────────────────────────────

export function normalizeIsraeliPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Strip everything that isn't a digit or leading +
  const digits = trimmed.replace(/[^\d]/g, '')
  if (!digits) return null

  let normalized = digits

  // +972XXXXXXXXX → 0XXXXXXXXX
  if (normalized.startsWith('972') && normalized.length === 12) {
    normalized = '0' + normalized.slice(3)
  }
  // 00972XXXXXXXXX → 0XXXXXXXXX
  if (normalized.startsWith('00972') && normalized.length === 14) {
    normalized = '0' + normalized.slice(5)
  }

  // Must be 9 or 10 digits for Israeli numbers
  if (normalized.length < 9 || normalized.length > 10) return null

  // Reject placeholder patterns (all zeros or very sparse)
  if (/^0+$/.test(normalized)) return null
  if (normalized === '000000000' || normalized === '0000000000') return null

  return normalized
}

function isRealPhone(phone: string | null | undefined): boolean {
  const n = normalizeIsraeliPhone(phone)
  return n !== null
}

// ─── Connector client fetch (may not exist on older connector versions) ───────

async function fetchConnectorClients(): Promise<ConnectorClient[] | null> {
  if (!CONNECTOR_URL || !CONNECTOR_KEY) return null
  try {
    const res = await fetch(`${CONNECTOR_URL}/api/clients`, {
      headers: { 'x-api-key': CONNECTOR_KEY },
      signal:  AbortSignal.timeout(30_000),
      cache:   'no-store',
    })
    if (!res.ok) return null  // endpoint doesn't exist on this connector version
    const json = await res.json()
    const rows: ConnectorClient[] = Array.isArray(json) ? json : (json.data ?? json.rows ?? [])
    return rows.length > 0 ? rows : null
  } catch {
    return null
  }
}

// ─── Workorder-based phone fallback ──────────────────────────────────────────

async function fetchPhonesFromWorkorders(): Promise<Map<string, string>> {
  if (!CONNECTOR_URL || !CONNECTOR_KEY) return new Map()
  try {
    const res = await fetch(`${CONNECTOR_URL}/api/workorders?limit=5000`, {
      headers: { 'x-api-key': CONNECTOR_KEY },
      signal:  AbortSignal.timeout(30_000),
      cache:   'no-store',
    })
    if (!res.ok) return new Map()
    const json  = await res.json()
    const rows: WORow[] = json.rows ?? json.data ?? []

    // Aggregate: first non-null drv_phone per customer
    const phoneByCliNo = new Map<string, string>()
    for (const row of rows) {
      if (!row.cli_no) continue
      const key   = String(row.cli_no)
      if (phoneByCliNo.has(key)) continue
      const phone = normalizeIsraeliPhone(row.drv_phone)
      if (phone) phoneByCliNo.set(key, phone)
    }
    return phoneByCliNo
  } catch {
    return new Map()
  }
}

// ─── Public result type ───────────────────────────────────────────────────────

export interface PhoneSyncResult {
  source:          'connector_clients' | 'workorder_drv_phone' | 'none'
  nesherTable:     string
  nesherFields:    string[]
  totalNesherRows: number
  withRealPhone:   number
  withoutPhone:    number
  updatedInGarage: number
  skippedNoMatch:  number
  skippedNoPhone:  number
  skippedHadPhone: number
  failed:          number
  errors:          string[]
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runPhoneSync(orgId: string): Promise<PhoneSyncResult> {
  const errors: string[] = []

  // Build phone map: externalNo (cli_no as string) → normalized phone
  let phoneMap = new Map<string, string>()
  let source:  PhoneSyncResult['source'] = 'none'
  let nesherTable  = ''
  let nesherFields: string[] = []
  let totalNesherRows = 0

  // ── Attempt 1: /api/clients endpoint ────────────────────────────────────────
  const clients = await fetchConnectorClients()
  if (clients) {
    source       = 'connector_clients'
    nesherTable  = 'dbo.ca_clients'
    nesherFields = ['cli_phone', 'cli_pele']
    totalNesherRows = clients.length

    for (const c of clients) {
      if (!c.cli_no) continue
      const key = String(c.cli_no)
      // Prefer cli_pele (mobile) over cli_phone (landline)
      const phone = normalizeIsraeliPhone(c.cli_pele) ?? normalizeIsraeliPhone(c.cli_phone)
      if (phone) phoneMap.set(key, phone)
    }
  } else {
    // ── Attempt 2: drv_phone from work orders ──────────────────────────────────
    const woPhones = await fetchPhonesFromWorkorders()
    if (woPhones.size > 0) {
      source       = 'workorder_drv_phone'
      nesherTable  = 'dbo.ca_cards'
      nesherFields = ['drv_phone']
      phoneMap     = woPhones
    }
    // Set totalNesherRows below from map size
    totalNesherRows = phoneMap.size
  }

  const withRealPhone   = phoneMap.size
  const withoutPhone    = Math.max(0, totalNesherRows - withRealPhone)

  if (phoneMap.size === 0) {
    return {
      source, nesherTable, nesherFields, totalNesherRows,
      withRealPhone: 0, withoutPhone: totalNesherRows,
      updatedInGarage: 0, skippedNoMatch: 0, skippedNoPhone: 0,
      skippedHadPhone: 0, failed: 0, errors,
    }
  }

  // ── Load all NESHER-imported customers from GarageOS ────────────────────────
  const garageCusts = await prisma.customer.findMany({
    where:  { organizationId: orgId, importSource: 'NESHER' },
    select: { id: true, externalNo: true, phone: true },
  })

  // ── Update phone numbers ───────────────────────────────────────────────────
  let updatedInGarage = 0
  let skippedNoMatch  = 0
  let skippedNoPhone  = 0
  let skippedHadPhone = 0
  let failed          = 0

  const PLACEHOLDER_PHONES = new Set(['000000000', '0000000000', '', '0'])

  for (const cust of garageCusts) {
    const externalNo = cust.externalNo
    if (!externalNo) { skippedNoMatch++; continue }

    const newPhone = phoneMap.get(externalNo)
    if (!newPhone) { skippedNoPhone++; continue }

    // Don't overwrite a real existing phone
    const existingPhone = cust.phone?.trim() ?? ''
    if (existingPhone && !PLACEHOLDER_PHONES.has(existingPhone) && isRealPhone(existingPhone)) {
      skippedHadPhone++
      continue
    }

    try {
      await prisma.customer.update({
        where: { id: cust.id },
        data:  { phone: newPhone },
      })
      updatedInGarage++
    } catch (e) {
      failed++
      errors.push(`cust ${cust.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return {
    source, nesherTable, nesherFields, totalNesherRows,
    withRealPhone, withoutPhone,
    updatedInGarage, skippedNoMatch, skippedNoPhone, skippedHadPhone,
    failed, errors,
  }
}
