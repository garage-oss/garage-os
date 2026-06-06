/**
 * POST /api/periodic-quote
 *
 * Plate-first periodic service quote.
 *
 * Minimal body:  { vehiclePlate, vehicleMileage }
 * Full body:     { vehiclePlate, vehicleMileage, vehicleMake, vehicleModel,
 *                  vehicleYear, vehicleFuelType, vehicleTransmission }
 *
 * Priority:
 *   1. Manufacturer schedule from DB (exact → fuel → model → generic)
 *   2. Hardcoded baseline quote   — never blocks the advisor
 *
 * No AI is involved. The response is 100% rule-based.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext }     from '@/lib/org'
import { resolveSchedule, LABOR_RATE_ILS, VAT_RATE } from '@/lib/maintenance-schedule'
import { lookupVehicle }     from '@/lib/vehicle-lookup'
import type { ScheduleResult, ServiceItem } from '@/lib/maintenance-schedule'

// ─── Hardcoded fallback — used when no DB schedule is found ──────────────────
//
// Contains the minimum set of items every basic periodic service should cover.
// The advisor reviews and edits before sending to the customer.

const FALLBACK_ITEMS: ServiceItem[] = [
  { category: 'OIL',          nameHe: 'שמן מנוע',             quantity: 1, unitPrice: 90,  laborHours: 0,   required: true, priority: 'REQUIRED', sortOrder: 1 },
  { category: 'FILTER_OIL',   nameHe: 'מסנן שמן',              quantity: 1, unitPrice: 30,  laborHours: 0,   required: true, priority: 'REQUIRED', sortOrder: 2 },
  { category: 'FILTER_AIR',   nameHe: 'מסנן אוויר',             quantity: 1, unitPrice: 40,  laborHours: 0,   required: true, priority: 'REQUIRED', sortOrder: 3 },
  { category: 'FILTER_CABIN', nameHe: 'מסנן מזגן',              quantity: 1, unitPrice: 35,  laborHours: 0,   required: true, priority: 'REQUIRED', sortOrder: 4 },
  { category: 'INSPECTION',   nameHe: 'נוזל שמשות',             quantity: 1, unitPrice: 15,  laborHours: 0,   required: true, priority: 'REQUIRED', sortOrder: 5 },
  { category: 'INSPECTION',   nameHe: 'חומר ניקוי',             quantity: 1, unitPrice: 20,  laborHours: 0,   required: true, priority: 'REQUIRED', sortOrder: 6 },
  { category: 'INSPECTION',   nameHe: 'טיפול תקופתי לרכב',     quantity: 1, unitPrice: 0,   laborHours: 1.5, required: true, priority: 'REQUIRED', sortOrder: 7 },
  { category: 'BRAKE_PADS',   nameHe: 'בדיקת בלמים',            quantity: 1, unitPrice: 0,   laborHours: 0.5, required: true, priority: 'REQUIRED', sortOrder: 8 },
]

function buildFallbackSchedule(mileage: number): ScheduleResult {
  const r2 = (n: number) => Math.round(n * 100) / 100
  const partsTotal       = r2(FALLBACK_ITEMS.reduce((s, i) => s + i.unitPrice * i.quantity, 0))
  const reqLaborHours    = r2(FALLBACK_ITEMS.reduce((s, i) => s + i.laborHours, 0))
  const laborTotal       = r2(reqLaborHours * LABOR_RATE_ILS)
  const subtotal         = r2(partsTotal + laborTotal)
  const vat              = r2(subtotal * VAT_RATE)
  const total            = r2(subtotal + vat)

  return {
    scheduleId:          'fallback',
    intervalKm:          0,
    scheduledMileage:    mileage,
    intervalLabel:       'טיפול תקופתי — הצעת בסיס',
    items:               FALLBACK_ITEMS,
    totalLaborHours:     reqLaborHours,
    requiredLaborHours:  reqLaborHours,
    partsTotal,
    laborTotal,
    laborRate:           LABOR_RATE_ILS,
    subtotal,
    vat,
    total,
    isGeneric:           true,
    isFallback:          true,
    matchNote:           'לא נמצאו הוראות יצרן מלאות — נוצרה הצעת בסיס לבדיקה ואישור יועץ שירות.',
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const org = await getOrgContext()
  if (!org) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ───────────────────────────────────────────────────────────────
  const body = await req.json() as {
    vehiclePlate:         string   // required
    vehicleMileage:       number   // required
    vehicleMake?:         string
    vehicleModel?:        string
    vehicleYear?:         number
    vehicleFuelType?:     string
    vehicleTransmission?: string
  }

  if (!body.vehiclePlate?.trim()) {
    return NextResponse.json({ error: 'vehiclePlate is required' }, { status: 400 })
  }
  if (body.vehicleMileage == null || isNaN(Number(body.vehicleMileage))) {
    return NextResponse.json({ error: 'vehicleMileage is required' }, { status: 400 })
  }

  const mileage = Number(body.vehicleMileage)

  // ── Resolve vehicle fields ────────────────────────────────────────────────────
  let make         = body.vehicleMake  ?? null
  let model        = body.vehicleModel ?? null
  let year         = body.vehicleYear  ?? null
  let fuelType     = body.vehicleFuelType    ?? null
  let transmission = body.vehicleTransmission ?? null

  if (!make || !model || !year) {
    const looked = await lookupVehicle(body.vehiclePlate).catch(() => null)
    if (looked) {
      make         = make  || looked.make
      model        = model || looked.model
      year         = year  || looked.year
      fuelType     = fuelType     || (looked.fuelType     ?? null)
      transmission = transmission || (looked.transmission ?? null)
    }
  }

  // If we still can't identify the vehicle → use fallback with unknown vehicle label
  if (!make || !model || !year) {
    return NextResponse.json({
      schedule:        buildFallbackSchedule(mileage),
      usedFuelType:    fuelType,
      usedTransmission: transmission,
      missingFields:   ['fuelType', 'transmission'] as Array<'fuelType' | 'transmission'>,
    })
  }

  // ── Resolve schedule ──────────────────────────────────────────────────────────
  const schedule: ScheduleResult | null = await resolveSchedule({
    make, model, year, mileage, fuelType, transmission,
  })

  // ── Never block — use hardcoded fallback if nothing found ─────────────────────
  const finalSchedule = schedule ?? buildFallbackSchedule(mileage)

  // ── Missing-data detection ────────────────────────────────────────────────────
  const missingFields: Array<'fuelType' | 'transmission'> = []
  if (!fuelType)     missingFields.push('fuelType')
  if (!transmission) missingFields.push('transmission')

  return NextResponse.json({
    schedule:         finalSchedule,
    usedFuelType:     fuelType,
    usedTransmission: transmission,
    missingFields,
  })
}
