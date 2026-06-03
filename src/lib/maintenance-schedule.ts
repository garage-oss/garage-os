/**
 * Maintenance Schedule Engine — David Malka Service Book
 *
 * Resolves the correct service interval for a vehicle + mileage.
 *
 * Matching priority (4 passes):
 *   1. Exact   — make + model + year + fuelType + transmission
 *   2. Fuel    — make + model + year + fuelType  (any transmission)
 *   3. Model   — make + model + year             (any fuel/trans)
 *   4. Generic — fuelType only (make = '__generic__')
 *
 * For each pass, ALL matching schedules (across all intervals) are fetched.
 * The interval whose `intervalKm` is closest to (but ≤) the vehicle's mileage
 * is selected. If the mileage is below the smallest interval, the first service
 * is returned.
 *
 * The engine NEVER hands off to AI for schedule items.
 * AI is allowed to explain or annotate, but the item list is always sourced
 * from this structured data.
 *
 * Supported intervals: 15,000 / 30,000 / 60,000 / 90,000 / 120,000 km
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
  /** REQUIRED | RECOMMENDED | SAFETY */
  priority:   string
  notes?:     string
  sortOrder:  number
}

export interface GroupedItems {
  required:    ServiceItem[]
  recommended: ServiceItem[]
  safety:      ServiceItem[]
}

/** Split items into the three advisory tiers */
export function groupByPriority(items: ServiceItem[]): GroupedItems {
  return {
    required:    items.filter(i => i.priority === 'REQUIRED'),
    recommended: items.filter(i => i.priority === 'RECOMMENDED'),
    safety:      items.filter(i => i.priority === 'SAFETY'),
  }
}

export interface ScheduleResult {
  scheduleId:        string
  intervalKm:        number
  scheduledMileage:  number   // = intervalKm of the selected schedule
  nextIntervalKm?:   number   // next service interval in the same schedule group
  intervalLabel:     string   // "טיפול 60,000 ק״מ"
  items:             ServiceItem[]
  totalLaborHours:   number
  requiredLaborHours: number
  partsTotal:        number   // required parts only (sum unitPrice × qty)
  laborTotal:        number   // requiredLaborHours × LABOR_RATE_ILS
  laborRate:         number
  subtotal:          number
  vat:               number
  total:             number
  isGeneric:         boolean  // true if generic fallback was used
  matchNote?:        string   // e.g. "התאמה לפי דגם בלבד"
  scheduleNotes?:    string   // notes from the schedule record
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normaliseMake(s: string): string {
  return s.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function formatMileage(km: number): string {
  return km.toLocaleString('he-IL')
}

/**
 * Given a list of available intervalKm values and the vehicle's current mileage,
 * returns the highest interval that is ≤ mileage.
 * If the mileage is below all intervals, returns the smallest interval (first service).
 */
function selectInterval(intervals: number[], mileage: number): number {
  // Deduplicate without spread-on-Set (es5 target)
  const seen: Record<number, boolean> = {}
  const unique: number[] = []
  for (const km of intervals) { if (!seen[km]) { seen[km] = true; unique.push(km) } }
  const sorted = unique.sort((a, b) => a - b)
  if (sorted.length === 0) return 60000
  const past = sorted.filter(km => km <= mileage)
  return past.length > 0 ? past[past.length - 1] : sorted[0]
}

/** Convert a Prisma MaintenanceItem (Decimal fields) to ServiceItem */
function toServiceItem(row: {
  category:   string
  nameHe:     string
  quantity:   number
  unitPrice:  { toNumber: () => number } | number
  laborHours: { toNumber: () => number } | number
  required:   boolean
  priority:   string
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
    priority:   row.priority,
    notes:      row.notes ?? undefined,
    sortOrder:  row.sortOrder,
  }
}

function buildResult(
  scheduleId:    string,
  intervalKm:    number,
  items:         ServiceItem[],
  isGeneric:     boolean,
  matchNote:     string | undefined,
  scheduleNotes: string | undefined,
): ScheduleResult {
  const label = `טיפול ${formatMileage(intervalKm)} ק״מ`

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
    scheduledMileage: intervalKm,
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
  required: true, priority: true, notes: true, sortOrder: true,
}

const SCHED_SELECT = { id: true, intervalKm: true, notes: true }

type SchedRow = { id: string; intervalKm: number; notes: string | null }

interface FindSchedulesResult {
  schedules:  SchedRow[]
  isGeneric:  boolean
  matchNote?: string
}

/**
 * Find ALL schedules matching a vehicle (across all intervals).
 * Returns the best-quality match group (4 passes).
 */
async function findSchedules(spec: VehicleSpec): Promise<FindSchedulesResult | null> {
  const make  = normaliseMake(spec.make)
  const model = spec.model.trim()
  const year  = spec.year
  const fuel  = spec.fuelType  ?? null
  const trans = spec.transmission ?? null

  // ── Pass 1: exact — make + model + year + fuelType + transmission ────────────
  if (fuel && trans) {
    const rows = await prisma.maintenanceSchedule.findMany({
      where: {
        make:         { equals: make,  mode: 'insensitive' },
        model:        { equals: model, mode: 'insensitive' },
        yearFrom:     { lte: year },
        yearTo:       { gte: year },
        fuelType:     fuel,
        transmission: trans,
      },
      select: SCHED_SELECT,
    })
    if (rows.length > 0) return { schedules: rows, isGeneric: false }
  }

  // ── Pass 2: make + model + year + fuelType (any transmission) ───────────────
  if (fuel) {
    const rows = await prisma.maintenanceSchedule.findMany({
      where: {
        make:     { equals: make, mode: 'insensitive' },
        model:    { equals: model, mode: 'insensitive' },
        yearFrom: { lte: year },
        yearTo:   { gte: year },
        fuelType: fuel,
        NOT: { make: '__generic__' },
      },
      select: SCHED_SELECT,
    })
    if (rows.length > 0) {
      return { schedules: rows, isGeneric: false, matchNote: 'התאמה לפי יצרן, דגם וסוג דלק' }
    }
  }

  // ── Pass 3: make + model + year (any fuel/trans) ─────────────────────────────
  const byModel = await prisma.maintenanceSchedule.findMany({
    where: {
      make:     { equals: make, mode: 'insensitive' },
      model:    { equals: model, mode: 'insensitive' },
      yearFrom: { lte: year },
      yearTo:   { gte: year },
      NOT: { make: '__generic__' },
    },
    select: SCHED_SELECT,
  })
  if (byModel.length > 0) {
    return {
      schedules: byModel,
      isGeneric: false,
      matchNote: 'התאמה לפי יצרן ודגם בלבד — נדרש אימות לפי קוד מנוע / גיר לפני שליחה ללקוח',
    }
  }

  // ── Pass 4: generic fallback by fuelType ─────────────────────────────────────
  const resolvedFuel = fuel ?? 'GASOLINE'
  const generic = await prisma.maintenanceSchedule.findMany({
    where: {
      make:     '__generic__',
      model:    '__generic__',
      fuelType: resolvedFuel,
    },
    select: SCHED_SELECT,
  })
  if (generic.length > 0) {
    return {
      schedules: generic,
      isGeneric: true,
      matchNote: 'לא נמצאה התאמה ספציפית — לוח זמנים כללי. נדרש אימות לפי קוד מנוע והוראות יצרן לפני שליחה ללקוח.',
    }
  }

  return null
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve the maintenance schedule for a vehicle + mileage.
 *
 * Selects the highest interval ≤ mileage from the best-matching schedule group.
 * Returns null only when the DB has no generic fallback (should never happen
 * after seeding).
 */
export async function resolveSchedule(spec: VehicleSpec): Promise<ScheduleResult | null> {
  const match = await findSchedules(spec)
  if (!match) return null

  // Pick the best interval for this mileage
  const targetKm    = selectInterval(match.schedules.map(s => s.intervalKm), spec.mileage)
  const targetSched = match.schedules.find(s => s.intervalKm === targetKm)!

  // Compute the next interval above the matched one (for "next service" display)
  const seenKm: Record<number, boolean> = {}
  const sortedKms: number[] = []
  for (const s of match.schedules) {
    if (!seenKm[s.intervalKm]) { seenKm[s.intervalKm] = true; sortedKms.push(s.intervalKm) }
  }
  sortedKms.sort((a, b) => a - b)
  const currentIdx    = sortedKms.indexOf(targetKm)
  const nextIntervalKm = (currentIdx >= 0 && currentIdx < sortedKms.length - 1)
    ? sortedKms[currentIdx + 1]
    : undefined

  // Load full items for the selected schedule
  const full = await prisma.maintenanceSchedule.findUnique({
    where:   { id: targetSched.id },
    include: { items: { select: ITEM_SELECT } },
  })
  if (!full) return null

  const result = buildResult(
    targetSched.id,
    targetKm,
    full.items.map(toServiceItem),
    match.isGeneric,
    match.matchNote,
    targetSched.notes ?? undefined,
  )
  return { ...result, nextIntervalKm }
}

// ─── Category labels ─────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<string, string> = {
  // ── Required tier ─────────────────────────────────────────────────────────
  OIL:            'שמן מנוע',
  FILTER_OIL:     'פילטר שמן',
  FILTER_AIR:     'פילטר אוויר',
  FILTER_CABIN:   'פילטר קבין',
  FILTER_FUEL:    'פילטר דלק',
  SPARK_PLUGS:    'מצתים',
  GLOW_PLUGS:     'נרות לבה',
  BRAKE_FLUID:    'נוזל בלמים',
  GEARBOX_OIL:    'שמן גיר',
  TIMING_BELT:    'רצועת תזמון',
  INSPECTION:     'בדיקה',
  // ── Recommended tier ──────────────────────────────────────────────────────
  BATTERY:        'מצבר',
  ALIGNMENT:      'יישור גלגלים',
  INJECTOR_CLEAN: 'ניקוי מזרקים',
  // ── Safety tier ───────────────────────────────────────────────────────────
  BRAKE_PADS:     'רפידות בלם',
  TIRES:          'צמיגים',
  SUSPENSION:     'מתלים',
}

export const CATEGORY_ICONS: Record<string, string> = {
  // ── Required tier ─────────────────────────────────────────────────────────
  OIL:            '🛢️',
  FILTER_OIL:     '🔩',
  FILTER_AIR:     '💨',
  FILTER_CABIN:   '🌿',
  FILTER_FUEL:    '⛽',
  SPARK_PLUGS:    '⚡',
  GLOW_PLUGS:     '🔥',
  BRAKE_FLUID:    '🔴',
  GEARBOX_OIL:    '⚙️',
  TIMING_BELT:    '🔗',
  INSPECTION:     '🔍',
  // ── Recommended tier ──────────────────────────────────────────────────────
  BATTERY:        '🔋',
  ALIGNMENT:      '🎯',
  INJECTOR_CLEAN: '💉',
  // ── Safety tier ───────────────────────────────────────────────────────────
  BRAKE_PADS:     '🛑',
  TIRES:          '🏎️',
  SUSPENSION:     '🔩',
}
