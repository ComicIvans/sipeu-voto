#!/usr/bin/env bash
# Restores a backup produced by ops/backup.sh. Usage: ops/restore.sh ./backups/<timestamp>
# WARNING: replaces every table and every avatar with the backup contents.
#
# The two halves cannot share a transaction: PostgreSQL rolls back on its own,
# the filesystem does not. So the images are unpacked and swapped in first, the
# previous directory is kept aside, and it is put back if the database restore
# fails. The window where the two disagree is the swap itself.
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
archive="${source_dir}/avatars.tar.gz"
live_dir="${APP_DATA_DIR}/avatars"
previous_dir="${APP_DATA_DIR}/avatars.previous"

staging=""
avatars_swapped=false
restore_ok=false

on_exit() {
  if [ "$restore_ok" = false ] && [ "$avatars_swapped" = true ]; then
    echo "== Restore failed: putting the previous images back ==" >&2
    rm -rf "$live_dir"
    [ -d "$previous_dir" ] && mv "$previous_dir" "$live_dir"
  fi
  [ -n "$staging" ] && rm -rf "$staging"
  return 0
}
trap on_exit EXIT

echo "== Verifying the backup =="
[ -f "$dump" ] || {
  echo "ERROR: ${dump} does not exist" >&2
  exit 1
}
gunzip -t "$dump" || {
  echo "ERROR: ${dump} is corrupted" >&2
  exit 1
}
if [ -f "$archive" ]; then
  # Readable is not enough: it has to be the archive this script knows how to
  # apply, with a single top-level "avatars/" directory.
  #
  # The listing is read into a variable and matched with here-strings, never
  # piped: `grep -q` exits at its first match, whatever is writing into the pipe
  # then dies of SIGPIPE, and under `pipefail` the `if` would be answering about
  # the broken pipe instead of about the archive. With a listing large enough to
  # outgrow the pipe buffer that turns both checks upside down.
  listing="$(tar -tzf "$archive")" || {
    echo "ERROR: ${archive} is corrupted" >&2
    exit 1
  }
  if ! grep -qx 'avatars/' <<<"$listing"; then
    echo "ERROR: ${archive} does not contain a top-level avatars/ directory" >&2
    exit 1
  fi
  if grep -qv '^avatars/' <<<"$listing"; then
    echo "ERROR: ${archive} contains entries outside avatars/" >&2
    exit 1
  fi
fi
echo "    the backup looks like one of ours"

app_was_running=false
if docker compose config --services 2>/dev/null | grep -qx "$COMPOSE_APP_SERVICE"; then
  if [ -n "$(docker compose ps -q "$COMPOSE_APP_SERVICE" 2>/dev/null)" ]; then
    app_was_running=true
    echo "== Stopping ${COMPOSE_APP_SERVICE} while the data is replaced =="
    docker compose stop "$COMPOSE_APP_SERVICE"
  fi
fi

# Images first, fully unpacked before anything is replaced, so a broken archive
# cannot leave the database restored and the pictures missing.
if [ -f "$archive" ]; then
  echo "== Unpacking images =="
  mkdir -p "$APP_DATA_DIR"
  staging="$(mktemp -d "${APP_DATA_DIR}/.restore-XXXXXX")"
  tar -xzf "$archive" -C "$staging"
  [ -d "${staging}/avatars" ] || {
    echo "ERROR: the archive did not produce an avatars directory" >&2
    exit 1
  }

  echo "== Replacing images =="
  rm -rf "$previous_dir"
  [ -d "$live_dir" ] && mv "$live_dir" "$previous_dir"
  mv "${staging}/avatars" "$live_dir"
  avatars_swapped=true
fi

# --single-transaction makes the database half all-or-nothing: an error in the
# middle rolls back instead of leaving half the tables restored. It works
# because ops/backup.sh writes a plain dump with no CREATE DATABASE or \connect.
echo "== Restoring database from ${dump} =="
gunzip -c "$dump" | docker compose exec -T "$COMPOSE_POSTGRES_SERVICE" \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q --single-transaction -v ON_ERROR_STOP=1

restore_ok=true
rm -rf "$previous_dir"

if [ "$app_was_running" = true ]; then
  echo "== Starting ${COMPOSE_APP_SERVICE} again =="
  docker compose start "$COMPOSE_APP_SERVICE"
  echo "Restore finished."
else
  echo "Restore finished. Start the app when you are ready: docker compose up -d"
fi
