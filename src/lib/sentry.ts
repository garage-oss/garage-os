/**
 * Sentry error-tracking wrapper (stub — ready to activate).
 *
 * To activate full Sentry:
 *   1. npm install @sentry/nextjs
 *   2. Add SENTRY_DSN to environment variables
 *   3. Create sentry.client.config.ts:
 *        import * as Sentry from '@sentry/nextjs'
 *        Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.2 })
 *   4. Create sentry.server.config.ts (same content)
 *   5. Create instrumentation.ts:
 *        export async function register() {
 *          if (process.env.NEXT_RUNTIME === 'nodejs') {
 *            await import('./sentry.server.config')
 *          }
 *        }
 *   6. Wrap next.config.js:
 *        const { withSentryConfig } = require('@sentry/nextjs')
 *        module.exports = withSentryConfig(nextConfig, { silent: true })
 *
 * Until then, errors are console-logged in development and silently
 * dropped in production (the `logger.ts` handles console output).
 */

// ─── Public API (matches Sentry's surface) ────────────────────────────────────

export function captureException(
  err:      unknown,
  context?: Record<string, unknown>,
): void {
  if (process.env.SENTRY_DSN) {
    // TODO: import('@sentry/nextjs').then((S) => S.captureException(err, { extra: context }))
  }
  if (process.env.NODE_ENV === 'development') {
    console.error('[sentry-stub] captureException:', err, context ?? '')
  }
}

export function captureMessage(
  message:  string,
  level:    'info' | 'warning' | 'error' = 'info',
  context?: Record<string, unknown>,
): void {
  if (process.env.SENTRY_DSN) {
    // TODO: import('@sentry/nextjs').then((S) => S.captureMessage(message, { level, extra: context }))
  }
}

export function setUser(id: string, email?: string, name?: string): void {
  if (process.env.SENTRY_DSN) {
    // TODO: import('@sentry/nextjs').then((S) => S.setUser({ id, email, username: name }))
  }
}

export function clearUser(): void {
  if (process.env.SENTRY_DSN) {
    // TODO: import('@sentry/nextjs').then((S) => S.setUser(null))
  }
}

/**
 * Wraps an async function and reports any thrown error to Sentry.
 * Re-throws the error after reporting.
 */
export async function withSentry<T>(
  fn:       () => Promise<T>,
  context?: Record<string, unknown>,
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    captureException(err, context)
    throw err
  }
}
