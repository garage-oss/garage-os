/**
 * Job queue worker endpoint — GET /api/cron/jobs
 *
 * Called by a cron service (Railway, Vercel Cron, GitHub Actions, etc.)
 * to process pending retry-queue jobs.
 *
 * Protected by a CRON_SECRET header to prevent public access.
 * Set CRON_SECRET to a random string and pass it in the cron scheduler.
 *
 * Example Railway cron:
 *   schedule: "* * * * *"    (every minute)
 *   command: curl -H "Authorization: Bearer $CRON_SECRET" https://app.../api/cron/jobs
 */

import { NextRequest, NextResponse } from 'next/server'
import { processJobs, pruneJobs } from '@/lib/job-queue'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.replace(/^Bearer\s+/i, '')
    if (token !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const t0 = Date.now()

  try {
    const { processed, failed } = await processJobs()

    // Prune old jobs once a day (roughly — runs each time but deletes nothing if recent)
    const pruned = await pruneJobs(30)

    const elapsed = Date.now() - t0
    logger.info('Cron jobs run', { processed, failed, pruned, elapsed })

    return NextResponse.json({ ok: true, processed, failed, pruned, elapsed })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    logger.error('Cron jobs error', err instanceof Error ? err : new Error(msg))
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
