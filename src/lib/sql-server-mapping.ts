/**
 * SQL Server Integration — Field Mapping Definitions
 *
 * Describes how each GarageOS entity maps to/from an external SQL Server table.
 * These are the canonical schemas displayed in the mapping UI and used by the
 * sync engine.  The external table/column names are configured per-integration
 * in the UI; this file only defines the GarageOS side.
 */

// ─── Sync entity names ────────────────────────────────────────────────────────

export type SyncEntity =
  | 'customers'
  | 'vehicles'
  | 'work_orders'
  | 'invoices'
  | 'suppliers'
  | 'parts'

export const SYNC_ENTITY_LABELS: Record<SyncEntity, string> = {
  customers:   'לקוחות',
  vehicles:    'רכבים',
  work_orders: 'פקודות עבודה',
  invoices:    'חשבוניות',
  suppliers:   'ספקים',
  parts:       'חלקים',
}

export const SYNC_ENTITY_ICONS: Record<SyncEntity, string> = {
  customers:   '👥',
  vehicles:    '🚗',
  work_orders: '🔧',
  invoices:    '📄',
  suppliers:   '🏭',
  parts:       '📦',
}

// ─── Field types ──────────────────────────────────────────────────────────────

export type MappingFieldType =
  | 'string'
  | 'number'
  | 'date'
  | 'boolean'
  | 'enum'
  | 'phone'     // normalized phone number
  | 'currency'  // decimal, stored as number
  | 'lookup'    // resolved via another entity

export type MappingField = {
  /** GarageOS field key (camelCase) */
  key:          string
  /** Hebrew label shown in UI */
  label:        string
  type:         MappingFieldType
  required:     boolean
  /** Allowed values for enum fields */
  enumValues?:  string[]
  /** For lookup fields — which entity / field resolves it */
  lookupEntity?: SyncEntity
  lookupBy?:    string
  /** Short helper text shown under the field in the mapping UI */
  hint?:        string
  /** Whether this field can be used as a natural-key for deduplication */
  isKey?:       boolean
}

// ─── Mapping definitions — one per GarageOS entity ───────────────────────────

export const ENTITY_MAPPINGS: Record<SyncEntity, MappingField[]> = {

  // ── Customers ──────────────────────────────────────────────────────────────
  customers: [
    {
      key: 'name', label: 'שם לקוח', type: 'string', required: true,
      hint: 'שם מלא — משפחה ופרטי',
    },
    {
      key: 'phone', label: 'טלפון', type: 'phone', required: true, isKey: true,
      hint: 'מספר טלפון — ישמש לאיתור לקוח קיים (מפתח טבעי)',
    },
    { key: 'email',   label: 'אימייל',  type: 'string', required: false },
    { key: 'address', label: 'כתובת',   type: 'string', required: false },
    { key: 'notes',   label: 'הערות',   type: 'string', required: false },
  ],

  // ── Vehicles ───────────────────────────────────────────────────────────────
  vehicles: [
    {
      key: 'plate', label: 'לוחית רישוי', type: 'string', required: true, isKey: true,
      hint: 'מספר רישוי — ישמש לאיתור רכב קיים',
    },
    { key: 'make',   label: 'יצרן',         type: 'string', required: true  },
    { key: 'model',  label: 'דגם',           type: 'string', required: true  },
    { key: 'year',   label: 'שנת ייצור',     type: 'number', required: true  },
    { key: 'color',  label: 'צבע',           type: 'string', required: false },
    { key: 'vin',    label: 'מספר שלדה',     type: 'string', required: false },
    { key: 'engine', label: 'מנוע',          type: 'string', required: false },
    { key: 'mileage',label: 'קילומטראז׳',    type: 'number', required: false },
    {
      key: 'fuelType', label: 'סוג דלק', type: 'enum', required: false,
      enumValues: ['GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC', 'LPG'],
    },
    {
      key: 'transmission', label: 'תיבת הילוכים', type: 'enum', required: false,
      enumValues: ['MANUAL', 'AUTOMATIC', 'CVT'],
    },
    {
      key: '_customer_phone', label: 'טלפון לקוח (קישור)', type: 'lookup',
      required: false, lookupEntity: 'customers', lookupBy: 'phone',
      hint: 'יקשר את הרכב ללקוח לפי מספר טלפון',
    },
    { key: 'notes', label: 'הערות', type: 'string', required: false },
  ],

  // ── Work Orders ────────────────────────────────────────────────────────────
  work_orders: [
    {
      key: 'workOrderNumber', label: 'מספר פקודה', type: 'string',
      required: false, hint: 'יופק אוטומטית אם ריק',
    },
    { key: 'complaint',          label: 'תלונת לקוח',  type: 'string',  required: true  },
    { key: 'diagnosis',          label: 'אבחון',        type: 'string',  required: false },
    { key: 'laborHours',         label: 'שעות עבודה',  type: 'number',  required: false },
    { key: 'laborRate',          label: 'תעריף לשעה',  type: 'currency',required: false },
    { key: 'partsTotal',         label: 'סה"כ חלקים',  type: 'currency',required: false },
    { key: 'totalPrice',         label: 'סה"כ',        type: 'currency',required: false },
    { key: 'mileage',            label: 'קילומטראז׳',  type: 'number',  required: false },
    { key: 'assignedTechnician', label: 'טכנאי',       type: 'string',  required: false },
    { key: 'receivedAt',         label: 'תאריך קבלה',  type: 'date',    required: false },
    { key: 'completedAt',        label: 'תאריך סיום',  type: 'date',    required: false },
    {
      key: 'status', label: 'סטטוס', type: 'enum', required: false,
      enumValues: ['PENDING', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'CANCELLED'],
    },
    {
      key: '_vehicle_plate', label: 'לוחית רכב (קישור)', type: 'lookup',
      required: true, lookupEntity: 'vehicles', lookupBy: 'plate',
      hint: 'יקשר את פקודת העבודה לרכב לפי לוחית',
    },
    {
      key: '_customer_phone', label: 'טלפון לקוח (קישור)', type: 'lookup',
      required: false, lookupEntity: 'customers', lookupBy: 'phone',
    },
    { key: 'notes', label: 'הערות', type: 'string', required: false },
  ],

  // ── Invoices ───────────────────────────────────────────────────────────────
  invoices: [
    {
      key: 'number', label: 'מספר חשבונית', type: 'string', required: true, isKey: true,
      hint: 'מספר חשבונית — ישמש לאיתור חשבונית קיימת',
    },
    { key: 'subtotal', label: 'סכום לפני מע"מ', type: 'currency', required: true  },
    { key: 'tax',      label: 'מע"מ',            type: 'currency', required: false },
    { key: 'total',    label: 'סה"כ לתשלום',     type: 'currency', required: true  },
    {
      key: 'status', label: 'סטטוס', type: 'enum', required: false,
      enumValues: ['DRAFT', 'SENT', 'PAID', 'CANCELLED'],
    },
    { key: 'issuedAt', label: 'תאריך הוצאה', type: 'date',   required: false },
    { key: 'dueAt',    label: 'תאריך פירעון', type: 'date',   required: false },
    { key: 'notes',    label: 'הערות',         type: 'string', required: false },
    {
      key: '_customer_phone', label: 'טלפון לקוח (קישור)', type: 'lookup',
      required: false, lookupEntity: 'customers', lookupBy: 'phone',
    },
    {
      key: '_work_order_number', label: 'מספר פקודה (קישור)', type: 'lookup',
      required: false, lookupEntity: 'work_orders', lookupBy: 'workOrderNumber',
      hint: 'יקשר חשבונית לפקודת עבודה',
    },
  ],

  // ── Suppliers ──────────────────────────────────────────────────────────────
  suppliers: [
    {
      key: 'name', label: 'שם ספק', type: 'string', required: true, isKey: true,
      hint: 'שם חברה — ישמש לאיתור ספק קיים',
    },
    { key: 'contactName', label: 'איש קשר',  type: 'string', required: false },
    { key: 'phone',       label: 'טלפון',    type: 'phone',  required: false },
    { key: 'email',       label: 'אימייל',   type: 'string', required: false },
    { key: 'address',     label: 'כתובת',    type: 'string', required: false },
    { key: 'notes',       label: 'הערות',    type: 'string', required: false },
  ],

  // ── Parts ──────────────────────────────────────────────────────────────────
  parts: [
    {
      key: 'sku', label: 'מק"ט', type: 'string', required: true, isKey: true,
      hint: 'מק"ט — ישמש לאיתור חלק קיים',
    },
    { key: 'name',         label: 'שם חלק',        type: 'string',  required: true  },
    { key: 'category',     label: 'קטגוריה',        type: 'string',  required: false },
    { key: 'manufacturer', label: 'יצרן',           type: 'string',  required: false },
    { key: 'costPrice',    label: 'מחיר עלות',      type: 'currency',required: true  },
    { key: 'salePrice',    label: 'מחיר מכירה',     type: 'currency',required: true  },
    { key: 'quantity',     label: 'כמות במלאי',     type: 'number',  required: false },
    { key: 'minQuantity',  label: 'כמות מינימום',   type: 'number',  required: false },
    { key: 'location',     label: 'מיקום מדף',      type: 'string',  required: false },
    { key: 'notes',        label: 'הערות',          type: 'string',  required: false },
    {
      key: '_supplier_name', label: 'שם ספק (קישור)', type: 'lookup',
      required: false, lookupEntity: 'suppliers', lookupBy: 'name',
      hint: 'יקשר חלק לספק לפי שם',
    },
  ],
}

// ─── Sync direction ───────────────────────────────────────────────────────────

export type SyncDirection = 'pull' | 'push'

export const SYNC_DIRECTION_LABELS: Record<SyncDirection, string> = {
  pull: 'ייבוא מ-SQL Server → GarageOS',
  push: 'ייצוא מ-GarageOS → SQL Server',
}

// ─── Column transform types ───────────────────────────────────────────────────

export type ColumnTransform =
  | 'none'
  | 'trim'
  | 'uppercase'
  | 'lowercase'
  | 'strip_nondigit'  // phone normalization
  | 'number'
  | 'date_iso'
  | 'boolean_yn'      // "Y"/"N" → true/false
  | 'fuel_he'         // Hebrew fuel → enum

export const COLUMN_TRANSFORM_LABELS: Record<ColumnTransform, string> = {
  none:           'ללא המרה',
  trim:           'הסרת רווחים',
  uppercase:      'אותיות גדולות',
  lowercase:      'אותיות קטנות',
  strip_nondigit: 'ספרות בלבד (טלפון)',
  number:         'המרה למספר',
  date_iso:       'המרה לתאריך ISO',
  boolean_yn:     'Y/N → אמת/שקר',
  fuel_he:        'סוג דלק (עברית)',
}

// ─── Per-entity column mapping (user-configured) ──────────────────────────────

export type ColumnMapping = {
  /** External SQL Server column name */
  sourceColumn: string
  /** GarageOS field key (from MappingField.key) */
  targetField:  string
  transform?:   ColumnTransform
  /** If set, overrides sourceColumn with a constant value */
  staticValue?: string
}

export type EntitySyncConfig = {
  entity:          SyncEntity
  sourceTable:     string       // external SQL Server table or view
  columnMappings:  ColumnMapping[]
  filterSql?:      string       // WHERE clause appended to SELECT
  /** Column to use for incremental sync (must be a datetime) */
  incrementalCol?: string
  direction:       SyncDirection
  enabled:         boolean
}
