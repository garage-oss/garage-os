/**
 * NESHER import via REST connector (port 4000).
 *
 * Architecture: Vercel → REST connector → SQL Server (NESHER).
 * Direct SQL Server (port 1433) is never used from this code path.
 * GarageOS performs ONLY read (GET) requests against the connector.
 * The connector performs ONLY SELECT queries against NESHER SQL Server.
 * No INSERT / UPDATE / DELETE / ALTER ever touches the NESHER database.
 *
 * Pagination: the connector supports cursor-based paging via ?before={card_id}.
 * Each call to runNesherImportViaConnector processes ONE page (≤100 records)
 * and returns nextCursor so the caller can continue with the next page.
 */

import { prisma }          from '@/lib/prisma'
import { WorkOrderStatus }  from '@prisma/client'
import { Decimal }          from '@prisma/client/runtime/library'
import type { ImportResult } from './importer'

const IMPORT_SOURCE   = 'NESHER'
const PAGE_SIZE       = 100
const NULL_DATE_FLOOR = new Date('1900-01-01').getTime()
const UPSERT_BATCH    = 10

// ─── Public result type ───────────────────────────────────────────────────────

export interface ImportBatchResult extends ImportResult {
  nextCursor: number | null  // null ⇒ no more pages
  done:       boolean
  page:       number
}

// ─── Connector wire types ─────────────────────────────────────────────────────

interface ConnectorCard {
  card_id:   string | number
  card_no:   number | null
  open_dt:   string | null
  close_dt:  string | null
  car_no:    string | null
  cli_no:    number | null
  cli_name:  string | null
  car_code:  string | null
  car_model: string | null
  car_desc:  string | null
  part_tot:  number | null
  work_tot:  number | null
  tarif:     number | null
  card_st:   string | null
  card_km:   number | null
  cli_email: string | null
  prod_dt:   string | null
  adviser:   string | null
  drv_name:  string | null
  drv_phone: string | null
}

interface ConnectorPage {
  data:      ConnectorCard[]
  count:     number
  remaining: number
  minCardId: number | null
}

// ─── Connector fetch ──────────────────────────────────────────────────────────

async function fetchConnectorPage(cursor: number | null): Promise<ConnectorPage> {
  const baseUrl = process.env.NESHER_CONNECTOR_URL
  const apiKey  = process.env.NESHER_CONNECTOR_API_KEY
  if (!baseUrl) throw new Error('NESHER_CONNECTOR_URL לא מוגדר')
  if (!apiKey)  throw new Error('NESHER_CONNECTOR_API_KEY לא מוגדר')

  const params = cursor
    ? `limit=${PAGE_SIZE}&before=${cursor}`
    : `limit=${PAGE_SIZE}`

  const res = await fetch(`${baseUrl}/api/workorders?${params}`, {
    headers: { 'x-api-key': apiKey },
    signal:  AbortSignal.timeout(30_000),
    cache:   'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Connector ${res.status}: ${text.slice(0, 200)}`)
  }

  const json = await res.json()
  const data: ConnectorCard[] = Array.isArray(json)
    ? json
    : (json.data ?? json.rows ?? [])

  return {
    data,
    count:     data.length,
    remaining: json.remaining ?? 0,
    minCardId: json.minCardId ?? (data.length > 0
      ? Math.min(...data.map((c: ConnectorCard) => Number(c.card_id)))
      : null),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSafeDate(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) || d.getTime() < NULL_DATE_FLOOR ? null : d
}

function toDecimal(v: number | null | undefined): Decimal {
  return new Decimal(v != null ? v : 0)
}

function resolveStatus(cardSt: string | null | undefined, completedAt: Date | null): WorkOrderStatus {
  if (completedAt) return WorkOrderStatus.COMPLETED
  const s = String(cardSt ?? '').toUpperCase().trim()
  if (s === '2' || s === 'X' || s === 'C') return WorkOrderStatus.CANCELLED
  if (s === '1' || s === 'P') return WorkOrderStatus.IN_PROGRESS
  return WorkOrderStatus.PENDING
}

async function parallel<T, R>(items: T[], handler: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += UPSERT_BATCH) {
    const batchResults = await Promise.all(items.slice(i, i + UPSERT_BATCH).map(handler))
    results.push(...batchResults)
  }
  return results
}

// ─── Per-batch upsert ─────────────────────────────────────────────────────────

async function processBatch(
  orgId: string,
  cards: ConnectorCard[],
): Promise<Omit<ImportResult, 'dryRun' | 'durationMs'>> {
  const errors: string[] = []

  // Aggregate unique customers from this batch
  const customerMap = new Map<string, { name: string; email: string | null }>()
  for (const c of cards) {
    if (c.cli_no == null || !c.cli_name?.trim()) continue
    const key = String(c.cli_no)
    if (!customerMap.has(key)) {
      customerMap.set(key, { name: c.cli_name.trim(), email: c.cli_email?.trim() || null })
    }
  }

  // Aggregate unique vehicles from this batch
  interface AggVehicle {
    plate:              string
    make:               string
    model:              string
    year:               number
    customerExternalNo: string | null
  }
  const vehicleMap = new Map<string, AggVehicle>()
  for (const c of cards) {
    const plate = (c.car_no ?? '').trim().toUpperCase()
    if (!plate) continue
    if (!vehicleMap.has(plate)) {
      const prodYear = c.prod_dt ? new Date(c.prod_dt).getFullYear() : 0
      vehicleMap.set(plate, {
        plate,
        make:               c.car_code?.trim() || 'לא ידוע',
        model:              (c.car_model === '*' ? c.car_desc : c.car_model)?.trim() || 'לא ידוע',
        year:               prodYear > 1900 ? prodYear : new Date().getFullYear(),
        customerExternalNo: c.cli_no != null ? String(c.cli_no) : null,
      })
    }
  }

  // ── Phase 1: Customers ────────────────────────────────────────────────────
  const customerStats = { created: 0, updated: 0, skipped: 0, failed: 0 }

  const customerExternalNos = Array.from(customerMap.keys())
  const existing = await prisma.customer.findMany({
    where: { organizationId: orgId, importSource: IMPORT_SOURCE, importId: { in: customerExternalNos } },
    select: { id: true, externalNo: true, importId: true },
  })
  const existingCustomerImportIds = new Set(existing.map(c => c.importId).filter(Boolean) as string[])
  const externalNoToCustomerId = new Map<string, string>()
  for (const c of existing) {
    if (c.externalNo) externalNoToCustomerId.set(c.externalNo, c.id)
  }

  await parallel(Array.from(customerMap.entries()), async ([externalNo, cust]) => {
    try {
      const saved = await prisma.customer.upsert({
        where: {
          organizationId_importSource_importId: {
            organizationId: orgId,
            importSource:   IMPORT_SOURCE,
            importId:       externalNo,
          },
        },
        create: {
          organizationId: orgId,
          name:           cust.name,
          phone:          '000000000',
          email:          cust.email ?? undefined,
          importSource:   IMPORT_SOURCE,
          importId:       externalNo,
          externalNo,
        },
        update: { name: cust.name, email: cust.email ?? undefined, externalNo },
        select: { id: true },
      })
      externalNoToCustomerId.set(externalNo, saved.id)
      if (existingCustomerImportIds.has(externalNo)) customerStats.updated++
      else                                            customerStats.created++
    } catch (e) {
      customerStats.failed++
      errors.push(`לקוח ${cust.name}: ${e instanceof Error ? e.message : String(e)}`)
    }
  })

  // ── Phase 2: Vehicles ─────────────────────────────────────────────────────
  const vehicleStats = { created: 0, updated: 0, skipped: 0, failed: 0 }

  const plates = Array.from(vehicleMap.keys())
  const existingVehicles = await prisma.vehicle.findMany({
    where: { organizationId: orgId, importSource: IMPORT_SOURCE, importId: { in: plates } },
    select: { id: true, plate: true, customerId: true, importId: true },
  })
  const existingVehicleImportIds = new Set(existingVehicles.map(v => v.importId).filter(Boolean) as string[])
  const plateToVehicleId  = new Map<string, string>()
  const plateToCustomerId = new Map<string, string>()
  for (const v of existingVehicles) {
    plateToVehicleId.set(v.plate, v.id)
    plateToCustomerId.set(v.plate, v.customerId)
  }

  await parallel(Array.from(vehicleMap.entries()), async ([plate, veh]) => {
    const customerId = veh.customerExternalNo
      ? externalNoToCustomerId.get(veh.customerExternalNo)
      : undefined

    if (!customerId) { vehicleStats.skipped++; return }

    try {
      const saved = await prisma.vehicle.upsert({
        where: {
          organizationId_importSource_importId: {
            organizationId: orgId,
            importSource:   IMPORT_SOURCE,
            importId:       plate,
          },
        },
        create: {
          organizationId: orgId,
          customerId,
          plate:          veh.plate,
          make:           veh.make,
          model:          veh.model,
          year:           veh.year,
          importSource:   IMPORT_SOURCE,
          importId:       plate,
        },
        update: { plate: veh.plate, make: veh.make, model: veh.model, year: veh.year },
        select: { id: true, customerId: true },
      })
      plateToVehicleId.set(plate, saved.id)
      plateToCustomerId.set(plate, saved.customerId)
      if (existingVehicleImportIds.has(plate)) vehicleStats.updated++
      else                                      vehicleStats.created++
    } catch (e) {
      vehicleStats.failed++
      errors.push(`רכב ${plate}: ${e instanceof Error ? e.message : String(e)}`)
    }
  })

  // ── Phase 3: Work Orders ──────────────────────────────────────────────────
  const workOrderStats = { created: 0, updated: 0, skipped: 0, failed: 0 }

  const importIds = cards.map(c => String(c.card_id))
  const existingWOs = await prisma.workOrder.findMany({
    where: { organizationId: orgId, importSource: IMPORT_SOURCE, importId: { in: importIds } },
    select: { importId: true },
  })
  const existingWOImportIds = new Set(existingWOs.map(w => w.importId).filter(Boolean) as string[])

  await parallel(cards, async (card) => {
    const importId   = String(card.card_id)
    const plate      = (card.car_no ?? '').trim().toUpperCase()
    const vehicleId  = plate ? plateToVehicleId.get(plate)  : undefined
    const customerId = plate ? plateToCustomerId.get(plate) : undefined

    if (!vehicleId || !customerId) { workOrderStats.skipped++; return }

    const receivedAt  = toSafeDate(card.open_dt)
    const completedAt = toSafeDate(card.close_dt)
    const status      = resolveStatus(card.card_st, completedAt)
    const partsTotal  = toDecimal(card.part_tot)
    const laborTotal  = toDecimal(card.work_tot)
    const laborRate   = toDecimal(card.tarif)
    const totalPrice  = new Decimal(partsTotal.toNumber() + laborTotal.toNumber())

    try {
      await prisma.workOrder.upsert({
        where: {
          organizationId_importSource_importId: {
            organizationId: orgId,
            importSource:   IMPORT_SOURCE,
            importId,
          },
        },
        create: {
          organizationId:  orgId,
          customerId,
          vehicleId,
          workOrderNumber: String(card.card_no ?? importId),
          status,
          partsTotal,
          laborTotal,
          laborRate,
          totalPrice,
          mileage:         card.card_km != null ? Math.round(card.card_km) : undefined,
          notes:           card.car_desc?.trim() || undefined,
          receivedAt:      receivedAt  ?? undefined,
          completedAt:     completedAt ?? undefined,
          advisorName:     card.adviser?.trim()   || undefined,
          driverName:      card.drv_name?.trim()  || undefined,
          driverPhone:     card.drv_phone?.trim() || undefined,
          importSource:    IMPORT_SOURCE,
          importId,
        },
        update: {
          status,
          partsTotal,
          laborTotal,
          laborRate,
          totalPrice,
          mileage:     card.card_km != null ? Math.round(card.card_km) : undefined,
          receivedAt:  receivedAt  ?? undefined,
          completedAt: completedAt ?? undefined,
        },
        select: { id: true },
      })
      if (existingWOImportIds.has(importId)) workOrderStats.updated++
      else                                    workOrderStats.created++
    } catch (e) {
      workOrderStats.failed++
      errors.push(`כרטיסייה ${card.card_no} (id=${importId}): ${e instanceof Error ? e.message : String(e)}`)
    }
  })

  return {
    errors,
    stats: {
      customers:  customerStats,
      vehicles:   vehicleStats,
      workOrders: workOrderStats,
    },
  }
}

// ─── Main export: single-page cursor import ───────────────────────────────────

export async function runNesherImportViaConnector(
  orgId:  string,
  cursor: number | null = null,
  page    = 1,
): Promise<ImportBatchResult> {
  const t0 = Date.now()

  const connectorPage = await fetchConnectorPage(cursor)

  if (connectorPage.data.length === 0) {
    return {
      dryRun:     false,
      durationMs: Date.now() - t0,
      done:       true,
      nextCursor: null,
      page,
      errors:     [],
      stats: {
        customers:  { created: 0, updated: 0, skipped: 0, failed: 0 },
        vehicles:   { created: 0, updated: 0, skipped: 0, failed: 0 },
        workOrders: { created: 0, updated: 0, skipped: 0, failed: 0 },
      },
    }
  }

  const batchResult = await processBatch(orgId, connectorPage.data)

  const isLastPage = connectorPage.data.length < PAGE_SIZE || connectorPage.remaining === 0

  return {
    dryRun:     false,
    durationMs: Date.now() - t0,
    done:       isLastPage,
    nextCursor: isLastPage ? null : (connectorPage.minCardId ?? null),
    page,
    ...batchResult,
  }
}
