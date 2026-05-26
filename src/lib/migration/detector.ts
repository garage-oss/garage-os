/**
 * Source schema detection — reads table/column metadata from Hanesher SQL Server.
 *
 * Strategy:
 *  1. Try INFORMATION_SCHEMA.TABLES for the table list.
 *  2. If that returns nothing (permissions gap), fall back to sys.tables.
 *  3. Fetch ALL columns in ONE bulk query (not N+1).
 *  4. Fetch row counts in ONE sys.partitions query (not N COUNT(*)).
 */

import { query } from '@/lib/mssql'
import type { SourceTable, SourceColumn } from './types'

// ─── Table list ───────────────────────────────────────────────────────────────

/**
 * Returns all user tables with their columns.
 * Optionally includes an approximate row count via sys.partitions (fast, single query).
 */
export async function detectTables(withRowCounts = false): Promise<SourceTable[]> {
  // ── Step 1: table names ───────────────────────────────────────────────────

  let tableRows: { TABLE_SCHEMA: string; TABLE_NAME: string }[] = []

  // Try INFORMATION_SCHEMA first
  try {
    tableRows = await query<{ TABLE_SCHEMA: string; TABLE_NAME: string }>(`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM   INFORMATION_SCHEMA.TABLES
      WHERE  TABLE_TYPE = 'BASE TABLE'
      ORDER  BY TABLE_SCHEMA, TABLE_NAME
    `)
  } catch {
    tableRows = []
  }

  // Fallback: sys.tables (bypasses INFORMATION_SCHEMA permission requirements)
  if (tableRows.length === 0) {
    try {
      const sysRows = await query<{ schema_name: string; table_name: string }>(`
        SELECT SCHEMA_NAME(schema_id) AS schema_name,
               name                   AS table_name
        FROM   sys.tables
        ORDER  BY schema_name, table_name
      `)
      tableRows = sysRows.map(r => ({
        TABLE_SCHEMA: r.schema_name,
        TABLE_NAME:   r.table_name,
      }))
    } catch {
      tableRows = []
    }
  }

  if (tableRows.length === 0) return []

  // ── Step 2: all columns in ONE query ─────────────────────────────────────

  // Build a set of table names for the IN clause
  const tableNames = tableRows.map(r => `'${r.TABLE_NAME.replace(/'/g, "''")}'`).join(', ')

  let allColumns: {
    TABLE_SCHEMA:             string
    TABLE_NAME:               string
    COLUMN_NAME:              string
    DATA_TYPE:                string
    IS_NULLABLE:              string
    CHARACTER_MAXIMUM_LENGTH: number | null
  }[] = []

  try {
    allColumns = await query(`
      SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME,
             DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
      FROM   INFORMATION_SCHEMA.COLUMNS
      WHERE  TABLE_NAME IN (${tableNames})
      ORDER  BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
    `)
  } catch {
    // If INFORMATION_SCHEMA.COLUMNS is also blocked, try sys.columns
    try {
      allColumns = await query(`
        SELECT
          SCHEMA_NAME(t.schema_id)  AS TABLE_SCHEMA,
          t.name                     AS TABLE_NAME,
          c.name                     AS COLUMN_NAME,
          tp.name                    AS DATA_TYPE,
          CASE WHEN c.is_nullable = 1 THEN 'YES' ELSE 'NO' END AS IS_NULLABLE,
          CASE WHEN tp.name IN ('varchar','nvarchar','char','nchar')
               THEN c.max_length ELSE NULL END AS CHARACTER_MAXIMUM_LENGTH
        FROM   sys.columns  c
        JOIN   sys.tables   t  ON t.object_id = c.object_id
        JOIN   sys.types    tp ON tp.user_type_id = c.user_type_id
        WHERE  t.name IN (${tableNames})
        ORDER  BY SCHEMA_NAME(t.schema_id), t.name, c.column_id
      `)
    } catch {
      allColumns = []
    }
  }

  // Index columns by "schema.table"
  const colMap = new Map<string, SourceColumn[]>()
  for (const c of allColumns) {
    const key = `${c.TABLE_SCHEMA}.${c.TABLE_NAME}`
    if (!colMap.has(key)) colMap.set(key, [])
    colMap.get(key)!.push({
      name:     c.COLUMN_NAME,
      sqlType:  c.DATA_TYPE,
      nullable: c.IS_NULLABLE === 'YES',
      maxLen:   c.CHARACTER_MAXIMUM_LENGTH ?? undefined,
    })
  }

  // ── Step 3: row counts via sys.partitions (ONE query, no table scans) ────

  const rowCountMap = new Map<string, number>()
  if (withRowCounts) {
    try {
      const counts = await query<{ TABLE_SCHEMA: string; TABLE_NAME: string; row_count: number }>(`
        SELECT
          SCHEMA_NAME(t.schema_id) AS TABLE_SCHEMA,
          t.name                    AS TABLE_NAME,
          SUM(p.rows)               AS row_count
        FROM   sys.tables     t
        JOIN   sys.partitions p ON t.object_id = p.object_id
        WHERE  p.index_id IN (0, 1)   -- heap (0) or clustered index (1)
        GROUP  BY t.schema_id, t.name
      `)
      for (const r of counts) {
        rowCountMap.set(`${r.TABLE_SCHEMA}.${r.TABLE_NAME}`, r.row_count)
      }
    } catch {
      // row counts are best-effort — silently skip
    }
  }

  // ── Assemble result ───────────────────────────────────────────────────────

  return tableRows.map(r => ({
    schema:   r.TABLE_SCHEMA,
    name:     r.TABLE_NAME,
    columns:  colMap.get(`${r.TABLE_SCHEMA}.${r.TABLE_NAME}`) ?? [],
    rowCount: withRowCounts ? (rowCountMap.get(`${r.TABLE_SCHEMA}.${r.TABLE_NAME}`) ?? 0) : undefined,
  }))
}

// ─── Column metadata (single table) ──────────────────────────────────────────

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

  return rows.map(r => ({
    name:     r.COLUMN_NAME,
    sqlType:  r.DATA_TYPE,
    nullable: r.IS_NULLABLE === 'YES',
    maxLen:   r.CHARACTER_MAXIMUM_LENGTH ?? undefined,
  }))
}

// ─── Row preview ──────────────────────────────────────────────────────────────

export async function previewRows(
  schemaName: string,
  tableName:  string,
  limit = 20,
  filterSql?: string,
): Promise<Record<string, unknown>[]> {
  const safeSchema = schemaName.replace(/[^a-zA-Z0-9_]/g, '')
  const safeTable  = tableName.replace(/[^a-zA-Z0-9_]/g, '')
  const safeLimit  = Math.min(Math.max(1, limit), 200)
  const where      = filterSql?.trim() ? `WHERE ${filterSql}` : ''

  return query<Record<string, unknown>>(`
    SELECT TOP ${safeLimit} *
    FROM   [${safeSchema}].[${safeTable}]
    ${where}
  `)
}

// ─── Row count ────────────────────────────────────────────────────────────────

export async function countRows(
  schemaName:      string,
  tableName:       string,
  filterSql?:      string,
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

export async function* fetchRows(
  schemaName:      string,
  tableName:       string,
  pkColumn:        string,
  filterSql?:      string,
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

  const baseWhere = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  let lastPk: unknown = null
  let page   = 0

  while (true) {
    let where = baseWhere
    if (lastPk !== null) {
      const cursor = `[${safePk}] > '${String(lastPk).replace(/'/g, "''")}'`
      where = baseWhere
        ? `${baseWhere} AND ${cursor}`
        : `WHERE ${cursor}`
    }

    const rows = await query<Record<string, unknown>>(`
      SELECT TOP ${batchSize} *
      FROM   [${safeSchema}].[${safeTable}]
      ${where}
      ORDER  BY [${safePk}] ASC
    `)

    if (!rows.length) break
    yield rows
    lastPk = rows[rows.length - 1][pkColumn]
    page++

    if (page * batchSize >= 2_000_000) break
  }
}
