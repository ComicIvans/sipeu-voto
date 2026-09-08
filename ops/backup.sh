#!/usr/bin/env bash
# Dumps PostgreSQL and the avatars directory into ./backups/<timestamp>/.
# Run from the directory that holds docker-compose.yml and .env (dev or VPS).
set -euo pipefail

COMPOSE_POSTGRES_SERVICE="${COMPOSE_POSTGRES_SERVICE:-postgres}"
APP_DATA_DIR="${APP_DATA_DIR:-./data}"
BACKUP_ROOT="${BACKUP_ROOT:-./backups}"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

stamp="$(date +%Y%m%d-%H%M%S)"
target="${BACKUP_ROOT}/${stamp}"
mkdir -p "$target"

echo "== Dumping database to ${target}/db.sql.gz =="
docker compose exec -T "$COMPOSE_POSTGRES_SERVICE" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists | gzip > "${target}/db.sql.gz"

if [ -d "${APP_DATA_DIR}/avatars" ]; then
  echo "== Archiving avatars =="
  tar -czf "${target}/avatars.tar.gz" -C "$APP_DATA_DIR" avatars
fi

echo "Backup written to ${target}"
