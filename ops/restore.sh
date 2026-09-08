#!/usr/bin/env bash
# Restores a backup produced by ops/backup.sh. Usage: ops/restore.sh ./backups/<timestamp>
# WARNING: replaces every table and every avatar with the backup contents.
set -euo pipefail

source_dir="${1:?usage: ops/restore.sh <backup-dir>}"
COMPOSE_POSTGRES_SERVICE="${COMPOSE_POSTGRES_SERVICE:-postgres}"
APP_DATA_DIR="${APP_DATA_DIR:-./data}"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

echo "== Restoring database from ${source_dir}/db.sql.gz =="
gunzip -c "${source_dir}/db.sql.gz" | docker compose exec -T "$COMPOSE_POSTGRES_SERVICE" \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q -v ON_ERROR_STOP=1

if [ -f "${source_dir}/avatars.tar.gz" ]; then
  echo "== Restoring avatars =="
  mkdir -p "$APP_DATA_DIR"
  rm -rf "${APP_DATA_DIR}/avatars"
  tar -xzf "${source_dir}/avatars.tar.gz" -C "$APP_DATA_DIR"
fi

echo "Restore finished. Restart the app service so it reconnects: docker compose restart app"
