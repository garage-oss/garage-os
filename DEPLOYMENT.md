# GarageOS — Deployment Guide

Three supported deployment targets:

| Target | Best for | Output mode |
|--------|----------|-------------|
| **Vercel** | Fastest time-to-production, serverless | Default (no `output`) |
| **Railway** | Full-stack PaaS with Postgres add-on | Docker (`output: standalone`) |
| **Docker / self-hosted** | On-premise, VPS, full control | Docker (`output: standalone`) |

---

## Prerequisites

- **Node.js 20+** (only needed locally; cloud providers supply it)
- **PostgreSQL 15+** — managed cloud database recommended for production
- `.env.example` — copy to `.env.local` for local dev; configure secrets in your platform's dashboard for production

---

## 1 — Vercel (recommended for serverless)

### 1.1 Database

Use a Postgres provider with a **connection pooler**:

| Provider | Pooler URL param | Direct URL |
|----------|-----------------|------------|
| **Supabase** | `?pgbouncer=true` on port 6543 | port 5432 (no param) |
| **Neon** | `?pgbouncer=true` appended | same host, no param |
| **Railway** | use private network URL | same |

Set **both** in Vercel:
```
DATABASE_URL  = <pooler URL>   # for runtime queries
DIRECT_URL    = <direct URL>   # for prisma migrate deploy
```

### 1.2 Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Link project (first time)
vercel link

# Deploy to production
vercel --prod
```

Or push to `main` with the Vercel GitHub integration — it deploys automatically.

### 1.3 Environment variables

Add every variable from `.env.example` in **Vercel Dashboard → Settings → Environment Variables**.

Minimum required set:
```
DATABASE_URL          (pooler URL)
DIRECT_URL            (direct URL)
NEXTAUTH_SECRET       (openssl rand -base64 32)
NEXTAUTH_URL          (https://your-domain.vercel.app)
ENCRYPTION_KEY        (openssl rand -hex 32)
```

### 1.4 Run migrations

After the first deploy — run Prisma migrate from your local machine (or in a Vercel Build Command):

```bash
# One-off migration against production DB
DATABASE_URL="<direct URL>" npx prisma migrate deploy
```

Or add to **Vercel Build Command** (Settings → General):
```
prisma migrate deploy && next build
```

### 1.5 Stripe webhook

1. Install Stripe CLI: `stripe login`
2. Add the Vercel URL as a webhook endpoint in the Stripe Dashboard:
   `https://your-domain.vercel.app/api/webhooks/stripe`
3. Events to subscribe: `checkout.session.completed`, `checkout.session.expired`
4. Copy the **Signing secret** → set `STRIPE_WEBHOOK_SECRET` in Vercel.

---

## 2 — Railway (Docker + managed Postgres)

Railway uses the `Dockerfile` at the repo root and the `railway.json` config.

### 2.1 Create services

1. **New Project → Deploy from GitHub repo**
2. Add a **PostgreSQL** plugin from the Railway dashboard
3. Railway automatically injects `DATABASE_URL` from the plugin

### 2.2 Additional env vars

Set in Railway Dashboard → your service → Variables:
```
DIRECT_URL      = ${{Postgres.DATABASE_URL}}   # same as DATABASE_URL — no pooler
NEXTAUTH_SECRET = (openssl rand -base64 32)
NEXTAUTH_URL    = https://<your-railway-domain>
ENCRYPTION_KEY  = (openssl rand -hex 32)
```

### 2.3 Start command

`railway.json` already configures:
```json
"startCommand": "npx prisma migrate deploy && node server.js"
```

No further action needed — Railway will build the Docker image and run this on every deploy.

---

## 3 — Docker / self-hosted

### 3.1 Build image

```bash
docker build -t garageos .
```

### 3.2 Run with Docker Compose

```bash
# Copy and fill in the secrets
cp .env.example .env

# Start Postgres + app
docker compose up -d
```

`docker-compose.yml` is pre-configured. Edit the `environment:` section or use an `.env` file.

### 3.3 First-run migrations

```bash
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed   # optional demo data
```

---

## Environment Variable Reference

All variables with descriptions are documented in **`.env.example`**.

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | Pooler URL in serverless environments |
| `DIRECT_URL` | ✅ | Non-pooler URL for migrations |
| `NEXTAUTH_SECRET` | ✅ | Min 32 chars — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | Full public URL (auto-set on Vercel) |
| `ENCRYPTION_KEY` | ✅* | 64-char hex — `openssl rand -hex 32` (*required for SQL Server integration) |
| `ANTHROPIC_API_KEY` | Optional | AI quote analysis |
| `STRIPE_*` | Optional | Payments (enable with `FLAG_STRIPE_PAYMENTS=true`) |
| `TWILIO_*` | Optional | WhatsApp (enable with `FLAG_TWILIO_WHATSAPP=true`) |
| `SMTP_*` | Optional | Transactional email |
| `UPSTASH_REDIS_*` | Optional | Distributed rate limiting |
| `SENTRY_DSN` | Optional | Error monitoring |
| `STORAGE_PROVIDER` | Optional | `local` (default) \| `s3` \| `supabase` |

---

## Post-Deploy Checklist

- [ ] `DATABASE_URL` and `DIRECT_URL` are set correctly
- [ ] `NEXTAUTH_SECRET` is at least 32 characters
- [ ] `NEXTAUTH_URL` matches the public domain
- [ ] Prisma migrations have been run (`prisma migrate deploy`)
- [ ] Health check passes: `GET /api/health` → `{ ok: true }`
- [ ] First org created at `/auth/register`
- [ ] Stripe webhook endpoint registered and `STRIPE_WEBHOOK_SECRET` set (if using payments)
- [ ] `FLAG_STRIPE_PAYMENTS=true` / `FLAG_TWILIO_WHATSAPP=true` only after their vars are set

---

## Generating Secrets

```bash
# NEXTAUTH_SECRET (32+ chars)
openssl rand -base64 32

# ENCRYPTION_KEY (64-char hex / 32 bytes)
openssl rand -hex 32
```

On Windows (PowerShell):
```powershell
# NEXTAUTH_SECRET
[Convert]::ToBase64String((1..32 | ForEach-Object { [byte](Get-Random -Max 256) }))

# ENCRYPTION_KEY
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
```
