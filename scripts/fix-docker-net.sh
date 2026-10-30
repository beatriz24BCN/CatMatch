#!/usr/bin/env bash
# Allow container-to-container traffic inside the catmatch-net bridge.
# Needed in Codespaces when iptables-legacy has FORWARD policy DROP while Docker uses nftables.
# Idempotent: adds a single ACCEPT rule to DOCKER-USER only if it is missing.
# Does not restart Docker, containers or networks, and does not touch nftables.
# Usage: scripts/fix-docker-net.sh [--check]   (--check only reports, changes nothing)
set -euo pipefail

NETWORK="${CATMATCH_NET:-catmatch-net}"
CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

if ! command -v docker >/dev/null 2>&1; then
  echo "[fix-docker-net] ERROR: docker not found" >&2; exit 1
fi
if ! command -v iptables-legacy >/dev/null 2>&1; then
  echo "[fix-docker-net] iptables-legacy not available; nothing to do."; exit 0
fi

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if sudo -n true 2>/dev/null; then SUDO="sudo -n"; else
    echo "[fix-docker-net] ERROR: root or passwordless sudo is required" >&2; exit 1
  fi
fi

if ! NET_ID=$(docker network inspect -f '{{.Id}}' "$NETWORK" 2>/dev/null) || [ -z "$NET_ID" ]; then
  echo "[fix-docker-net] ERROR: docker network '$NETWORK' not found" >&2; exit 1
fi

# Prefer an explicit bridge name; Docker's default is br-<first 12 chars of the network ID>
BRIDGE=$(docker network inspect -f '{{index .Options "com.docker.network.bridge.name"}}' "$NETWORK" 2>/dev/null || true)
[ -z "$BRIDGE" ] && BRIDGE="br-${NET_ID:0:12}"

if [ ! -d "/sys/class/net/$BRIDGE" ]; then
  echo "[fix-docker-net] ERROR: bridge interface '$BRIDGE' does not exist on this host" >&2; exit 1
fi

if ! $SUDO iptables-legacy -n -L DOCKER-USER >/dev/null 2>&1; then
  echo "[fix-docker-net] iptables-legacy has no DOCKER-USER chain; nothing to do."; exit 0
fi

if $SUDO iptables-legacy -C DOCKER-USER -i "$BRIDGE" -o "$BRIDGE" -j ACCEPT 2>/dev/null; then
  echo "[fix-docker-net] OK: rule already present for $NETWORK ($BRIDGE)"; exit 0
fi

if [ "$CHECK_ONLY" -eq 1 ]; then
  echo "[fix-docker-net] MISSING: rule for $NETWORK ($BRIDGE); run without --check to add it"; exit 2
fi

$SUDO iptables-legacy -I DOCKER-USER -i "$BRIDGE" -o "$BRIDGE" -j ACCEPT
echo "[fix-docker-net] ADDED: DOCKER-USER ACCEPT $BRIDGE -> $BRIDGE"
echo "[fix-docker-net] Revert: sudo iptables-legacy -D DOCKER-USER -i $BRIDGE -o $BRIDGE -j ACCEPT"
