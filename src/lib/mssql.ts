/**
 * Microsoft SQL Server connection for the Hanesher migration connector.
 *
 * All queries are read-only (readOnlyIntent: true).
 * Credentials come exclusively from environment variables — never from user input.
 *
 * Required env vars:
 *   HANESHER_DB_HOST      e.g. "192.168.1.10" or "sql-server.local"
 *   HANESHER_DB_PORT      default 1433
 *   HANESHER_DB_NAME      database name
 *   HANESHER_DB_USER      SQL login
 *   HANESHER_DB_PASSWORD  SQL password
 *
 * Optional:
 *   HANESHER_DB_ENCRYPT        "true" | "false"  (default: false for local LAN)
 *   HANESHER_DB_TRUST_CERT     "true" | "false"  (default: true)
 */

import sql from 'mssql'

let pool: sql.ConnectionPool | null = null
let poolPromise: Promise<sql.ConnectionPool> | null = null

export function hanesherConfigured(): boolean {
  return !!(
    process.env.HANESHER_DB_HOST &&
    process.env.HANESHER_DB_NAME &&
    process.env.HANESHER_DB_USER &&
    process.env.HANESHER_DB_PASSWORD
  )
}

function buildConfig(): sql.config {
  return {
    server:   process.env.HANESHER_DB_HOST!,
    port:     parseInt(process.env.HANESHER_DB_PORT ?? '1433', 10),
    database: process.env.HANESHER_DB_NAME!,
    user:     process.env.HANESHER_DB_USER!,
    password: process.env.HANESHER_DB_PASSWORD!,
    options: {
      encrypt:              process.env.HANESHER_DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.HANESHER_DB_TRUST_CERT !== 'false',
      readOnlyIntent:       true,   // ← never write to Hanesher
      enableArithAbort:     true,
    },
    connectionTimeout:  15000,
    requestTimeout:     30000,
    pool: {
      max: 3,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  }
}

/**
 * Returns the shared connection pool, creating it on first call.
 * Throws if env vars are missing.
 */
export async function getPool(): Promise<sql.ConnectionPool> {
  if (!hanesherConfigured()) {
    throw new Error(
      'Hanesher DB credentials not configured. ' +
      'Set HANESHER_DB_HOST, HANESHER_DB_NAME, HANESHER_DB_USER, HANESHER_DB_PASSWORD in .env',
    )
  }

  if (pool?.connected) return pool

  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(buildConfig())
      .connect()
      .then((p) => { pool = p; poolPromise = null; return p })
      .catch((err) => { poolPromise = null; throw err })
  }

  return poolPromise
}

/**
 * Close the pool — call during graceful shutdown.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close().catch(() => {})
    pool = null
  }
}

/**
 * Run a read-only SELECT query and return the recordset as a typed array.
 */
export async function query<T = Record<string, unknown>>(
  sqlText: string,
  params?: Record<string, { type: sql.ISqlType; value: unknown }>,
): Promise<T[]> {
  const p   = await getPool()
  const req = p.request()
  if (params) {
    for (const [key, { type, value }] of Object.entries(params)) {
      req.input(key, type, value)
    }
  }
  const result = await req.query(sqlText)
  return result.recordset as unknown as T[]
}

/**
 * Quick connectivity test — returns true/false rather than throwing.
 */
export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getPool()
    await query('SELECT 1 AS ping')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
