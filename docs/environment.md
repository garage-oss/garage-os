# Environment Variables

All variables are validated by `src/lib/env.ts` using Zod at server startup.
Copy `.env.example` to `.env` and fill in your values.

---

## Required

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_SECRET` | JWT / cookie signing key (≥ 32 chars) | `openssl rand -base64 32` |

---

## Runtime

| Variable | Default | Description |
|---|---|---|
| `NEXTAUTH_URL` | `http://localhost:3000` | Public app URL (no trailing slash) |
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |
| `PORT` | `3000` | HTTP port |

---

## Storage

Controls where uploaded files (avatar photos, etc.) are persisted.

| Variable | Default | Description |
|---|---|---|
| `STORAGE_PROVIDER` | `local` | `local` \| `s3` \| `supabase` |

> ⚠️ **`local` is not suitable for Vercel or any ephemeral-filesystem host.**
> Files written to `public/uploads/` are lost on redeploy. Use `s3` or `supabase` in production.

### S3 / Cloudflare R2 / MinIO (`STORAGE_PROVIDER=s3`)

| Variable | Required | Description |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | ✅ | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | ✅ | IAM secret key |
| `AWS_S3_BUCKET` | ✅ | Bucket name |
| `AWS_REGION` | — (default `us-east-1`) | AWS region |
| `AWS_S3_PUBLIC_URL` | — | CDN URL in front of bucket (e.g. `https://cdn.example.com`) |

For **Cloudflare R2**, use the R2 endpoint as `AWS_S3_PUBLIC_URL` and
set `AWS_REGION=auto`.

### Supabase Storage (`STORAGE_PROVIDER=supabase`)

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Project URL (`https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | ✅ | Service role key (not the anon key) |
| `SUPABASE_STORAGE_BUCKET` | — (default `avatars`) | Bucket name |

---

## AI

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Enables the AI Diagnostics feature. Get from [console.anthropic.com](https://console.anthropic.com) |

---

## Monitoring

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `SENTRY_DSN` | — | Sentry project DSN for error tracking |

Logs are written as structured JSON in production, pretty-printed in development.

---

## Rate Limiting

| Variable | Required | Description |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | — | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | — | Upstash Redis REST token |

Without these, an **in-memory rate limiter** is used — it works correctly on a
single server instance but does not share state across multiple instances (e.g.
Vercel Edge replicas). For production at scale, set the Upstash vars and enable
the Upstash backend in `src/lib/ratelimit.ts`.

---

## Feature Flags

Toggle features without redeploying. Values: `true` / `false`.

| Variable | Default | Description |
|---|---|---|
| `FLAG_AI_DIAGNOSTICS` | `true` | AI-powered vehicle diagnostics |
| `FLAG_AUDIT_LOG` | `true` | Full audit log page |
| `FLAG_AVATAR_UPLOAD` | `true` | Profile photo uploads |
| `FLAG_ADVANCED_REPORTS` | `false` | Advanced analytics (placeholder) |
| `FLAG_BILLING_PORTAL` | `false` | Self-serve billing portal (placeholder) |

---

## Build / CI

| Variable | Default | Description |
|---|---|---|
| `SKIP_ENV_VALIDATION` | `false` | Skip Zod validation — **only for CI build steps** |

---

## Generating secrets

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# Or with Node
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
