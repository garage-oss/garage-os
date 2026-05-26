/**
 * Israeli vehicle plate lookup via data.gov.il public API.
 *
 * Resource ID: 053cea08-09bc-40ec-8f7a-156f0677aff3
 * Cache TTL: 30 days (checked at read-time)
 */

import { prisma } from './prisma'
import { FuelType } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VehicleLookupResult = {
  plate:        string        // normalized digits only
  make:         string        // e.g. "TOYOTA"
  makeHe:       string        // Hebrew manufacturer name
  model:        string        // e.g. "COROLLA"
  trim?:        string        // commercial name / trim
  year:         number        // manufacture year
  fuelType?:    FuelType
  engineVolume?: number       // cc
  color?:       string        // Hebrew color name
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GOV_API =
  'https://data.gov.il/api/3/action/datastore_search'
const RESOURCE_ID = '053cea08-09bc-40ec-8f7a-156f0677aff3'
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000   // 30 days

// Hebrew fuel type → Prisma FuelType enum
const FUEL_MAP: Record<string, FuelType> = {
  'בנזין':   'GASOLINE',
  'דיזל':    'DIESEL',
  'גז':      'LPG',
  'גז ובנזין': 'LPG',
  'היברידי': 'HYBRID',
  'חשמל':    'ELECTRIC',
  'חשמלי':   'ELECTRIC',
}

// ─── Plate normalization / validation ─────────────────────────────────────────

/**
 * Strip dashes, spaces, dots from a plate string and validate it is either
 * 7 digits (old format XX-XXX-XX) or 8 digits (new format XXX-XX-XXX).
 *
 * Returns normalized digit-only string or `null` if the input is not a valid
 * Israeli plate.
 */
export function normalizePlate(raw: string): string | null {
  const digits = raw.replace(/[\s\-\.]/g, '')
  if (!/^\d{7,8}$/.test(digits)) return null
  return digits
}

// ─── Gov API fetch ─────────────────────────────────────────────────────────────

type GovRecord = {
  mispar_rechev:  string   // plate digits
  tozeret_nm:     string   // manufacturer name Hebrew
  degem_nm:       string   // model name (often English)
  kinuy_mishari?: string   // commercial trim name
  shnat_yitzur:   string   // year as string
  sug_delek_nm?:  string   // fuel type Hebrew
  nefah_manoa?:   string   // engine volume cc
  tzeva_rechev_nm?: string // color Hebrew
}

async function fetchFromGovApi(
  plate: string,
): Promise<VehicleLookupResult | null> {
  const filters = JSON.stringify({ mispar_rechev: plate })
  const url = `${GOV_API}?resource_id=${RESOURCE_ID}&filters=${encodeURIComponent(filters)}&limit=1`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      // 8-second timeout so the page doesn't hang on a slow gov server
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return null   // network/timeout error → graceful fallback
  }

  if (!res.ok) return null

  const json = await res.json().catch(() => null)
  const records: GovRecord[] = json?.result?.records ?? []
  if (!records.length) return null

  const r = records[0]

  const year = parseInt(r.shnat_yitzur, 10)
  if (!year || isNaN(year)) return null

  const fuelHe = r.sug_delek_nm?.trim() ?? ''
  // Try exact match first, then partial
  let fuelType: FuelType | undefined =
    FUEL_MAP[fuelHe] ??
    (Object.entries(FUEL_MAP).find(([k]) => fuelHe.includes(k))?.[1])

  const engineVolume = r.nefah_manoa
    ? parseInt(r.nefah_manoa, 10) || undefined
    : undefined

  return {
    plate,
    make:         r.tozeret_nm?.trim() ?? '',
    makeHe:       r.tozeret_nm?.trim() ?? '',
    model:        r.degem_nm?.trim() ?? '',
    trim:         r.kinuy_mishari?.trim() || undefined,
    year,
    fuelType,
    engineVolume,
    color:        r.tzeva_rechev_nm?.trim() || undefined,
  }
}

// ─── Cache read / write ────────────────────────────────────────────────────────

async function readCache(
  plate: string,
): Promise<VehicleLookupResult | null> {
  const row = await prisma.vehicleLookupCache.findUnique({
    where: { plate },
  })
  if (!row) return null

  const age = Date.now() - row.fetchedAt.getTime()
  if (age > CACHE_TTL_MS) {
    // Stale — delete and return null so caller re-fetches
    await prisma.vehicleLookupCache.delete({ where: { plate } }).catch(() => {})
    return null
  }

  return row.data as VehicleLookupResult
}

async function writeCache(
  plate: string,
  data: VehicleLookupResult,
): Promise<void> {
  await prisma.vehicleLookupCache.upsert({
    where:  { plate },
    create: { plate, data: data as object, source: 'gov_il' },
    update: { data: data as object, fetchedAt: new Date(), source: 'gov_il' },
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up an Israeli vehicle by plate.
 *
 * 1. Normalize plate → validate format
 * 2. Check DB cache (30-day TTL)
 * 3. Fetch from data.gov.il
 * 4. Save to cache
 *
 * Returns `null` if the plate is invalid or not found.
 */
export async function lookupVehicle(
  rawPlate: string,
): Promise<VehicleLookupResult | null> {
  const plate = normalizePlate(rawPlate)
  if (!plate) return null

  const cached = await readCache(plate)
  if (cached) return cached

  const result = await fetchFromGovApi(plate)
  if (!result) return null

  await writeCache(plate, result).catch(() => {})   // non-fatal

  return result
}
