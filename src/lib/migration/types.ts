/**
 * Shared TypeScript types for the Hanesher SQL → GarageOS migration connector.
 */

import { FuelType, Transmission } from '@prisma/client'

// ─── Entities ─────────────────────────────────────────────────────────────────

export type TargetEntity =
  | 'customer'
  | 'vehicle'
  | 'supplier'
  | 'part'
  | 'work_order'
  | 'invoice'
  | 'quote'

// ─── Field definitions (what each target entity accepts) ──────────────────────

export type FieldType = 'string' | 'number' | 'date' | 'enum' | 'boolean' | 'lookup'

export type TargetFieldDef = {
  key:         string
  label:       string     // Hebrew label shown in mapping UI
  required:    boolean
  type:        FieldType
  enumValues?: string[]   // for type='enum'
  lookupBy?:   string     // for type='lookup' — e.g. 'customer_phone' or 'vehicle_plate'
  hint?:       string     // extra explanation
}

// Full field map per target entity
export const TARGET_FIELDS: Record<TargetEntity, TargetFieldDef[]> = {
  customer: [
    { key: 'name',    label: 'שם לקוח',    required: true,  type: 'string' },
    { key: 'phone',   label: 'טלפון',      required: true,  type: 'string' },
    { key: 'email',   label: 'אימייל',     required: false, type: 'string' },
    { key: 'address', label: 'כתובת',      required: false, type: 'string' },
    { key: 'notes',   label: 'הערות',      required: false, type: 'string' },
  ],
  vehicle: [
    { key: 'plate',        label: 'לוחית רישוי',   required: true,  type: 'string' },
    { key: 'make',         label: 'יצרן',           required: true,  type: 'string' },
    { key: 'model',        label: 'דגם',            required: true,  type: 'string' },
    { key: 'year',         label: 'שנת ייצור',      required: true,  type: 'number' },
    { key: 'color',        label: 'צבע',            required: false, type: 'string' },
    { key: 'vin',          label: 'מספר שלדה',      required: false, type: 'string' },
    { key: 'engine',       label: 'מנוע',           required: false, type: 'string' },
    { key: 'mileage',      label: 'קילומטראז׳',     required: false, type: 'number' },
    { key: 'notes',        label: 'הערות',          required: false, type: 'string' },
    {
      key: 'fuelType', label: 'סוג דלק', required: false, type: 'enum',
      enumValues: ['GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC', 'LPG'],
    },
    {
      key: 'transmission', label: 'תיבת הילוכים', required: false, type: 'enum',
      enumValues: ['MANUAL', 'AUTOMATIC', 'CVT'],
    },
    // Lookup fields — resolved at import time
    {
      key: '_customer_phone', label: 'טלפון לקוח (קישור)', required: false, type: 'lookup',
      lookupBy: 'customer_phone', hint: 'חפש לקוח לפי מספר טלפון',
    },
    {
      key: '_customer_name', label: 'שם לקוח (קישור)', required: false, type: 'lookup',
      lookupBy: 'customer_name', hint: 'חפש לקוח לפי שם',
    },
  ],
  supplier: [
    { key: 'name',        label: 'שם ספק',    required: true,  type: 'string' },
    { key: 'contactName', label: 'איש קשר',   required: false, type: 'string' },
    { key: 'phone',       label: 'טלפון',     required: false, type: 'string' },
    { key: 'email',       label: 'אימייל',    required: false, type: 'string' },
    { key: 'address',     label: 'כתובת',     required: false, type: 'string' },
    { key: 'notes',       label: 'הערות',     required: false, type: 'string' },
  ],
  part: [
    { key: 'sku',          label: 'מק"ט',          required: true,  type: 'string' },
    { key: 'name',         label: 'שם חלק',        required: true,  type: 'string' },
    { key: 'costPrice',    label: 'מחיר עלות',     required: true,  type: 'number' },
    { key: 'salePrice',    label: 'מחיר מכירה',    required: true,  type: 'number' },
    { key: 'category',     label: 'קטגוריה',       required: false, type: 'string' },
    { key: 'manufacturer', label: 'יצרן',          required: false, type: 'string' },
    { key: 'quantity',     label: 'כמות במלאי',    required: false, type: 'number' },
    { key: 'minQuantity',  label: 'כמות מינימום',  required: false, type: 'number' },
    { key: 'location',     label: 'מיקום מדף',     required: false, type: 'string' },
    { key: 'notes',        label: 'הערות',         required: false, type: 'string' },
    {
      key: '_supplier_name', label: 'שם ספק (קישור)', required: false, type: 'lookup',
      lookupBy: 'supplier_name', hint: 'חפש ספק לפי שם',
    },
  ],
  work_order: [
    { key: 'workOrderNumber',    label: 'מספר פקודה',      required: false, type: 'string', hint: 'יופק אוטומטית אם ריק' },
    { key: 'complaint',          label: 'תלונת לקוח',      required: true,  type: 'string' },
    { key: 'diagnosis',          label: 'אבחון',           required: false, type: 'string' },
    { key: 'laborHours',         label: 'שעות עבודה',      required: false, type: 'number' },
    { key: 'laborRate',          label: 'תעריף לשעה',      required: false, type: 'number' },
    { key: 'mileage',            label: 'קילומטראז׳',      required: false, type: 'number' },
    { key: 'notes',              label: 'הערות',           required: false, type: 'string' },
    { key: 'assignedTechnician', label: 'טכנאי',           required: false, type: 'string' },
    { key: 'completedAt',        label: 'תאריך סיום',      required: false, type: 'date'   },
    { key: 'receivedAt',         label: 'תאריך קבלה',      required: false, type: 'date'   },
    {
      key: 'status', label: 'סטטוס', required: false, type: 'enum',
      enumValues: ['PENDING', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'CANCELLED'],
    },
    {
      key: '_customer_phone', label: 'טלפון לקוח (קישור)', required: false, type: 'lookup',
      lookupBy: 'customer_phone',
    },
    {
      key: '_vehicle_plate', label: 'לוחית רכב (קישור)', required: true, type: 'lookup',
      lookupBy: 'vehicle_plate',
    },
  ],
  invoice: [
    { key: 'number',   label: 'מספר חשבונית',  required: true,  type: 'string' },
    { key: 'subtotal', label: 'סכום לפני מע"מ', required: true,  type: 'number' },
    { key: 'total',    label: 'סה"כ',           required: true,  type: 'number' },
    { key: 'tax',      label: 'מע"מ',           required: false, type: 'number' },
    { key: 'notes',    label: 'הערות',          required: false, type: 'string' },
    {
      key: 'status', label: 'סטטוס', required: false, type: 'enum',
      enumValues: ['DRAFT', 'SENT', 'PAID', 'CANCELLED'],
    },
    {
      key: '_customer_phone', label: 'טלפון לקוח (קישור)', required: false, type: 'lookup',
      lookupBy: 'customer_phone',
    },
  ],
  quote: [
    { key: 'quoteNumber', label: 'מספר הצעה',     required: true,  type: 'string' },
    { key: 'laborHours',  label: 'שעות עבודה',    required: false, type: 'number' },
    { key: 'laborRate',   label: 'תעריף לשעה',    required: false, type: 'number' },
    { key: 'partsTotal',  label: 'סה"כ חלקים',    required: false, type: 'number' },
    { key: 'totalPrice',  label: 'סה"כ',          required: false, type: 'number' },
    { key: 'notes',       label: 'הערות',         required: false, type: 'string' },
    { key: 'validUntil',  label: 'תוקף עד',       required: false, type: 'date'   },
    {
      key: 'status', label: 'סטטוס', required: false, type: 'enum',
      enumValues: ['DRAFT', 'SENT', 'APPROVED', 'REJECTED'],
    },
    {
      key: '_customer_phone', label: 'טלפון לקוח (קישור)', required: false, type: 'lookup',
      lookupBy: 'customer_phone',
    },
  ],
}

export const ENTITY_LABELS: Record<TargetEntity, string> = {
  customer:   'לקוחות',
  vehicle:    'רכבים',
  supplier:   'ספקים',
  part:       'חלקים',
  work_order: 'פקודות עבודה',
  invoice:    'חשבוניות',
  quote:      'הצעות מחיר',
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

export type TransformType =
  | 'none'
  | 'uppercase'
  | 'lowercase'
  | 'trim'
  | 'number'
  | 'date_iso'       // parse various date formats to ISO
  | 'boolean_yn'     // "Y"/"N" → true/false
  | 'fuel_he'        // Hebrew fuel type → FuelType enum
  | 'strip_nondigit' // remove all non-digit chars (for phone normalization)

export type ColumnMapping = {
  sourceColumn: string
  targetField:  string
  transform?:   TransformType
  staticValue?: string   // if set, ignores source column and uses this value
}

// A full preset: one source table → one target entity
export type MappingPreset = {
  id:                string
  name:              string
  sourceTable:       string
  targetEntity:      TargetEntity
  columnMappings:    ColumnMapping[]
  filterSql?:        string      // appended as WHERE clause
  incrementalColumn?: string     // timestamp column for incremental sync
}

// ─── Source schema detection ──────────────────────────────────────────────────

export type SourceColumn = {
  name:     string
  sqlType:  string
  nullable: boolean
  maxLen?:  number
}

export type SourceTable = {
  schema:  string
  name:    string
  columns: SourceColumn[]
  rowCount?: number
}

// ─── Import results ───────────────────────────────────────────────────────────

export type LogAction = 'created' | 'updated' | 'skipped' | 'failed' | 'rolled_back'

export type RowResult = {
  entity:    TargetEntity
  sourceId?: string
  targetId?: string
  action:    LogAction
  message?:  string
  rowData?:  Record<string, unknown>
}

export type BatchSummary = {
  batchId:     string
  isDryRun:    boolean
  total:       number
  imported:    number
  skipped:     number
  failed:      number
  results:     RowResult[]
}

// Fuel type transform helper — exported here so importer + mapper share it
const FUEL_HE_MAP: Record<string, FuelType> = {
  'בנזין':     'GASOLINE',
  'דיזל':      'DIESEL',
  'גז':        'LPG',
  'גז ובנזין': 'LPG',
  'היברידי':   'HYBRID',
  'חשמל':      'ELECTRIC',
  'חשמלי':     'ELECTRIC',
}

export function mapFuelType(value: string): FuelType | undefined {
  const trimmed = value.trim()
  return (
    FUEL_HE_MAP[trimmed] ??
    (Object.entries(FUEL_HE_MAP).find(([k]) => trimmed.includes(k))?.[1])
  )
}
