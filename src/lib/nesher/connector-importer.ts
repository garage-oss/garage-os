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
 *
 * Performance: each page is saved in 3 batch SQL round-trips (one per entity
 * type) instead of N individual upserts, staying well inside Vercel's 60s limit.
 */

import { Prisma, WorkOrderStatus }  from '@prisma/client'
import { prisma }                   from '@/lib/prisma'
import type { ImportResult }        from './importer'

const IMPORT_SOURCE   = 'NESHER'
const PAGE_SIZE       = 100
const NULL_DATE_FLOOR = new Date('1900-01-01').getTime()

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

function resolveStatus(cardSt: string | null | undefined, completedAt: Date | null): WorkOrderStatus {
  if (completedAt) return WorkOrderStatus.COMPLETED
  const s = String(cardSt ?? '').toUpperCase().trim()
  if (s === '2' || s === 'X' || s === 'C') return WorkOrderStatus.CANCELLED
  if (s === '1' || s === 'P') return WorkOrderStatus.IN_PROGRESS
  return WorkOrderStatus.PENDING
}

// ─── Batch upsert (3 SQL round-trips instead of N individual upserts) ─────────

async function processBatch(
  orgId: string,
  cards: ConnectorCard[],
): Promise<Omit<ImportResult, 'dryRun' | 'durationMs'>> {
  const errors: string[] = []

  // ── Aggregate unique customers ────────────────────────────────────────────
  const customerMap = new Map<string, { name: string; email: string | null }>()
  for (const c of cards) {
    if (c.cli_no == null || !c.cli_name?.trim()) continue
    const key = String(c.cli_no)
    if (!customerMap.has(key)) {
      customerMap.set(key, { name: c.cli_name.trim(), email: c.cli_email?.trim() || null })
    }
  }

  // ── Aggregate unique vehicles ─────────────────────────────────────────────
  const vehicleMap = new Map<string, {
    make:               string
    model:              string
    year:               number
    customerExternalNo: string | null
  }>()
  for (const c of cards) {
    const plate = (c.car_no ?? '').trim().toUpperCase()
    if (!plate) continue
    if (!vehicleMap.has(plate)) {
      const prodYear = c.prod_dt ? new Date(c.prod_dt).getFullYear() : 0
      vehicleMap.set(plate, {
        make:               c.car_code?.trim() || 'לא ידוע',
        model:              (c.car_model === '*' ? c.car_desc : c.car_model)?.trim() || 'לא ידוע',
        year:               prodYear > 1900 ? prodYear : new Date().getFullYear(),
        customerExternalNo: c.cli_no != null ? String(c.cli_no) : null,
      })
    }
  }

  // ── Phase 1: Batch customer upsert ────────────────────────────────────────
  const customerStats = { created: 0, updated: 0, skipped: 0, failed: 0 }
  const externalNoToCustomerId = new Map<string, string>()

  if (customerMap.size > 0) {
    const externalNos = Array.from(customerMap.keys())

    // Pre-load existing to distinguish creates from updates in RETURNING
    const existingCusts = await prisma.customer.findMany({
      where: { organizationId: orgId, importSource: IMPORT_SOURCE, importId: { in: externalNos } },
      select: { id: true, importId: true, externalNo: true },
    })
    const existingCustSet = new Set(
      existingCusts.map(c => c.importId).filter((v): v is string => v != null),
    )
    for (const c of existingCusts) {
      if (c.externalNo) externalNoToCustomerId.set(c.externalNo, c.id)
    }

    try {
      const vals = Array.from(customerMap.entries()).map(([externalNo, cust]) =>
        Prisma.sql`(gen_random_uuid()::text, ${orgId}, ${cust.name}, ${'000000000'}, ${cust.email ?? null}, ${'NESHER'}, ${externalNo}, ${externalNo}, NOW(), NOW())`
      )

      const rows = await prisma.$queryRaw<{ id: string; import_id: string }[]>`
        INSERT INTO "Customer"
          (id, "organizationId", name, phone, email, "importSource", "importId", "externalNo", "createdAt", "updatedAt")
        VALUES ${Prisma.join(vals)}
        ON CONFLICT ("organizationId", "importSource", "importId")
        DO UPDATE SET
          name         = EXCLUDED.name,
          email        = EXCLUDED.email,
          "externalNo" = EXCLUDED."externalNo",
          "updatedAt"  = NOW()
        RETURNING id, "importId" AS import_id
      `

      for (const row of rows) {
        externalNoToCustomerId.set(row.import_id, row.id)
        if (existingCustSet.has(row.import_id)) customerStats.updated++
        else                                     customerStats.created++
      }
    } catch (e) {
      errors.push(`שגיאה בייבוא לקוחות: ${e instanceof Error ? e.message : String(e)}`)
      customerStats.failed += customerMap.size
    }
  }

  // ── Phase 2: Batch vehicle upsert ─────────────────────────────────────────
  const vehicleStats = { created: 0, updated: 0, skipped: 0, failed: 0 }
  const plateToVehicleId  = new Map<string, string>()
  const plateToCustomerId = new Map<string, string>()

  const vehicleEntries = Array.from(vehicleMap.entries()).filter(([, veh]) =>
    veh.customerExternalNo != null && externalNoToCustomerId.has(veh.customerExternalNo)
  )
  vehicleStats.skipped = vehicleMap.size - vehicleEntries.length

  if (vehicleEntries.length > 0) {
    const plates = vehicleEntries.map(([plate]) => plate)

    const existingVehs = await prisma.vehicle.findMany({
      where: { organizationId: orgId, importSource: IMPORT_SOURCE, importId: { in: plates } },
      select: { id: true, plate: true, customerId: true, importId: true },
    })
    const existingVehSet = new Set(
      existingVehs.map(v => v.importId).filter((v): v is string => v != null),
    )
    for (const v of existingVehs) {
      plateToVehicleId.set(v.plate, v.id)
      plateToCustomerId.set(v.plate, v.customerId)
    }

    try {
      const vals = vehicleEntries.map(([plate, veh]) => {
        const customerId = externalNoToCustomerId.get(veh.customerExternalNo!)!
        return Prisma.sql`(gen_random_uuid()::text, ${orgId}, ${customerId}, ${plate}, ${veh.make}, ${veh.model}, ${veh.year}, ${'NESHER'}, ${plate}, NOW(), NOW())`
      })

      const rows = await prisma.$queryRaw<{ id: string; plate: string; customer_id: string }[]>`
        INSERT INTO "Vehicle"
          (id, "organizationId", "customerId", plate, make, model, year, "importSource", "importId", "createdAt", "updatedAt")
        VALUES ${Prisma.join(vals)}
        ON CONFLICT ("plate", "organizationId")
        DO UPDATE SET
          make           = EXCLUDED.make,
          model          = EXCLUDED.model,
          year           = EXCLUDED.year,
          "customerId"   = EXCLUDED."customerId",
          "importSource" = EXCLUDED."importSource",
          "importId"     = EXCLUDED."importId",
          "updatedAt"    = NOW()
        RETURNING id, plate, "customerId" AS customer_id
      `

      for (const row of rows) {
        plateToVehicleId.set(row.plate, row.id)
        plateToCustomerId.set(row.plate, row.customer_id)
        if (existingVehSet.has(row.plate)) vehicleStats.updated++
        else                               vehicleStats.created++
      }
    } catch (e) {
      errors.push(`שגיאה בייבוא רכבים: ${e instanceof Error ? e.message : String(e)}`)
      vehicleStats.failed += vehicleEntries.length
    }
  }

  // ── Phase 3: Batch work order upsert ──────────────────────────────────────
  const workOrderStats = { created: 0, updated: 0, skipped: 0, failed: 0 }

  const validCards = cards.filter(card => {
    const plate = (card.car_no ?? '').trim().toUpperCase()
    return plate && plateToVehicleId.has(plate) && plateToCustomerId.has(plate)
  })
  workOrderStats.skipped = cards.length - validCards.length

  if (validCards.length > 0) {
    const importIds = validCards.map(c => String(c.card_id))

    const existingWOs = await prisma.workOrder.findMany({
      where: { organizationId: orgId, importSource: IMPORT_SOURCE, importId: { in: importIds } },
      select: { importId: true },
    })
    const existingWOSet = new Set(
      existingWOs.map(w => w.importId).filter((v): v is string => v != null),
    )

    try {
      // workOrderNumber = importId (card_id) to guarantee uniqueness across batches
      const vals = validCards.map(card => {
        const importId    = String(card.card_id)
        const plate       = (card.car_no ?? '').trim().toUpperCase()
        const vehicleId   = plateToVehicleId.get(plate)!
        const customerId  = plateToCustomerId.get(plate)!
        const receivedAt  = toSafeDate(card.open_dt)
        const completedAt = toSafeDate(card.close_dt)
        const status      = resolveStatus(card.card_st, completedAt)
        const partsTotal  = card.part_tot ?? 0
        const laborTotal  = card.work_tot ?? 0
        const laborRate   = card.tarif ?? 0
        const totalPrice  = partsTotal + laborTotal
        const mileage     = card.card_km != null ? Math.round(card.card_km) : null
        const notes       = card.car_desc?.trim() || null
        const advisorName = card.adviser?.trim() || null
        const driverName  = card.drv_name?.trim() || null
        const driverPhone = card.drv_phone?.trim() || null

        return Prisma.sql`(
          gen_random_uuid()::text,
          ${orgId},
          ${customerId},
          ${vehicleId},
          ${importId},
          ${status as string}::"WorkOrderStatus",
          ${partsTotal},
          ${laborTotal},
          ${laborRate},
          ${totalPrice},
          ${mileage},
          ${notes},
          ${receivedAt},
          ${completedAt},
          ${advisorName},
          ${driverName},
          ${driverPhone},
          ${'NESHER'},
          ${importId},
          NOW(),
          NOW()
        )`
      })

      const rows = await prisma.$queryRaw<{ id: string; import_id: string }[]>`
        INSERT INTO "WorkOrder" (
          id, "organizationId", "customerId", "vehicleId",
          "workOrderNumber", status,
          "partsTotal", "laborTotal", "laborRate", "totalPrice",
          mileage, notes,
          "receivedAt", "completedAt",
          "advisorName", "driverName", "driverPhone",
          "importSource", "importId",
          "createdAt", "updatedAt"
        )
        VALUES ${Prisma.join(vals)}
        ON CONFLICT ("organizationId", "importSource", "importId")
        DO UPDATE SET
          status        = EXCLUDED.status,
          "partsTotal"  = EXCLUDED."partsTotal",
          "laborTotal"  = EXCLUDED."laborTotal",
          "laborRate"   = EXCLUDED."laborRate",
          "totalPrice"  = EXCLUDED."totalPrice",
          mileage       = EXCLUDED.mileage,
          "receivedAt"  = EXCLUDED."receivedAt",
          "completedAt" = EXCLUDED."completedAt",
          "updatedAt"   = NOW()
        RETURNING id, "importId" AS import_id
      `

      for (const row of rows) {
        if (existingWOSet.has(row.import_id)) workOrderStats.updated++
        else                                   workOrderStats.created++
      }
    } catch (e) {
      errors.push(`שגיאה בייבוא כרטיסיות: ${e instanceof Error ? e.message : String(e)}`)
      workOrderStats.failed += validCards.length
    }
  }

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
