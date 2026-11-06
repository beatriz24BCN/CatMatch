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
   0. Comprueba que `dockerd` usa el containerd del sistema (`--containerd /run/containerd/containerd.sock`). Si no está corriendo o arrancó con el containerd erróneo, realiza una reconciliación segura y no destructiva:
      - Verifica que no haya ningún contenedor activo usando `catmatch_pgdata`.
      - Asegura que el containerd del sistema esté activo con `/etc/containerd/config.toml`.
      - Verifica que los snapshots originales (`93c7ef03e6d5...`) existan en el containerd del sistema antes de reiniciar nada (si no existen, se detiene para proteger el estado).
      - Si dockerd estaba corriendo con el socket incorrecto, lo detiene con SIGTERM y lo relanza conectado a `/run/containerd/containerd.sock`.
      - Si `catmatch-backend-recover` estuviera activo en el 8000, lo detiene para evitar conflictos de puerto.
   1. Comprueba el estado de `catmatch-db-recover`. Verifica estrictamente que esté montado sobre el volumen `catmatch_pgdata` (aborta si no es así). Si ya está en ejecución (`running`), no lo toca. Si está detenido, intenta arrancarlo (`docker start`, **nunca recrea**).
   2. Aplica la regla temporal en `iptables-legacy` (`scripts/fix-docker-net.sh`) para permitir el tráfico en la red bridge `catmatch-net` (idempotente: no duplica la regla).
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

- **Problema:** `iptables-legacy` tiene `FORWARD` en `DROP` y no contiene reglas para `catmatch-net`. Docker gestiona sus reglas en nftables. El tráfico entre contenedores del mismo bridge se descarta y el backend no llega a `db:5432`, ni puede resolver DNS ni conectar con servicios SMTP externos como Brevo.
- **Solución:** reglas granulares en la cadena `DOCKER-USER` de `iptables-legacy` insertadas **estrictamente antes de `-j RETURN` y en este orden exacto**:
  1. Tráfico interno del bridge: `-i <bridge> -o <bridge> -j ACCEPT` (FastAPI <-> PostgreSQL).
  2. Respuestas entrantes para conexiones establecidas/relacionadas: `-o <bridge> -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT`.
  3. Consultas DNS salientes UDP puerto 53 restringidas al servidor DNS del entorno (`168.63.129.16`): `-i <bridge> ! -o <bridge> -d <dns_server> -p udp --dport 53 -j ACCEPT`.
  4. Consultas DNS salientes TCP puerto 53 restringidas al servidor DNS del entorno (`168.63.129.16`): `-i <bridge> ! -o <bridge> -d <dns_server> -p tcp --dport 53 -j ACCEPT`.
  5. Conexión SMTP saliente TCP puerto 587 para el relay de Brevo: `-i <bridge> ! -o <bridge> -p tcp --dport 587 -j ACCEPT`.
- **Temporal:** se pierde al reiniciar Docker o el Codespace. `dev-up.sh` la vuelve a aplicar.
- **Aplicar a mano:** `./scripts/fix-docker-net.sh`. Solo comprobar: `./scripts/fix-docker-net.sh --check` (código 2 si falta).
- **Revertir:** ejecutar manualmente `sudo iptables-legacy -D DOCKER-USER <regla>` para cada una de las reglas administradas que se desee retirar.
- **Alcance:** tráfico interno entre contenedores de `catmatch-net` y salida exclusiva para DNS (puerto 53) y SMTP Brevo (puerto 587). No abre puertos indiscriminadamente, no elimina reglas ajenas y no toca nftables.
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

`dev-up.sh` comprueba que `dockerd` tenga exactamente `--containerd /run/containerd/containerd.sock` (o `--containerd=/run/containerd/containerd.sock`). Si detecta que no está conectado o que está detenido, ejecuta una reconciliación automática, segura y no destructiva descrita abajo; `dev-check.sh` muestra el estado como `[OK]`/`[FAIL]`.

Nota: con el snapshotter de containerd, `GraphDriver` aparece vacío y `State.Error` conserva errores antiguos; no sirven como diagnóstico.

### Recuperación automática (integrada en `dev-up.sh`)

Al ejecutar `./scripts/dev-up.sh`, el script realiza los siguientes pasos de seguridad antes de intervenir:
1. Comprueba si algún contenedor está usando activamente `catmatch_pgdata` bajo el daemon actual (si es así, se detiene para evitar interrupciones no deseadas).
2. Asegura que el containerd del sistema esté activo con `/etc/containerd/config.toml` y respondiendo en `/run/containerd/containerd.sock`.
3. Comprueba que las capas originales (`93c7ef03e6d5...`) existan en el containerd del sistema; si no existen, aborta sin reiniciar Docker.
4. Si dockerd estaba corriendo con el socket incorrecto, lo detiene con `SIGTERM` y lo arranca con `--containerd /run/containerd/containerd.sock --dns 168.63.129.16`.
5. Si `catmatch-backend-recover` estuviera activo en el 8000, lo detiene para evitar conflictos de puerto.

### Recuperación manual de referencia (no recrea nada)

Si se desea ejecutar el procedimiento paso a paso a mano:
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

## 11. Registro de validación de desarrollo — 5 y 6 de noviembre de 2026

Este registro conserva las comprobaciones realizadas; no garantiza un arranque desde cero tras reiniciar Codespaces o Docker.

- **05-11:** los commits `bef21eb` y `3076638` incorporan la reconciliación de Docker/containerd con comprobaciones previas, la carga de variables privadas mediante `env_file` en el backend y las cinco reglas granulares DNS/SMTP descritas en la sección 5. No se guardan secretos en esta documentación.
- **06-11, diagnóstico de solo lectura:** backend y PostgreSQL activos, volumen original `catmatch_pgdata`, PostgreSQL aceptando conexiones y backend alcanzando `db:5432`. `/health` respondió HTTP 200 con `status: ok`. El catálogo devolvió una lista JSON por backend y proxy, con cuerpos idénticos; frontend HTTP 200 y sin `NEXT_PUBLIC_API_BASE` no vacío.
- **Red:** resolución de `smtp-relay.brevo.com` y conexión TCP al puerto 587 correctas desde el backend. `fix-docker-net.sh --check` terminó con código 0: cinco reglas únicas en orden antes de `RETURN`. No se modificó el firewall durante ese diagnóstico.
- **Alcance de `dev-check.sh`:** no se ejecutó literalmente en la revisión de solo lectura del 06-11 porque crea archivos temporales. Se ejecutaron comprobaciones funcionales equivalentes en memoria, satisfactorias. Esto no se registra como una ejecución nueva del script.

### Brevo: configuración, autenticación e intento real

1. Se corrigió únicamente el usuario SMTP local para usar el identificador de Brevo en lugar del correo personal, conservando contraseña, remitente y todas las demás variables. El archivo privado continúa excluido de Git.
2. Se detectó que el proceso del backend aún conservaba el usuario anterior. Con autorización explícita, se recreó **solo el backend** mediante `docker compose -f compose.codespaces.yml up -d --no-deps --no-build --pull never --force-recreate backend`. Esta es una intervención histórica, no una instrucción para repetirla sin autorización.
3. Se confirmó el usuario actualizado en el proceso, la presencia de contraseña y remitente sin mostrarlos, STARTTLS con certificado validado y autenticación SMTP aceptada por Brevo (código `235`). Esta prueba no envió correos.
4. Con autorización adicional se realizó **una sola petición**, sin reintentos, a `POST /api/auth/password-reset/request`: HTTP `202`. Los logs de la ventana revisada no mostraron errores SMTP. El envío es una tarea en segundo plano y el código actual no registra la respuesta positiva de aceptación del mensaje; `202` no prueba aceptación SMTP ni entrega.
5. Después, la usuaria confirmó en la conversación haber recibido el correo de recuperación. Se registra como **recepción real comunicada por la destinataria**, no como comprobación independiente del buzón ni como evento de entrega consultado en Brevo. No se accedió a dev-outbox ni se consumió el token ni se cambió la contraseña.

PostgreSQL no se reinició durante la actualización autorizada del backend y mantuvo su volumen. En la tarea documental y responsive posterior no se recrean ni detienen servicios y no se envían más correos. La entrega en un futuro entorno de producción sigue pendiente de prueba.

## 12. Recuperación completa y validada tras reinicio — 6 de noviembre de 2026

El 6 de noviembre de 2026 se diagnosticó y resolvió con éxito una interrupción del entorno provocada por el reinicio de Codespaces/Docker.

### Causa raíz identificada

1. **Desalineación entre dockerd y el containerd del sistema:** Al arrancar el entorno, `/usr/local/share/docker-init.sh` inició el daemon como `dockerd --dns 168.63.129.16` sin pasar el parámetro `--containerd /run/containerd/containerd.sock`. Debido a esto, Docker utilizaba un almacén interno donde no existían las capas de escritura (`RWLayer`) de `catmatch-db-recover` ni de `catmatch-backend-perm`, impidiendo su arranque.
2. **Pérdida de reglas de red en iptables:** Las reglas en la cadena `DOCKER-USER` de `iptables-legacy` no son persistentes y se habían borrado tras el reinicio, bloqueando la comunicación interna y hacia el exterior.
3. **Servicios dependientes detenidos:** Next.js no estaba en ejecución en el puerto 3000 y el contenedor legacy `catmatch-backend-recover` ocupaba el puerto 8000.

### Procedimiento de recuperación ejecutado

1. **Copias de seguridad verificadas:**
   - Se validó la copia en frío previa `pgdata_cold_20261105T112223Z.tar.gz` mediante su checksum SHA256.
   - Con los contenedores detenidos, se generó una copia en frío adicional preventiva: `pgdata_cold_20261106T141210Z.tar.gz` en `/home/codespace/catmatch_backups/`, verificando inmediatamente su integridad con SHA256 (`OK`) y descompresión de prueba (`tar -tzf: OK`).
2. **Ejecución de `scripts/dev-up.sh`:**
   - Reconciliación de containerd: detención limpia del dockerd desalineado mediante `SIGTERM` y arranque automático conectado a `/run/containerd/containerd.sock` con DNS `168.63.129.16`.
   - Detención segura del contenedor legacy `catmatch-backend-recover` (liberando el puerto 8000).
   - Verificación de seguridad de que `catmatch-db-recover` monta estrictamente el volumen original `catmatch_pgdata`.
   - Arranque ordenado de PostgreSQL (`docker start catmatch-db-recover`) y confirmación de disponibilidad con `pg_isready`.
   - Aplicación ordenada de las 5 reglas de red granulares mediante `scripts/fix-docker-net.sh`.
   - Arranque del backend activo (`docker start catmatch-backend-perm`) y verificación de salud en el puerto 8001 (`/health`).
   - Arranque en segundo plano de Next.js en `frontend-next/` sobre el puerto 3000 con `NEXT_PUBLIC_API_BASE` desarmado.
3. **Verificación final integral:**
   - La suite de comprobaciones `scripts/dev-check.sh` se ejecutó al cierre confirmando:
     - Docker conectado al containerd del sistema (`/run/containerd/containerd.sock`).
     - PostgreSQL activo sobre `catmatch_pgdata` con los 6 gatos del catálogo intactos.
     - Backend respondiendo 200 en `http://127.0.0.1:8001/health` y `/api/cats/`.
     - Next.js respondiendo 200 en `http://127.0.0.1:3000/`.
     - Proxy inverso `/api/cats/` en el puerto 3000 devolviendo un cuerpo JSON **idéntico** al backend.
     - Conservación íntegra de la configuración SMTP y Brevo (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURITY`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, `FRONTEND_BASE_URL`) cargada en el proceso del backend sin exponer valores sensibles.
     - Todas las comprobaciones en verde: **`All checks passed.`**

---

## 13. Procedimiento habitual de inicio del entorno

Tras cualquier reinicio de Codespaces, parada o desconexión del entorno Docker, el procedimiento estándar, seguro y no destructivo para recuperar todos los servicios de CatMatch es:

```bash
cd /workspaces/CatMatch
./scripts/dev-up.sh
```

> **Aviso de seguridad:**
> Este script es idempotente y no destructivo: comprueba las capas, reconcilia containerd si es necesario, monta el volumen original sin escribir en él, restaura las reglas de red y levanta el backend y Next.js.
> 
> Si por alguna razón `./scripts/dev-up.sh` o `./scripts/dev-check.sh` arrojan algún fallo, **NO realices intervenciones manuales ni destructivas** (no uses `docker compose down -v`, no ejecutes `docker system prune`, no elimines volúmenes ni recrees contenedores). Consulta el diagnóstico de error en la tabla de contingencia de este documento y realiza una copia de seguridad en frío antes de cualquier diagnóstico avanzado.

