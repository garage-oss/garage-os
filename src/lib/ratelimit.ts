/**
 * Rate limiting abstraction.
 *
 * Development / single-instance: in-memory sliding-window counter.
 * Production / multi-instance:   swap `backend` for Upstash Redis by
 *   installing @upstash/ratelimit and @upstash/redis and uncommenting
 *   the UpstashBackend block below.
 *
 * Usage:
 *   const result = await rateLimit(`login:${ip}`, { limit: 5, windowMs: 60_000 })
 *   if (!result.success) return new Response('Too Many Requests', { status: 429 })
 */

export interface RateLimitResult {
  success:   boolean
  limit:     number
  remaining: number
  resetAt:   number  // Unix ms
}

export interface RateLimitOptions {
  limit:    number  // max requests per window
  windowMs: number  // window duration in milliseconds
}

// ─── In-memory backend (single-process) ──────────────────────────────────────

interface MemoryEntry {
  count:   number
  resetAt: number
}

const store = new Map<string, MemoryEntry>()

// Prune stale entries every 5 minutes to avoid memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    Array.from(store.entries()).forEach(([key, value]) => {
      if (value.resetAt < now) store.delete(key)
    })
  }, 5 * 60_000).unref?.()
}

function memoryRateLimit(id: string, opts: RateLimitOptions): RateLimitResult {
  const now   = Date.now()
  const entry = store.get(id)

  if (!entry || entry.resetAt < now) {
    const resetAt = now + opts.windowMs
    store.set(id, { count: 1, resetAt })
    return { success: true, limit: opts.limit, remaining: opts.limit - 1, resetAt }
  }

  if (entry.count >= opts.limit) {
    return { success: false, limit: opts.limit, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return {
    success:   true,
    limit:     opts.limit,
    remaining: opts.limit - entry.count,
    resetAt:   entry.resetAt,
  }
}

// ─── Upstash backend (multi-instance production) ──────────────────────────────
//
// To enable:
//   npm install @upstash/ratelimit @upstash/redis
//   Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
//
// import { Ratelimit } from '@upstash/ratelimit'
// import { Redis }     from '@upstash/redis'
//
// const redis    = new Redis({ url: env.UPSTASH_REDIS_REST_URL!, token: env.UPSTASH_REDIS_REST_TOKEN! })
// const limiter  = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '10 s') })
//
// async function upstashRateLimit(id, opts): Promise<RateLimitResult> {
//   const { success, limit, remaining, reset } = await limiter.limit(id)
//   return { success, limit, remaining, resetAt: reset }
// }

// ─── Public API ───────────────────────────────────────────────────────────────

export async function rateLimit(
  identifier: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  // TODO: swap to upstashRateLimit() when UPSTASH_REDIS_REST_URL is set
  return memoryRateLimit(identifier, opts)
}

/** Pre-configured limiters for common endpoints */
export const LIMITS = {
  /** Login attempts — 10 per minute per IP */
  auth: (ip: string) => rateLimit(`auth:${ip}`, { limit: 10, windowMs: 60_000 }),

  /** API calls — 60 per minute per user */
  api: (userId: string) => rateLimit(`api:${userId}`, { limit: 60, windowMs: 60_000 }),

  /** File uploads — 20 per hour per user */
  upload: (userId: string) => rateLimit(`upload:${userId}`, { limit: 20, windowMs: 60 * 60_000 }),

  /** Invitations — 10 per hour per org */
  invite: (orgId: string) => rateLimit(`invite:${orgId}`, { limit: 10, windowMs: 60 * 60_000 }),

  /** Payment link generation — 20 per hour per org (prevent abuse) */
  payment: (orgId: string) => rateLimit(`payment:${orgId}`, { limit: 20, windowMs: 60 * 60_000 }),

  /** WhatsApp sends — 100 per hour per org (Twilio cost protection) */
  whatsapp: (orgId: string) => rateLimit(`wa:${orgId}`, { limit: 100, windowMs: 60 * 60_000 }),

  /** Webhook endpoints — 500 per minute per IP (high traffic allowed) */
  webhook: (ip: string) => rateLimit(`webhook:${ip}`, { limit: 500, windowMs: 60_000 }),

  /** Export endpoints — 5 per minute per user (prevent abuse) */
  export: (userId: string) => rateLimit(`export:${userId}`, { limit: 5, windowMs: 60_000 }),
} as const

/** Add rate-limit headers to a response */
export function applyRateLimitHeaders(
  headers: Headers,
  result:  RateLimitResult,
): void {
  headers.set('X-RateLimit-Limit',     String(result.limit))
  headers.set('X-RateLimit-Remaining', String(result.remaining))
  headers.set('X-RateLimit-Reset',     String(Math.ceil(result.resetAt / 1000)))
  if (!result.success) {
    headers.set('Retry-After', String(Math.ceil((result.resetAt - Date.now()) / 1000)))
  }
}
