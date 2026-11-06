# Guía de Despliegue en Producción — CatMatch

Este documento describe la arquitectura, configuración de variables de entorno, seguridad, estrategia de CORS y comandos de ejecución para el despliegue de CatMatch en entornos de producción (Semana 4).

---

## 1. Arquitectura de Despliegue

En desarrollo (GitHub Codespaces), el frontend Next.js redirige las peticiones `/api/*` al backend FastAPI (puerto 8001) mediante rewrites en `next.config.js`.

En un despliegue de producción típico existen dos escenarios de arquitectura:
- **Escenario A (Dominio unificado con Reverse Proxy / CDN):** Un balanceador (Nginx, Caddy o Cloudflare) enruta `midominio.com/api` hacia el backend y `midominio.com/` hacia Next.js. Este escenario no requiere CORS.
- **Escenario B (Dominios o subdominios independientes en PaaS):**
  - Frontend: `https://catmatch.vercel.app` (o AWS Amplify / Netlify).
  - Backend API: `https://api.catmatch.com` (o Render / Railway / Fly.io).
  - En este escenario, el frontend define `NEXT_PUBLIC_API_BASE=https://api.catmatch.com` y el backend debe habilitar `CORSMiddleware`.

---

## 2. Variables de Entorno en Producción

### 2.1. Backend FastAPI (`.env` o variables del servicio PaaS)

| Variable | Descripción | Obligatoria en Prod | Ejemplo seguro |
|---|---|:---:|---|
| `DATABASE_URL` | URI de conexión a PostgreSQL gestionado (con SSL si aplica) | **Sí** | `postgresql+psycopg2://user:pass@ep-db.region.postgres.com:5432/catmatch?sslmode=require` |
| `JWT_SECRET_KEY` | Clave secreta larga generada aleatoriamente (mínimo 32 caracteres) para firma HMAC-SHA256 | **Sí** | `openssl rand -hex 32` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Tiempo de expiración del token de sesión (minutos) | Opcional | `60` (por defecto) |
| `ALLOWED_ORIGINS` | Lista de dominios frontend permitidos separados por comas para CORS | Opcional (si Escenario B) | `https://catmatch.vercel.app,https://midominio.com` |
| `env` | Entorno de ejecución (`prod`) | Opcional | `prod` |
| `REMEMBER_ME_EXPIRE_DAYS` | Duración de la sesión con «Recordarme» (días) | Opcional | `30` (por defecto) |
| `FRONTEND_BASE_URL` | URL pública HTTPS del frontend para los enlaces de recuperación | **Sí** (recuperación de contraseña) | `https://midominio.com` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURITY` | Servidor SMTP del proveedor de correo (`starttls` o `ssl`) | **Sí** (recuperación de contraseña) | `smtp.proveedor.example` / `587` / `starttls` |
| `SMTP_USERNAME` / `SMTP_PASSWORD` / `SMTP_FROM` | Credenciales y remitente verificado (como secretos del servicio) | **Sí** (recuperación de contraseña) | — |
| `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES` / `PASSWORD_RESET_MIN_INTERVAL_SECONDS` | Caducidad del enlace y espera mínima entre solicitudes por cuenta | Opcional | `30` / `60` |
| `PASSWORD_RESET_DEV_OUTBOX` | Buzón de recuperación **solo para desarrollo**. Debe ser `false` o no definirse; con `env=prod` se ignora aunque valga `true` | **No usar** | `false` |

Sin `SMTP_HOST`, `SMTP_FROM` y `FRONTEND_BASE_URL`, la solicitud de recuperación responde `503` y no envía correos.

Antes de arrancar en producción deben aplicarse todas las migraciones de base de datos (`alembic upgrade head`):
- `0004_password_reset`: añade `users.token_version` y la tabla `password_reset_tokens` para invalidación y recuperación segura.
- `0005_add_users_name`: añade la columna `users.name VARCHAR(100) NULL` para almacenar el nombre real/preferido del usuario. Las cuentas registradas con anterioridad mantienen `name=NULL` de forma retrocompatible.

*Seguridad:* Nunca incluir contraseñas reales ni claves en `.env.example` ni en el control de versiones Git.

### 2.2. Frontend Next.js

| Variable | Descripción | Obligatoria en Prod | Ejemplo |
|---|---|:---:|---|
| `NEXT_PUBLIC_API_BASE` | URL base del backend público. Omitir si se utiliza el proxy unificado del mismo dominio. | Condicional (Escenario B) | `https://api.catmatch.com` |
| `NODE_ENV` | Modo de ejecución de Node.js | Automática | `production` |

---

## 3. Configuración de CORS en FastAPI (Producción)

Si el frontend y el backend operan bajo dominios distintos, FastAPI debe registrar el middleware de CORS:

```python
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings

origins = [
    origin.strip()
    for origin in getattr(settings, "ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
] or ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
```

---

## 4. Comandos de Compilación y Arranque en Producción

### 4.1. Backend FastAPI
- **Instalación de dependencias de producción:**
  ```bash
  pip install --no-cache-dir -r backend/requirements.txt
  ```
- **Ejecución de migraciones de base de datos:**
  ```bash
  cd backend && alembic upgrade head
  ```
- **Comando de arranque en producción (con workers de Uvicorn):**
  *(Nota: `uvicorn[standard]` está incluido en `requirements.txt`; si se desea `gunicorn` como process manager, debe añadirse al entorno).*
  ```bash
  uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --workers 2
  ```

### 4.2. Frontend Next.js
- **Instalación limpia de dependencias:**
  ```bash
  cd frontend-next
  npm ci
  ```
- **Compilación de producción optimizada:**
  ```bash
  npm run build
  ```
- **Arranque del servidor de producción:**
  ```bash
  npm run start
  # O especificando puerto:
  npx next start -p 3000
  ```

---

## 5. Diferencias entre Entorno Local (Codespaces) y Producción

| Componente | Entorno Local (Codespaces) | Entorno de Producción |
|---|---|---|
| **Base de datos** | Contenedor local `catmatch-db-recover` en red bridge interna | PostgreSQL gestionado (AWS RDS, Supabase, Neon) con copias automatizadas y SSL |
| **API Proxy** | `next.config.js` reescribe `/api/*` a `localhost:8001` sin CORS | Dominio unificado por CDN o `CORSMiddleware` explícito |
| **Claves JWT** | Clave efímera de desarrollo con aviso `UserWarning` | `JWT_SECRET_KEY` aleatoria e inmutable inyectada en variables de entorno |
| **Tokens / Cookies** | Cookie `catmatch_token` con `Secure=False` en HTTP | Cookie `catmatch_token` con `Secure=True` (`https://`) y `SameSite=Lax` |
| **Servidor Frontend** | `next dev` con Turbopack y hot-reloading | `next build` estático/SSR servido con `next start` |

---

## 6. Estado de Verificación para Producción

- **Documentado y probado localmente:** La compilación estricta de Next.js (`npm run build`) y los tests de backend con SQLite en memoria y PostgreSQL pasan al 100%.
- **Pendiente para la puesta en producción real:** Adquirir dominio, aprovisionar la instancia gestionada de PostgreSQL y configurar los certificados TLS/SSL correspondientes.

### 6.1. Revisión de evidencias — Semana 5 (06-11-2026)

La afirmación de pruebas del apartado anterior es un registro histórico, no una ejecución nueva ni una validación de producción. Codespaces es el entorno de desarrollo; sus puertos reenviados no acreditan un despliegue público estable.

**Referencia disponible:** inicialmente se revisó una lista resumida, sin localizar `GeekFORCE Labs.pdf`. El 06-11-2026 la responsable del proyecto aportó en la conversación el texto de «GEEKFORCE LABS — SEMANA 5: Despliegue y Pulido Final», que sustituye esa referencia provisional para esta matriz. No se ha consultado directamente el PDF. El objetivo es desplegar la aplicación en producción accesible públicamente y pulir los detalles finales de calidad. El texto exige desplegar la base de datos en **Supabase**, no solo valorarlo como alternativa.

| Requisito de Semana 5 | Estado | Evidencia y límite |
|---|---|---|
| Desplegar frontend y backend en Vercel, Netlify u otra plataforma compatible | PENDIENTE | Hay instrucciones y servicios de desarrollo operativos; no se ha verificado ninguna URL pública de producción. Los dominios de ejemplo de esta guía no son despliegues acreditados. |
| Desplegar la base de datos en Supabase | PENDIENTE | PostgreSQL local conserva `catmatch_pgdata`. No se ha acreditado un despliegue en Supabase. Las alternativas genéricas descritas en esta guía no sustituyen este requisito de Labs. |
| Variables de entorno de producción | PARCIAL | Plantilla y variables documentadas. SMTP validado en desarrollo; falta comprobar secretos y valores en el proveedor de producción, sin publicarlos. |
| Verificar conexión frontend–backend | PARCIAL | El 06-11 se verificaron HTTP 200 y lista JSON en `/api/cats/`, tanto en backend como en proxy, con cuerpos idénticos. Falta repetir en el despliegue público. |
| Pruebas end-to-end en el entorno desplegado, funcionalidades principales y corrección de errores | PENDIENTE | Las pruebas locales y la recepción de correo comunicada por la usuaria no equivalen a un E2E completo en producción. Falta ejecutar el flujo completo, registrar incidencias y corregir y volver a probar las que se encuentren. |
| Pulido de tipografía, colores, espaciados, iconos, microinteracciones y responsive móvil | PARCIAL | Existen mejoras de Matcher y tarjetas; se ajusta el orden móvil sin cambiar escritorio. El alcance y las limitaciones de validación se registran en el README. Falta revisión visual completa de estos aspectos en dispositivos. |
| Vídeo demo de máximo 3 minutos con las funcionalidades principales | PENDIENTE | No se ha localizado un vídeo ni un enlace de entrega verificable en el repositorio. |
| README con enlace de despliegue, capturas y descripción | PARCIAL | Descripción y documentación disponibles; faltan URL pública verificada y capturas actuales de la aplicación para la entrega. |
| Sesión con el mentor: preparación para Demo Day (60 minutos) | PENDIENTE | No consta evidencia de una demostración completa del despliegue, ensayo de la presentación y recepción de feedback sobre comunicación y narrativa. |

**Entregables exigidos:** aplicación desplegada accesible mediante URL pública, vídeo de demostración grabado y README final con enlace de producción y capturas de pantalla. Ninguno se considera completo solo por disponer de una versión funcional en Codespaces.

### 6.2. Próximos pasos (sin ejecutarlos en esta revisión)

1. Elegir plataformas compatibles para frontend y backend; acordar arquitectura de proxy o dominios separados.
2. Preparar el despliegue de la base de datos en Supabase. Se necesitan acceso al proyecto y autorización para aprovisionar recursos y aplicar el esquema o cargar datos en producción; no incluir credenciales en Git.
3. Con autorización, preparar secretos en los proveedores y la base de producción, revisar TLS, cookies y conectividad. No reutilizar ni intervenir sobre el volumen local para esta tarea.
4. Autorizar y realizar el despliegue; verificar sus URLs reales y ejecutar el flujo E2E: catálogo → Matcher → resultados → ficha → solicitud, además de autenticación y recuperación con una cuenta de prueba autorizada.
5. Completar revisión móvil/escritorio, añadir capturas y URL al README y grabar/publicar el vídeo de hasta 3 minutos.
6. Preparar la sesión de 60 minutos con el mentor: demostración completa del despliegue, ensayo de presentación y registro del feedback sobre comunicación y narrativa.

No se han realizado despliegues ni cambios en producción durante esta revisión.
