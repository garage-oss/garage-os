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
import { isTwilioEnabled } from '@/lib/twilio'
import { isStripeEnabled } from '@/lib/stripe'
import { isEmailEnabled }  from '@/lib/email'

export const dynamic = 'force-dynamic'

// Simple in-process start time
const startedAt = Date.now()

interface ServiceStatus {
  status:   'ok' | 'error' | 'disabled'
  latency?: number
  detail?:  string
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

async function checkStorage(): Promise<ServiceStatus> {
  const provider = process.env.STORAGE_PROVIDER ?? 'local'
  if (provider === 'local') return { status: 'ok', detail: 'local' }

  // For S3 — a lightweight existence check would require a ListBuckets call.
  // For now, just verify config is present.
  if (provider === 's3') {
    const ok = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_S3_BUCKET)
    return {
      status: ok ? 'ok' : 'error',
      detail: ok ? 's3' : 'S3 config missing',
    }
  }

  return { status: 'disabled', detail: provider }
}

function checkTwilio(): ServiceStatus {
  if (!isTwilioEnabled()) return { status: 'disabled' }
  // Can't ping Twilio without a real message — just confirm config
  return { status: 'ok', detail: 'configured' }
}

function checkStripe(): ServiceStatus {
  if (!isStripeEnabled()) return { status: 'disabled' }
  return { status: 'ok', detail: 'configured' }
}

function checkEmail(): ServiceStatus {
  if (!isEmailEnabled()) return { status: 'disabled' }
  return { status: 'ok', detail: process.env.SMTP_HOST }
}

export async function GET() {
  const t0 = Date.now()

  const [db, storage] = await Promise.all([
    checkDatabase(),
    checkStorage(),
  ])

  const twilio = checkTwilio()
  const stripe = checkStripe()
  const email  = checkEmail()

  const critical = [db]   // services that must be OK for the app to function
  const allOk    = critical.every((s) => s.status === 'ok')
  const status   = allOk ? 'ok' : 'degraded'
  const code     = allOk ? 200 : 503

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
        storage,
        twilio,
        stripe,
        email,
      },
    },
    {
      status:  code,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  )
}
