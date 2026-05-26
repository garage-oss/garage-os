/**
 * Row mapper — transforms a raw SQL Server row into a GarageOS-ready object
 * using a ColumnMapping[] preset.
 */

import type { ColumnMapping, TransformType } from './types'
import { mapFuelType } from './types'

// ─── Value transforms ─────────────────────────────────────────────────────────

function applyTransform(raw: unknown, transform: TransformType): unknown {
  if (raw === null || raw === undefined) return undefined

  const str = String(raw)

  switch (transform) {
    case 'none':         return raw
    case 'trim':         return str.trim()
    case 'uppercase':    return str.trim().toUpperCase()
    case 'lowercase':    return str.trim().toLowerCase()
    case 'number': {
      const n = parseFloat(str.replace(/[^\d.-]/g, ''))
      return isNaN(n) ? undefined : n
    }
    case 'date_iso': {
      if (raw instanceof Date) return raw
      const d = new Date(str)
      return isNaN(d.getTime()) ? undefined : d
    }
    case 'boolean_yn':
      return str.trim().toUpperCase() === 'Y' || str === '1' || str.toLowerCase() === 'true'
    case 'fuel_he':
      return mapFuelType(str)
    case 'strip_nondigit':
      return str.replace(/\D/g, '')
    default:
      return raw
  }
}

// ─── Main mapper ──────────────────────────────────────────────────────────────

export type MappedRow = Record<string, unknown>

/**
 * Transform a single source row into a MappedRow using the preset's column mappings.
 *
 * - `staticValue` overrides the source column value
 * - `transform` is applied after reading the source column value
 * - Lookup fields (keys starting with `_`) are kept as-is for the importer to resolve
 */
export function mapRow(
  sourceRow:      Record<string, unknown>,
  columnMappings: ColumnMapping[],
): MappedRow {
  const out: MappedRow = {}

  for (const mapping of columnMappings) {
    const { sourceColumn, targetField, transform = 'none', staticValue } = mapping

    let value: unknown
    if (staticValue !== undefined && staticValue !== '') {
      value = staticValue
    } else {
      // Case-insensitive column lookup (SQL Server column names vary)
      const key = Object.keys(sourceRow).find(
        (k) => k.toLowerCase() === sourceColumn.toLowerCase(),
      )
      value = key !== undefined ? sourceRow[key] : undefined
    }

    const transformed = applyTransform(value, transform)
    if (transformed !== undefined && transformed !== null && transformed !== '') {
      out[targetField] = transformed
    }
  }

  return out
}

// ─── Validation ───────────────────────────────────────────────────────────────

import type { TargetEntity } from './types'
import { TARGET_FIELDS } from './types'

export type ValidationResult =
  | { valid: true }
  | { valid: false; missing: string[] }

/**
 * Check that all required fields for the target entity are present in the mapped row.
 */
export function validateMappedRow(
  row:    MappedRow,
  entity: TargetEntity,
): ValidationResult {
  const fields   = TARGET_FIELDS[entity]
  const required = fields.filter((f) => f.required && !f.key.startsWith('_'))
  const missing  = required
    .filter((f) => row[f.key] === undefined || row[f.key] === null || row[f.key] === '')
    .map((f) => f.key)

  return missing.length ? { valid: false, missing } : { valid: true }
}
