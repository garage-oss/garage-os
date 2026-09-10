/**
 * POST /api/nesher/sync-all
 *
 * Owner-only: runs a complete paginated NESHER import (all pages) followed by
 * a phone sync.  Updates SqlServerIntegration.lastSyncAt and writes a log entry.
 *
 * Intended for the "סנכרן עכשיו" (Sync Now) button.
 * Vercel function timeout is 60 s — each import page takes ~1-2 s, so this can
 * process ~30-40 pages (3 000-4 000 records) per call.  For larger initial
 * imports, call repeatedly until done: true.
 *
 * Request body (optional):
 *   { cursor: number | null }  — resume from cursor (null = start from top)
 *
 * Response:
 *   { done, nextCursor, pages, stats, phones, durationMs }
 */
import { NextRequest, NextResponse }   from 'next/server'
import { requireOrg }                  from '@/lib/org'
import { prisma }                      from '@/lib/prisma'
import { runNesherImportViaConnector } from '@/lib/nesher/connector-importer'
import { runPhoneSync }                from '@/lib/nesher/phone-sync'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { orgId, memberRole } = await requireOrg()
  if (memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as { cursor?: number | null }
  let cursor: number | null = body.cursor ?? null

  const t0    = Date.now()
  let pages   = 0
  let done    = false

  const totals = {
    customers:  { created: 0, updated: 0, skipped: 0, failed: 0 },
    vehicles:   { created: 0, updated: 0, skipped: 0, failed: 0 },
    workOrders: { created: 0, updated: 0, skipped: 0, failed: 0 },
  }
  const allErrors: string[] = []

  // Run pages until done or approaching timeout (50 s safety margin)
  while (Date.now() - t0 < 50_000) {
    let result: Awaited<ReturnType<typeof runNesherImportViaConnector>>
    try {
      result = await runNesherImportViaConnector(orgId, cursor, pages + 1)
    } catch (e) {
      allErrors.push(e instanceof Error ? e.message : String(e))
      break
    }

    pages++
    for (const [entity, stat] of Object.entries(result.stats) as [keyof typeof totals, typeof result.stats.customers][]) {
      totals[entity].created  += stat.created
      totals[entity].updated  += stat.updated
      totals[entity].skipped  += stat.skipped
      totals[entity].failed   += stat.failed
    }
    allErrors.push(...result.errors)

    if (result.done || result.nextCursor == null) {
      done   = true
      cursor = null
      break
    }
    cursor = result.nextCursor
  }

  // ── Phone sync (runs once at the end, or on every resume call when done) ──
  let phoneResult: Awaited<ReturnType<typeof runPhoneSync>> | null = null
  if (done) {
    try { phoneResult = await runPhoneSync(orgId) } catch { /* non-fatal */ }
  }

  // ── Update lastSyncAt ─────────────────────────────────────────────────────
  const syncedAt    = new Date()
  const integration = await prisma.sqlServerIntegration.findUnique({
    where:  { organizationId: orgId },
    select: { id: true },
  })

  if (integration && done) {
    await prisma.sqlServerIntegration.update({
      where: { id: integration.id },
      data:  { lastSyncAt: syncedAt },
    }).catch(() => {})

    await prisma.sqlSyncLog.create({
      data: {
        integrationId:  integration.id,
        organizationId: orgId,
        entity:         'full_sync',
        direction:      'pull',
        status:         allErrors.length > 0 ? 'failed' : 'completed',
        rowsInserted:   totals.customers.created + totals.vehicles.created + totals.workOrders.created,
        rowsUpdated:    totals.customers.updated + totals.vehicles.updated + totals.workOrders.updated,
        rowsSkipped:    totals.customers.skipped + totals.vehicles.skipped + totals.workOrders.skipped,
        rowsFailed:     totals.customers.failed  + totals.vehicles.failed  + totals.workOrders.failed,
        rowsRead:       pages * 100,
        errorMessage:   allErrors[0] ?? null,
        finishedAt:     syncedAt,
      },
    }).catch(() => {})
  }

  return NextResponse.json({
    success:    true,
    done,
    nextCursor: cursor,
    pages,
    durationMs: Date.now() - t0,
    stats:      totals,
    errors:     allErrors.slice(0, 10),
    phones:     phoneResult
      ? { source: phoneResult.source, updated: phoneResult.updatedInGarage }
      : null,
    syncedAt:   done ? syncedAt.toISOString() : null,
  })
}
