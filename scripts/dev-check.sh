#!/usr/bin/env bash
# Non-destructive checks for CatMatch local dev environment.
# Performs read-only checks and reports status and where to find logs.
set -euo pipefail

FAILS=0
ok()   { echo "  [OK]   $*"; }
fail() { echo "  [FAIL] $*"; FAILS=$((FAILS+1)); }

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
REPO_ROOT="/workspaces/CatMatch"

# GET a URL; succeeds only if HTTP 200 AND the body is a JSON array (an error payload is not enough)
api_list() { # url outfile
  local code
  code=$(curl -sS --max-time 15 -o "$2" -w '%{http_code}' "$1" 2>/dev/null) || code=000
  [ "$code" = "200" ] || { echo "HTTP $code"; return 1; }
  python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if isinstance(d,list) else 1)' "$2" 2>/dev/null \
    || { echo "HTTP 200 but body is not a JSON list: $(head -c 120 "$2")"; return 1; }
}

echo "[dev-check] Docker/containerd:"
DOCKERD_ARGS=$(ps -o args= -C dockerd 2>/dev/null | head -n1 || true)
if [ -z "$DOCKERD_ARGS" ]; then
  fail "dockerd is not running"
elif ! [[ " $DOCKERD_ARGS " =~ [[:space:]]--containerd(=|[[:space:]]+)/run/containerd/containerd\.sock[[:space:]] ]]; then
  fail "dockerd is not connected to the system containerd (expected --containerd /run/containerd/containerd.sock; got: $DOCKERD_ARGS). RWLayer errors expected. See docs/CATMATCH_RECOVERY.md (section 10)"
else
  ok "dockerd uses system containerd (/run/containerd/containerd.sock)"
fi

echo
echo "[dev-check] Docker containers and status:"
docker ps -a --format '  - {{.Names}}: {{.Status}} ({{.Ports}})'

echo
echo "[dev-check] Network catmatch-net members:"
docker network inspect catmatch-net --format '{{range .Containers}}  - {{.Name}} {{.IPv4Address}}{{"\n"}}{{end}}' 2>/dev/null || echo '  (network not present)'

echo
echo "[dev-check] Network rule (iptables-legacy DOCKER-USER):"
if "$REPO_ROOT/scripts/fix-docker-net.sh" --check >"$TMP/net.out" 2>&1; then ok "$(cat "$TMP/net.out")"; else fail "$(cat "$TMP/net.out")"; fi

echo
echo "[dev-check] PostgreSQL:"
if docker exec catmatch-db-recover pg_isready -U postgres -d catmatch >/dev/null 2>&1; then ok "pg_isready: accepting connections"; else fail "PostgreSQL not ready (docker logs catmatch-db-recover)"; fi
if docker exec catmatch-backend-perm python -c "import socket; socket.create_connection(('db',5432),5).close()" >/dev/null 2>&1; then ok "backend container reaches db:5432"; else fail "backend container cannot reach db:5432"; fi

echo
echo "[dev-check] Backend (port 8001):"
if curl -sS --max-time 5 http://127.0.0.1:8001/health >/dev/null 2>&1; then ok "/health"; else fail "/health: no response (docker logs catmatch-backend-perm)"; fi
if msg=$(api_list http://127.0.0.1:8001/api/cats/ "$TMP/back.json"); then ok "GET /api/cats/ returns a JSON list"; else fail "GET /api/cats/ -> $msg"; fi

echo
echo "[dev-check] Next.js (port 3000):"
if curl -sSL --max-time 10 -o /dev/null -f http://127.0.0.1:3000/ 2>/dev/null; then ok "frontend responds"; else fail "frontend not responding on 3000"; fi
if msg=$(api_list http://127.0.0.1:3000/api/cats/ "$TMP/proxy.json"); then
  ok "GET /api/cats/ through the proxy returns a JSON list"
  if [ -f "$TMP/back.json" ] && cmp -s "$TMP/back.json" "$TMP/proxy.json"; then ok "proxy body identical to backend body"; else fail "proxy body differs from backend body"; fi
else
  fail "GET /api/cats/ via proxy -> $msg"
fi
NEXT_PID=$(ss -ltnp 2>/dev/null | grep ':3000' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2 || true)
if [ -n "$NEXT_PID" ] && tr '\0' '\n' < "/proc/$NEXT_PID/environ" 2>/dev/null | grep -q '^NEXT_PUBLIC_API_BASE=.\+'; then
  fail "Next was started with NEXT_PUBLIC_API_BASE set; the browser would bypass the proxy"
fi
[ -f /tmp/catmatch-next.log ] && echo "  Next logs: /tmp/catmatch-next.log"

echo
echo "[dev-check] Git status (short):"
git -C "$REPO_ROOT" status -sb || true

echo
if [ "$FAILS" -eq 0 ]; then
  echo "[dev-check] All checks passed."
else
  echo "[dev-check] $FAILS check(s) FAILED." >&2
  exit 1
fi
