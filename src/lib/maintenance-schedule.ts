/**
 * Maintenance Schedule Engine
 *
 * Resolves a structured service schedule for a vehicle + mileage.
 *
 * Matching priority:
 *   1. Exact match  — make + model + year range + fuelType + transmission
 *   2. Partial match — make + model + year range (any fuelType / transmission)
 *   3. Generic fallback — keyed by fuelType only (make = '__generic__')
 *
 * The engine NEVER hands off to AI for schedule items.
 * AI is allowed to explain or annotate, but the returned item list is always
 * sourced from this structured data.
 *
 * LABOR_RATE and VAT_RATE are kept in sync with quote-engine.ts.
 */

import { prisma } from './prisma'

// ─── Constants ────────────────────────────────────────────────────────────────

export const LABOR_RATE_ILS = 295
export const VAT_RATE       = 0.17

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VehicleSpec {
  make:          string
  model:         string
  year:          number
  mileage:       number
  fuelType?:     string | null
  transmission?: string | null
}

export interface ServiceItem {
  category:   string
  nameHe:     string
  quantity:   number
  unitPrice:  number
  laborHours: number
  required:   boolean
  notes?:     string
  sortOrder:  number
}

export interface ScheduleResult {
  scheduleId:       string
  intervalKm:       number
  scheduledMileage: number   // nearest milestone for this vehicle (e.g. 60 000)
  intervalLabel:    string   // "טיפול 60,000 ק״מ"
  items:            ServiceItem[]
  totalLaborHours:  number
  requiredLaborHours: number
  partsTotal:       number   // required parts only (sum of unitPrice × qty)
  laborTotal:       number   // requiredLaborHours × LABOR_RATE_ILS
  laborRate:        number
  subtotal:         number
  vat:              number
  total:            number
  isGeneric:        boolean   // true if no exact match → generic fallback used
  matchNote?:       string    // e.g. "התאמה לפי דגם בלבד (סוג דלק לא ידוע)"
  scheduleNotes?:   string    // notes from the schedule record itself
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise manufacturer name for comparison — title-case, trimmed */
function normaliseMake(s: string): string {
  return s.trim()
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
}

/** Round a mileage to the nearest multiple of intervalKm */
function nearestMilestone(mileage: number, intervalKm: number): number {
  return Math.round(mileage / intervalKm) * intervalKm
}

function formatMileage(km: number): string {
  return km.toLocaleString('he-IL')
}

/** Convert a Prisma MaintenanceItem (Decimal fields) to ServiceItem */
function toServiceItem(row: {
  category:   string
  nameHe:     string
  quantity:   number
  unitPrice:  { toNumber: () => number } | number
  laborHours: { toNumber: () => number } | number
  required:   boolean
  notes:      string | null
  sortOrder:  number
}): ServiceItem {
  const price  = typeof row.unitPrice  === 'number' ? row.unitPrice  : row.unitPrice.toNumber()
  const labour = typeof row.laborHours === 'number' ? row.laborHours : row.laborHours.toNumber()
  return {
    category:   row.category,
    nameHe:     row.nameHe,
    quantity:   row.quantity,
    unitPrice:  price,
    laborHours: labour,
    required:   row.required,
    notes:      row.notes ?? undefined,
    sortOrder:  row.sortOrder,
  }
}

function buildResult(
  scheduleId: string,
  intervalKm: number,
  mileage: number,
  items: ServiceItem[],
  isGeneric: boolean,
  matchNote: string | undefined,
  scheduleNotes: string | undefined,
): ScheduleResult {
  const scheduledMileage = nearestMilestone(mileage, intervalKm)
  const label = `טיפול ${formatMileage(scheduledMileage)} ק״מ`

  const requiredItems = items.filter(i => i.required)

  const totalLaborHours    = round2(items.reduce((s, i) => s + i.laborHours, 0))
  const requiredLaborHours = round2(requiredItems.reduce((s, i) => s + i.laborHours, 0))

  const partsTotal = round2(requiredItems
    .filter(i => i.category !== 'INSPECTION')
    .reduce((s, i) => s + i.unitPrice * i.quantity, 0))

  const laborTotal = round2(requiredLaborHours * LABOR_RATE_ILS)
  const subtotal   = round2(laborTotal + partsTotal)
  const vat        = round2(subtotal * VAT_RATE)
  const total      = round2(subtotal + vat)

  return {
    scheduleId,
    intervalKm,
    scheduledMileage,
    intervalLabel: label,
    items: [...items].sort((a, b) => a.sortOrder - b.sortOrder),
    totalLaborHours,
    requiredLaborHours,
    partsTotal,
    laborTotal,
    laborRate: LABOR_RATE_ILS,
    subtotal,
    vat,
    total,
    isGeneric,
    matchNote,
    scheduleNotes,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─── DB Queries ───────────────────────────────────────────────────────────────

const ITEM_SELECT = {
  id: true, category: true, nameHe: true,
  quantity: true, unitPrice: true, laborHours: true,
  required: true, notes: true, sortOrder: true,
}

/** Find the best matching schedule row for a vehicle spec */
async function findSchedule(
  spec: VehicleSpec,
): Promise<{ scheduleId: string; isGeneric: boolean; matchNote?: string; scheduleNotes?: string; rows: ServiceItem[] } | null> {
  const make  = normaliseMake(spec.make)
  const model = spec.model.trim()
  const year  = spec.year
  const fuel  = spec.fuelType  ?? null
  const trans = spec.transmission ?? null

  // ── Pass 1: exact — make + model + year + fuelType + transmission ────────────
  if (fuel && trans) {
    const exact = await prisma.maintenanceSchedule.findFirst({
      where: {
        make:         { equals: make,  mode: 'insensitive' },
        model:        { equals: model, mode: 'insensitive' },
        yearFrom:     { lte: year },
        yearTo:       { gte: year },
        fuelType:     fuel,
        transmission: trans,
      },
      include: { items: { select: ITEM_SELECT } },
    })
    if (exact) {
      return {
        scheduleId: exact.id,
        isGeneric:  false,
        scheduleNotes: exact.notes ?? undefined,
        rows: exact.items.map(toServiceItem),
      }
    }
  }

  // ── Pass 2: make + model + year + fuelType (any transmission) ───────────────
  if (fuel) {
    const byFuel = await prisma.maintenanceSchedule.findFirst({
      where: {
        make:     { equals: make,  mode: 'insensitive' },
        model:    { equals: model, mode: 'insensitive' },
        yearFrom: { lte: year },
        yearTo:   { gte: year },
        fuelType: fuel,
      },
      include: { items: { select: ITEM_SELECT } },
    })
    if (byFuel) {
      return {
        scheduleId: byFuel.id,
        isGeneric:  false,
        matchNote:  'התאמה לפי יצרן, דגם וסוג דלק',
        scheduleNotes: byFuel.notes ?? undefined,
        rows: byFuel.items.map(toServiceItem),
      }
    }
  }

  // ── Pass 3: make + model + year (any fuel/trans) ─────────────────────────────
  const byModel = await prisma.maintenanceSchedule.findFirst({
    where: {
      make:     { equals: make,  mode: 'insensitive' },
      model:    { equals: model, mode: 'insensitive' },
      yearFrom: { lte: year },
      yearTo:   { gte: year },
      NOT: { make: '__generic__' },
    },
    include: { items: { select: ITEM_SELECT } },
  })
  if (byModel) {
    return {
      scheduleId: byModel.id,
      isGeneric:  false,
      matchNote:  'התאמה לפי יצרן ודגם בלבד — סוג דלק לא אומת',
      scheduleNotes: byModel.notes ?? undefined,
      rows: byModel.items.map(toServiceItem),
    }
  }

  // ── Pass 4: generic fallback by fuel type ────────────────────────────────────
  const resolvedFuel = fuel ?? 'GASOLINE'
  const generic = await prisma.maintenanceSchedule.findFirst({
    where: {
      make:     '__generic__',
      model:    '__generic__',
      fuelType: resolvedFuel,
    },
    include: { items: { select: ITEM_SELECT } },
  })
  if (generic) {
    return {
      scheduleId: generic.id,
      isGeneric:  true,
      matchNote:  'לא נמצאה התאמה ספציפית — נעשה שימוש בלוח זמנים כללי',
      scheduleNotes: generic.notes ?? undefined,
      rows: generic.items.map(toServiceItem),
    }
  }

  return null
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve the maintenance schedule for a vehicle + mileage.
 *
 * Returns null only when the DB contains no generic fallback (should never
 * happen after seeding).
 */
export async function resolveSchedule(
  spec: VehicleSpec,
): Promise<ScheduleResult | null> {
  const match = await findSchedule(spec)
  if (!match) return null

  // Determine interval from the matched schedule record
  const schedRow = await prisma.maintenanceSchedule.findUnique({
    where:  { id: match.scheduleId },
    select: { intervalKm: true },
  })
  const intervalKm = schedRow?.intervalKm ?? 60000

  return buildResult(
    match.scheduleId,
    intervalKm,
    spec.mileage,
    match.rows,
    match.isGeneric,
    match.matchNote,
    match.scheduleNotes,
  )
}

// ─── Category labels ─────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<string, string> = {
  OIL:           'שמן מנוע',
  FILTER_OIL:    'פילטר שמן',
  FILTER_AIR:    'פילטר אוויר',
  FILTER_CABIN:  'פילטר קבין',
  FILTER_FUEL:   'פילטר דלק',
  SPARK_PLUGS:   'מצתים',
  GLOW_PLUGS:    'נרות לבה',
  BRAKE_FLUID:   'נוזל בלמים',
  GEARBOX_OIL:   'שמן גיר',
  INSPECTION:    'בדיקה',
}

export const CATEGORY_ICONS: Record<string, string> = {
  OIL:           '🛢️',
  FILTER_OIL:    '🔩',
  FILTER_AIR:    '💨',
  FILTER_CABIN:  '🌿',
  FILTER_FUEL:   '⛽',
  SPARK_PLUGS:   '⚡',
  GLOW_PLUGS:    '🔥',
  BRAKE_FLUID:   '🔴',
  GEARBOX_OIL:   '⚙️',
  INSPECTION:    '🔍',
}
