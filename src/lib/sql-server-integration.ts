/**
 * SQL Server Integration — Connector Service
 *
 * Manages per-organisation SQL Server connection configurations.
 * Credentials are stored encrypted (AES-256-GCM) in the Postgres DB.
 * The decrypted password is NEVER returned to the client — only a
 * `passwordSet: boolean` flag is sent over the wire.
 *
 * Connection pools are created on-demand per organisation and cached
 * in-process.  Pools are closed when the config is updated or deleted.
 *
 * Security constraints (same as Hanesher connector):
 *   - readOnlyIntent: true  — no write queries through this connector
 *   - passwordEnc column — AES-256-GCM; decrypted only server-side
 */

import sql from 'mssql'
import { prisma }                            from './prisma'
import { encrypt, decrypt, encryptIfEnabled } from './encryption'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Config as accepted from the UI (password in plaintext — never stored as-is) */
export interface SqlServerConfigInput {
  server:    string
  database:  string
  username:  string
  password:  string   // plaintext — encrypted before DB write
  port?:     number
  encrypt?:  boolean
  trustCert?: boolean
}

/** Config as returned to the UI (password omitted, replaced by passwordSet flag) */
export interface SqlServerConfigPublic {
  id:          string
  server:      string
  database:    string
  username:    string
  passwordSet: boolean   // true when a password is stored; value never exposed
  port:        number
  encrypt:     boolean
  trustCert:   boolean
  syncEnabled:      boolean
  syncIntervalMin:  number
  lastTestedAt:     Date | null
  lastTestOk:       boolean | null
  lastTestError:    string | null
  lastSyncAt:       Date | null
  createdAt:        Date
  updatedAt:        Date
}

/** Result of a connection test */
export interface TestResult {
  ok:      boolean
  latencyMs?: number
  error?:  string
}

// ─── In-process pool cache ────────────────────────────────────────────────────

const poolCache = new Map<string, sql.ConnectionPool>()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMssqlConfig(
  cfg: SqlServerConfigInput,
): sql.config {
  const raw = (cfg.server ?? '').trim()
  let server:       string
  let instanceName: string | undefined
  let port:         number | undefined

  if (raw.includes('\\')) {
    const [host, inst] = raw.split('\\', 2)
    server = host; instanceName = inst
  } else if (raw.includes(',')) {
    const [host, p] = raw.split(',', 2)
    server = host; port = parseInt(p, 10)
  } else {
    server = raw; port = cfg.port ?? 1433
  }

  const mssqlCfg: sql.config = {
    server,
    database:           cfg.database,
    user:               cfg.username,
    password:           cfg.password,
    options: {
      encrypt:                cfg.encrypt  ?? false,
      trustServerCertificate: cfg.trustCert ?? true,
      readOnlyIntent:         true,   // ← never write through this connector
      enableArithAbort:       true,
      ...(instanceName ? { instanceName } : {}),
    },
    connectionTimeout: 15000,
    requestTimeout:    20000,
    pool: { max: 3, min: 0, idleTimeoutMillis: 30000 },
  }

  if (!instanceName && port) mssqlCfg.port = port
  return mssqlCfg
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save (create or update) an integration config for an organisation.
 * Encrypts the password before writing.
 * Closes any existing pool for the org so the next use re-connects.
 */
export async function saveConfig(
  orgId: string,
  input: SqlServerConfigInput,
): Promise<SqlServerConfigPublic> {
  await closePool(orgId)

  const passwordEnc = encryptIfEnabled(input.password)

  const row = await prisma.sqlServerIntegration.upsert({
    where:  { organizationId: orgId },
    update: {
      server:      input.server,
      database:    input.database,
      username:    input.username,
      passwordEnc,
      port:        input.port      ?? 1433,
      encrypt:     input.encrypt   ?? false,
      trustCert:   input.trustCert ?? true,
    },
    create: {
      organizationId: orgId,
      server:         input.server,
      database:       input.database,
      username:       input.username,
      passwordEnc,
      port:           input.port      ?? 1433,
      encrypt:        input.encrypt   ?? false,
      trustCert:      input.trustCert ?? true,
    },
  })

  return toPublic(row)
}

/**
 * Fetch the public (password-redacted) config for an organisation.
 * Returns null when no config has been saved yet.
 */
export async function getConfig(
  orgId: string,
): Promise<SqlServerConfigPublic | null> {
  const row = await prisma.sqlServerIntegration.findUnique({
    where: { organizationId: orgId },
  })
  return row ? toPublic(row) : null
}

/**
 * Delete the integration config.  Closes any open pool first.
 */
export async function deleteConfig(orgId: string): Promise<void> {
  await closePool(orgId)
  await prisma.sqlServerIntegration.delete({
    where: { organizationId: orgId },
  }).catch(() => { /* already gone */ })
}

/**
 * Test a connection using supplied credentials WITHOUT saving them.
 * Returns ok + latency, or ok=false + error message.
 *
 * This is the handler for the "Test Connection" button — credentials come
 * straight from the form body and are never written to DB here.
 */
export async function testConnectionWithConfig(
  input: SqlServerConfigInput,
): Promise<TestResult> {
  const cfg = buildMssqlConfig(input)
  let pool: sql.ConnectionPool | null = null
  const t0 = Date.now()
  try {
    pool = await new sql.ConnectionPool(cfg).connect()
    await pool.request().query('SELECT 1 AS ping')
    return { ok: true, latencyMs: Date.now() - t0 }
  } catch (e) {
    return {
      ok:    false,
      error: e instanceof Error ? e.message : String(e),
    }
  } finally {
    await pool?.close().catch(() => {})
  }
}

/**
 * Test the connection using the config stored in the DB for this org.
 * Persists lastTestedAt / lastTestOk / lastTestError in the DB afterwards.
 */
export async function testStoredConfig(
  orgId: string,
): Promise<TestResult> {
  const row = await prisma.sqlServerIntegration.findUnique({
    where: { organizationId: orgId },
  })
  if (!row) return { ok: false, error: 'לא נמצאה הגדרת חיבור' }

  const password = decrypt(row.passwordEnc) ?? ''
  const result   = await testConnectionWithConfig({
    server:    row.server,
    database:  row.database,
    username:  row.username,
    password,
    port:      row.port,
    encrypt:   row.encrypt,
    trustCert: row.trustCert,
  })

  await prisma.sqlServerIntegration.update({
    where: { organizationId: orgId },
    data:  {
      lastTestedAt:  new Date(),
      lastTestOk:    result.ok,
      lastTestError: result.ok ? null : (result.error ?? null),
    },
  })

  return result
}

/**
 * Get a live connection pool for an org (creates one if needed).
 * This is used by the sync engine — NOT by the admin UI.
 */
export async function getPool(orgId: string): Promise<sql.ConnectionPool> {
  const existing = poolCache.get(orgId)
  if (existing?.connected) return existing

  const row = await prisma.sqlServerIntegration.findUnique({
    where: { organizationId: orgId },
  })
  if (!row) throw new Error(`SQL Server integration not configured for org ${orgId}`)

  const password = decrypt(row.passwordEnc) ?? ''
  const pool = await new sql.ConnectionPool(
    buildMssqlConfig({
      server:    row.server,
      database:  row.database,
      username:  row.username,
      password,
      port:      row.port,
      encrypt:   row.encrypt,
      trustCert: row.trustCert,
    }),
  ).connect()

  poolCache.set(orgId, pool)
  return pool
}

/**
 * Close and remove the cached pool for an org.
 */
export async function closePool(orgId: string): Promise<void> {
  const p = poolCache.get(orgId)
  if (p) {
    await p.close().catch(() => {})
    poolCache.delete(orgId)
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toPublic(row: {
  id: string
  server: string; database: string; username: string; passwordEnc: string
  port: number; encrypt: boolean; trustCert: boolean
  syncEnabled: boolean; syncIntervalMin: number
  lastTestedAt: Date | null; lastTestOk: boolean | null; lastTestError: string | null
  lastSyncAt: Date | null; createdAt: Date; updatedAt: Date
}): SqlServerConfigPublic {
  return {
    id:               row.id,
    server:           row.server,
    database:         row.database,
    username:         row.username,
    passwordSet:      !!row.passwordEnc,
    port:             row.port,
    encrypt:          row.encrypt,
    trustCert:        row.trustCert,
    syncEnabled:      row.syncEnabled,
    syncIntervalMin:  row.syncIntervalMin,
    lastTestedAt:     row.lastTestedAt,
    lastTestOk:       row.lastTestOk,
    lastTestError:    row.lastTestError,
    lastSyncAt:       row.lastSyncAt,
    createdAt:        row.createdAt,
    updatedAt:        row.updatedAt,
  }
}
