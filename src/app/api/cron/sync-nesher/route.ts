/**
 * GET /api/cron/sync-nesher
 *
 * Vercel Cron Job — runs every 6 hours.
 * Imports the latest NESHER work orders (most recent page only) so GarageOS
 * stays up to date without user intervention.
 *
 * This endpoint is called by Vercel's cron scheduler.
 * It is protected by the CRON_SECRET environment variable.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/prisma'
import { runNesherImportViaConnector } from '@/lib/nesher/connector-importer'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret — always required; endpoint is closed if CRON_SECRET is not set
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const t0 = Date.now()

  try {
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

    // Import the latest page (cursor = null → most recent 100 records)
    // These are always the most recently updated records, so this keeps GarageOS in sync.
    const result = await runNesherImportViaConnector(orgId, null, 1)

    const durationMs = Date.now() - t0

    return NextResponse.json({
      success:   true,
      syncedAt:  new Date().toISOString(),
      durationMs,
      page:      result.page,
      done:      result.done,
      stats:     result.stats,
      errors:    result.errors.slice(0, 10),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), durationMs: Date.now() - t0 },
      { status: 502 },
    )
  }
}
