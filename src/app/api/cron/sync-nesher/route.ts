/**
 * GET /api/cron/sync-nesher
 *
 * Vercel Cron Job — runs daily at 02:00 UTC.
 * Imports the latest NESHER work orders (most recent page) and syncs phone numbers.
 * Updates SqlServerIntegration.lastSyncAt and writes a SqlSyncLog entry.
 *
 * Protected by CRON_SECRET environment variable.
 */
import { NextRequest, NextResponse }   from 'next/server'
import { prisma }                      from '@/lib/prisma'
import { runNesherImportViaConnector } from '@/lib/nesher/connector-importer'
import { runPhoneSync }                from '@/lib/nesher/phone-sync'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const t0 = Date.now()

  // Find the organization that owns NESHER data
  const membership = await prisma.membership.findFirst({
    where:   { isActive: true },
    orderBy: { createdAt: 'asc' },
    select:  { organizationId: true },
  })

  if (!membership) {
    return NextResponse.json({ error: 'No active organization found' }, { status: 404 })
  }

  const orgId = membership.organizationId

  // Find the SqlServerIntegration record for this org (used for lastSyncAt tracking)
  const integration = await prisma.sqlServerIntegration.findUnique({
    where:  { organizationId: orgId },
    select: { id: true },
  })

  // ── Step 1: Sync work orders (latest page) ────────────────────────────────
  let importResult: Awaited<ReturnType<typeof runNesherImportViaConnector>> | null = null
  let importError: string | null = null

  try {
    importResult = await runNesherImportViaConnector(orgId, null, 1)
  } catch (e) {
    importError = e instanceof Error ? e.message : String(e)
  }

  // ── Step 2: Sync phone numbers (no-op until /api/clients is on connector) ─
  let phoneResult: Awaited<ReturnType<typeof runPhoneSync>> | null = null
  let phoneError: string | null = null

  try {
    phoneResult = await runPhoneSync(orgId)
  } catch (e) {
    phoneError = e instanceof Error ? e.message : String(e)
  }

  const durationMs = Date.now() - t0
  const syncedAt   = new Date()
  const hasError   = !!(importError || phoneError || (importResult?.errors?.length ?? 0) > 0)

  // ── Step 3: Update lastSyncAt on the integration record ───────────────────
  if (integration) {
    await prisma.sqlServerIntegration.update({
      where: { id: integration.id },
      data:  { lastSyncAt: syncedAt },
    }).catch(() => {})

    // Write audit log entry
    await prisma.sqlSyncLog.create({
      data: {
        integrationId:  integration.id,
        organizationId: orgId,
        entity:         'work_orders+phones',
        direction:      'pull',
        status:         hasError ? 'failed' : 'completed',
        rowsRead:       importResult
          ? (importResult.stats.customers.created  + importResult.stats.customers.updated  +
             importResult.stats.vehicles.created   + importResult.stats.vehicles.updated   +
             importResult.stats.workOrders.created + importResult.stats.workOrders.updated)
          : 0,
        rowsInserted:   (importResult?.stats.customers.created  ?? 0) +
                        (importResult?.stats.vehicles.created   ?? 0) +
                        (importResult?.stats.workOrders.created ?? 0),
        rowsUpdated:    (importResult?.stats.customers.updated  ?? 0) +
                        (importResult?.stats.vehicles.updated   ?? 0) +
                        (importResult?.stats.workOrders.updated ?? 0),
        rowsSkipped:    (importResult?.stats.customers.skipped  ?? 0) +
                        (importResult?.stats.vehicles.skipped   ?? 0) +
                        (importResult?.stats.workOrders.skipped ?? 0),
        rowsFailed:     (importResult?.stats.customers.failed   ?? 0) +
                        (importResult?.stats.vehicles.failed    ?? 0) +
                        (importResult?.stats.workOrders.failed  ?? 0),
        errorMessage:   importError ?? phoneError ?? importResult?.errors?.[0] ?? null,
        finishedAt:     syncedAt,
      },
    }).catch(() => {})
  }

  return NextResponse.json({
    success:   !hasError,
    syncedAt:  syncedAt.toISOString(),
    durationMs,
    workOrders: importResult
      ? { stats: importResult.stats, errors: importResult.errors.slice(0, 5) }
      : { error: importError },
    phones: phoneResult
      ? { source: phoneResult.source, updated: phoneResult.updatedInGarage }
      : { error: phoneError },
  })
}
