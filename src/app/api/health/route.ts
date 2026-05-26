/**
 * Health check endpoint — /api/health
 *
 * Returns 200 when all services are nominal, 503 when degraded.
 * Used by load balancers, uptime monitors (Uptime Robot, Better Uptime),
 * and Kubernetes liveness/readiness probes.
 *
 * Note: does NOT require authentication so monitors can call it freely.
 */

import { NextResponse } from 'next/server'
import { prisma }       from '@/lib/prisma'
import { logger }       from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Simple in-process start time
const startedAt = Date.now()

interface ServiceStatus {
  status:  'ok' | 'error'
  latency: number
  detail?: string
}

async function checkDatabase(): Promise<ServiceStatus> {
  const t0 = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'ok', latency: Date.now() - t0 }
  } catch (err) {
    return {
      status:  'error',
      latency: Date.now() - t0,
      detail:  err instanceof Error ? err.message : 'unknown',
    }
  }
}

export async function GET() {
  const t0 = Date.now()

  const [db] = await Promise.all([
    checkDatabase(),
    // Add more service checks here: Redis, S3, etc.
  ])

  const allOk   = db.status === 'ok'
  const status  = allOk ? 'ok' : 'degraded'
  const code    = allOk ? 200 : 503

  if (!allOk) {
    logger.error('Health check failed', undefined, { db })
  }

  return NextResponse.json(
    {
      status,
      version:   process.env.npm_package_version ?? '0.1.0',
      timestamp: new Date().toISOString(),
      uptime:    Math.floor((Date.now() - startedAt) / 1000),
      latency:   Date.now() - t0,
      services: {
        database: db,
      },
    },
    {
      status:  code,
      headers: {
        // Never cache health checks
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  )
}
