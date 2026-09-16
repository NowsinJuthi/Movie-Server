#!/usr/bin/env bash
# Deploy / update AmarPin on Ubuntu + aaPanel (Docker Compose)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.aapanel.yml"
ENV_FILE="$ROOT_DIR/.env"
MEDIA_HOST="${CINEVAULT_MEDIA_HOST:-/data/movies.amarpin.com/media}"
SMB_HOST="${CINEVAULT_SMB_HOST:-/data/movies.amarpin.com/smb-mounts}"

cd "$ROOT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env — copying template..."
  cp "$ROOT_DIR/deploy/aapanel/.env.aapanel.example" "$ENV_FILE"
  echo "Edit $ENV_FILE (domain, JWT secret, admin password) then re-run."
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

MEDIA_HOST="${CINEVAULT_MEDIA_HOST:-$MEDIA_HOST}"
SMB_HOST="${CINEVAULT_SMB_HOST:-$SMB_HOST}"

echo ">> Creating media directories on host"
mkdir -p "$MEDIA_HOST/movies" "$MEDIA_HOST/tv" "$SMB_HOST"
chmod -R 755 /data/movies.amarpin.com 2>/dev/null || true

echo ">> Building and starting stack"
docker compose -f "$COMPOSE_FILE" up -d --build

echo ">> Waiting for health..."
sleep 5
docker compose -f "$COMPOSE_FILE" ps

echo
echo "Local checks (from this VPS):"
echo "  curl -sS http://127.0.0.1:4000/api/v1/health"
echo "  curl -I  http://127.0.0.1:3000"
echo
echo "Next: aaPanel → two sites + SSL:"
echo "  movies.amarpin.com     → deploy/aapanel/nginx-web.conf  (127.0.0.1:3000)"
echo "  movies.api.amarpin.com → deploy/aapanel/nginx-api.conf (127.0.0.1:4000)"
echo "Done."
