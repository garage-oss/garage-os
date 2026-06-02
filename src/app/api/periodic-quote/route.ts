/**
 * POST /api/periodic-quote
 *
 * Accepts plate + mileage (+ optional vehicle fields) and returns a
 * structured maintenance quote driven by the MaintenanceSchedule DB.
 *
 * Flow:
 *  1. Validate auth
 *  2. Try to enrich vehicle data from the VehicleLookupCache (if plate given)
 *  3. Resolve the best matching schedule from the DB
 *  4. Return schedule items + totals
 *
 * No AI is involved. The response is 100% rule-based.
 *
 * Body: {
 *   vehiclePlate?:       string
 *   vehicleMake:         string
 *   vehicleModel:        string
 *   vehicleYear:         number
 *   vehicleMileage:      number
 *   vehicleFuelType?:    string    // GASOLINE | DIESEL | HYBRID | ELECTRIC | LPG
 *   vehicleTransmission?: string  // MANUAL | AUTOMATIC | CVT
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext }     from '@/lib/org'
import { resolveSchedule }   from '@/lib/maintenance-schedule'
import { lookupVehicle }     from '@/lib/vehicle-lookup'
import type { ScheduleResult } from '@/lib/maintenance-schedule'

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const org = await getOrgContext()
  if (!org) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  const body = await req.json() as {
    vehiclePlate?:        string
    vehicleMake:          string
    vehicleModel:         string
    vehicleYear:          number
    vehicleMileage:       number
    vehicleFuelType?:     string
    vehicleTransmission?: string
  }

  const { vehicleMake, vehicleModel, vehicleYear, vehicleMileage } = body

  if (!vehicleMake || !vehicleModel || !vehicleYear || vehicleMileage == null) {
    return NextResponse.json(
      { error: 'vehicleMake, vehicleModel, vehicleYear, vehicleMileage are required' },
      { status: 400 },
    )
  }

  // ── Optional: enrich from gov.il plate cache ─────────────────────────────────
  let fuelType    = body.vehicleFuelType    ?? null
  let transmission = body.vehicleTransmission ?? null

  if (body.vehiclePlate && (!fuelType || !transmission)) {
    const cached = await lookupVehicle(body.vehiclePlate).catch(() => null)
    if (cached) {
      if (!fuelType && cached.fuelType)      fuelType    = cached.fuelType
      // gov.il does not expose transmission — keep as-is
    }
  }

  // ── Resolve schedule ────────────────────────────────────────────────────────
  const schedule: ScheduleResult | null = await resolveSchedule({
    make:         vehicleMake,
    model:        vehicleModel,
    year:         vehicleYear,
    mileage:      vehicleMileage,
    fuelType,
    transmission,
  })

  if (!schedule) {
    return NextResponse.json(
      { error: 'SCHEDULE_NOT_FOUND', message: 'לא נמצא לוח טיפולים מתאים' },
      { status: 404 },
    )
  }

  // ── Missing-data detection ───────────────────────────────────────────────────
  const missingFields: Array<'fuelType' | 'transmission'> = []
  if (!fuelType)    missingFields.push('fuelType')
  if (!transmission) missingFields.push('transmission')

  return NextResponse.json({
    schedule,
    usedFuelType:    fuelType,
    usedTransmission: transmission,
    missingFields,   // client can prompt user for these next time
  })
}
