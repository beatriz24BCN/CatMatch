#!/usr/bin/env bash
# Allow container-to-container and minimal required outbound traffic for CatMatch.
# Needed in Codespaces when iptables-legacy has FORWARD policy DROP while Docker uses nftables.
# Idempotent: enforces CatMatch rules in strict order before the terminating -j RETURN.
# Protects pre-existing rules: aborts on ambiguous states; rolls back only newly added rules on failure.
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

# Dynamic DNS server detection (Azure recursive resolver in Codespaces: 168.63.129.16)
DNS_SERVER="${DNS_SERVER:-}"
if [ -z "$DNS_SERVER" ]; then
  DNS_SERVER=$(grep -E '^[[:space:]]*nameserver[[:space:]]+' /etc/resolv.conf 2>/dev/null \
    | awk '{print $2}' | grep -v '^127\.' | head -n1 || true)
  [ -z "$DNS_SERVER" ] && DNS_SERVER="168.63.129.16"
fi
DNS_ESCAPED=$(printf '%s\n' "$DNS_SERVER" | sed 's/\./\\./g')

# Strict ordered list of required CatMatch rules:
# 1. Internal bridge (FastAPI <-> PostgreSQL)
# 2. Return packets for established/related connections
# 3. Outbound DNS UDP 53 restricted to bridge and DNS_SERVER
# 4. Outbound DNS TCP 53 restricted to bridge and DNS_SERVER
# 5. Outbound SMTP TCP 587 restricted to bridge (Brevo STARTTLS)
RULES=(
  "-i $BRIDGE -o $BRIDGE -j ACCEPT"
  "-o $BRIDGE -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT"
  "-i $BRIDGE ! -o $BRIDGE -d $DNS_SERVER -p udp --dport 53 -j ACCEPT"
  "-i $BRIDGE ! -o $BRIDGE -d $DNS_SERVER -p tcp --dport 53 -j ACCEPT"
  "-i $BRIDGE ! -o $BRIDGE -p tcp --dport 587 -j ACCEPT"
)

# Strict positional validator via awk.
# Matches each rule checking all parameters exactly:
# - R1: exact in/out bridge match
# - R2: exact out bridge and conntrack state match
# - R3/R4: exact in-bridge, not-out-bridge, exact escaped DNS destination IP (/32 canonical), proto and dport 53
# - R5: exact in-bridge, not-out-bridge, tcp and dport 587 (rejects any foreign rule on other interfaces)
inspect_catmatch_rules() {
  $SUDO iptables-legacy -S DOCKER-USER 2>/dev/null | awk -v br="$BRIDGE" -v dns="$DNS_ESCAPED" '
  /^-A DOCKER-USER/ {
    idx++
    if ($0 ~ ("^-A DOCKER-USER -i " br " -o " br " -j ACCEPT$")) { r1=idx; c1++ }
    if ($0 ~ ("^-A DOCKER-USER -o " br " -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT$")) { r2=idx; c2++ }
    if ($0 ~ ("^-A DOCKER-USER -d " dns "/32 -i " br " ! -o " br " -p udp -m udp --dport 53 -j ACCEPT$")) { r3=idx; c3++ }
    if ($0 ~ ("^-A DOCKER-USER -d " dns "/32 -i " br " ! -o " br " -p tcp -m tcp --dport 53 -j ACCEPT$")) { r4=idx; c4++ }
    if ($0 ~ ("^-A DOCKER-USER -i " br " ! -o " br " -p tcp -m tcp --dport 587 -j ACCEPT$")) { r5=idx; c5++ }
    if ($0 ~ "^-A DOCKER-USER -j RETURN$") { if (!r_ret) r_ret=idx }
  }
  END {
    print (c1+0), (c2+0), (c3+0), (c4+0), (c5+0), (r1+0), (r2+0), (r3+0), (r4+0), (r5+0), (r_ret+0)
  }'
}

read -r c1 c2 c3 c4 c5 r1 r2 r3 r4 r5 r_ret <<< "$(inspect_catmatch_rules)"

# Verification helper: strict sequence pos(R1) < pos(R2) < pos(R3) < pos(R4) < pos(R5) < pos(RETURN)
is_order_perfect() {
  [ "$c1" -eq 1 ] && [ "$c2" -eq 1 ] && [ "$c3" -eq 1 ] && [ "$c4" -eq 1 ] && [ "$c5" -eq 1 ] && \
  [ "$r_ret" -gt 0 ] && [ "$r1" -lt "$r2" ] && [ "$r2" -lt "$r3" ] && [ "$r3" -lt "$r4" ] && \
  [ "$r4" -lt "$r5" ] && [ "$r5" -lt "$r_ret" ]
}

# Check mode for scripts/dev-check.sh
if [ "$CHECK_ONLY" -eq 1 ]; then
  if is_order_perfect; then
    echo "[fix-docker-net] OK: all 5 rules present in correct order before RETURN for $NETWORK ($BRIDGE, DNS: $DNS_SERVER)"
    exit 0
  else
    echo "[fix-docker-net] MISSING: rules missing or out of order for $NETWORK ($BRIDGE); run without --check to fix"
    exit 2
  fi
fi

# Idempotency: if all 5 rules are already in perfect order before RETURN, do nothing
if is_order_perfect; then
  echo "[fix-docker-net] OK: rules already configured in exact order before RETURN for $NETWORK ($BRIDGE)"
  exit 0
fi

# Pre-condition: a terminating RETURN rule must exist in DOCKER-USER before inserting anything
if [ "$r_ret" -le 0 ]; then
  echo "[fix-docker-net] ERROR: No terminating RETURN rule found in DOCKER-USER chain. Refusing to modify iptables." >&2
  exit 1
fi

# Protection check for pre-existing rules:
# Do not delete any pre-existing rule. If any pre-existing CatMatch rule is found in an ambiguous state
# (e.g. duplicates, placed behind RETURN, or out of relative order), stop and report instead of deleting.
for i in 1 2 3 4 5; do
  eval "count=\$c$i"
  eval "pos=\$r$i"
  if [ "$count" -gt 1 ]; then
    echo "[fix-docker-net] ERROR: Pre-existing duplicate detected for rule $i (count=$count). Cannot safely determine ownership. Aborting without deleting rules." >&2
    exit 1
  fi
  if [ "$count" -eq 1 ] && [ "$pos" -gt "$r_ret" ]; then
    echo "[fix-docker-net] ERROR: Pre-existing rule $i is placed behind RETURN (pos $pos > return $r_ret). Aborting without deleting rules." >&2
    exit 1
  fi
done

# Verify relative order of whichever rules are already present
last_pos=0
for i in 1 2 3 4 5; do
  eval "count=\$c$i"
  eval "pos=\$r$i"
  if [ "$count" -eq 1 ]; then
    if [ "$pos" -le "$last_pos" ]; then
      echo "[fix-docker-net] ERROR: Pre-existing CatMatch rules are in an inconsistent relative order. Aborting without deleting rules." >&2
      exit 1
    fi
    last_pos="$pos"
  fi
done

# Rollback trap: tracks ONLY rules added during THIS run. If anything fails, rolls back only these rules.
ADDED_RULES=()
cleanup_on_error() {
  local exit_code=$?
  if [ "$exit_code" -ne 0 ] && [ "${#ADDED_RULES[@]}" -gt 0 ]; then
    echo "[fix-docker-net] ROLLBACK: An error occurred. Reverting newly added rules (pre-existing rules untouched)..." >&2
    for ((idx=${#ADDED_RULES[@]}-1; idx>=0; idx--)); do
      local r="${ADDED_RULES[$idx]}"
      $SUDO iptables-legacy -D DOCKER-USER $r 2>/dev/null || true
      echo "  [ROLLED BACK] $r" >&2
    done
  fi
}
trap cleanup_on_error EXIT

# Insertion: insert missing rules preserving existing ones and guaranteeing exact sequence before RETURN
insert_pos=1
[ "$r1" -gt 0 ] && insert_pos=$((r1 + 1))

for i in 1 2 3 4 5; do
  eval "count=\$c$i"
  if [ "$count" -eq 1 ]; then
    continue  # Rule is pre-existing and in valid relative position; leave it untouched
  fi

  rule="${RULES[$((i-1))]}"
  $SUDO iptables-legacy -I DOCKER-USER "$insert_pos" $rule
  ADDED_RULES+=("$rule")
  echo "[fix-docker-net] ADDED (pos $insert_pos): $rule"
  insert_pos=$((insert_pos + 1))
done

# Re-inspect and verify final state
read -r c1 c2 c3 c4 c5 r1 r2 r3 r4 r5 r_ret <<< "$(inspect_catmatch_rules)"
if ! is_order_perfect; then
  echo "[fix-docker-net] ERROR: Final order verification failed." >&2
  exit 1
fi

# Success: disarm error rollback trap
trap - EXIT
echo "[fix-docker-net] SUCCESS: all 5 rules verified in exact order before RETURN for $NETWORK ($BRIDGE)"
