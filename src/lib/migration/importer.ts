/**
 * Core import engine.
 *
 * Handles: dry-run, duplicate detection, ID lookups, batch logging, rollback.
 * Import order is enforced: customers → suppliers → vehicles → parts → work_orders → invoices → quotes
 */

import { prisma } from '@/lib/prisma'
import { fetchRows, countRows } from './detector'
import { mapRow, validateMappedRow } from './mapper'
import type {
  MappingPreset,
  TargetEntity,
  RowResult,
  BatchSummary,
} from './types'
import type { MappedRow } from './mapper'
import { MigrationLogAction } from '@prisma/client'
import type { WorkOrderStatus, InvoiceStatus, QuoteStatus, FuelType, Transmission } from '@prisma/client'

// ─── Import options ───────────────────────────────────────────────────────────

export type ImportOptions = {
  orgId:         string
  userId:        string
  userName:      string
  isDryRun:      boolean
  isIncremental: boolean
  /** Only fetch rows with timestamp column > lastSyncAt */
  lastSyncAt?:   Date
}

// ─── Ordered execution ────────────────────────────────────────────────────────

const ENTITY_ORDER: TargetEntity[] = [
  'customer', 'supplier', 'vehicle', 'part', 'work_order', 'invoice', 'quote',
]

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function runImport(
  presets: MappingPreset[],
  opts:    ImportOptions,
): Promise<BatchSummary> {
  // Create a batch record
  const batch = opts.isDryRun
    ? null
    : await prisma.migrationBatch.create({
        data: {
          organizationId: opts.orgId,
          userId:         opts.userId,
          userName:       opts.userName,
          status:         'RUNNING',
          isDryRun:       false,
          isIncremental:  opts.isIncremental,
          presetsUsed:    presets.map((p) => p.name),
          startedAt:      new Date(),
        },
      })

  const batchId   = batch?.id ?? `dry-run-${Date.now()}`
  const results:  RowResult[] = []
  const idMap:    Record<string, Record<string, string>> = {}   // entity → sourceId → targetId

  // Sort presets by entity dependency order
  const sortedPresets = [...presets].sort((a, b) => {
    return ENTITY_ORDER.indexOf(a.targetEntity) - ENTITY_ORDER.indexOf(b.targetEntity)
  })

  let totalRows = 0
  let imported  = 0
  let skipped   = 0
  let failed    = 0

  for (const preset of sortedPresets) {
    const entity = preset.targetEntity

    // Determine after-timestamp for incremental
    const afterTs = opts.isIncremental && opts.lastSyncAt && preset.incrementalColumn
      ? { column: preset.incrementalColumn, value: opts.lastSyncAt }
      : undefined

    // Count rows for this preset
    const rowCount = await countRows(
      schemaFromTable(preset.sourceTable),
      nameFromTable(preset.sourceTable),
      preset.filterSql,
      afterTs,
    )
    totalRows += rowCount

    // Update batch total
    if (batch) {
      await prisma.migrationBatch.update({
        where: { id: batch.id },
        data:  { totalRows },
      })
    }

    // Stream rows in batches
    for await (const rowBatch of fetchRows(
      schemaFromTable(preset.sourceTable),
      nameFromTable(preset.sourceTable),
      guessPkColumn(preset),
      preset.filterSql,
      afterTs,
    )) {
      for (const sourceRow of rowBatch) {
        const mapped = mapRow(sourceRow, preset.columnMappings)
        const result = await importRow(entity, mapped, sourceRow, opts, idMap)
        results.push(result)

        if (result.action === 'created')  { imported++; if (result.targetId) { idMap[entity] = idMap[entity] ?? {}; idMap[entity][String(result.sourceId ?? '')] = result.targetId } }
        if (result.action === 'skipped')  skipped++
        if (result.action === 'failed')   failed++

        // Persist log entry (non-dry-run)
        if (!opts.isDryRun && batch) {
          await prisma.migrationLog.create({
            data: {
              batchId:  batch.id,
              entity,
              sourceId: result.sourceId,
              targetId: result.targetId,
              action:   toLogAction(result.action),
              message:  result.message,
              rowData:  result.rowData as object | undefined,
            },
          })
        }
      }
    }
  }

  // Finalise batch
  if (batch) {
    await prisma.migrationBatch.update({
      where: { id: batch.id },
      data:  {
        status:      failed > 0 && imported === 0 ? 'FAILED' : 'COMPLETED',
        imported,
        skipped,
        failed,
        totalRows,
        completedAt: new Date(),
      },
    })
  }

  return { batchId, isDryRun: opts.isDryRun, total: totalRows, imported, skipped, failed, results }
}

// ─── Per-row import ───────────────────────────────────────────────────────────

async function importRow(
  entity:    TargetEntity,
  mapped:    MappedRow,
  sourceRow: Record<string, unknown>,
  opts:      ImportOptions,
  idMap:     Record<string, Record<string, string>>,
): Promise<RowResult> {
  const sourceId = String(guessSourceId(sourceRow))

  // Validate required fields
  const validation = validateMappedRow(mapped, entity)
  if (!validation.valid) {
    return {
      entity,
      sourceId,
      action:  'failed',
      message: `שדות חסרים: ${validation.missing.join(', ')}`,
      rowData: sourceRow,
    }
  }

  try {
    switch (entity) {
      case 'customer':   return await importCustomer(mapped, sourceId, opts)
      case 'vehicle':    return await importVehicle(mapped, sourceId, opts, idMap)
      case 'supplier':   return await importSupplier(mapped, sourceId, opts)
      case 'part':       return await importPart(mapped, sourceId, opts, idMap)
      case 'work_order': return await importWorkOrder(mapped, sourceId, opts, idMap)
      case 'invoice':    return await importInvoice(mapped, sourceId, opts, idMap)
      case 'quote':      return await importQuote(mapped, sourceId, opts, idMap)
      default:           return { entity, sourceId, action: 'failed', message: 'Unknown entity' }
    }
  } catch (e) {
    return {
      entity,
      sourceId,
      action:  'failed',
      message: e instanceof Error ? e.message : String(e),
      rowData: sourceRow,
    }
  }
}

// ─── Entity importers ─────────────────────────────────────────────────────────

async function importCustomer(
  row:      MappedRow,
  sourceId: string,
  opts:     ImportOptions,
): Promise<RowResult> {
  const phone = normalizePhone(String(row.phone ?? ''))
  const name  = String(row.name ?? '').trim()

  // Dedup: exact phone, then name
  const existing = await prisma.customer.findFirst({
    where: {
      organizationId: opts.orgId,
      OR: [
        { phone },
        { name:  { equals: name, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  })

  if (existing) {
    return { entity: 'customer', sourceId, targetId: existing.id, action: 'skipped', message: 'כבר קיים' }
  }

  if (opts.isDryRun) {
    return { entity: 'customer', sourceId, action: 'created', message: `[dry-run] ${name} / ${phone}` }
  }

  const created = await prisma.customer.create({
    data: {
      organizationId: opts.orgId,
      name,
      phone,
      email:   str(row.email),
      address: str(row.address),
      notes:   str(row.notes),
    },
  })
  return { entity: 'customer', sourceId, targetId: created.id, action: 'created', message: name }
}

async function importVehicle(
  row:      MappedRow,
  sourceId: string,
  opts:     ImportOptions,
  idMap:    Record<string, Record<string, string>>,
): Promise<RowResult> {
  const plate = String(row.plate ?? '').trim().toUpperCase()

  // Resolve customer ID
  const customerId = await resolveCustomerId(row, opts.orgId, idMap)
  if (!customerId) {
    return { entity: 'vehicle', sourceId, action: 'failed', message: 'לא נמצא לקוח מקושר' }
  }

  // Dedup: plate + org
  const existing = await prisma.vehicle.findFirst({
    where: { organizationId: opts.orgId, plate },
    select: { id: true },
  })

  if (existing) {
    idMap['vehicle'] = idMap['vehicle'] ?? {}
    idMap['vehicle'][sourceId] = existing.id
    return { entity: 'vehicle', sourceId, targetId: existing.id, action: 'skipped', message: 'לוחית קיימת' }
  }

  // Also dedup by VIN if present
  if (row.vin) {
    const byVin = await prisma.vehicle.findFirst({
      where: { organizationId: opts.orgId, vin: String(row.vin) },
      select: { id: true },
    })
    if (byVin) {
      idMap['vehicle'] = idMap['vehicle'] ?? {}
      idMap['vehicle'][sourceId] = byVin.id
      return { entity: 'vehicle', sourceId, targetId: byVin.id, action: 'skipped', message: 'VIN קיים' }
    }
  }

  if (opts.isDryRun) {
    return { entity: 'vehicle', sourceId, action: 'created', message: `[dry-run] ${plate}` }
  }

  const created = await prisma.vehicle.create({
    data: {
      organizationId: opts.orgId,
      customerId,
      plate,
      make:         String(row.make ?? '').trim(),
      model:        String(row.model ?? '').trim(),
      year:         num(row.year) ?? new Date().getFullYear(),
      color:        str(row.color),
      vin:          str(row.vin),
      engine:       str(row.engine),
      mileage:      num(row.mileage) ?? null,
      fuelType:     (row.fuelType as FuelType) ?? null,
      transmission: (row.transmission as Transmission) ?? null,
      notes:        str(row.notes),
    },
  })
  idMap['vehicle'] = idMap['vehicle'] ?? {}
  idMap['vehicle'][sourceId] = created.id
  return { entity: 'vehicle', sourceId, targetId: created.id, action: 'created', message: plate }
}

async function importSupplier(
  row:      MappedRow,
  sourceId: string,
  opts:     ImportOptions,
): Promise<RowResult> {
  const name  = String(row.name ?? '').trim()
  const phone = normalizePhone(String(row.phone ?? ''))

  const existing = await prisma.supplier.findFirst({
    where: {
      organizationId: opts.orgId,
      OR: [
        ...(phone ? [{ phone }] : []),
        { name: { equals: name, mode: 'insensitive' as const } },
      ],
    },
    select: { id: true },
  })
  if (existing) {
    return { entity: 'supplier', sourceId, targetId: existing.id, action: 'skipped', message: 'ספק קיים' }
  }

  if (opts.isDryRun) {
    return { entity: 'supplier', sourceId, action: 'created', message: `[dry-run] ${name}` }
  }

  const created = await prisma.supplier.create({
    data: {
      organizationId: opts.orgId,
      name,
      contactName: str(row.contactName),
      phone:       phone || null,
      email:       str(row.email),
      address:     str(row.address),
      notes:       str(row.notes),
    },
  })
  return { entity: 'supplier', sourceId, targetId: created.id, action: 'created', message: name }
}

async function importPart(
  row:      MappedRow,
  sourceId: string,
  opts:     ImportOptions,
  idMap:    Record<string, Record<string, string>>,
): Promise<RowResult> {
  const sku  = String(row.sku ?? '').trim()
  const name = String(row.name ?? '').trim()

  // Dedup: sku + org, then name
  const existing = await prisma.part.findFirst({
    where: {
      organizationId: opts.orgId,
      OR: [
        { sku },
        { name: { equals: name, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  })
  if (existing) {
    return { entity: 'part', sourceId, targetId: existing.id, action: 'skipped', message: 'חלק קיים' }
  }

  // Resolve supplier
  let supplierId: string | null = null
  if (row._supplier_name) {
    const sup = await prisma.supplier.findFirst({
      where: { organizationId: opts.orgId, name: { equals: String(row._supplier_name), mode: 'insensitive' } },
      select: { id: true },
    })
    supplierId = sup?.id ?? null
  }

  if (opts.isDryRun) {
    return { entity: 'part', sourceId, action: 'created', message: `[dry-run] ${sku} ${name}` }
  }

  const created = await prisma.part.create({
    data: {
      organizationId: opts.orgId,
      sku,
      name,
      category:     str(row.category),
      manufacturer: str(row.manufacturer),
      costPrice:    num(row.costPrice) ?? 0,
      salePrice:    num(row.salePrice) ?? 0,
      quantity:     num(row.quantity)  ?? 0,
      minQuantity:  num(row.minQuantity) ?? 5,
      location:     str(row.location),
      notes:        str(row.notes),
      supplierId,
    },
  })
  return { entity: 'part', sourceId, targetId: created.id, action: 'created', message: `${sku} — ${name}` }
}

async function importWorkOrder(
  row:      MappedRow,
  sourceId: string,
  opts:     ImportOptions,
  idMap:    Record<string, Record<string, string>>,
): Promise<RowResult> {
  const customerId = await resolveCustomerId(row, opts.orgId, idMap)
  const vehicleId  = await resolveVehicleId(row, opts.orgId, idMap)

  if (!customerId || !vehicleId) {
    return { entity: 'work_order', sourceId, action: 'failed', message: 'לא נמצא לקוח/רכב מקושר' }
  }

  // Auto-generate work order number
  const woNumber = str(row.workOrderNumber) ?? await generateWoNumber(opts.orgId)

  // Dedup by number + org
  const existing = await prisma.workOrder.findFirst({
    where: { organizationId: opts.orgId, workOrderNumber: woNumber },
    select: { id: true },
  })
  if (existing) {
    return { entity: 'work_order', sourceId, targetId: existing.id, action: 'skipped', message: `WO ${woNumber} קיים` }
  }

  if (opts.isDryRun) {
    return { entity: 'work_order', sourceId, action: 'created', message: `[dry-run] WO ${woNumber}` }
  }

  const created = await prisma.workOrder.create({
    data: {
      organizationId:     opts.orgId,
      customerId,
      vehicleId,
      workOrderNumber:    woNumber,
      status:             (row.status as WorkOrderStatus) ?? 'COMPLETED',
      complaint:          str(row.complaint) ?? '',
      diagnosis:          str(row.diagnosis),
      laborHours:         num(row.laborHours) ?? 0,
      laborRate:          num(row.laborRate)  ?? 150,
      mileage:            num(row.mileage)    ?? null,
      notes:              str(row.notes),
      assignedTechnician: str(row.assignedTechnician),
      completedAt:        date(row.completedAt),
      receivedAt:         date(row.receivedAt),
    },
  })
  return { entity: 'work_order', sourceId, targetId: created.id, action: 'created', message: `WO ${woNumber}` }
}

async function importInvoice(
  row:      MappedRow,
  sourceId: string,
  opts:     ImportOptions,
  idMap:    Record<string, Record<string, string>>,
): Promise<RowResult> {
  const number     = String(row.number ?? '').trim()
  const customerId = await resolveCustomerId(row, opts.orgId, idMap)
  if (!customerId) {
    return { entity: 'invoice', sourceId, action: 'failed', message: 'לא נמצא לקוח מקושר' }
  }

  // Dedup by number + org
  const existing = await prisma.invoice.findFirst({
    where: { organizationId: opts.orgId, number },
    select: { id: true },
  })
  if (existing) {
    return { entity: 'invoice', sourceId, targetId: existing.id, action: 'skipped', message: `חשבונית ${number} קיימת` }
  }

  if (opts.isDryRun) {
    return { entity: 'invoice', sourceId, action: 'created', message: `[dry-run] INV ${number}` }
  }

  const subtotal = num(row.subtotal) ?? 0
  const tax      = num(row.tax)      ?? 0
  const total    = num(row.total)    ?? subtotal + tax

  const created = await prisma.invoice.create({
    data: {
      organizationId: opts.orgId,
      customerId,
      number,
      status:   (row.status as InvoiceStatus) ?? 'PAID',
      subtotal,
      tax,
      total,
      notes:    str(row.notes),
    },
  })
  return { entity: 'invoice', sourceId, targetId: created.id, action: 'created', message: `INV ${number}` }
}

async function importQuote(
  row:      MappedRow,
  sourceId: string,
  opts:     ImportOptions,
  idMap:    Record<string, Record<string, string>>,
): Promise<RowResult> {
  const quoteNumber = String(row.quoteNumber ?? '').trim()
  const customerId  = await resolveCustomerId(row, opts.orgId, idMap)
  if (!customerId) {
    return { entity: 'quote', sourceId, action: 'failed', message: 'לא נמצא לקוח מקושר' }
  }

  const existing = await prisma.quote.findFirst({
    where: { organizationId: opts.orgId, quoteNumber },
    select: { id: true },
  })
  if (existing) {
    return { entity: 'quote', sourceId, targetId: existing.id, action: 'skipped', message: `הצעה ${quoteNumber} קיימת` }
  }

  if (opts.isDryRun) {
    return { entity: 'quote', sourceId, action: 'created', message: `[dry-run] Q ${quoteNumber}` }
  }

  const created = await prisma.quote.create({
    data: {
      organizationId: opts.orgId,
      customerId,
      quoteNumber,
      status:     (row.status as QuoteStatus) ?? 'DRAFT',
      laborHours: num(row.laborHours)  ?? 0,
      laborRate:  num(row.laborRate)   ?? 150,
      partsTotal: num(row.partsTotal)  ?? 0,
      totalPrice: num(row.totalPrice)  ?? 0,
      notes:      str(row.notes),
      validUntil: date(row.validUntil),
    },
  })
  return { entity: 'quote', sourceId, targetId: created.id, action: 'created', message: `Q ${quoteNumber}` }
}

// ─── Rollback ─────────────────────────────────────────────────────────────────

/**
 * Delete all records created by a batch in reverse dependency order.
 */
export async function rollbackBatch(batchId: string, orgId: string): Promise<void> {
  const logs = await prisma.migrationLog.findMany({
    where:   { batchId, action: 'CREATED' },
    orderBy: { createdAt: 'desc' },  // reverse insertion order
  })

  const reverseOrder: TargetEntity[] = [...ENTITY_ORDER].reverse() as TargetEntity[]

  for (const entity of reverseOrder) {
    const entityLogs = logs.filter((l) => l.entity === entity && l.targetId)
    for (const log of entityLogs) {
      try {
        await deleteEntity(entity, log.targetId!, orgId)
        await prisma.migrationLog.update({
          where: { id: log.id },
          data:  { action: 'ROLLED_BACK' },
        })
      } catch {
        // Continue even if individual delete fails
      }
    }
  }

  await prisma.migrationBatch.update({
    where: { id: batchId },
    data:  { status: 'ROLLED_BACK', rolledBack: true },
  })
}

async function deleteEntity(entity: TargetEntity, id: string, orgId: string): Promise<void> {
  // Verify org ownership before deleting
  switch (entity) {
    case 'customer':   await prisma.customer.deleteMany({ where: { id, organizationId: orgId } });   break
    case 'vehicle':    await prisma.vehicle.deleteMany({ where: { id, organizationId: orgId } });    break
    case 'supplier':   await prisma.supplier.deleteMany({ where: { id, organizationId: orgId } });   break
    case 'part':       await prisma.part.deleteMany({ where: { id, organizationId: orgId } });       break
    case 'work_order': await prisma.workOrder.deleteMany({ where: { id, organizationId: orgId } });  break
    case 'invoice':    await prisma.invoice.deleteMany({ where: { id, organizationId: orgId } });    break
    case 'quote':      await prisma.quote.deleteMany({ where: { id, organizationId: orgId } });      break
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).trim()
  return s || null
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ''))
  return isNaN(n) ? null : n
}

function date(v: unknown): Date | null {
  if (!v) return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  const d = new Date(String(v))
  return isNaN(d.getTime()) ? null : d
}

function normalizePhone(phone: string): string {
  // Strip all non-digit, keep leading + for international
  if (!phone) return ''
  const clean = phone.replace(/[^\d+]/g, '')
  return clean
}

async function resolveCustomerId(
  row:   MappedRow,
  orgId: string,
  idMap: Record<string, Record<string, string>>,
): Promise<string | null> {
  // 1. Direct customerId field
  if (row.customerId) return String(row.customerId)

  // 2. Lookup by phone
  if (row._customer_phone) {
    const phone = normalizePhone(String(row._customer_phone))
    const c = await prisma.customer.findFirst({
      where: { organizationId: orgId, phone },
      select: { id: true },
    })
    if (c) return c.id
  }

  // 3. Lookup by name
  if (row._customer_name) {
    const c = await prisma.customer.findFirst({
      where: { organizationId: orgId, name: { equals: String(row._customer_name), mode: 'insensitive' } },
      select: { id: true },
    })
    if (c) return c.id
  }

  return null
}

async function resolveVehicleId(
  row:   MappedRow,
  orgId: string,
  idMap: Record<string, Record<string, string>>,
): Promise<string | null> {
  // 1. Direct vehicleId
  if (row.vehicleId) return String(row.vehicleId)

  // 2. Lookup by plate
  if (row._vehicle_plate) {
    const plate = String(row._vehicle_plate).trim().toUpperCase()
    const v = await prisma.vehicle.findFirst({
      where: { organizationId: orgId, plate },
      select: { id: true },
    })
    if (v) return v.id
  }

  return null
}

async function generateWoNumber(orgId: string): Promise<string> {
  const count = await prisma.workOrder.count({ where: { organizationId: orgId } })
  return `WO-${String(count + 1).padStart(5, '0')}`
}

function guessSourceId(row: Record<string, unknown>): unknown {
  // Try common PK column names
  for (const key of ['id', 'ID', 'Id', 'pk', 'PK']) {
    if (row[key] !== undefined) return row[key]
  }
  return JSON.stringify(row).slice(0, 40)
}

function guessPkColumn(preset: MappingPreset): string {
  // If a source column maps to an id-like field, use it
  const pkMapping = preset.columnMappings.find((m) =>
    /^(id|pk)$/i.test(m.sourceColumn),
  )
  return pkMapping?.sourceColumn ?? 'id'
}

function schemaFromTable(qualifiedName: string): string {
  return qualifiedName.includes('.') ? qualifiedName.split('.')[0] : 'dbo'
}

function nameFromTable(qualifiedName: string): string {
  return qualifiedName.includes('.') ? qualifiedName.split('.')[1] : qualifiedName
}

function toLogAction(action: LogAction): MigrationLogAction {
  const map: Record<string, MigrationLogAction> = {
    created:      'CREATED',
    updated:      'UPDATED',
    skipped:      'SKIPPED',
    failed:       'FAILED',
    rolled_back:  'ROLLED_BACK',
  }
  return map[action] ?? 'FAILED'
}

type LogAction = 'created' | 'updated' | 'skipped' | 'failed' | 'rolled_back'
