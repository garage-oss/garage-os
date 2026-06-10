/**
 * SQL Server Integration — Sync Architecture
 *
 * Defines the sync strategy pattern and per-entity runners.
 * The actual SQL queries are intentionally left as stubs:
 * the connector is NOT yet connected — this file establishes the
 * framework so the sync engine can be wired up in a future phase.
 *
 * Architecture:
 *   runSync(orgId, entity, direction)
 *     └─ finds the registered EntitySyncStrategy
 *        └─ calls strategy.pull(ctx) or strategy.push(ctx)
 *           └─ writes rows to the SqlSyncLog table
 *
 * Strategy pattern:
 *   Each entity registers an EntitySyncStrategy with a pull() and push()
 *   method.  Strategies are pure functions — they receive a SyncContext
 *   (which includes the live DB pool) and return a SyncResult.
 */

import { prisma }  from './prisma'
import { getPool } from './sql-server-integration'
import type { SyncEntity, SyncDirection, EntitySyncConfig } from './sql-server-mapping'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncStatus = 'running' | 'completed' | 'failed'

export interface SyncRowResult {
  action:    'inserted' | 'updated' | 'skipped' | 'failed'
  sourceId?: string
  targetId?: string
  message?:  string
}

export interface SyncResult {
  entity:       SyncEntity
  direction:    SyncDirection
  status:       SyncStatus
  rowsRead:     number
  rowsInserted: number
  rowsUpdated:  number
  rowsSkipped:  number
  rowsFailed:   number
  rows:         SyncRowResult[]
  errorMessage?: string
  startedAt:    Date
  finishedAt:   Date
}

export interface SyncContext {
  orgId:     string
  config:    EntitySyncConfig
  /** live mssql pool — available once connector is wired up */
  // pool:   sql.ConnectionPool   ← uncomment when sync is enabled
}

// ─── Strategy interface ───────────────────────────────────────────────────────

export interface EntitySyncStrategy {
  entity: SyncEntity
  /**
   * Pull: read rows from SQL Server, upsert into GarageOS.
   * Returns a complete SyncResult.
   */
  pull(ctx: SyncContext): Promise<SyncResult>
  /**
   * Push: read rows from GarageOS, write to SQL Server.
   * Returns a complete SyncResult.
   */
  push(ctx: SyncContext): Promise<SyncResult>
}

// ─── Stub result builder ──────────────────────────────────────────────────────

function stubResult(
  entity:    SyncEntity,
  direction: SyncDirection,
  note:      string,
): SyncResult {
  const now = new Date()
  return {
    entity, direction,
    status:       'completed',
    rowsRead:     0, rowsInserted: 0, rowsUpdated: 0,
    rowsSkipped:  0, rowsFailed:   0,
    rows:         [],
    errorMessage: note,
    startedAt:    now,
    finishedAt:   now,
  }
}

// ─── Per-entity strategy implementations ─────────────────────────────────────
// Each strategy is a STUB — the framework is ready but no live queries are
// executed until the connector is intentionally enabled.

const customersStrategy: EntitySyncStrategy = {
  entity: 'customers',

  async pull(ctx: SyncContext): Promise<SyncResult> {
    // TODO (Phase 2): query ctx.config.sourceTable, map columns, upsert Customer rows
    return stubResult('customers', 'pull', 'Sync not yet enabled — framework placeholder')
  },

  async push(ctx: SyncContext): Promise<SyncResult> {
    // TODO (Phase 2): read GarageOS customers, write to ctx.config.sourceTable
    return stubResult('customers', 'push', 'Sync not yet enabled — framework placeholder')
  },
}

const vehiclesStrategy: EntitySyncStrategy = {
  entity: 'vehicles',

  async pull(ctx: SyncContext): Promise<SyncResult> {
    return stubResult('vehicles', 'pull', 'Sync not yet enabled — framework placeholder')
  },

  async push(ctx: SyncContext): Promise<SyncResult> {
    return stubResult('vehicles', 'push', 'Sync not yet enabled — framework placeholder')
  },
}

const workOrdersStrategy: EntitySyncStrategy = {
  entity: 'work_orders',

  async pull(ctx: SyncContext): Promise<SyncResult> {
    return stubResult('work_orders', 'pull', 'Sync not yet enabled — framework placeholder')
  },

  async push(ctx: SyncContext): Promise<SyncResult> {
    return stubResult('work_orders', 'push', 'Sync not yet enabled — framework placeholder')
  },
}

const invoicesStrategy: EntitySyncStrategy = {
  entity: 'invoices',

  async pull(ctx: SyncContext): Promise<SyncResult> {
    return stubResult('invoices', 'pull', 'Sync not yet enabled — framework placeholder')
  },

  async push(ctx: SyncContext): Promise<SyncResult> {
    return stubResult('invoices', 'push', 'Sync not yet enabled — framework placeholder')
  },
}

const suppliersStrategy: EntitySyncStrategy = {
  entity: 'suppliers',

  async pull(ctx: SyncContext): Promise<SyncResult> {
    return stubResult('suppliers', 'pull', 'Sync not yet enabled — framework placeholder')
  },

  async push(ctx: SyncContext): Promise<SyncResult> {
    return stubResult('suppliers', 'push', 'Sync not yet enabled — framework placeholder')
  },
}

const partsStrategy: EntitySyncStrategy = {
  entity: 'parts',

  async pull(ctx: SyncContext): Promise<SyncResult> {
    return stubResult('parts', 'pull', 'Sync not yet enabled — framework placeholder')
  },

  async push(ctx: SyncContext): Promise<SyncResult> {
    return stubResult('parts', 'push', 'Sync not yet enabled — framework placeholder')
  },
}

// ─── Strategy registry ────────────────────────────────────────────────────────

const STRATEGIES: Record<SyncEntity, EntitySyncStrategy> = {
  customers:   customersStrategy,
  vehicles:    vehiclesStrategy,
  work_orders: workOrdersStrategy,
  invoices:    invoicesStrategy,
  suppliers:   suppliersStrategy,
  parts:       partsStrategy,
}

// ─── Main sync runner ─────────────────────────────────────────────────────────

/**
 * Run a sync for one entity in one direction.
 *
 * Writes a SqlSyncLog record (status=running) before execution,
 * updates it to completed/failed after, and returns the full result.
 *
 * The connector is NOT yet enabled — this function scaffolds the full
 * flow so that wiring up the actual queries (Phase 2) requires only
 * filling in the strategy bodies above.
 */
export async function runSync(
  orgId:     string,
  entity:    SyncEntity,
  direction: SyncDirection,
  config:    EntitySyncConfig,
): Promise<SyncResult> {
  const integration = await prisma.sqlServerIntegration.findUnique({
    where: { organizationId: orgId },
  })
  if (!integration) {
    throw new Error('SQL Server integration not configured')
  }

  // Create a running log entry
  const log = await prisma.sqlSyncLog.create({
    data: {
      integrationId:  integration.id,
      organizationId: orgId,
      entity,
      direction,
      status:         'running',
    },
  })

  const strategy = STRATEGIES[entity]
  const ctx: SyncContext = { orgId, config }

  let result: SyncResult
  try {
    result = direction === 'pull'
      ? await strategy.pull(ctx)
      : await strategy.push(ctx)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    result = {
      entity, direction,
      status: 'failed',
      rowsRead: 0, rowsInserted: 0, rowsUpdated: 0,
      rowsSkipped: 0, rowsFailed: 0,
      rows: [],
      errorMessage,
      startedAt:  new Date(log.startedAt),
      finishedAt: new Date(),
    }
  }

  // Update the log with final state
  await prisma.sqlSyncLog.update({
    where: { id: log.id },
    data:  {
      status:       result.status,
      rowsRead:     result.rowsRead,
      rowsInserted: result.rowsInserted,
      rowsUpdated:  result.rowsUpdated,
      rowsSkipped:  result.rowsSkipped,
      rowsFailed:   result.rowsFailed,
      errorMessage: result.errorMessage ?? null,
      finishedAt:   result.finishedAt,
    },
  })

  // Update lastSyncAt on integration
  if (result.status === 'completed') {
    await prisma.sqlServerIntegration.update({
      where: { organizationId: orgId },
      data:  { lastSyncAt: result.finishedAt },
    })
  }

  return result
}

/**
 * Fetch the most recent sync logs for an organisation (all entities).
 */
export async function getRecentLogs(
  orgId: string,
  limit: number = 20,
): Promise<Array<{
  id: string; entity: string; direction: string; status: string
  rowsInserted: number; rowsUpdated: number; rowsFailed: number
  errorMessage: string | null; startedAt: Date; finishedAt: Date | null
}>> {
  const integration = await prisma.sqlServerIntegration.findUnique({
    where: { organizationId: orgId },
    select: { id: true },
  })
  if (!integration) return []

  return prisma.sqlSyncLog.findMany({
    where:   { integrationId: integration.id },
    orderBy: { startedAt: 'desc' },
    take:    limit,
    select: {
      id: true, entity: true, direction: true, status: true,
      rowsInserted: true, rowsUpdated: true, rowsFailed: true,
      errorMessage: true, startedAt: true, finishedAt: true,
    },
  })
}
