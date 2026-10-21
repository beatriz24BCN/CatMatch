CatMatch — DEV_ENVIRONMENT (short guide)

Purpose
-------
This document describes how to bring up the CatMatch recovery environment in this Codespace
without modifying backups, volumes or business code. It is intentionally conservative.

Overview
--------
- PostgreSQL recovery container: catmatch-db-recover (do not remove or recreate)
- Backend containers: catmatch-backend-perm (active on host:8001), catmatch-backend-recover (on 8000, only /health; not used)
- Frontend: Next.js in frontend-next, dev server on port 3000

Scripts
-------
Helper scripts in scripts/ (full procedure: docs/CATMATCH_RECOVERY.md):
- scripts/dev-up.sh  — idempotent starter: starts existing PostgreSQL and backend containers (docker start, never recreates),
  applies the container network rule via scripts/fix-docker-net.sh, waits for PostgreSQL and launches Next dev if port 3000 is free.
  It finishes by running dev-check.sh.
- scripts/dev-check.sh — read-only checks: network rule, PostgreSQL, backend /health, GET /api/cats/ (backend and through the Next proxy), frontend.
- scripts/fix-docker-net.sh — adds the temporary iptables-legacy DOCKER-USER rule for catmatch-net if missing (--check only reports).

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
   - start catmatch-db-recover and catmatch-backend-perm if they exist but are stopped
   - ensure the container network rule (stops with an error if it fails)
   - wait for PostgreSQL and check backend health on http://127.0.0.1:8001/health
   - start Next dev server on port 3000 if it is not running, WITHOUT NEXT_PUBLIC_API_BASE
     (the browser calls /api/... on port 3000 and frontend-next/next.config.js proxies it to http://localhost:8001)
   - run scripts/dev-check.sh

2) Verify environment at any time (read-only):

   ./scripts/dev-check.sh

3) Open the frontend from the Ports tab (port 3000, Open in Browser).

Manual commands
---------------
- Start an existing container (non-destructive): docker start <container>
- View backend logs: docker logs -f catmatch-backend-perm
- Start Next dev manually (if you prefer; do NOT set NEXT_PUBLIC_API_BASE):
    cd frontend-next
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
