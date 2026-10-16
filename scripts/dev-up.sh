#!/usr/bin/env bash
# Idempotent helper to start existing CatMatch services in this Codespace.
# Non-destructive: does not recreate or remove containers, does not write DB.
set -euo pipefail

REPO_ROOT="/workspaces/CatMatch"
NEXT_DIR="$REPO_ROOT/frontend-next"

# Containers we expect
CONTAINERS=("catmatch-db-recover" "catmatch-backend-perm" "catmatch-backend-recover")

echo "[dev-up] Checking Docker containers..."
for c in "${CONTAINERS[@]}"; do
  if docker ps -a --format '{{.Names}}' | grep -xq "$c"; then
    STATUS=$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo "not-found")
    echo "  - $c: $STATUS"
    if [ "$STATUS" = "exited" ] || [ "$STATUS" = "created" ] || [ "$STATUS" = "paused" ]; then
      echo "    -> starting $c"; docker start "$c" >/dev/null || echo "    (start failed)"; fi
  else
    echo "  - $c: (container not present). Will NOT create it automatically. See docs/DEV_ENVIRONMENT.md"
  fi
done

# Wait a short moment for services to be reachable
sleep 2

# Check backend health (port 8001)
echo "[dev-up] Checking backend on http://127.0.0.1:8001/health"
if curl -sS --max-time 5 http://127.0.0.1:8001/health >/dev/null 2>&1; then
  echo "  - backend healthy"
else
  echo "  - backend not responding (check container logs: docker logs catmatch-backend-perm)"
fi

# Start Next.js dev server if not running
echo "[dev-up] Ensuring Next dev server on port 3000"
if ss -ltnp 2>/dev/null | grep -q ':3000'; then
  echo "  - Next dev appears to be running already"
else
  echo "  - Next dev not running. Starting it in background with NEXT_PUBLIC_API_BASE=http://127.0.0.1:8001"
  if [ -d "$NEXT_DIR" ]; then
    # start without changing files; will use existing node_modules if present
    (cd "$NEXT_DIR" && env NEXT_PUBLIC_API_BASE='http://127.0.0.1:8001' npm run dev > /tmp/catmatch-next.log 2>&1 & echo $! > /tmp/catmatch-next.pid)
    sleep 1
    echo "    -> started (pid $(cat /tmp/catmatch-next.pid 2>/dev/null || echo '?')); logs: /tmp/catmatch-next.log"
  else
    echo "    -> frontend directory missing: $NEXT_DIR"
  fi
fi

echo "[dev-up] Done. Use scripts/dev-check.sh to verify services."
