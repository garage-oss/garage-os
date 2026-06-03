/**
 * POST /api/periodic-quote
 *
 * Plate-first periodic service quote.
 *
 * Minimal body:  { vehiclePlate, vehicleMileage }
 * Full body:     { vehiclePlate, vehicleMileage, vehicleMake, vehicleModel,
 *                  vehicleYear, vehicleFuelType, vehicleTransmission }
 *
 * When vehicleMake/vehicleModel/vehicleYear are omitted the server does a
 * plate lookup (cache-first, then gov.il API) and fills them in.
 *
 * No AI is involved. The response is 100% rule-based.
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
    vehiclePlate:         string            // required
    vehicleMileage:       number            // required
    vehicleMake?:         string            // optional — provided by client after lookup
    vehicleModel?:        string            // optional
    vehicleYear?:         number            // optional
    vehicleFuelType?:     string
    vehicleTransmission?: string
  }

  if (!body.vehiclePlate?.trim()) {
    return NextResponse.json({ error: 'vehiclePlate is required' }, { status: 400 })
  }
  if (body.vehicleMileage == null || isNaN(Number(body.vehicleMileage))) {
    return NextResponse.json({ error: 'vehicleMileage is required' }, { status: 400 })
  }

  // ── Resolve vehicle fields ───────────────────────────────────────────────────
  // Client provides these when it has already done a plate lookup (typical path).
  // If any are missing, do the lookup server-side (direct API calls, future use).
  let make         = body.vehicleMake  ?? null
  let model        = body.vehicleModel ?? null
  let year         = body.vehicleYear  ?? null
  let fuelType     = body.vehicleFuelType    ?? null
  let transmission = body.vehicleTransmission ?? null

  if (!make || !model || !year) {
    const looked = await lookupVehicle(body.vehiclePlate).catch(() => null)
    if (looked) {
      make  = make  || looked.make
      model = model || looked.model
      year  = year  || looked.year
      fuelType     = fuelType     || (looked.fuelType     ?? null)
      transmission = transmission || (looked.transmission ?? null)
    }
  }

  if (!make || !model || !year) {
    return NextResponse.json(
      { error: 'VEHICLE_NOT_FOUND', message: 'לא ניתן לזהות את הרכב — בדוק את הלוחית' },
      { status: 404 },
    )
  }

  // ── Resolve schedule ────────────────────────────────────────────────────────
  const schedule: ScheduleResult | null = await resolveSchedule({
    make,
    model,
    year,
    mileage:      Number(body.vehicleMileage),
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
    usedFuelType:     fuelType,
    usedTransmission: transmission,
    missingFields,
  })
}
