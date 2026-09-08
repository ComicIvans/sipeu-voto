#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '== %s ==\n' "$1"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'ERROR: %s is not available locally\n' "$1" >&2
    exit 1
  }
}

load_env_file() {
  local env_file="$1"

  if [ -f "$env_file" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$env_file"
    set +a
  fi
}

build_and_push_image() {
  local latest_image="${IMAGE_NAME}:latest"
  local build_site_url="${NUXT_DEPLOY_SITE_URL:-$NUXT_SITE_URL}"

  if docker buildx version >/dev/null 2>&1; then
    docker buildx build \
      --platform "$DOCKER_PLATFORM" \
      --build-arg "NUXT_SITE_URL=$build_site_url" \
      -t "$IMAGE" \
      -t "$latest_image" \
      --push \
      .
    return
  fi

  docker build \
    --platform "$DOCKER_PLATFORM" \
    --build-arg "NUXT_SITE_URL=$build_site_url" \
    -t "$IMAGE" \
    -t "$latest_image" \
    .
  docker push "$IMAGE"
  docker push "$latest_image"
}

remote_compose_up() {
  ssh "$VPS_HOST" 'bash -se' <<EOF
set -euo pipefail

cd "${COMPOSE_DIR}"

# Per-project var (compose reads ${SIPEU_VOTO_IMAGE:-...}), never a bare IMAGE.
export SIPEU_VOTO_IMAGE="${IMAGE}"

cleanup_old_images() {
  local retention="${DEPLOY_IMAGE_RETENTION}"

  if [ "\$retention" -le 0 ]; then
    echo "== Skip old image cleanup =="
    return
  fi

  echo "== Clean old Docker images =="

  mapfile -t image_ids < <(docker image ls "${IMAGE_NAME}" --format '{{.ID}}' | awk '!seen[\$0]++')

  if [ "\${#image_ids[@]}" -le "\$retention" ]; then
    echo "Keeping \${#image_ids[@]} image(s); nothing to remove"
    return
  fi

  printf '%s\n' "\${image_ids[@]:\$retention}" | xargs -r docker image rm -f
}

echo "== Pull images =="
docker compose pull "${COMPOSE_APP_SERVICE}"

if [ "${APPLY_MIGRATIONS_ON_DEPLOY}" = "true" ]; then
  if docker compose config --services | grep -qx "${COMPOSE_POSTGRES_SERVICE}"; then
    echo "== Ensure postgres is running =="
    docker compose up -d "${COMPOSE_POSTGRES_SERVICE}"
  fi

  echo "== Apply database migrations =="
  docker compose run -T --rm "${COMPOSE_APP_SERVICE}" /app/ops/migrate.mjs </dev/null
fi

echo "== Recreate containers =="
docker compose up -d "${COMPOSE_APP_SERVICE}"

echo "== Persist SIPEU_VOTO_IMAGE in .env =="
# Without this, SIPEU_VOTO_IMAGE only exists in this SSH session. Any later bare
# \`docker compose up -d\` (a reboot, a manual restart, bringing up another
# service) would resolve \${SIPEU_VOTO_IMAGE:-...} back to its ':latest' fallback
# and silently revert this container to whatever ':latest' is cached locally --
# which can be arbitrarily stale, since deploys pull the sha tag, never
# ':latest'. Compose auto-loads .env from the project dir on every invocation.
# The upsert is anchored on ^SIPEU_VOTO_IMAGE= so sibling projects' keys
# (WEB_IMAGE, INTRANET_IMAGE) in the same shared .env are left untouched.
SIPEU_VOTO_IMAGE_ENV_LINE="SIPEU_VOTO_IMAGE=${IMAGE}"
if [ -f .env ] && grep -q '^SIPEU_VOTO_IMAGE=' .env; then
  TMP_ENV="\$(mktemp)"
  sed "s|^SIPEU_VOTO_IMAGE=.*|\$SIPEU_VOTO_IMAGE_ENV_LINE|" .env > "\$TMP_ENV"
  cat "\$TMP_ENV" > .env
  rm -f "\$TMP_ENV"
else
  printf '%s\n' "\$SIPEU_VOTO_IMAGE_ENV_LINE" >> .env
fi
echo "    \$SIPEU_VOTO_IMAGE_ENV_LINE"

if docker compose config --services | grep -qx "${COMPOSE_NGINX_SERVICE}"; then
  echo "== Reload NGINX =="
  docker compose exec -T "${COMPOSE_NGINX_SERVICE}" nginx -s reload
fi

cleanup_old_images
EOF
}

load_env_file ".env"

: "${VPS_HOST:?ERROR: VPS_HOST is required}"
: "${REMOTE_DIR:?ERROR: REMOTE_DIR is required}"
: "${NUXT_SITE_URL:?ERROR: NUXT_SITE_URL is required}"

require_command docker
require_command ssh
require_command git

IMAGE_NAME="${IMAGE_NAME:-ghcr.io/comicivans/sipeu-voto}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
IMAGE="${IMAGE:-${IMAGE_NAME}:${IMAGE_TAG}}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"
APPLY_MIGRATIONS_ON_DEPLOY="${APPLY_MIGRATIONS_ON_DEPLOY:-true}"
COMPOSE_DIR="${COMPOSE_DIR:-$REMOTE_DIR}"
COMPOSE_APP_SERVICE="${COMPOSE_APP_SERVICE:-app}"
COMPOSE_POSTGRES_SERVICE="${COMPOSE_POSTGRES_SERVICE:-postgres}"
COMPOSE_NGINX_SERVICE="${COMPOSE_NGINX_SERVICE:-nginx}"
GHCR_LOGIN="${GHCR_LOGIN:-false}"
DEPLOY_IMAGE_RETENTION="${DEPLOY_IMAGE_RETENTION:-2}"

if ! [[ "$DEPLOY_IMAGE_RETENTION" =~ ^[0-9]+$ ]]; then
  printf 'ERROR: DEPLOY_IMAGE_RETENTION must be a non-negative integer\n' >&2
  exit 1
fi

if [ "$GHCR_LOGIN" = "true" ]; then
  : "${GHCR_USERNAME:?ERROR: GHCR_USERNAME is required when GHCR_LOGIN=true}"
  : "${GHCR_TOKEN:?ERROR: GHCR_TOKEN is required when GHCR_LOGIN=true}"
  log "GHCR login"
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
fi

log "Build and push: $IMAGE"
build_and_push_image

log "Deploy to VPS with docker compose"
remote_compose_up

printf 'Deploy finished successfully\n'
