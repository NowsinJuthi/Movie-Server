#!/usr/bin/env bash
# Fast web rebuild on VPS (systemd + standalone Next.js)
set -euo pipefail

ROOT="${ROOT:-/www/wwwroot/movies.amarpin.com}"
cd "$ROOT"

echo ">> Stopping amarpin-web"
sudo systemctl stop amarpin-web

echo ">> Removing old .next"
sudo rm -rf apps/web/.next

echo ">> Building web (includes prepare-web-standalone via package.json)"
npm run build -w @movie-server/web

echo ">> Fixing standalone ownership for www user"
sudo chown -R www:www apps/web/.next/standalone

echo ">> Starting amarpin-web"
sudo systemctl start amarpin-web

sleep 2
echo ">> Service status"
sudo systemctl is-active amarpin-web

echo ">> Smoke test"
curl -sS -o /dev/null -w "localhost:3000 → %{http_code}\n" http://127.0.0.1:3000/
curl -sS -o /dev/null -w "public /api/v1/health → %{http_code}\n" https://movies.amarpin.com/api/v1/health

CSS=$(curl -sS "https://movies.amarpin.com/?$(date +%s)" | grep -oE '/_next/static/[^"]+\.css' | head -1 || true)
if [[ -n "${CSS:-}" ]]; then
  curl -sS -o /dev/null -w "public CSS → %{http_code}\n" "https://movies.amarpin.com${CSS}"
else
  echo "WARN: no CSS link in HTML"
fi

echo ">> Verify HTML chunk references (stale cache shows 404 and flashing UI)"
HTML=$(curl -sS "https://movies.amarpin.com/")
MISSING=0
while IFS= read -r asset; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "https://movies.amarpin.com${asset}")
  if [[ "$code" != "200" ]]; then
    echo "MISSING ${asset} → HTTP ${code}"
    MISSING=$((MISSING + 1))
  fi
done < <(printf '%s\n' "$HTML" | grep -oE '/_next/static/chunks/[^" ]+\.(js|css)' | sort -u)
if [[ "$MISSING" -gt 0 ]]; then
  echo "FAIL: ${MISSING} chunk(s) missing. Reload nginx after updating deploy/aapanel/nginx-web.conf, then rerun this script."
  exit 1
fi
echo "All referenced chunks → 200"

echo ">> Done. Hard refresh (Ctrl+Shift+R) or incognito: https://movies.amarpin.com/login"
