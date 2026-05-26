# Deployment Guide

GarageOS is a Next.js 14 application designed to deploy on **Vercel** with
**PostgreSQL** (Neon, Supabase, or Railway). Other platforms (Railway, Render,
Fly.io) work with minor adjustments.

---

## Prerequisites

- Node.js ≥ 20
- PostgreSQL 14+ (cloud or self-hosted)
- A Vercel account (free tier works for staging)
- Git repository connected to Vercel

---

## 1 — Database

### Option A: Neon (recommended — generous free tier, auto-suspend)

1. Go to [neon.tech](https://neon.tech) → create a project
2. Copy the **connection string** (choose `pooled` for Vercel serverless)
3. Your connection string looks like:
   ```
   postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/garagedb?sslmode=require
   ```

### Option B: Supabase

1. Go to [supabase.com](https://supabase.com) → New project
2. Settings → Database → Connection string (use **Session mode** for Prisma)
3. Connection string:
   ```
   postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
   ```

### Option C: Railway

1. Go to [railway.app](https://railway.app) → New project → Add PostgreSQL
2. Click on the Postgres service → Variables → Copy `DATABASE_URL`

---

## 2 — Vercel

### Connect repository

```bash
npm i -g vercel
vercel link          # follow prompts to link your repo
```

Or connect via the Vercel dashboard: Import Project → select your GitHub repo.

### Set environment variables

In the Vercel dashboard → Project → Settings → Environment Variables, add:

| Variable | Value | Environment |
|---|---|---|
| `DATABASE_URL` | your PostgreSQL URL | Production, Preview, Development |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | All |
| `NEXTAUTH_URL` | `https://your-domain.vercel.app` | Production |
| `NEXTAUTH_URL` | `https://your-branch-xxx.vercel.app` | Preview |
| `STORAGE_PROVIDER` | `s3` or `supabase` | Production |
| `ANTHROPIC_API_KEY` | your key | Production |
| `LOG_LEVEL` | `info` | Production |

See `docs/environment.md` for the full variable reference.

### Deploy

```bash
vercel --prod        # manual deploy
```

Or push to `main` — Vercel auto-deploys on every push.

### Post-deploy: run migrations

After first deploy (and after schema changes), sync the database schema:

```bash
# From your local machine with DATABASE_URL pointed at production:
DATABASE_URL="your-prod-url" npx prisma db push

# Or use the Vercel CLI to run in production context:
vercel env pull .env.production.local
npx prisma db push
```

---

## 3 — Storage

See `docs/environment.md → Storage` for provider setup.

### Quick: Supabase Storage

1. Supabase dashboard → Storage → New bucket → name it `avatars` → Public
2. Set `STORAGE_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
3. Uncomment `SupabaseProvider` in `src/lib/storage.ts`

### Quick: Cloudflare R2

1. Cloudflare dashboard → R2 → Create bucket → name it `garageos-uploads`
2. Create API token (R2 read+write)
3. Set `STORAGE_PROVIDER=s3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
   `AWS_S3_BUCKET`, `AWS_REGION=auto`,
   `AWS_S3_PUBLIC_URL=https://pub-xxx.r2.dev`
4. Uncomment `S3Provider` in `src/lib/storage.ts`

---

## 4 — Custom domain

Vercel dashboard → Project → Settings → Domains → Add domain.

Update `NEXTAUTH_URL` to match your custom domain.

---

## 5 — Non-Vercel platforms

### Railway / Render / Fly.io

These platforms run a persistent Node.js server so `STORAGE_PROVIDER=local`
**will** persist files between requests (but not between deploys). Use `s3` or
`supabase` for durable storage.

Build command:
```
npx prisma generate && npm run build
```

Start command:
```
npm start
```

Set all required environment variables in the platform dashboard.

---

## Post-deployment checklist

- [ ] `DATABASE_URL` points to production database
- [ ] `NEXTAUTH_SECRET` is a unique random string (≥ 32 chars)
- [ ] `NEXTAUTH_URL` matches the public URL exactly (no trailing slash)
- [ ] `STORAGE_PROVIDER` is `s3` or `supabase` (not `local`)
- [ ] `ANTHROPIC_API_KEY` is set if AI Diagnostics is enabled
- [ ] Health check returns 200: `curl https://your-domain.com/api/health`
- [ ] Login works: `https://your-domain.com/login`
- [ ] Database seeded (or fresh data added via onboarding)

---

## Seeding production (initial data)

```bash
# Run from local machine with prod DATABASE_URL
DATABASE_URL="your-prod-url" npx tsx prisma/seed.ts
```

> ⚠️ The seed script uses `upsert` so it is safe to run multiple times,
> but it will reset demo data. Only run it on a fresh production database.

---

## Monitoring

- **Health check**: `GET /api/health` — returns database status and uptime
- **Vercel Analytics**: enable in Project → Analytics
- **Error tracking**: add `SENTRY_DSN` and uncomment Sentry calls in `src/lib/logger.ts`

---

## Rolling back

```bash
vercel rollback      # revert to previous production deployment
```

Database schema rollbacks require manual intervention — always backup
before running `prisma db push` on production.
