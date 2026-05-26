/**
 * Database-backed job queue with retry logic.
 *
 * Jobs are stored in the `JobQueue` table and processed by a worker
 * (called from a cron endpoint or background task).
 *
 * Supported job types:
 *   send_whatsapp  — send a WhatsApp message via Twilio
 *   send_email     — send a transactional email
 *   generate_pdf   — (future) generate invoice PDF and store in S3
 */

import { prisma } from './prisma'
import { sendWhatsApp } from './twilio'
import { sendEmail } from './email'
import { logger } from './logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobType = 'send_whatsapp' | 'send_email' | 'generate_pdf'

export interface WhatsAppPayload {
  to:   string
  body: string
}

export interface EmailPayload {
  to:      string | string[]
  subject: string
  html:    string
  text?:   string
}

export type JobPayload = WhatsAppPayload | EmailPayload | Record<string, unknown>

export interface EnqueueOptions {
  type:        JobType
  payload:     JobPayload
  runAt?:      Date       // default: now
  maxAttempts?: number    // default: 3
}

// ─── Enqueue ─────────────────────────────────────────────────────────────────

/** Add a job to the queue. Returns the new job's ID. */
export async function enqueue(opts: EnqueueOptions): Promise<string> {
  const job = await prisma.jobQueue.create({
    data: {
      type:        opts.type,
      payload:     opts.payload as object,
      runAt:       opts.runAt ?? new Date(),
      maxAttempts: opts.maxAttempts ?? 3,
    },
  })
  logger.info('Job enqueued', { jobId: job.id, type: job.type })
  return job.id
}

/** Enqueue a WhatsApp message (fire-and-forget with retry) */
export async function enqueueWhatsApp(to: string, body: string): Promise<string> {
  return enqueue({ type: 'send_whatsapp', payload: { to, body } })
}

/** Enqueue a transactional email (fire-and-forget with retry) */
export async function enqueueEmail(opts: EmailPayload): Promise<string> {
  return enqueue({ type: 'send_email', payload: opts })
}

// ─── Worker ───────────────────────────────────────────────────────────────────

const BATCH_SIZE = 10

/**
 * Process up to BATCH_SIZE due jobs.
 * Call from GET /api/cron/jobs or a scheduled task.
 * Returns the number of jobs processed.
 */
export async function processJobs(): Promise<{ processed: number; failed: number }> {
  const now = new Date()

  // Claim PENDING jobs that are due (attempts < maxAttempts checked in-process)
  const jobs = await prisma.jobQueue.findMany({
    where: {
      status: 'PENDING',
      runAt:  { lte: now },
    },
    orderBy: { runAt: 'asc' },
    take:    BATCH_SIZE * 2,  // fetch extra, filter below
  })

  // Filter out jobs that have exhausted retries
  const eligibleJobs = jobs.filter((j) => j.attempts < j.maxAttempts).slice(0, BATCH_SIZE)

  let processed = 0
  let failed    = 0

  for (const job of eligibleJobs) {
    // Mark as RUNNING
    await prisma.jobQueue.update({
      where: { id: job.id },
      data:  { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } },
    })

    try {
      await runJob(job.type as JobType, job.payload as JobPayload)

      await prisma.jobQueue.update({
        where: { id: job.id },
        data:  { status: 'DONE', finishedAt: new Date() },
      })
      processed++
      logger.info('Job completed', { jobId: job.id, type: job.type })
    } catch (err) {
      const msg  = err instanceof Error ? err.message : 'unknown'
      const next = job.attempts + 1 >= job.maxAttempts ? 'FAILED' : 'PENDING'
      // Exponential backoff: 5min, 25min, 2h
      const backoff = Math.pow(5, job.attempts + 1) * 60 * 1000
      const runAt   = new Date(Date.now() + backoff)

      await prisma.jobQueue.update({
        where: { id: job.id },
        data:  {
          status:    next,
          lastError: msg,
          runAt:     next === 'PENDING' ? runAt : undefined,
        },
      })
      failed++
      logger.error('Job failed', err instanceof Error ? err : new Error(msg), { jobId: job.id, type: job.type, next })
    }
  }

  return { processed, failed }
}

async function runJob(type: JobType, payload: JobPayload): Promise<void> {
  switch (type) {
    case 'send_whatsapp': {
      const p = payload as WhatsAppPayload
      const result = await sendWhatsApp({ to: p.to, body: p.body })
      if (!result.success) throw new Error(result.error ?? 'WhatsApp send failed')
      break
    }

    case 'send_email': {
      const p = payload as EmailPayload
      const result = await sendEmail(p)
      if (!result.success) throw new Error(result.error ?? 'Email send failed')
      break
    }

    case 'generate_pdf':
      // TODO: implement PDF generation
      logger.warn('generate_pdf job type not yet implemented', { type })
      break

    default:
      throw new Error(`Unknown job type: ${type}`)
  }
}

/** Clean up old DONE/FAILED jobs older than N days */
export async function pruneJobs(olderThanDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
  const { count } = await prisma.jobQueue.deleteMany({
    where: {
      status: { in: ['DONE', 'FAILED'] },
      createdAt: { lt: cutoff },
    },
  })
  logger.info('Job queue pruned', { deleted: count })
  return count
}
