#!/usr/bin/env bash
# Non-destructive checks for CatMatch local dev environment.
# Performs read-only checks and reports status and where to find logs.
set -euo pipefail

echo "[dev-check] Docker containers and status:"
docker ps -a --format '  - {{.Names}}: {{.Status}} ({{.Ports}})'

echo "\n[dev-check] Network catmatch-net members:"
docker network inspect catmatch-net --format '{{json .Containers}}' 2>/dev/null || echo '  (network not present)'

echo "\n[dev-check] Backend health and OpenAPI summary:"
if curl -sS --max-time 5 http://127.0.0.1:8001/health >/dev/null 2>&1; then
  echo "  - /health: OK"
else
  echo "  - /health: NO RESPONSE (check: docker logs catmatch-backend-perm)"
fi

echo "\n  - OpenAPI paths (top-level):"
if curl -sS --max-time 5 http://127.0.0.1:8001/openapi.json | jq '.paths | keys' >/dev/null 2>&1; then
  curl -sS --max-time 5 http://127.0.0.1:8001/openapi.json | jq '.paths | keys'
else
  echo "    (openapi.json not available or request timed out)"
fi

echo "\n[dev-check] Next.js dev server:"
if ss -ltnp 2>/dev/null | grep -q ':3000'; then
  echo "  - Next dev: running (port 3000)."
  echo "  - Next logs (last 200 lines): /tmp/catmatch-next.log"
  [ -f /tmp/catmatch-next.log ] && tail -n 200 /tmp/catmatch-next.log || echo "    (no local log file)"
else
  echo "  - Next dev: not running"
fi

echo "\n[dev-check] CORS quick test (Origin: http://localhost:3000):"
if curl -i -sS -H "Origin: http://localhost:3000" --max-time 5 http://127.0.0.1:8001/openapi.json | head -n 20 | grep -i 'Access-Control-Allow-Origin' >/dev/null 2>&1; then
  echo "  - CORS header present"
else
  echo "  - CORS header absent (backend must allow origin http://localhost:3000)"
fi

echo "\n[dev-check] Git status (short):"
git -C /workspaces/CatMatch status -sb || true

echo "\n[dev-check] To debug: docker logs catmatch-backend-perm | tail -n 200"

echo "\n[dev-check] Done."
