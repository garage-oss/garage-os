/**
 * Environment variable validation — runs once at server startup.
 * Import this instead of process.env in server code.
 *
 * Client-side: use only NEXT_PUBLIC_* vars directly from process.env.
 * Build-time:  set SKIP_ENV_VALIDATION=true in CI to bypass validation.
 */
import { z } from 'zod'

// ─── Schema ───────────────────────────────────────────────────────────────────

const envSchema = z.object({
  // ── Required ──────────────────────────────────────────────────────────────
  DATABASE_URL:    z.string().min(1, 'DATABASE_URL is required'),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be ≥ 32 characters'),

  // ── Runtime ───────────────────────────────────────────────────────────────
  NODE_ENV:     z.enum(['development', 'production', 'test']).default('development'),
  NEXTAUTH_URL: z.string().url().default('http://localhost:3000'),
  PORT:         z.coerce.number().default(3000),

  // ── Storage ───────────────────────────────────────────────────────────────
  STORAGE_PROVIDER:        z.enum(['local', 's3', 'supabase']).default('local'),
  // S3 — required when STORAGE_PROVIDER=s3
  AWS_ACCESS_KEY_ID:       z.string().optional(),
  AWS_SECRET_ACCESS_KEY:   z.string().optional(),
  AWS_S3_BUCKET:           z.string().optional(),
  AWS_REGION:              z.string().default('us-east-1'),
  AWS_S3_PUBLIC_URL:       z.string().url().optional(),   // CDN in front of bucket
  // Supabase — required when STORAGE_PROVIDER=supabase
  SUPABASE_URL:            z.string().url().optional(),
  SUPABASE_SERVICE_KEY:    z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('avatars'),

  // ── AI ────────────────────────────────────────────────────────────────────
  ANTHROPIC_API_KEY: z.string().optional(),

  // ── Monitoring ────────────────────────────────────────────────────────────
  LOG_LEVEL:  z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SENTRY_DSN: z.string().url().optional(),

  // ── Rate limiting (Upstash Redis — optional, falls back to in-memory) ─────
  UPSTASH_REDIS_REST_URL:   z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // ── Twilio (WhatsApp / SMS) ────────────────────────────────────────────────
  TWILIO_ACCOUNT_SID:     z.string().optional(),
  TWILIO_AUTH_TOKEN:      z.string().optional(),
  TWILIO_WHATSAPP_FROM:   z.string().optional(),  // e.g. "whatsapp:+14155238886"

  // ── Stripe (Payments) ────────────────────────────────────────────────────
  STRIPE_SECRET_KEY:      z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET:  z.string().optional(),

  // ── SMTP (Email) ─────────────────────────────────────────────────────────
  SMTP_HOST:              z.string().optional(),
  SMTP_PORT:              z.coerce.number().default(587),
  SMTP_USER:              z.string().optional(),
  SMTP_PASS:              z.string().optional(),
  SMTP_FROM:              z.string().email().optional(),
  SMTP_SECURE:            z.string().default('false'),  // 'true' for port 465

  // ── Security ─────────────────────────────────────────────────────────────
  // 32-byte hex string for AES-256-GCM field encryption
  ENCRYPTION_KEY:         z.string().optional(),
  SESSION_TIMEOUT_MINUTES: z.coerce.number().default(480), // 8 hours

  // ── Feature flags (default values are production-safe) ────────────────────
  FLAG_AI_DIAGNOSTICS:   z.string().default('true'),
  FLAG_AUDIT_LOG:        z.string().default('true'),
  FLAG_AVATAR_UPLOAD:    z.string().default('true'),
  FLAG_ADVANCED_REPORTS: z.string().default('false'),
  FLAG_BILLING_PORTAL:   z.string().default('false'),
  FLAG_TWILIO_WHATSAPP:  z.string().default('false'), // use real Twilio vs wa.me links
  FLAG_STRIPE_PAYMENTS:  z.string().default('false'), // use Stripe vs manual pay
})

export type Env = z.infer<typeof envSchema>

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(): Env {
  // Allow CI/build pipelines to skip validation
  if (process.env.SKIP_ENV_VALIDATION === 'true') {
    return process.env as unknown as Env
  }

  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(
      `❌  Invalid environment variables:\n${issues}\n\n` +
      `  See .env.example for the full reference.\n`
    )
  }

  // Cross-field validation
  const d = result.data
  if (d.STORAGE_PROVIDER === 's3') {
    if (!d.AWS_ACCESS_KEY_ID || !d.AWS_SECRET_ACCESS_KEY || !d.AWS_S3_BUCKET) {
      throw new Error(
        '❌  STORAGE_PROVIDER=s3 requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_S3_BUCKET'
      )
    }
  }
  if (d.STORAGE_PROVIDER === 'supabase') {
    if (!d.SUPABASE_URL || !d.SUPABASE_SERVICE_KEY) {
      throw new Error(
        '❌  STORAGE_PROVIDER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_KEY'
      )
    }
  }

  // Twilio cross-field validation
  if (d.FLAG_TWILIO_WHATSAPP === 'true') {
    if (!d.TWILIO_ACCOUNT_SID || !d.TWILIO_AUTH_TOKEN || !d.TWILIO_WHATSAPP_FROM) {
      throw new Error(
        '❌  FLAG_TWILIO_WHATSAPP=true requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM'
      )
    }
  }

  // Stripe cross-field validation
  if (d.FLAG_STRIPE_PAYMENTS === 'true') {
    if (!d.STRIPE_SECRET_KEY || !d.STRIPE_PUBLISHABLE_KEY) {
      throw new Error(
        '❌  FLAG_STRIPE_PAYMENTS=true requires STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY'
      )
    }
  }

  // Encryption key format check
  if (d.ENCRYPTION_KEY && !/^[0-9a-fA-F]{64}$/.test(d.ENCRYPTION_KEY)) {
    throw new Error(
      '❌  ENCRYPTION_KEY must be a 64-character hex string (32 bytes, e.g. openssl rand -hex 32)'
    )
  }

  return d
}

/** Validated, typed environment — import in server code instead of process.env */
export const env = validate()

/** Convenience helpers */
export const isProd = env.NODE_ENV === 'production'
export const isDev  = env.NODE_ENV === 'development'
