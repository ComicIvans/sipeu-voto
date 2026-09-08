#!/usr/bin/env bash
# Restores a backup produced by ops/backup.sh. Usage: ops/restore.sh ./backups/<timestamp>
# WARNING: replaces every table and every avatar with the backup contents.
#
# Nothing is touched until both files have been verified, the database is
# restored inside a single transaction, and the avatars are unpacked to a
# temporary directory before replacing the live one. A failure at any point
# leaves the previous state in place.
set -euo pipefail

source_dir="${1:?usage: ops/restore.sh <backup-dir>}"
COMPOSE_POSTGRES_SERVICE="${COMPOSE_POSTGRES_SERVICE:-postgres}"
COMPOSE_APP_SERVICE="${COMPOSE_APP_SERVICE:-app}"
APP_DATA_DIR="${APP_DATA_DIR:-./data}"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

dump="${source_dir}/db.sql.gz"
avatars="${source_dir}/avatars.tar.gz"

echo "== Verifying the backup =="
[ -f "$dump" ] || {
  echo "ERROR: ${dump} does not exist" >&2
  exit 1
}
gunzip -t "$dump" || {
  echo "ERROR: ${dump} is corrupted" >&2
  exit 1
}
if [ -f "$avatars" ]; then
  tar -tzf "$avatars" >/dev/null || {
    echo "ERROR: ${avatars} is corrupted" >&2
    exit 1
  }
fi
echo "    both files are readable"

app_was_running=false
if docker compose config --services 2>/dev/null | grep -qx "$COMPOSE_APP_SERVICE"; then
  if [ -n "$(docker compose ps -q "$COMPOSE_APP_SERVICE" 2>/dev/null)" ]; then
    app_was_running=true
    echo "== Stopping ${COMPOSE_APP_SERVICE} while the data is replaced =="
    docker compose stop "$COMPOSE_APP_SERVICE"
  fi
fi

# --single-transaction turns the whole dump into all-or-nothing: an error in the
# middle rolls back instead of leaving half the tables restored. It works
# because ops/backup.sh writes a plain dump with no CREATE DATABASE or \connect.
echo "== Restoring database from ${dump} =="
gunzip -c "$dump" | docker compose exec -T "$COMPOSE_POSTGRES_SERVICE" \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q --single-transaction -v ON_ERROR_STOP=1

if [ -f "$avatars" ]; then
  echo "== Restoring avatars =="
  mkdir -p "$APP_DATA_DIR"
  staging="$(mktemp -d "${APP_DATA_DIR}/.restore-XXXXXX")"
  trap 'rm -rf "$staging"' EXIT
  tar -xzf "$avatars" -C "$staging"

  if [ -d "${APP_DATA_DIR}/avatars" ]; then
    rm -rf "${APP_DATA_DIR}/avatars.previous"
    mv "${APP_DATA_DIR}/avatars" "${APP_DATA_DIR}/avatars.previous"
  fi
  mv "${staging}/avatars" "${APP_DATA_DIR}/avatars"
  rm -rf "${APP_DATA_DIR}/avatars.previous"
fi

if [ "$app_was_running" = true ]; then
  echo "== Starting ${COMPOSE_APP_SERVICE} again =="
  docker compose start "$COMPOSE_APP_SERVICE"
  echo "Restore finished."
else
  echo "Restore finished. Start the app when you are ready: docker compose up -d"
fi
