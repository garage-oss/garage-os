/**
 * Source schema detection — reads table/column metadata from Hanesher SQL Server.
 */

import { query } from '@/lib/mssql'
import type { SourceTable, SourceColumn } from './types'

// ─── Table list ───────────────────────────────────────────────────────────────

/**
 * Returns all user tables in the configured database (excludes system tables).
 * Optionally includes a row count for each table.
 */
export async function detectTables(withRowCounts = false): Promise<SourceTable[]> {
  // All user base tables with their schema
  const tableRows = await query<{ TABLE_SCHEMA: string; TABLE_NAME: string }>(`
    SELECT TABLE_SCHEMA, TABLE_NAME
    FROM   INFORMATION_SCHEMA.TABLES
    WHERE  TABLE_TYPE = 'BASE TABLE'
    ORDER  BY TABLE_SCHEMA, TABLE_NAME
  `)

  const tables: SourceTable[] = []

  for (const row of tableRows) {
    const columns = await detectColumns(row.TABLE_SCHEMA, row.TABLE_NAME)

    let rowCount: number | undefined
    if (withRowCounts) {
      try {
        const countRows = await query<{ cnt: number }>(
          `SELECT COUNT(*) AS cnt FROM [${row.TABLE_SCHEMA}].[${row.TABLE_NAME}]`,
        )
        rowCount = countRows[0]?.cnt ?? 0
      } catch {
        rowCount = undefined
      }
    }

    tables.push({
      schema:   row.TABLE_SCHEMA,
      name:     row.TABLE_NAME,
      columns,
      rowCount,
    })
  }

  return tables
}

// ─── Column metadata ──────────────────────────────────────────────────────────

export async function detectColumns(
  schemaName: string,
  tableName:  string,
): Promise<SourceColumn[]> {
  const rows = await query<{
    COLUMN_NAME:              string
    DATA_TYPE:                string
    IS_NULLABLE:              string
    CHARACTER_MAXIMUM_LENGTH: number | null
  }>(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
    FROM   INFORMATION_SCHEMA.COLUMNS
    WHERE  TABLE_SCHEMA = '${schemaName.replace(/'/g, "''")}'
      AND  TABLE_NAME   = '${tableName.replace(/'/g, "''")}'
    ORDER  BY ORDINAL_POSITION
  `)

  return rows.map((r) => ({
    name:     r.COLUMN_NAME,
    sqlType:  r.DATA_TYPE,
    nullable: r.IS_NULLABLE === 'YES',
    maxLen:   r.CHARACTER_MAXIMUM_LENGTH ?? undefined,
  }))
}

// ─── Row preview ──────────────────────────────────────────────────────────────

/**
 * Returns the first `limit` rows from a source table.
 * Table and schema names are NOT parameterised (INFORMATION_SCHEMA names are
 * safe — we read them from the DB itself) but we sanitize them anyway.
 */
export async function previewRows(
  schemaName: string,
  tableName:  string,
  limit = 20,
  filterSql?: string,
): Promise<Record<string, unknown>[]> {
  const safeSchema = schemaName.replace(/[^a-zA-Z0-9_]/g, '')
  const safeTable  = tableName.replace(/[^a-zA-Z0-9_]/g, '')
  const safeLimit  = Math.min(Math.max(1, limit), 200)

  const where = filterSql?.trim() ? `WHERE ${filterSql}` : ''

  return query<Record<string, unknown>>(`
    SELECT TOP ${safeLimit} *
    FROM   [${safeSchema}].[${safeTable}]
    ${where}
  `)
}

// ─── Row count ────────────────────────────────────────────────────────────────

export async function countRows(
  schemaName:    string,
  tableName:     string,
  filterSql?:    string,
  afterTimestamp?: { column: string; value: Date },
): Promise<number> {
  const safeSchema = schemaName.replace(/[^a-zA-Z0-9_]/g, '')
  const safeTable  = tableName.replace(/[^a-zA-Z0-9_]/g, '')

  const conditions: string[] = []
  if (filterSql?.trim()) conditions.push(`(${filterSql})`)
  if (afterTimestamp) {
    const iso = afterTimestamp.value.toISOString()
    conditions.push(`[${afterTimestamp.column}] > '${iso}'`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const rows = await query<{ cnt: number }>(`
    SELECT COUNT(*) AS cnt
    FROM   [${safeSchema}].[${safeTable}]
    ${where}
  `)
  return rows[0]?.cnt ?? 0
}

// ─── Full table fetch (batched) ───────────────────────────────────────────────

/**
 * Async generator that yields rows in batches of `batchSize`.
 * Used during import to avoid loading entire tables into memory.
 */
export async function* fetchRows(
  schemaName:     string,
  tableName:      string,
  pkColumn:       string,
  filterSql?:     string,
  afterTimestamp?: { column: string; value: Date },
  batchSize = 500,
): AsyncGenerator<Record<string, unknown>[]> {
  const safeSchema = schemaName.replace(/[^a-zA-Z0-9_]/g, '')
  const safeTable  = tableName.replace(/[^a-zA-Z0-9_]/g, '')
  const safePk     = pkColumn.replace(/[^a-zA-Z0-9_]/g, '')

  const conditions: string[] = []
  if (filterSql?.trim()) conditions.push(`(${filterSql})`)
  if (afterTimestamp) {
    const iso = afterTimestamp.value.toISOString()
    conditions.push(`[${afterTimestamp.column}] > '${iso}'`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  let lastPk: unknown = null
  let page = 0

  while (true) {
    const cursor = lastPk !== null
      ? `AND [${safePk}] > '${String(lastPk).replace(/'/g, "''")}'`
      : ''

    const rows = await query<Record<string, unknown>>(`
      SELECT TOP ${batchSize} *
      FROM   [${safeSchema}].[${safeTable}]
      ${where} ${cursor ? (where ? 'AND' : 'WHERE') + ' ' + cursor.slice(4) : ''}
      ORDER  BY [${safePk}] ASC
    `)

    if (!rows.length) break
    yield rows
    lastPk = rows[rows.length - 1][pkColumn]
    page++

    // Safety: never exceed 2 million rows
    if (page * batchSize >= 2_000_000) break
  }
}
