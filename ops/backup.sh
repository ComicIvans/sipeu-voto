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

# Images before the dump, and the order is the whole point. The app keeps
# serving during a backup, so the two halves are taken a few seconds apart:
#
#   images first  → a picture replaced in between leaves an extra file in the
#                   archive that no row points at. Harmless.
#   dump first    → the same replacement leaves the dump pointing at a file the
#                   archive never got, and no restore can invent it back.
#
# The window that survives is a picture uploaded between the two steps: the row
# is in the dump, the file is not in the archive. Take backups when nobody is
# uploading if that matters, or stop the app first.
if [ -d "${APP_DATA_DIR}/avatars" ]; then
  echo "== Archiving avatars =="
  tar -czf "${target}/avatars.tar.gz" -C "$APP_DATA_DIR" avatars
fi

echo "== Dumping database to ${target}/db.sql.gz =="
docker compose exec -T "$COMPOSE_POSTGRES_SERVICE" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists | gzip > "${target}/db.sql.gz"

echo "Backup written to ${target}"
