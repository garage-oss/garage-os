#!/usr/bin/env sh
# ──────────────────────────────────────────────────────────────────────────────
# PostgreSQL daily backup script for GarageOS
#
# Outputs a gzipped dump to $BACKUP_DIR (default: /backups)
# Keeps the last $KEEP_DAYS days of backups (default: 30)
#
# Environment variables (all optional — defaults work for docker-compose):
#   PGHOST        PostgreSQL host     (default: postgres)
#   PGPORT        PostgreSQL port     (default: 5432)
#   PGUSER        PostgreSQL user     (default: garageos)
#   PGPASSWORD    PostgreSQL password (required — set in environment)
#   PGDATABASE    Database name       (default: garagedb)
#   BACKUP_DIR    Output directory    (default: /backups)
#   KEEP_DAYS     Retention days      (default: 30)
#   S3_BUCKET     If set, upload to S3 with aws-cli after dumping
#
# Usage (manual):
#   PGPASSWORD=secret ./scripts/backup.sh
#
# Usage (cron — add to crontab):
#   0 2 * * * /app/scripts/backup.sh >> /var/log/backup.log 2>&1
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-garageos}"
PGDATABASE="${PGDATABASE:-garagedb}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
FILENAME="${BACKUP_DIR}/garageos_${TIMESTAMP}.sql.gz"

echo "[backup] Starting PostgreSQL backup — $(date)"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Dump and compress
pg_dump \
  --host="$PGHOST" \
  --port="$PGPORT" \
  --username="$PGUSER" \
  --dbname="$PGDATABASE" \
  --no-owner \
  --no-acl \
  --format=plain \
  | gzip -9 > "$FILENAME"

SIZE=$(du -sh "$FILENAME" | cut -f1)
echo "[backup] Dump complete: $FILENAME ($SIZE)"

# Upload to S3 if configured
if [ -n "${S3_BUCKET:-}" ]; then
  S3_KEY="garageos-backups/$(basename "$FILENAME")"
  echo "[backup] Uploading to s3://$S3_BUCKET/$S3_KEY"
  aws s3 cp "$FILENAME" "s3://$S3_BUCKET/$S3_KEY" --storage-class STANDARD_IA
  echo "[backup] S3 upload complete"
fi

# Prune old backups
echo "[backup] Pruning backups older than $KEEP_DAYS days"
find "$BACKUP_DIR" -name "garageos_*.sql.gz" -mtime "+$KEEP_DAYS" -delete
REMAINING=$(find "$BACKUP_DIR" -name "garageos_*.sql.gz" | wc -l)
echo "[backup] Done — $REMAINING backups retained"
