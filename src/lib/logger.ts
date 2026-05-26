/**
 * Structured logger — JSON in production, pretty-printed in development.
 *
 * Swap the transport in the `send()` function to ship logs to
 * Axiom, Datadog, Logtail, or any OTLP-compatible collector without
 * changing call-sites.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 0,
  info:  1,
  warn:  2,
  error: 3,
}

const MIN_LEVEL = (process.env.LOG_LEVEL ?? 'info') as LogLevel
const IS_PROD   = process.env.NODE_ENV === 'production'

// ─── Transport ────────────────────────────────────────────────────────────────

interface LogEntry {
  level:     LogLevel
  message:   string
  timestamp: string
  context?:  Record<string, unknown>
  error?:    { message: string; stack?: string } | unknown
}

function send(entry: LogEntry): void {
  if (IS_PROD) {
    // Structured JSON — machine-readable, works with log aggregators
    const output = JSON.stringify(entry)
    if (entry.level === 'error') console.error(output)
    else if (entry.level === 'warn') console.warn(output)
    else console.log(output)

    // TODO: ship to external collector, e.g.:
    // await axiom.ingest('garage-os', [entry])
    // Sentry.captureException(entry.error, { extra: entry.context })
  } else {
    // Pretty-print for developer ergonomics
    const ts    = new Date(entry.timestamp).toLocaleTimeString()
    const badge = { debug: '🔍', info: '💬', warn: '⚠️', error: '🔴' }[entry.level]
    const line  = `${badge} [${ts}] ${entry.message}`

    if (entry.level === 'error') {
      console.error(line, entry.context ?? '', entry.error ?? '')
    } else if (entry.level === 'warn') {
      console.warn(line, entry.context ?? '')
    } else {
      console.log(line, entry.context ?? '')
    }
  }
}

// ─── Core ─────────────────────────────────────────────────────────────────────

function log(
  level:    LogLevel,
  message:  string,
  context?: Record<string, unknown>,
  err?:     unknown,
): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[MIN_LEVEL]) return

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context } : {}),
    ...(err !== undefined
      ? {
          error:
            err instanceof Error
              ? { message: err.message, stack: err.stack }
              : err,
        }
      : {}),
  }

  send(entry)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    log('debug', message, context),

  info: (message: string, context?: Record<string, unknown>) =>
    log('info', message, context),

  warn: (message: string, context?: Record<string, unknown>) =>
    log('warn', message, context),

  error: (message: string, err?: unknown, context?: Record<string, unknown>) =>
    log('error', message, context, err),
}

// ─── Request logger middleware helper ─────────────────────────────────────────

export function logRequest(
  method: string,
  path:   string,
  status: number,
  ms:     number,
) {
  const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
  log(level, `${method} ${path} ${status}`, { ms })
}
