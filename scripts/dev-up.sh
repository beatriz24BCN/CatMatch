#!/usr/bin/env bash
# Idempotent helper to start existing CatMatch services in this Codespace.
# Non-destructive: does not recreate or remove containers, does not write DB.
set -euo pipefail

REPO_ROOT="/workspaces/CatMatch"
NEXT_DIR="$REPO_ROOT/frontend-next"

DB_CONTAINER="catmatch-db-recover"
BACKEND_CONTAINER="catmatch-backend-perm"

die() { echo "[dev-up] ERROR: $*" >&2; exit 1; }

# Ensures dockerd is running and connected to the system containerd (where container layers live).
# If dockerd is stopped or connected to managed containerd, safely and non-destructively reconciles it.
ensure_docker_containerd() {
  local args dockerd_pid
  args=$(ps -o args= -C dockerd 2>/dev/null | head -n1 || true)
  if [ -n "$args" ] && [[ " $args " =~ [[:space:]]--containerd(=|[[:space:]]+)/run/containerd/containerd\.sock[[:space:]] ]]; then
    if docker info >/dev/null 2>&1; then
      echo "  - dockerd uses system containerd: OK"
      return 0
    fi
  fi

  echo "  - dockerd not running or not connected to system containerd. Performing safe reconciliation..."

  # Pre-flight safety check: ensure no active container is currently writing to catmatch_pgdata
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker ps -q --filter "volume=catmatch_pgdata" 2>/dev/null | grep -q .; then
      die "A container is actively using catmatch_pgdata under the current daemon. Please stop it safely before reconnecting Docker."
    fi
  fi

  # Ensure system containerd is running with /etc/containerd/config.toml
  if ! [ -S /run/containerd/containerd.sock ] || ! sudo ctr --address /run/containerd/containerd.sock version >/dev/null 2>&1; then
    echo "    -> starting system containerd (/etc/containerd/config.toml)..."
    sudo nohup /usr/bin/containerd --config /etc/containerd/config.toml > /tmp/containerd-manual.log 2>&1 < /dev/null &
    for _ in $(seq 1 30); do
      [ -S /run/containerd/containerd.sock ] && sudo ctr --address /run/containerd/containerd.sock version >/dev/null 2>&1 && break
      sleep 1
    done
    sudo ctr --address /run/containerd/containerd.sock version >/dev/null 2>&1 \
      || die "system containerd failed to start on /run/containerd/containerd.sock"
  fi

  # Safety verification: ensure original container snapshot exists in system containerd before touching dockerd
  if ! sudo ctr --address /run/containerd/containerd.sock -n moby snapshots ls 2>/dev/null | grep "93c7ef03e6d5" >/dev/null; then
    die "Cannot guarantee safe recovery: snapshot for catmatch-db-recover not found in system containerd storage. Aborting without restarting Docker."
  fi

  # If dockerd is running with wrong containerd, stop it gracefully
  if [ -n "$args" ]; then
    dockerd_pid=$(pgrep -x dockerd | head -n1 || true)
    if [ -n "$dockerd_pid" ]; then
      echo "    -> stopping misaligned dockerd (PID $dockerd_pid)..."
      sudo kill -TERM "$dockerd_pid" 2>/dev/null || true
      for _ in $(seq 1 20); do
        ps -p "$dockerd_pid" >/dev/null 2>&1 || break
        sleep 1
      done
    fi
  fi

  # Start dockerd connected to system containerd
  echo "    -> starting dockerd with system containerd..."
  sudo nohup dockerd --containerd /run/containerd/containerd.sock --dns 168.63.129.16 > /tmp/dockerd-manual.log 2>&1 < /dev/null &
  for _ in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
  docker info >/dev/null 2>&1 || die "dockerd failed to respond after launch"
  echo "  - dockerd successfully connected to system containerd: OK"

  # Stop legacy backend container if running to prevent port 8000 conflicts
  if docker ps -q --filter "name=catmatch-backend-recover" --filter "status=running" 2>/dev/null | grep -q .; then
    echo "    -> stopping legacy backend container (catmatch-backend-recover)..."
    docker stop catmatch-backend-recover >/dev/null 2>&1 || true
  fi
}

# Starts an existing container if it is not running. Never creates or removes containers.
ensure_container() {
  local c="$1" status start_err
  docker ps -a --format '{{.Names}}' | grep -xq "$c" \
    || die "container $c not present. It will NOT be created automatically. See docs/DEV_ENVIRONMENT.md"

  # Verify volume mount on PostgreSQL container before proceeding
  if [ "$c" = "$DB_CONTAINER" ]; then
    local mount_vol
    mount_vol=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' "$c" 2>/dev/null || true)
    if [ "$mount_vol" != "catmatch_pgdata" ]; then
      die "$c is not mounted to volume 'catmatch_pgdata' (got '$mount_vol'). Aborting to protect data."
    fi
    echo "  - $c volume 'catmatch_pgdata': OK"
  fi

  status=$(docker inspect -f '{{.State.Status}}' "$c")
  echo "  - $c: $status"
  case "$status" in
    running) ;;
    exited|created)
      echo "    -> starting $c"
      if ! start_err=$(docker start "$c" 2>&1); then
        if echo "$start_err" | grep -qi "RWLayer.*is unexpectedly nil"; then
          die "could not start $c: RWLayer is unexpectedly nil. Most likely dockerd is connected to a different containerd store than the one holding this container's layer. Do NOT recreate. See docs/CATMATCH_RECOVERY.md (section 10)"
        else
          die "could not start $c: $start_err"
        fi
      fi
      ;;
    paused) echo "    -> unpausing $c"; docker unpause "$c" >/dev/null || die "could not unpause $c" ;;
    *) die "$c is in unexpected state '$status'" ;;
  esac
}

echo "[dev-up] Checking Docker/containerd..."
ensure_docker_containerd

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
