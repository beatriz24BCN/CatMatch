# CatMatch — Recuperación del entorno en GitHub Codespaces

Guía para volver a abrir el Codespace y comprobar que CatMatch está listo para probar el MVP.

Arranque habitual:

```bash
cd /workspaces/CatMatch && ./scripts/dev-up.sh
```

Estado (29-10-2026, 18:30 UTC): tras la recuperación de Docker descrita en la sección 10, `./scripts/dev-check.sh` termina con `All checks passed.` Están activos Next.js en el 3000, PostgreSQL en el 5432 y el backend en el 8001; `catmatch-backend-recover` está parado y el 8000 no se usa.

**No está garantizado que el arranque funcione tras reiniciar el Codespace o Docker**: la carrera de arranque de containerd (sección 10) puede repetirse. En ese caso `dev-up.sh` se detiene con un mensaje claro sin modificar nada (ver "Pruebas pendientes").

## 1. Servicios y puertos

| Servicio | Contenedor / proceso | Puerto interno | Puerto del Codespace | Notas |
|---|---|---|---|---|
| Frontend Next.js | `next dev` (proceso en el Codespace) | 3000 | 3000 | Única URL que debe abrir el navegador |
| Backend FastAPI (activo) | `catmatch-backend-perm` | 8000 | 8001 | Sirve `/api/...`; Next lo alcanza por proxy |
| Backend de recuperación | `catmatch-backend-recover` | 8000 | 8000 | Solo `/health`. No usar. Debe estar parado; si aparece en marcha, ver sección 10 |
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
   0. Comprueba (solo lectura) que `dockerd` usa el containerd del sistema (`--containerd /run/containerd/containerd.sock`). Si no es así, se detiene sin arrancar ni cambiar nada (ver sección 10).
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

- `dockerd` usa el containerd del sistema (`--containerd /run/containerd/containerd.sock`; ver sección 10).
- Regla de red presente.
- PostgreSQL acepta conexiones y el backend alcanza `db:5432`.
- Backend `/health` responde.
- `GET /api/cats/` responde 200 con una lista JSON, en el backend y a través del proxy, con el mismo cuerpo.
- El frontend responde y Next no tiene `NEXT_PUBLIC_API_BASE`.

Un 200 no basta: si el cuerpo no es una lista JSON, la comprobación falla. Tampoco garantiza que haya datos: la lista puede estar vacía.

## 4. Qué hacer si falla cada componente

| Fallo | Qué significa | Qué hacer |
|---|---|---|
| `dockerd is not connected to the system containerd` o `could not start …: RWLayer is unexpectedly nil` | `dockerd` arrancó sin conectarse al containerd del sistema; las capas de los contenedores están en otro almacén (no es corrupción) | **DETENERSE**. No recrear contenedores ni tocar volúmenes. Ver sección 10 y pedir autorización para reconectar Docker. |
| `dockerd is not running` | Docker no está en marcha; `dev-up.sh` se detiene antes de arrancar nada | Esperar a que el Codespace termine de iniciar Docker (`docker ps`) y repetir. Si no responde, ver sección 10. No reiniciar Docker sin autorización. |
| `PostgreSQL is not ready` | Arrancó pero no acepta conexiones | `docker logs --tail 50 catmatch-db-recover` |
| `network fix failed` | Sin sudo, red `catmatch-net` ausente o bridge inexistente | Leer el mensaje; no continuar |
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
- `/home/codespace/catmatch_backups/pgdata_cold_20261029T180335Z.tar.gz`
  - SHA-256: `b7045131afe1e5f8fa4be9d9d907b9796865c6dd43de05b78c7e355bb57f2858` (archivo `.sha256` junto a la copia).
  - Copia en frío de `catmatch_pgdata` con PostgreSQL parado. Validada: checksum correcto, mismo número de ficheros (1286) y mismo hash de contenido que el volumen. **No** se ha probado a restaurarla en PostgreSQL.
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
2. `docker start catmatch-db-recover` tras un reinicio real de Codespaces o de Docker. Parcialmente comprobado el 29-10-2026: tras reconectar `dockerd` al containerd del sistema (sección 10), arrancó con su capa original.
3. ~~Verificar si el demonio Docker mantiene intacta la capa de escritura (RWLayer)~~ Diagnosticado: la capa no se pierde; `dockerd` se conecta a otro containerd (sección 10). Queda por ver con qué frecuencia se repite la carrera de arranque.
4. Si el backend se recupera solo tras reiniciar PostgreSQL.
5. Acceso desde un navegador real por la URL reenviada del 3000.
6. Que `/api/cats/` tenga datos (puede devolver `[]`) y que el flujo completo del MVP funcione.
7. Restaurar una copia en un volumen de prueba y arrancar PostgreSQL con ella.

## 9. Limitaciones

- La regla de red no es persistente; hay que ejecutar `dev-up.sh` tras reiniciar.
- Si vuelve a aparecer `RWLayer is unexpectedly nil`, lo más probable es que `dockerd` esté conectado al containerd incorrecto (ver sección 10). No recrear contenedores sin autorización.
- `compose.codespaces.yml` proporciona la definición declarativa exacta del entorno activo (con volúmenes y redes externos), pero no se debe ejecutar con `up -d` a ciegas mientras los contenedores actuales estén activos para evitar recreaciones involuntarias.
- Las copias de seguridad dependen de este Codespace.
- `docker-compose.yml` (backend en el 8000) no refleja este entorno.
- Los scripts tienen la ruta `/workspaces/CatMatch` fija y necesitan `sudo` sin contraseña.
- Los scripts no reenvían puertos ni fijan su visibilidad: eso se hace en la pestaña **Ports**.
- No hay contraseñas ni secretos en este documento; las credenciales viven en el entorno de los contenedores.

## 10. Error `RWLayer is unexpectedly nil`: causa, detección y recuperación

### Causa (confirmada el 29-10-2026)

Al arrancar el Codespace, `/usr/local/share/docker-init.sh` inicia el containerd del sistema (`/etc/containerd/config.toml`, datos en `/var/lib/containerd`) y espera solo unos 5 s a que exista `/run/containerd/containerd.sock`. Si containerd tarda más (el 29-10 tardó 7,4 s), `dockerd` arranca **sin `--containerd`** y lanza su propio containerd (datos en `/var/lib/docker/containerd/daemon`).

Las capas de escritura de `catmatch-db-recover` y `catmatch-backend-perm` están en el almacén del sistema, por lo que Docker no las encuentra: `RWLayer ... is unexpectedly nil`. **No es corrupción** y el volumen `catmatch_pgdata` no se ve afectado. Síntoma adicional: aparece `catmatch-backend-recover` en el puerto 8000 (su capa sí está en el almacén interno).

### Detección segura (solo lectura)

```bash
ps -o args= -C dockerd                                   # correcto: contiene --containerd /run/containerd/containerd.sock
pgrep -a -x containerd                                   # correcto: /usr/bin/containerd --config /etc/containerd/config.toml
grep -c 'starting managed containerd' /tmp/dockerd.log   # correcto: 0
docker ps --format '{{.Names}} {{.Ports}}'               # correcto: sin catmatch-backend-recover en el 8000
```

`dev-up.sh` exige que `dockerd` tenga exactamente `--containerd /run/containerd/containerd.sock` (o `--containerd=/run/containerd/containerd.sock`) antes de arrancar nada y se detiene si no es así; `dev-check.sh` la muestra como `[OK]`/`[FAIL]`. Ninguno de los dos reinicia Docker.

Nota: con el snapshotter de containerd, `GraphDriver` aparece vacío y `State.Error` conserva errores antiguos; no sirven como diagnóstico.

### Recuperación (requiere autorización explícita; no recrea nada)

1. Copia en frío del volumen y validación (checksum, número de ficheros, hash del contenido).
2. Parar el `dockerd` incorrecto: `sudo kill -TERM <PID de dockerd>` (su containerd interno termina con él).
3. Arrancar el containerd del sistema si no está activo, en segundo plano:
   `sudo /usr/bin/containerd --config /etc/containerd/config.toml`.
   Comprobar: `sudo ctr -n moby snapshots ls` muestra las capas de los contenedores.
4. Arrancar `dockerd` conectado a él, en segundo plano:
   `sudo dockerd --containerd /run/containerd/containerd.sock --dns 168.63.129.16`.
5. Comprobar `ps -o args= -C dockerd` y que el volumen no ha cambiado.
6. Ejecutar `./scripts/dev-up.sh` una vez (vuelve a aplicar la regla de red, que se pierde al reiniciar Docker).

Si Docker no arranca: volver a lanzar `sudo dockerd --dns 168.63.129.16` (estado anterior) o `/usr/local/share/docker-init.sh`. Si aun así no funciona, detenerse: **no** recrear contenedores ni restaurar copias.

### Limitación

El fallo está en `docker-init.sh`, fuera del repositorio, y puede repetirse en cualquier reinicio del Codespace o de Docker. En la recuperación del 29-10, `dockerd` y `containerd` se lanzaron a mano y registran en `/tmp/dockerd-manual.log` y `/tmp/containerd-manual.log`.
