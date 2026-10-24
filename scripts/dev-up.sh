#!/usr/bin/env bash
# Idempotent helper to start existing CatMatch services in this Codespace.
# Non-destructive: does not recreate or remove containers, does not write DB.
set -euo pipefail

REPO_ROOT="/workspaces/CatMatch"
NEXT_DIR="$REPO_ROOT/frontend-next"

DB_CONTAINER="catmatch-db-recover"
BACKEND_CONTAINER="catmatch-backend-perm"

die() { echo "[dev-up] ERROR: $*" >&2; exit 1; }

# Starts an existing container if it is not running. Never creates or removes containers.
ensure_container() {
  local c="$1" status start_err
  docker ps -a --format '{{.Names}}' | grep -xq "$c" \
    || die "container $c not present. It will NOT be created automatically. See docs/DEV_ENVIRONMENT.md"
  status=$(docker inspect -f '{{.State.Status}}' "$c")
  echo "  - $c: $status"
  case "$status" in
    running) ;;
    exited|created)
      echo "    -> starting $c"
      if ! start_err=$(docker start "$c" 2>&1); then
        if echo "$start_err" | grep -qi "RWLayer.*is unexpectedly nil"; then
          die "could not start $c: Docker storage error (RWLayer is unexpectedly nil). The container write layer was corrupted by a daemon restart. Do NOT recreate automatically. See docs/CATMATCH_RECOVERY.md"
        else
          die "could not start $c: $start_err"
        fi
      fi
      ;;
    paused) echo "    -> unpausing $c"; docker unpause "$c" >/dev/null || die "could not unpause $c" ;;
    *) die "$c is in unexpected state '$status'" ;;
  esac
}

echo "[dev-up] Ensuring PostgreSQL container..."
ensure_container "$DB_CONTAINER"

# The network fix needs catmatch-net, which the DB container is attached to
echo "[dev-up] Ensuring container networking (iptables-legacy rule)"
"$REPO_ROOT/scripts/fix-docker-net.sh" || die "network fix failed (see output above); not continuing"

echo "[dev-up] Waiting for PostgreSQL (max 60s)"
for _ in $(seq 1 60); do
  docker exec "$DB_CONTAINER" pg_isready -U postgres -d catmatch >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$DB_CONTAINER" pg_isready -U postgres -d catmatch >/dev/null 2>&1 \
  || die "PostgreSQL is not ready (docker logs $DB_CONTAINER)"
echo "  - PostgreSQL ready"

echo "[dev-up] Ensuring backend container..."
ensure_container "$BACKEND_CONTAINER"

# Only waits for /health here; the functional API check (GET /api/cats/) runs in dev-check.sh at the end
echo "[dev-up] Waiting for backend on http://127.0.0.1:8001 (max 60s)"
for _ in $(seq 1 60); do
  curl -sS --max-time 5 http://127.0.0.1:8001/health >/dev/null 2>&1 && break
  sleep 1
done
curl -sS --max-time 5 http://127.0.0.1:8001/health >/dev/null 2>&1 \
  || die "backend not responding (docker logs $BACKEND_CONTAINER)"
echo "  - backend healthy"

# Start Next.js dev server if not running
echo "[dev-up] Ensuring Next dev server on port 3000"
if ss -ltnp 2>/dev/null | grep -q ':3000'; then
  echo "  - Next dev appears to be running already (not restarted)"
else
  echo "  - Next dev not running. Starting it in background; /api/* is proxied to the backend by next.config.js"
  [ -d "$NEXT_DIR" ] || die "frontend directory missing: $NEXT_DIR"
  # NEXT_PUBLIC_API_BASE must stay unset so the browser calls its own origin (/api/...)
  # nohup with stdin/stdout/stderr redirected decouples Next from caller pipeline and terminal session
  (cd "$NEXT_DIR" && nohup env -u NEXT_PUBLIC_API_BASE npm run dev </dev/null > /tmp/catmatch-next.log 2>&1 & echo $! > /tmp/catmatch-next.pid)
  for _ in $(seq 1 30); do
    curl -sS --max-time 3 -o /dev/null http://127.0.0.1:3000/ 2>/dev/null && break
    sleep 1
  done
  echo "    -> started (pid $(cat /tmp/catmatch-next.pid 2>/dev/null || echo '?')); logs: /tmp/catmatch-next.log"
fi

echo "[dev-up] Running final verification (scripts/dev-check.sh)"
exec "$REPO_ROOT/scripts/dev-check.sh"
