/**
 * Vehicle plate lookup — provider-agnostic.
 *
 * Lookup chain (priority order):
 *   1. Mock fleet   — in-process; always wins for known demo plates
 *   2. DB cache     — PostgreSQL; 30-day TTL for gov.il results
 *   3. Gov.il API   — data.gov.il public vehicle registry
 *
 * Swapping providers:
 *   To connect Neshar / AutoData / HaynesPro / TecAlliance, implement
 *   VehicleLookupProvider and insert it before or after the mock step.
 *   The rest of the system (PeriodicServicePanel, /api/periodic-quote)
 *   consumes VehicleLookupResult and requires no changes.
 */

import { prisma }   from './prisma'
import { FuelType } from '@prisma/client'

// ─── Provider contract ────────────────────────────────────────────────────────

/**
 * Universal shape returned by every lookup provider.
 *
 * `transmission`  canonical enum value — used for schedule matching:
 *                 "MANUAL" | "AUTOMATIC" | "CVT"
 * `gearbox`       human-readable display name — shown on the vehicle card:
 *                 "DSG7", "DCT6", "8AT", "6MT", "E-CVT", etc.
 *                 Omitting it falls back to the canonical label.
 */
export type VehicleLookupResult = {
  plate:          string        // normalized digits only
  make:           string        // "SKODA" — English uppercase, matches MaintenanceSchedule
  makeHe:         string        // "סקודה" — Hebrew display
  model:          string        // "OCTAVIA"
  trim?:          string        // engine label: "1.5 TSI", "2.0 GDI"
  year:           number        // manufacture year
  fuelType?:      FuelType
  engineVolume?:  number        // cc — 1498, 1999, …
  transmission?:  string        // canonical: "MANUAL" | "AUTOMATIC" | "CVT"
  gearbox?:       string        // display: "DSG7", "DCT6", "8AT", "6MT", "E-CVT"
  color?:         string        // Hebrew color name (gov.il only)
}

/** Implement this interface to add any new provider */
export type VehicleLookupProvider = (plate: string) => Promise<VehicleLookupResult | null>

// ─── Mock fleet ───────────────────────────────────────────────────────────────
//
// In-process demo data.  All plates here are returned instantly without a DB
// or network call.  Add entries to cover any plate used in demos / tests.
//
// When a real provider is wired in, plates NOT in this map will fall through
// to the DB cache and then to gov.il (or whatever production provider you set).

type MockEntry = Omit<VehicleLookupResult, 'plate'>

const MOCK_FLEET: Record<string, MockEntry> = {

  // ── Skoda ──────────────────────────────────────────────────────────────────
  '12345678': {
    make: 'SKODA',      makeHe: 'סקודה',      model: 'OCTAVIA',
    trim: '1.5 TSI',    year: 2020,            fuelType: 'GASOLINE',
    engineVolume: 1498, transmission: 'AUTOMATIC', gearbox: 'DSG7',
  },
  '55566777': {
    make: 'SKODA',      makeHe: 'סקודה',      model: 'OCTAVIA',
    trim: '1.5 TSI',    year: 2018,            fuelType: 'GASOLINE',
    engineVolume: 1498, transmission: 'AUTOMATIC', gearbox: 'DSG7',
  },

  // ── KIA ───────────────────────────────────────────────────────────────────
  '33344555': {
    make: 'KIA',        makeHe: 'קיה',         model: 'SPORTAGE',
    trim: '2.0 GDI',   year: 2022,             fuelType: 'GASOLINE',
    engineVolume: 1999, transmission: 'AUTOMATIC', gearbox: 'DCT6',
  },

  // ── Toyota ────────────────────────────────────────────────────────────────
  '77788899': {
    make: 'TOYOTA',     makeHe: 'טויוטה',      model: 'COROLLA',
    trim: '1.8 VVTi',  year: 2019,             fuelType: 'HYBRID',
    engineVolume: 1798, transmission: 'CVT',    gearbox: 'E-CVT',
  },
  '12312312': {
    make: 'TOYOTA',     makeHe: 'טויוטה',      model: 'COROLLA',
    trim: '2.0 GR Sport', year: 2022,           fuelType: 'HYBRID',
    engineVolume: 1987, transmission: 'CVT',    gearbox: 'Direct CVT',
  },

  // ── Hyundai ───────────────────────────────────────────────────────────────
  '98765432': {
    make: 'HYUNDAI',    makeHe: 'יונדאי',      model: 'TUCSON',
    trim: '1.6 T-GDI',  year: 2023,            fuelType: 'GASOLINE',
    engineVolume: 1591, transmission: 'AUTOMATIC', gearbox: '7DCT',
  },
  '11100022': {
    make: 'HYUNDAI',    makeHe: 'יונדאי',      model: 'KONA',
    trim: '1.0 T-GDI',  year: 2022,            fuelType: 'GASOLINE',
    engineVolume: 998,  transmission: 'AUTOMATIC', gearbox: '7DCT',
  },

  // ── Volkswagen ────────────────────────────────────────────────────────────
  '11122233': {
    make: 'VOLKSWAGEN', makeHe: 'פולקסווגן',  model: 'GOLF',
    trim: '1.5 TSI',    year: 2022,            fuelType: 'GASOLINE',
    engineVolume: 1498, transmission: 'AUTOMATIC', gearbox: 'DSG7',
  },

  // ── Mazda ─────────────────────────────────────────────────────────────────
  '44455566': {
    make: 'MAZDA',      makeHe: 'מאזדה',       model: 'CX-5',
    trim: '2.0 Skyactiv-G', year: 2022,         fuelType: 'GASOLINE',
    engineVolume: 1998, transmission: 'AUTOMATIC', gearbox: '6AT',
  },

  // ── Renault ───────────────────────────────────────────────────────────────
  '22233344': {
    make: 'RENAULT',    makeHe: 'רנו',          model: 'CLIO',
    trim: '1.0 TCe',    year: 2021,             fuelType: 'GASOLINE',
    engineVolume: 999,  transmission: 'MANUAL',  gearbox: '5MT',
  },

  // ── Honda ─────────────────────────────────────────────────────────────────
  '66677788': {
    make: 'HONDA',      makeHe: 'הונדה',        model: 'CIVIC',
    trim: '1.5 VTEC Turbo', year: 2020,          fuelType: 'GASOLINE',
    engineVolume: 1498, transmission: 'CVT',     gearbox: 'CVT',
  },

  // ── Nissan ────────────────────────────────────────────────────────────────
  '99900011': {
    make: 'NISSAN',     makeHe: 'ניסאן',        model: 'QASHQAI',
    trim: '1.3 DIG-T',  year: 2021,             fuelType: 'GASOLINE',
    engineVolume: 1332, transmission: 'AUTOMATIC', gearbox: 'DCT7',
  },

  // ── Dacia ─────────────────────────────────────────────────────────────────
  '55544433': {
    make: 'DACIA',      makeHe: 'דאציה',        model: 'SANDERO',
    trim: '1.0 TCe',    year: 2022,             fuelType: 'GASOLINE',
    engineVolume: 999,  transmission: 'MANUAL',  gearbox: '5MT',
  },

  // ── Tesla ─────────────────────────────────────────────────────────────────
  '88800099': {
    make: 'TESLA',      makeHe: 'טסלה',         model: 'MODEL 3',
    trim: 'Long Range', year: 2023,             fuelType: 'ELECTRIC',
    engineVolume: 0,    transmission: 'AUTOMATIC', gearbox: 'Single Speed',
  },
}

/**
 * Mock provider — returns full vehicle data for every plate in MOCK_FLEET.
 * Drop-in replacement for any real provider during development / demos.
 *
 * Future providers follow the same signature:
 *   export const nesharProvider:   VehicleLookupProvider = async (plate) => { … }
 *   export const autoDataProvider: VehicleLookupProvider = async (plate) => { … }
 */
export const mockLookupProvider: VehicleLookupProvider = async (plate) => {
  const entry = MOCK_FLEET[plate]
  return entry ? { plate, ...entry } : null
}

// ─── Plate normalization ──────────────────────────────────────────────────────

/**
 * Strip dashes / spaces / dots; validate 7–8 digit Israeli plate format.
 * Returns normalized digit-only string or `null` if invalid.
 */
export function normalizePlate(raw: string): string | null {
  const digits = raw.replace(/[\s\-\.]/g, '')
  if (!/^\d{7,8}$/.test(digits)) return null
  return digits
}

// ─── Gov.il provider ──────────────────────────────────────────────────────────

const GOV_API        = 'https://data.gov.il/api/3/action/datastore_search'
const RESOURCE_ID    = '053cea08-09bc-40ec-8f7a-156f0677aff3'
const CACHE_TTL_MS   = 30 * 24 * 60 * 60 * 1000   // 30 days

const FUEL_MAP: Record<string, FuelType> = {
  'בנזין':     'GASOLINE',
  'דיזל':      'DIESEL',
  'גז':        'LPG',
  'גז ובנזין': 'LPG',
  'היברידי':   'HYBRID',
  'חשמל':      'ELECTRIC',
  'חשמלי':     'ELECTRIC',
}

type GovRecord = {
  mispar_rechev:    string
  tozeret_nm:       string
  degem_nm:         string
  kinuy_mishari?:   string
  shnat_yitzur:     string
  sug_delek_nm?:    string
  nefah_manoa?:     string
  tzeva_rechev_nm?: string
}

export const govIlProvider: VehicleLookupProvider = async (plate) => {
  const filters = JSON.stringify({ mispar_rechev: plate })
  const url = `${GOV_API}?resource_id=${RESOURCE_ID}&filters=${encodeURIComponent(filters)}&limit=1`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal:  AbortSignal.timeout(8000),
    })
  } catch {
    return null
  }

  if (!res.ok) return null

  const json = await res.json().catch(() => null)
  const records: GovRecord[] = json?.result?.records ?? []
  if (!records.length) return null

  const r    = records[0]
  const year = parseInt(r.shnat_yitzur, 10)
  if (!year || isNaN(year)) return null

  const fuelHe   = r.sug_delek_nm?.trim() ?? ''
  const fuelType =
    FUEL_MAP[fuelHe] ??
    (Object.entries(FUEL_MAP).find(([k]) => fuelHe.includes(k))?.[1])

  const engineVolume = r.nefah_manoa ? parseInt(r.nefah_manoa, 10) || undefined : undefined

  return {
    plate,
    make:         r.tozeret_nm?.trim() ?? '',
    makeHe:       r.tozeret_nm?.trim() ?? '',
    model:        r.degem_nm?.trim() ?? '',
    trim:         r.kinuy_mishari?.trim() || undefined,
    year,
    fuelType,
    engineVolume,
    // gov.il does not supply transmission or gearbox
    color:        r.tzeva_rechev_nm?.trim() || undefined,
  }
}

// ─── DB cache ─────────────────────────────────────────────────────────────────

async function readCache(plate: string): Promise<VehicleLookupResult | null> {
  const row = await prisma.vehicleLookupCache.findUnique({ where: { plate } })
  if (!row) return null

  if (Date.now() - row.fetchedAt.getTime() > CACHE_TTL_MS) {
    await prisma.vehicleLookupCache.delete({ where: { plate } }).catch(() => {})
    return null
  }

  return row.data as VehicleLookupResult
}

async function writeCache(plate: string, data: VehicleLookupResult): Promise<void> {
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
 * Priority:
 *   1. Mock fleet   — instant, in-process, full spec (make/model/year/fuel/transmission/gearbox)
 *   2. DB cache     — 30-day TTL PostgreSQL cache
 *   3. Gov.il API   — live government registry (fuel only; no transmission)
 *
 * Returns `null` if the plate is invalid or completely unknown.
 */
export async function lookupVehicle(rawPlate: string): Promise<VehicleLookupResult | null> {
  const plate = normalizePlate(rawPlate)
  if (!plate) return null

  // 1. Mock fleet — always wins for demo plates
  const mock = await mockLookupProvider(plate)
  if (mock) return mock

  // 2. DB cache
  const cached = await readCache(plate)
  if (cached) return cached

  // 3. Gov.il
  const result = await govIlProvider(plate)
  if (!result) return null

  await writeCache(plate, result).catch(() => {})
  return result
}
