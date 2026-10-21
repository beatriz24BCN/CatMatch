# CatMatch — Recuperación del entorno en GitHub Codespaces

Guía para volver a abrir el Codespace y comprobar que CatMatch está listo para probar el MVP.

Estado: el procedimiento funciona con todos los servicios ya activos. **No se ha probado todavía desde un Codespace recién reiniciado** (ver "Pruebas pendientes").

## 1. Servicios y puertos

| Servicio | Contenedor / proceso | Puerto interno | Puerto del Codespace | Notas |
|---|---|---|---|---|
| Frontend Next.js | `next dev` (proceso en el Codespace) | 3000 | 3000 | Única URL que debe abrir el navegador |
| Backend FastAPI (activo) | `catmatch-backend-perm` | 8000 | 8001 | Sirve `/api/...`; Next lo alcanza por proxy |
| Backend de recuperación | `catmatch-backend-recover` | 8000 | 8000 | Solo `/health`. No usar |
| PostgreSQL | `catmatch-db-recover` | 5432 | 5432 | Red `catmatch-net`, alias `db`, volumen `catmatch_pgdata` |

El navegador llama a `/api/...` en el origen del puerto 3000 y `frontend-next/next.config.js` reenvía esas peticiones a `http://localhost:8001`. Por eso no hace falta reenviar el 8001 ni configurar CORS. No definir `NEXT_PUBLIC_API_BASE`.

## 2. Procedimiento al volver a abrir Codespaces

1. Abrir el Codespace y esperar a que Docker responda (`docker ps`).
2. En una terminal de Codespaces:
   ```bash
   cd /workspaces/CatMatch
   ./scripts/dev-up.sh
   ```
   El script ejecuta en secuencia de forma idempotente y segura:
   1. Comprueba el estado de `catmatch-db-recover`. Si ya está en ejecución (`running`), no lo toca. Si está detenido, intenta arrancarlo (`docker start`, **nunca recrea**). Si falla con error `RWLayer ... is unexpectedly nil`, se detiene de inmediato reportando el fallo sin modificar nada.
   2. Aplica la regla temporal en `iptables-legacy` (`scripts/fix-docker-net.sh`) para permitir el tráfico en la red bridge `catmatch-net`.
   3. Espera a que PostgreSQL esté listo y acepte conexiones (máx. 60 s).
   4. Comprueba `catmatch-backend-perm`. Si está corriendo, no lo toca; si está detenido, intenta arrancarlo con `docker start` (deteniéndose si detecta capa RW rota).
   5. Espera a que el backend responda en `http://127.0.0.1:8001/health` (máx. 60 s).
   6. Si el puerto 3000 está libre, arranca Next.js en segundo plano usando `nohup` y redirección completa (`</dev/null >/tmp/catmatch-next.log 2>&1`), evitando que dependa de la terminal abierta.
   7. Ejecuta automáticamente `./scripts/dev-check.sh` para verificar el sistema de extremo a extremo.
3. Abrir la pestaña **Ports**, localizar el puerto **3000** y usar **Open in Browser**. Usar únicamente la URL que muestre Codespaces. Mantener la visibilidad como privada.

Para solo comprobar en cualquier momento (solo lectura):
```bash
./scripts/dev-check.sh
```

## 3. Cómo saber si está listo

`dev-check.sh` termina con `All checks passed.` y código 0 solo si todo esto es correcto:

- Regla de red presente.
- PostgreSQL acepta conexiones y el backend alcanza `db:5432`.
- Backend `/health` responde.
- `GET /api/cats/` responde 200 con una lista JSON, en el backend y a través del proxy, con el mismo cuerpo.
- El frontend responde y Next no tiene `NEXT_PUBLIC_API_BASE`.

Un 200 no basta: si el cuerpo no es una lista JSON, la comprobación falla. Tampoco garantiza que haya datos: la lista puede estar vacía.

## 4. Qué hacer si falla cada componente

| Fallo | Qué significa | Qué hacer |
|---|---|---|
| `could not start catmatch-db-recover: Docker storage error (RWLayer is unexpectedly nil)` | Error del demonio de almacenamiento de Docker (capa RW perdida tras reinicio) | **DETENERSE**. No recrear contenedores ni tocar volúmenes. Consultar sección 7 y notificar al usuario para evaluar el demonio containerd. |
| `PostgreSQL is not ready` | Arrancó pero no acepta conexiones | `docker logs --tail 50 catmatch-db-recover` |
| `network fix failed` | Sin sudo, red `catmatch-net` ausente o bridge inexistente | Leer el mensaje; no continuar |
| `could not start catmatch-backend-perm: Docker storage error (RWLayer is unexpectedly nil)` | Capa RW del contenedor backend perdida tras reinicio | **DETENERSE**. No recrear automáticamente. |
| `backend not responding` | Contenedor parado o con error | `docker logs --tail 50 catmatch-backend-perm` |
| `/api/cats/` con 500 y PostgreSQL OK | El backend puede conservar conexiones obsoletas | Reiniciar el backend solo con autorización explícita |
| `frontend not responding` | Next parado o aún compilando | `tail /tmp/catmatch-next.log` y repetir `dev-check.sh` |
| `Next was started with NEXT_PUBLIC_API_BASE set` | El navegador saltaría el proxy | Parar ese Next (con autorización) y relanzar `dev-up.sh` |
| Proxy con error o cuerpo distinto | `next.config.js` no aplicado | Reiniciar Next (un cambio en `next.config.js` requiere reinicio) |

## 5. La regla temporal de red

- **Problema:** `iptables-legacy` tiene `FORWARD` en `DROP` y no contiene reglas para `catmatch-net`. Docker gestiona sus reglas en nftables. El tráfico entre contenedores del mismo bridge se descarta y el backend no llega a `db:5432`.
- **Solución:** una regla en la cadena `DOCKER-USER` de `iptables-legacy`: `-i <bridge> -o <bridge> -j ACCEPT`. El bridge se calcula como `br-` + 12 primeros caracteres del ID de `catmatch-net`.
- **Temporal:** se pierde al reiniciar Docker o el Codespace. `dev-up.sh` la vuelve a aplicar.
- **Aplicar a mano:** `./scripts/fix-docker-net.sh`. Solo comprobar: `./scripts/fix-docker-net.sh --check` (código 2 si falta).
- **Revertir:** `sudo iptables-legacy -D DOCKER-USER -i <bridge> -o <bridge> -j ACCEPT` (el script imprime el comando exacto).
- **Alcance:** solo tráfico dentro de `catmatch-net`. No abre puertos hacia fuera ni toca nftables.
- **Origen del problema:** hipótesis sin confirmar (reglas legacy residuales frente a Docker con nftables).

## 6. Copias de seguridad existentes (no mover ni modificar)

- `.backup/pgdata_backup_20261016105345.tar.gz`. No está en Git.
- `/home/codespace/catmatch_backups/pgdata_ro_backup_20261021T102632Z.tar.gz`
  - SHA-256: `1e07d6b6571370eaea65fcd24ba006faed87757525ca8d0282f49a281de2435c` (archivo `.sha256` junto a la copia).
  - Creada leyendo `catmatch_pgdata` en modo solo lectura. Se verificó que el archivo se puede listar y leer; **no** se ha verificado que sea restaurable en PostgreSQL.
- `/home/codespace/catmatch_backups/iptables-legacy_before_*.txt`: estado de iptables antes del cambio.

Las copias están solo en este Codespace. Si se elimina, se pierden.

## 7. Operaciones que nunca se ejecutan automáticamente

Requieren autorización explícita y una copia de seguridad previa:

- Eliminar o recrear contenedores, redes o volúmenes (`docker rm`, `docker compose down -v`, `docker system prune`, `docker volume prune`).
- Recrear PostgreSQL o `catmatch-db-recover`.
- Ejecutar migraciones (alembic) o cargar datos de demostración.
- Restaurar cualquier copia de seguridad.
- Reiniciar el backend o PostgreSQL cuando ya están en marcha.
- Instalar dependencias.

`dev-up.sh` solo hace `docker start`/`unpause` de contenedores existentes y no escribe en la base de datos.

## 8. Pruebas pendientes

1. Arranque desde cero con contenedores parados, sin la regla de red y con Next detenido.
2. `docker start catmatch-db-recover` tras un reinicio real de Codespaces o de Docker.
3. Verificar si el demonio Docker mantiene intacta la capa de escritura (RWLayer) tras sucesivos apagados/encendidos o si requiere diagnóstico a nivel de snapshotter.
4. Si el backend se recupera solo tras reiniciar PostgreSQL.
5. Acceso desde un navegador real por la URL reenviada del 3000.
6. Que `/api/cats/` tenga datos (puede devolver `[]`) y que el flujo completo del MVP funcione.
7. Restaurar una copia en un volumen de prueba y arrancar PostgreSQL con ella.

## 9. Limitaciones

- La regla de red no es persistente; hay que ejecutar `dev-up.sh` tras reiniciar.
- Si Docker vuelve a perder la capa de escritura de los contenedores (`RWLayer nil`), se debe diagnosticar como fallo del demonio de almacenamiento y no recrear automáticamente sin autorización.
- `compose.codespaces.yml` proporciona la definición declarativa exacta del entorno activo (con volúmenes y redes externos), pero no se debe ejecutar con `up -d` a ciegas mientras los contenedores actuales estén activos para evitar recreaciones involuntarias.
- Las copias de seguridad dependen de este Codespace.
- `docker-compose.yml` (backend en el 8000) no refleja este entorno.
- Los scripts tienen la ruta `/workspaces/CatMatch` fija y necesitan `sudo` sin contraseña.
- Los scripts no reenvían puertos ni fijan su visibilidad: eso se hace en la pestaña **Ports**.
- No hay contraseñas ni secretos en este documento; las credenciales viven en el entorno de los contenedores.
