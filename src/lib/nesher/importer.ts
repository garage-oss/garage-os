/**
 * NESHER dry-run importer.
 *
 * Simulates what a real import would do — checks GarageOS for existing records,
 * classifies each source row as would_create / would_update / would_skip / error —
 * but performs ZERO writes to the database.
 *
 * Real import is not implemented yet.
 */

import { prisma }                    from '@/lib/prisma'
import { fetchClients, fetchCars, fetchCards } from './queries'
import { mapClient, mapCar, mapCard, IMPORT_SOURCE } from './mapper'
import type { MappedCustomer, MappedVehicle, MappedWorkOrder } from './mapper'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EntityStats {
  would_create: number
  would_update: number
  would_skip:   number
  errors:       number
}

export interface DryRunResult {
  dryRun:      true
  durationMs:  number
  stats: {
    customers:  EntityStats
    vehicles:   EntityStats
    workOrders: EntityStats
  }
  samples: {
    customers:  MappedCustomer[]
    vehicles:   MappedVehicle[]
    workOrders: MappedWorkOrder[]
  }
  errors: string[]
}

// ─── Dry-run ──────────────────────────────────────────────────────────────────

export async function dryRunNesherImport(
  orgId:  string,
  limit?: number,
): Promise<DryRunResult> {
  const t0     = Date.now()
  const errors: string[] = []

  // ── 1. Customers ────────────────────────────────────────────────────────────
  const clientStats: EntityStats = { would_create: 0, would_update: 0, would_skip: 0, errors: 0 }
  const customerSamples: MappedCustomer[] = []

  const rawClients = await fetchClients(limit)

  // Batch-fetch already-imported customer importIds for this org
  const existingCustomerIds = new Set(
    (await prisma.customer.findMany({
      where: { organizationId: orgId, importSource: IMPORT_SOURCE },
      select: { importId: true },
    })).map(c => c.importId).filter(Boolean) as string[]
  )

  for (const row of rawClients) {
    const mapped = mapClient(row)
    if (!mapped) { clientStats.would_skip++; continue }

    if (existingCustomerIds.has(mapped.importId)) {
      clientStats.would_update++
    } else {
      clientStats.would_create++
      if (customerSamples.length < 5) customerSamples.push(mapped)
    }
  }

  // ── 2. Vehicles ─────────────────────────────────────────────────────────────
  const vehicleStats: EntityStats = { would_create: 0, would_update: 0, would_skip: 0, errors: 0 }
  const vehicleSamples: MappedVehicle[] = []

  const rawCars = await fetchCars(limit)

  const existingVehicleImportIds = new Set(
    (await prisma.vehicle.findMany({
      where: { organizationId: orgId, importSource: IMPORT_SOURCE },
      select: { importId: true },
    })).map(v => v.importId).filter(Boolean) as string[]
  )

  // Also collect known customer externalNos so we can validate links
  const knownExternalNos = new Set(
    (await prisma.customer.findMany({
      where: { organizationId: orgId, externalNo: { not: null } },
      select: { externalNo: true },
    })).map(c => c.externalNo).filter(Boolean) as string[]
  )

  for (const row of rawCars) {
    const mapped = mapCar(row)
    if (!mapped) { vehicleStats.would_skip++; continue }

    // Validate customer link
    if (mapped.customerExternalNo && !knownExternalNos.has(mapped.customerExternalNo)) {
      // Customer not yet imported — will be created in real run, just note it
      // Don't count as error; linking happens in order customers → vehicles
    }

    if (existingVehicleImportIds.has(mapped.importId)) {
      vehicleStats.would_update++
    } else {
      vehicleStats.would_create++
      if (vehicleSamples.length < 5) vehicleSamples.push(mapped)
    }
  }

  // ── 3. Work Orders ───────────────────────────────────────────────────────────
  const workOrderStats: EntityStats = { would_create: 0, would_update: 0, would_skip: 0, errors: 0 }
  const workOrderSamples: MappedWorkOrder[] = []

  const rawCards = await fetchCards(limit)

  const existingWOImportIds = new Set(
    (await prisma.workOrder.findMany({
      where: { organizationId: orgId, importSource: IMPORT_SOURCE },
      select: { importId: true },
    })).map(w => w.importId).filter(Boolean) as string[]
  )

  for (const row of rawCards) {
    const mapped = mapCard(row)
    if (!mapped) { workOrderStats.would_skip++; continue }

    if (existingWOImportIds.has(mapped.importId)) {
      workOrderStats.would_update++
    } else {
      workOrderStats.would_create++
      if (workOrderSamples.length < 5) workOrderSamples.push(mapped)
    }
  }

  return {
    dryRun:     true,
    durationMs: Date.now() - t0,
    stats: {
      customers:  clientStats,
      vehicles:   vehicleStats,
      workOrders: workOrderStats,
    },
    samples: {
      customers:  customerSamples,
      vehicles:   vehicleSamples,
      workOrders: workOrderSamples,
    },
    errors,
  }
}
