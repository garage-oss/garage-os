# Database Backup & Restore

GarageOS stores all data in PostgreSQL. This document covers backup strategies,
restore procedures, and verification steps.

---

## Backup strategy overview

| Tier | Frequency | Retention | Method |
|---|---|---|---|
| Automated | Daily | 7 days | Provider built-in (Neon / Supabase) |
| Weekly snapshot | Weekly | 30 days | `pg_dump` via cron or CI |
| Pre-migration | Before every schema change | Keep until next stable release | Manual `pg_dump` |
| Before major updates | Before Vercel deploys to main | 7 days | CI job |

---

## Provider built-in backups

### Neon
- Daily automated backups retained for 7 days (free tier)
- Pro tier: point-in-time restore up to 30 days
- Restore from: Dashboard → Branch → Restore
- Docs: https://neon.tech/docs/manage/backups

### Supabase
- Automated daily backups on Pro plan
- Point-in-time recovery available
- Restore from: Dashboard → Database → Backups
- Docs: https://supabase.com/docs/guides/platform/backups

### Railway
- Automated daily snapshots on Pro plan
- Restore from: Service → Deployments → Database → Backups

> ⚠️ **Free tiers often have no automated backups.** Always perform manual
> backups before schema changes or major updates.

---

## Manual backup with pg_dump

### Prerequisites
```bash
# Install PostgreSQL client tools (if not already installed)
# macOS: brew install postgresql
# Ubuntu: apt install postgresql-client
# Windows: download from postgresql.org/download/windows

pg_dump --version  # should show 14+
```

### Full database backup
```bash
# Set your production connection string
export DATABASE_URL="postgresql://user:pass@host:5432/dbname?sslmode=require"

# Create a timestamped dump
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump "$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --file="backup_${TIMESTAMP}.dump"

echo "Backup created: backup_${TIMESTAMP}.dump"
ls -lh "backup_${TIMESTAMP}.dump"
```

### Schema-only backup (for migration history)
```bash
pg_dump "$DATABASE_URL" \
  --schema-only \
  --no-owner \
  --file="schema_${TIMESTAMP}.sql"
```

### Data-only backup (for bulk exports)
```bash
pg_dump "$DATABASE_URL" \
  --data-only \
  --no-owner \
  --file="data_${TIMESTAMP}.sql"
```

---

## Automated weekly backup script

Create this as a cron job or a Vercel cron function:

```bash
#!/bin/bash
# scripts/backup.sh
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${BACKUP_DIR}/garageos_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting backup at $(date)"
pg_dump "$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --file="$FILENAME"

SIZE=$(du -sh "$FILENAME" | cut -f1)
echo "[backup] Created ${FILENAME} (${SIZE})"

# Remove backups older than retention period
find "$BACKUP_DIR" -name "*.dump" -mtime +${RETENTION_DAYS} -delete
echo "[backup] Pruned backups older than ${RETENTION_DAYS} days"

# Optional: upload to S3/R2
# aws s3 cp "$FILENAME" "s3://your-bucket/backups/$(basename $FILENAME)"
```

```bash
chmod +x scripts/backup.sh
# Run weekly via cron (every Sunday at 02:00):
# 0 2 * * 0 /path/to/scripts/backup.sh >> /var/log/garageos-backup.log 2>&1
```

---

## Restore procedure

### From a pg_dump file (`.dump`)
```bash
# ⚠️ This REPLACES all data in the target database.
# Always test on a staging database first.

export TARGET_URL="postgresql://user:pass@host:5432/dbname_restore"

# Create a fresh database (if needed)
createdb --host=host --username=user dbname_restore

# Restore
pg_restore \
  --dbname="$TARGET_URL" \
  --no-owner \
  --no-acl \
  --verbose \
  backup_20260101_020000.dump

echo "Restore complete."
```

### From a SQL file (`.sql`)
```bash
psql "$TARGET_URL" < backup_20260101_020000.sql
```

### Restore to production (emergency)
```bash
# 1. Put app in maintenance mode (set a MAINTENANCE=true env var in Vercel)
# 2. Take a backup of current state (even broken state can be useful)
pg_dump "$DATABASE_URL" --format=custom --file="pre_restore_$(date +%s).dump"

# 3. Drop all tables (or use --clean flag)
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  backup_KNOWN_GOOD.dump

# 4. Regenerate Prisma client + verify
npx prisma db push --force-reset  # only if schema needs sync
npx tsx prisma/seed.ts             # only if you need fresh demo data

# 5. Verify data integrity
psql "$DATABASE_URL" -c "SELECT count(*) FROM \"WorkOrder\";"
psql "$DATABASE_URL" -c "SELECT count(*) FROM \"Customer\";"

# 6. Remove maintenance mode
```

---

## Backup verification

Run this after every backup to confirm the file is not corrupt:

```bash
# Verify a .dump file is readable
pg_restore --list backup_20260101_020000.dump | head -20

# Quick row count check
pg_restore --dbname="$TEMP_DB_URL" backup_20260101_020000.dump
psql "$TEMP_DB_URL" -c "
  SELECT
    (SELECT count(*) FROM \"Customer\")    AS customers,
    (SELECT count(*) FROM \"WorkOrder\")   AS work_orders,
    (SELECT count(*) FROM \"Part\")        AS parts,
    (SELECT count(*) FROM \"User\")        AS users;
"
```

---

## Disaster recovery targets

| Metric | Target |
|---|---|
| Recovery Point Objective (RPO) | ≤ 24 hours (daily backups) |
| Recovery Time Objective (RTO) | ≤ 2 hours |
| Backup test frequency | Monthly |

---

## Pre-deployment backup checklist

Before every production schema change or major code deployment:

```bash
# 1. Backup
pg_dump "$DATABASE_URL" --format=custom --file="pre_deploy_$(date +%s).dump"

# 2. Deploy
git push origin main  # Vercel auto-deploys

# 3. Verify health
curl -f https://your-domain.com/api/health

# 4. If something goes wrong:
vercel rollback  # reverts code
# + pg_restore from pre-deploy backup if needed
```

---

## Storage backups (uploaded files)

Avatar photos and uploaded files are stored in S3/Supabase Storage.

### Supabase Storage
- Storage objects are included in Supabase project backups (Pro plan)
- Manual backup: `supabase storage ls --project-ref <ref>` then download

### S3 / Cloudflare R2
```bash
# Sync bucket to local directory
aws s3 sync s3://garageos-uploads ./uploads-backup/

# Or use rclone for R2:
rclone copy r2:garageos-uploads ./uploads-backup/
```
