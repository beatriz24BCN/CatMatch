CatMatch — DEV_ENVIRONMENT (short guide)

Purpose
-------
This document describes how to bring up the CatMatch recovery environment in this Codespace
without modifying backups, volumes or business code. It is intentionally conservative.

Overview
--------
- PostgreSQL recovery container: catmatch-db-recover (do not remove or recreate)
- Backend containers: catmatch-backend-perm (active on host:8001), catmatch-backend-recover (on 8000)
- Frontend: Next.js in frontend-next, dev server on port 3000

Scripts
-------
Two helper scripts are provided in scripts/:
- scripts/dev-up.sh  — idempotent starter: starts existing containers (docker start) and launches Next dev if needed.
- scripts/dev-check.sh — health checks: confirms backend /health and openapi, Next dev, CORS header presence, and git status.

Principles
----------
- Non-destructive: scripts do NOT recreate or remove containers, do NOT run migrations, do NOT write to DB.
- No secrets written to files. Do not store passwords in the scripts or repo.
- If a required container is missing, the script will report it and will not create it automatically.

How to use (next session)
-------------------------
1) Open the Codespace terminal and run:

   cd /workspaces/CatMatch
   ./scripts/dev-up.sh

   This will:
   - start catmatch-db-recover, catmatch-backend-perm, catmatch-backend-recover if they exist but are stopped
   - check backend health on http://127.0.0.1:8001/health
   - start Next dev server on port 3000 (with NEXT_PUBLIC_API_BASE=http://127.0.0.1:8001) using the local node_modules if present

2) Verify environment:

   ./scripts/dev-check.sh

   The script prints OpenAPI paths (if reachable), checks /health and reports if CORS header is present.

Manual commands
---------------
- Start an existing container (non-destructive): docker start <container>
- View backend logs: docker logs -f catmatch-backend-perm
- Show backend OpenAPI: curl http://127.0.0.1:8001/openapi.json | jq '.paths | keys'
- Start Next dev manually (if you prefer):
    cd frontend-next
    export NEXT_PUBLIC_API_BASE='http://127.0.0.1:8001'
    npm run dev

Notes and troubleshooting
-------------------------
- Do NOT run docker compose down -v, docker system prune, or any destructive Docker disk operations here.
- If Next dev cannot start because node_modules is missing, install deps manually (requires network):
    cd frontend-next && npm install
  Ask for authorization before installing dependencies in this Codespace.
- If the backend does not respond on 8001, check docker logs and DO NOT run migrations or seeds without authorization.

Preparing demo data (requires explicit authorization)
----------------------------------------------------
If the DB is empty, demo data must be inserted under controlled conditions. Do NOT insert demo data without explicit authorization.

Contact
-------
If the host Docker storage shows corruption again (errors about snapshots/digest/rootfs), notify the infra/teaching assistants. This scripts-based recovery relies on existing working images and containers.
