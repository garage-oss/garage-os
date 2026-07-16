/**
 * In-memory sliding-window rate limiter.
 *
 * For single-process deployments (local / VPS) this is sufficient.
 * For multi-instance / serverless (Vercel), wire in Upstash Redis:
 *   replace checkRateLimit with an @upstash/ratelimit Ratelimit instance.
 *
 * Keys are arbitrary strings; typical patterns:
 *   sms:phone:<normalized_phone>    — 3 sends per 15 min
 *   otp:verify:<normalized_phone>   — 5 attempts per 15 min
 *   sms:ip:<ip>                     — 10 sends per 15 min (looser IP bound)
 */

interface Entry {
  count:   number
  resetAt: number
}

const _store = new Map<string, Entry>()

// Prune expired entries every 30 min so the Map does not grow unbounded.
// `.unref()` prevents this timer from keeping the Node.js process alive in tests.
const _timer = setInterval(() => {
  const now = Date.now()
  _store.forEach((v, k) => {
    if (now > v.resetAt) _store.delete(k)
  })
}, 30 * 60 * 1000)
if (typeof _timer.unref === 'function') _timer.unref()

export interface RateLimitResult {
  allowed:   boolean
  remaining: number
  resetAt:   Date
}

/**
 * Fixed-window counter. Returns `allowed: false` once `limit` is reached
 * for the current window (resets after `windowMs` milliseconds).
 */
export function checkRateLimit(
  key:      string,
  limit:    number,
  windowMs: number,
): RateLimitResult {
  const now   = Date.now()
  const entry = _store.get(key)

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs
    _store.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt: new Date(resetAt) }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: new Date(entry.resetAt) }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetAt: new Date(entry.resetAt) }
}
