# Instrucciones para Copilot — CatMatch

## "Abre el entorno de CatMatch"

Cuando el usuario pida abrir, arrancar o recuperar el entorno de CatMatch:

1. Comprueba que el directorio de trabajo es `/workspaces/CatMatch`.
2. Ejecuta `./scripts/dev-check.sh` (solo lectura). Si termina con código 0 y `All checks passed.`, el entorno ya está listo: no ejecutes nada más.
3. Si falla algún punto, ejecuta `./scripts/dev-up.sh`. Solo hace `docker start` de contenedores existentes que estén parados, añade la regla de red si falta y arranca Next.js si el puerto 3000 está libre. Termina ejecutando `dev-check.sh`.
4. Informa del resultado de cada comprobación por separado. Un HTTP 200 no basta: `dev-check.sh` exige que `/api/cats/` devuelva una lista JSON y que el proxy devuelva lo mismo que el backend.
5. Indica al usuario que abra el frontend en la pestaña **Ports** → puerto **3000** → **Open in Browser**. Usa solo la URL que muestre Codespaces y no inventes ninguna.
6. Si algo falla, explica el error y consulta `docs/CATMATCH_RECOVERY.md` (tabla "Qué hacer si falla cada componente"). No improvises reparaciones.

## Arquitectura (no cambiar sin autorización)

| Servicio | Contenedor / proceso | Puerto Codespace |
|---|---|---|
| Frontend Next.js | `next dev` en `frontend-next/` | 3000 |
| Backend activo | `catmatch-backend-perm` | 8001 (interno 8000) |
| PostgreSQL | `catmatch-db-recover` (red `catmatch-net`, alias `db`) | 5432 |

- El navegador llama a `/api/...` en el puerto 3000 y `frontend-next/next.config.js` lo reenvía a `http://localhost:8001`. No definir `NEXT_PUBLIC_API_BASE` y no añadir CORS por este motivo.
- `catmatch-backend-recover` (puerto 8000) solo sirve `/health`; no usarlo.
- En este Codespace, `iptables-legacy` tiene `FORWARD DROP`, y `scripts/fix-docker-net.sh` añade una regla temporal en `DOCKER-USER` para `catmatch-net`. La regla se pierde al reiniciar Docker o el Codespace.

## Pedir autorización explícita antes de

- Reiniciar o parar cualquier servicio que ya esté activo (contenedores o Next.js).
- Modificar el firewall o ejecutar `fix-docker-net.sh` sin `--check` fuera de `dev-up.sh`.
- Tocar PostgreSQL: arrancar un contenedor nuevo, consultas de escritura, migraciones (alembic), cargar datos o restaurar copias.
- Cualquier operación destructiva: `docker rm`, `docker compose down`, `docker system prune`, `docker volume prune`, borrar volúmenes, recrear contenedores o redes.
- Instalar dependencias (`npm install`, `pip install`).
- Hacer commits o pushes.

## Copias de seguridad (no mover, no modificar, no commitear)

- `.backup/pgdata_backup_*.tar.gz`
- `/home/codespace/catmatch_backups/` (copia de `catmatch_pgdata` y estado de iptables)

No incluir `.backup/`, archivos `.bak`, volcados de bases de datos, contraseñas, tokens ni `.env` en commits.

## Qué no está probado

El arranque desde cero tras un reinicio real de Codespaces o Docker (contenedores parados, sin regla de red, Next detenido) no se ha probado. No lo des por verificado.
