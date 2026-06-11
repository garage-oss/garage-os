/**
 * Maps raw NESHER SQL Server rows to GarageOS Prisma input shapes.
 *
 * Rules:
 *   - All source text is decoded from Windows-1255/Latin-1 by the mssql driver (returns JS strings).
 *   - Phone/mobile numbers are stored as-is (garage operators know local formats).
 *   - Required fields that are missing get safe placeholders (never throw; record SKIPPED instead).
 *   - importSource is always 'NESHER', importId is the source PK as a string.
 */

import type { NesherClient, NesherCar, NesherCard } from './queries'
import { WorkOrderStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

export const IMPORT_SOURCE = 'NESHER'

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface MappedCustomer {
  name: string
  phone: string
  email: string | null
  address: string | null
  city: string | null
  mobile: string | null
  notes: string | null
  importSource: string
  importId: string
  externalNo: string | null
}

export function mapClient(row: NesherClient): MappedCustomer | null {
  const name = (row.cli_name ?? '').trim()
  if (!name) return null  // skip nameless records

  return {
    name,
    phone:        sanitizePhone(row.cli_phone) || '000000000',
    email:        emptyToNull(row.cli_email),
    address:      emptyToNull(row.cli_addr),
    city:         emptyToNull(row.cli_city),
    mobile:       sanitizePhone(row.cli_pele) || null,
    notes:        emptyToNull(row.cli_note),
    importSource: IMPORT_SOURCE,
    importId:     String(row.id),
    externalNo:   emptyToNull(row.cli_no),
  }
}

// ─── Vehicle ──────────────────────────────────────────────────────────────────

export interface MappedVehicle {
  plate: string
  make: string
  model: string
  year: number
  vin: string | null
  engine: string | null
  mileage: number | null
  notes: string | null
  makeCode: string | null
  importSource: string
  importId: string
  customerExternalNo: string | null
}

export function mapCar(row: NesherCar): MappedVehicle | null {
  const plate = (row.car_no ?? '').trim().toUpperCase()
  if (!plate) return null   // no plate = no vehicle

  return {
    plate,
    make:               emptyToNull(row.car_code) ?? 'לא ידוע',
    model:              emptyToNull(row.car_model) ?? 'לא ידוע',
    year:               normaliseYear(row.shana),
    vin:                emptyToNull(row.body_no),
    engine:             emptyToNull(row.eng_no),
    mileage:            row.LAST_KM != null ? Math.round(Number(row.LAST_KM)) : null,
    notes:              emptyToNull(row.CAR_DESC),
    makeCode:           emptyToNull(row.car_code),
    importSource:       IMPORT_SOURCE,
    importId:           String(row.LINE_ID),
    customerExternalNo: emptyToNull(row.cli_no),
  }
}

// ─── Work Order ───────────────────────────────────────────────────────────────

export interface MappedWorkOrder {
  workOrderNumber: string
  status: WorkOrderStatus
  partsTotal: Decimal
  laborTotal: Decimal
  laborRate: Decimal
  totalPrice: Decimal
  mileage: number | null
  notes: string | null
  receivedAt: Date | null
  completedAt: Date | null
  importSource: string
  importId: string
  advisorName: string | null
  driverName: string | null
  driverPhone: string | null
  vehiclePlate: string | null
  customerExternalNo: string | null
  customerNameFallback: string | null
}

export function mapCard(row: NesherCard): MappedWorkOrder | null {
  const partsTotal  = toDecimal(row.part_tot)
  const laborTotal  = toDecimal(row.work_tot)
  const laborRate   = toDecimal(row.tarif)
  const totalPrice  = new Decimal(partsTotal.toNumber() + laborTotal.toNumber())

  const completedAt = toDate(row.close_dt)
  const status      = resolveStatus(row.card_st, completedAt)

  return {
    workOrderNumber:      (row.card_no ?? '').trim() || `NESHER-${row.card_id}`,
    status,
    partsTotal,
    laborTotal,
    laborRate,
    totalPrice,
    mileage:              row.card_km != null ? Math.round(Number(row.card_km)) : null,
    notes:                emptyToNull(row.car_desc) ?? emptyToNull(row.card_status),
    receivedAt:           toDate(row.open_dt),
    completedAt,
    importSource:         IMPORT_SOURCE,
    importId:             String(row.card_id),
    advisorName:          emptyToNull(row.adviser),
    driverName:           emptyToNull(row.drv_name),
    driverPhone:          sanitizePhone(row.drv_phone) || null,
    vehiclePlate:         (row.car_no ?? '').trim().toUpperCase() || null,
    customerExternalNo:   emptyToNull(row.cli_no),
    customerNameFallback: emptyToNull(row.cli_name),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null) return null
  const t = v.trim()
  return t === '' ? null : t
}

function sanitizePhone(v: string | null | undefined): string {
  if (!v) return ''
  return v.replace(/[^\d+\-() ]/g, '').trim()
}

function normaliseYear(raw: number | null | undefined): number {
  if (!raw) return new Date().getFullYear()
  if (raw > 1900) return raw
  if (raw > 50)   return 1900 + raw
  return 2000 + raw
}

function toDecimal(v: number | string | null | undefined): Decimal {
  if (v == null) return new Decimal(0)
  const n = parseFloat(String(v))
  return new Decimal(isNaN(n) ? 0 : n)
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return isNaN(d.getTime()) ? null : d
}

function resolveStatus(
  cardSt: string | number | null | undefined,
  completedAt: Date | null,
): WorkOrderStatus {
  if (completedAt) return WorkOrderStatus.COMPLETED
  const s = String(cardSt ?? '').toUpperCase().trim()
  if (s === '2' || s === 'X' || s === 'C') return WorkOrderStatus.CANCELLED
  if (s === '1' || s === 'P') return WorkOrderStatus.IN_PROGRESS
  return WorkOrderStatus.PENDING
}
