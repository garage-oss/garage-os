/**
 * NESHER importer.
 *
 * dryRunNesherImport — simulates the import, classifies rows, writes nothing.
 * runNesherImport    — performs the actual upsert into GarageOS (customers → vehicles → work orders).
 *
 * NESHER SQL Server is opened with readOnlyIntent: true — we never write there.
 */

import { prisma }                          from '@/lib/prisma'
import { fetchClients, fetchCars, fetchCards } from './queries'
import { mapClient, mapCar, mapCard, IMPORT_SOURCE } from './mapper'
import type { MappedCustomer, MappedVehicle, MappedWorkOrder } from './mapper'

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface EntityStats {
  would_create: number
  would_update: number
  would_skip:   number
  errors:       number
}

export interface ImportStats {
  created: number
  updated: number
  skipped: number
  failed:  number
}

// ─── Dry-run result ───────────────────────────────────────────────────────────

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

// ─── Real import result ───────────────────────────────────────────────────────

export interface ImportResult {
  dryRun:     false
  durationMs: number
  stats: {
    customers:  ImportStats
    vehicles:   ImportStats
    workOrders: ImportStats
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

  const existingCustomerIds = new Set(
    (await prisma.customer.findMany({
      where:  { organizationId: orgId, importSource: IMPORT_SOURCE },
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
      where:  { organizationId: orgId, importSource: IMPORT_SOURCE },
      select: { importId: true },
    })).map(v => v.importId).filter(Boolean) as string[]
  )

  const knownExternalNos = new Set(
    (await prisma.customer.findMany({
      where:  { organizationId: orgId, externalNo: { not: null } },
      select: { externalNo: true },
    })).map(c => c.externalNo).filter(Boolean) as string[]
  )

  for (const row of rawCars) {
    const mapped = mapCar(row)
    if (!mapped) { vehicleStats.would_skip++; continue }

    if (mapped.customerExternalNo && !knownExternalNos.has(mapped.customerExternalNo)) {
      // Customer not yet imported — will be created in real run, linking happens in order
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
      where:  { organizationId: orgId, importSource: IMPORT_SOURCE },
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

// ─── Real import ──────────────────────────────────────────────────────────────

export async function runNesherImport(
  orgId:  string,
  limit?: number,
): Promise<ImportResult> {
  const t0     = Date.now()
  const errors: string[] = []

  // ── Phase 1: Customers ──────────────────────────────────────────────────────

  const customerStats: ImportStats = { created: 0, updated: 0, skipped: 0, failed: 0 }

  // Load already-imported customers so vehicle linking works even on incremental runs
  const preExistingCustomers = await prisma.customer.findMany({
    where:  { organizationId: orgId, importSource: IMPORT_SOURCE },
    select: { id: true, externalNo: true, importId: true },
  })
  const existingCustomerImportIds = new Set(preExistingCustomers.map(c => c.importId).filter(Boolean) as string[])

  // externalNo → GarageOS customerId (for vehicle linking)
  const externalNoToCustomerId = new Map<string, string>()
  for (const c of preExistingCustomers) {
    if (c.externalNo) externalNoToCustomerId.set(c.externalNo, c.id)
  }

  const rawClients = await fetchClients(limit)

  for (const row of rawClients) {
    const mapped = mapClient(row)
    if (!mapped) { customerStats.skipped++; continue }

    try {
      const saved = await prisma.customer.upsert({
        where: {
          organizationId_importSource_importId: {
            organizationId: orgId,
            importSource:   mapped.importSource,
            importId:       mapped.importId,
          },
        },
        create: {
          organizationId: orgId,
          name:           mapped.name,
          phone:          mapped.phone,
          email:          mapped.email ?? undefined,
          address:        mapped.address ?? undefined,
          city:           mapped.city ?? undefined,
          mobile:         mapped.mobile ?? undefined,
          notes:          mapped.notes ?? undefined,
          importSource:   mapped.importSource,
          importId:       mapped.importId,
          externalNo:     mapped.externalNo ?? undefined,
        },
        update: {
          name:       mapped.name,
          phone:      mapped.phone,
          email:      mapped.email ?? undefined,
          address:    mapped.address ?? undefined,
          city:       mapped.city ?? undefined,
          mobile:     mapped.mobile ?? undefined,
          notes:      mapped.notes ?? undefined,
          externalNo: mapped.externalNo ?? undefined,
        },
        select: { id: true },
      })

      if (mapped.externalNo) externalNoToCustomerId.set(mapped.externalNo, saved.id)

      if (existingCustomerImportIds.has(mapped.importId)) {
        customerStats.updated++
      } else {
        customerStats.created++
      }
    } catch (e) {
      customerStats.failed++
      errors.push(`לקוח importId=${mapped.importId} (${mapped.name}): ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ── Phase 2: Vehicles ────────────────────────────────────────────────────────

  const vehicleStats: ImportStats = { created: 0, updated: 0, skipped: 0, failed: 0 }

  // plate → vehicleId and customerId for work-order linking
  const plateToVehicleId  = new Map<string, string>()
  const plateToCustomerId = new Map<string, string>()

  const preExistingVehicles = await prisma.vehicle.findMany({
    where:  { organizationId: orgId, importSource: IMPORT_SOURCE },
    select: { id: true, plate: true, customerId: true, importId: true },
  })
  const existingVehicleImportIds = new Set(preExistingVehicles.map(v => v.importId).filter(Boolean) as string[])
  for (const v of preExistingVehicles) {
    plateToVehicleId.set(v.plate, v.id)
    plateToCustomerId.set(v.plate, v.customerId)
  }

  const rawCars = await fetchCars(limit)

  for (const row of rawCars) {
    const mapped = mapCar(row)
    if (!mapped) { vehicleStats.skipped++; continue }

    const customerId = mapped.customerExternalNo
      ? externalNoToCustomerId.get(mapped.customerExternalNo)
      : undefined

    if (!customerId) {
      vehicleStats.skipped++
      errors.push(`רכב לוחית=${mapped.plate}: לא נמצא לקוח (externalNo=${mapped.customerExternalNo ?? 'ריק'})`)
      continue
    }

    try {
      const saved = await prisma.vehicle.upsert({
        where: {
          organizationId_importSource_importId: {
            organizationId: orgId,
            importSource:   mapped.importSource,
            importId:       mapped.importId,
          },
        },
        create: {
          organizationId: orgId,
          customerId,
          plate:          mapped.plate,
          make:           mapped.make,
          model:          mapped.model,
          year:           mapped.year,
          vin:            mapped.vin ?? undefined,
          engine:         mapped.engine ?? undefined,
          mileage:        mapped.mileage ?? undefined,
          notes:          mapped.notes ?? undefined,
          makeCode:       mapped.makeCode ?? undefined,
          importSource:   mapped.importSource,
          importId:       mapped.importId,
        },
        update: {
          plate:   mapped.plate,
          make:    mapped.make,
          model:   mapped.model,
          year:    mapped.year,
          vin:     mapped.vin ?? undefined,
          engine:  mapped.engine ?? undefined,
          mileage: mapped.mileage ?? undefined,
          notes:   mapped.notes ?? undefined,
        },
        select: { id: true, customerId: true },
      })

      plateToVehicleId.set(mapped.plate, saved.id)
      plateToCustomerId.set(mapped.plate, saved.customerId)

      if (existingVehicleImportIds.has(mapped.importId)) {
        vehicleStats.updated++
      } else {
        vehicleStats.created++
      }
    } catch (e) {
      vehicleStats.failed++
      errors.push(`רכב לוחית=${mapped.plate} importId=${mapped.importId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ── Phase 3: Work Orders ─────────────────────────────────────────────────────

  const workOrderStats: ImportStats = { created: 0, updated: 0, skipped: 0, failed: 0 }

  const preExistingWOs = await prisma.workOrder.findMany({
    where:  { organizationId: orgId, importSource: IMPORT_SOURCE },
    select: { importId: true },
  })
  const existingWOImportIds = new Set(preExistingWOs.map(w => w.importId).filter(Boolean) as string[])

  const rawCards = await fetchCards(limit)

  for (const row of rawCards) {
    const mapped = mapCard(row)
    if (!mapped) { workOrderStats.skipped++; continue }

    const vehicleId  = mapped.vehiclePlate ? plateToVehicleId.get(mapped.vehiclePlate)  : undefined
    let   customerId = mapped.vehiclePlate ? plateToCustomerId.get(mapped.vehiclePlate) : undefined
    if (!customerId && mapped.customerExternalNo) {
      customerId = externalNoToCustomerId.get(mapped.customerExternalNo)
    }

    if (!vehicleId || !customerId) {
      workOrderStats.skipped++
      if (!vehicleId) {
        errors.push(`כרטיסייה ${mapped.workOrderNumber}: לא נמצא רכב (לוחית=${mapped.vehiclePlate ?? 'ריק'})`)
      }
      continue
    }

    try {
      await prisma.workOrder.upsert({
        where: {
          organizationId_importSource_importId: {
            organizationId: orgId,
            importSource:   mapped.importSource,
            importId:       mapped.importId,
          },
        },
        create: {
          organizationId:  orgId,
          customerId,
          vehicleId,
          workOrderNumber: mapped.workOrderNumber,
          status:          mapped.status,
          partsTotal:      mapped.partsTotal,
          laborTotal:      mapped.laborTotal,
          laborRate:       mapped.laborRate,
          totalPrice:      mapped.totalPrice,
          mileage:         mapped.mileage ?? undefined,
          notes:           mapped.notes ?? undefined,
          receivedAt:      mapped.receivedAt ?? undefined,
          completedAt:     mapped.completedAt ?? undefined,
          advisorName:     mapped.advisorName ?? undefined,
          driverName:      mapped.driverName ?? undefined,
          driverPhone:     mapped.driverPhone ?? undefined,
          importSource:    mapped.importSource,
          importId:        mapped.importId,
        },
        update: {
          status:      mapped.status,
          partsTotal:  mapped.partsTotal,
          laborTotal:  mapped.laborTotal,
          laborRate:   mapped.laborRate,
          totalPrice:  mapped.totalPrice,
          mileage:     mapped.mileage ?? undefined,
          notes:       mapped.notes ?? undefined,
          receivedAt:  mapped.receivedAt ?? undefined,
          completedAt: mapped.completedAt ?? undefined,
          advisorName: mapped.advisorName ?? undefined,
          driverName:  mapped.driverName ?? undefined,
          driverPhone: mapped.driverPhone ?? undefined,
        },
        select: { id: true },
      })

      if (existingWOImportIds.has(mapped.importId)) {
        workOrderStats.updated++
      } else {
        workOrderStats.created++
      }
    } catch (e) {
      workOrderStats.failed++
      errors.push(`כרטיסייה ${mapped.workOrderNumber} importId=${mapped.importId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return {
    dryRun:     false,
    durationMs: Date.now() - t0,
    stats: {
      customers:  customerStats,
      vehicles:   vehicleStats,
      workOrders: workOrderStats,
    },
    errors,
  }
}
