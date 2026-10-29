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

Sin `SMTP_HOST`, `SMTP_FROM` y `FRONTEND_BASE_URL`, la solicitud de recuperación responde `503` y no envía correos. Antes de arrancar la versión con recuperación de contraseña debe aplicarse la migración `0004_password_reset` (`alembic upgrade head`), que añade `users.token_version` y la tabla `password_reset_tokens`.

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
