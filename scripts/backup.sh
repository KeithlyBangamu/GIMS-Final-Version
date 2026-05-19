#!/usr/bin/env bash
# GIMS daily backup script.
# Dumps MongoDB Atlas → uploads to Google Drive via rclone → prunes >30 day old backups.
# Expected to run inside a Render Cron Job (see scripts/backup.Dockerfile and render.yaml).

set -euo pipefail

# ---- Required environment variables ----
: "${MONGO_URI:?MONGO_URI is required (Atlas connection string)}"
: "${RCLONE_CONFIG_GDRIVE_TYPE:?RCLONE_CONFIG_GDRIVE_TYPE is required (should be \"drive\")}"
: "${RCLONE_CONFIG_GDRIVE_SCOPE:?RCLONE_CONFIG_GDRIVE_SCOPE is required (should be \"drive\")}"
: "${RCLONE_CONFIG_GDRIVE_TOKEN:?RCLONE_CONFIG_GDRIVE_TOKEN is required (rclone Drive token JSON)}"

# ---- Optional environment variables ----
DRIVE_FOLDER="${DRIVE_FOLDER:-GIMS-Backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/gims-backup}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
ARCHIVE="$BACKUP_DIR/gims-${STAMP}.archive.gz"

echo "[backup] $(date -u +%FT%TZ) starting"
echo "[backup] writing dump to $ARCHIVE"

mongodump --uri="$MONGO_URI" --gzip --archive="$ARCHIVE" --quiet

DUMP_SIZE_BYTES=$(stat -c%s "$ARCHIVE" 2>/dev/null || stat -f%z "$ARCHIVE")
echo "[backup] dump complete (${DUMP_SIZE_BYTES} bytes)"

echo "[backup] uploading to gdrive:${DRIVE_FOLDER}/"
rclone copy "$ARCHIVE" "gdrive:${DRIVE_FOLDER}/" --stats=0 --quiet
echo "[backup] upload complete"

echo "[backup] pruning files older than ${RETENTION_DAYS} days in gdrive:${DRIVE_FOLDER}/"
rclone delete --min-age "${RETENTION_DAYS}d" "gdrive:${DRIVE_FOLDER}/" --quiet || true
echo "[backup] prune complete"

rm -f "$ARCHIVE"
echo "[backup] done"
