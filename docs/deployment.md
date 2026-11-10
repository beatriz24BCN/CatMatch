# Guía de Despliegue en Producción — CatMatch

Este documento describe la arquitectura, configuración de variables de entorno, seguridad, estrategia de CORS y comandos de ejecución para el despliegue de CatMatch en entornos de producción (Semana 4).

---

## 1. Arquitectura de Despliegue en Producción

CatMatch opera en producción sobre una arquitectura desacoplada de tres servicios gestionados:

| Componente | Proveedor / Servicio | URL / Identificador | Rol en la arquitectura |
|---|---|---|---|
| **Frontend** | Vercel (`catmatch-frontend-next`) | [https://catmatch-frontend-next.vercel.app/](https://catmatch-frontend-next.vercel.app/) | Next.js 16 (Pages Router), React 19, TypeScript. Aplica reescrituras de API (`rewrites()`) en `next.config.js` mediante la variable `BACKEND_URL`. |
| **Backend** | Render (`catmatch-backend`) | [https://catmatch-75g4.onrender.com](https://catmatch-75g4.onrender.com) | FastAPI + Uvicorn ejecutándose en contenedor Docker (`backend/Dockerfile`, puerto 8000, `backend/entrypoint.sh`). |
| **Base de datos** | Supabase (`ocxpapccorgqzziaapwc`) | Región Frankfurt (`eu-central-1`) | PostgreSQL 15 gestionado con Session Pooler y SSL obligatorio (`sslmode=require`). Migraciones Alembic aplicadas hasta `0005_add_users_name`. |

### 1.1. Comunicación Frontend–Backend y estrategia de CORS

En lugar de exponer la API pública de Render directamente al navegador del usuario final y exigir cabeceras complejas de CORS, CatMatch utiliza el **mecanismo de reescritura de Next.js** en Vercel:
1. El navegador realiza todas sus peticiones a rutas relativas (`/api/...`).
2. `next.config.js` reenvía internamente la llamada al servicio de Render definido en la variable de entorno `BACKEND_URL`:
   ```javascript
   const backend = process.env.BACKEND_URL || 'http://localhost:8001';
   return [
     { source: '/api/:path*/', destination: `${backend}/api/:path*/` },
     { source: '/api/:path*', destination: `${backend}/api/:path*` },
   ];
   ```
3. **Ventajas:** No se requiere definir `NEXT_PUBLIC_API_BASE`, no se expone el origen del backend al cliente y se eliminan los bloqueos por CORS en el navegador.

En desarrollo local (GitHub Codespaces), el mismo archivo `next.config.js` utiliza el valor por defecto `http://localhost:8001` hacia el contenedor local `catmatch-backend-perm`.

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
| Desplegar frontend y backend en Vercel, Netlify u otra plataforma compatible | COMPLETADO | Frontend desplegado en **Vercel** (`catmatch-frontend-next` en `https://catmatch-frontend-next.vercel.app/`). Backend desplegado en **Render** (`catmatch-backend` en `https://catmatch-75g4.onrender.com`). |
| Desplegar la base de datos en Supabase | COMPLETADO | Base de datos PostgreSQL alojada en **Supabase** (proyecto `ocxpapccorgqzziaapwc`, región Frankfurt `eu-central-1`) con conexión SSL y migraciones aplicadas hasta `0005_add_users_name`. |
| Variables de entorno de producción | COMPLETADO | Variables configuradas en proveedores (`BACKEND_URL` en Vercel; `DATABASE_URL`, `JWT_SECRET_KEY`, `FRONTEND_BASE_URL`, `PORT`, `env` y credenciales SMTP en Render). Sin credenciales en Git. |
| Verificar conexión frontend–backend | COMPLETADO | Proxy de Next.js mediante `BACKEND_URL` verificado en producción sin requerir CORS directo en el cliente. |
| Pruebas end-to-end en el entorno desplegado, funcionalidades principales y corrección de errores | PARCIAL | Flujo de catálogo, Matcher, resultados, fichas y solicitudes validado; pruebas de autenticación y recuperación de contraseñas verificadas. |
| Pulido de tipografía, colores, espaciados, iconos, microinteracciones y responsive móvil | COMPLETADO | Tarjetas de resultados de Matcher en dos columnas equilibradas (50% / 50%), semáforo cualitativo completo, todos los factores con acordeón de detalles, botón mostrar más/menos y responsive móvil adaptado. |
| Vídeo demo de máximo 3 minutos con las funcionalidades principales | PENDIENTE | Vídeo de demostración funcional para entrega final. |
| README con enlace de despliegue, capturas y descripción | COMPLETADO | README actualizado con tabla de entornos de producción oficiales (Vercel, Render y Supabase), arquitectura de comunicación y especificaciones. |
| Sesión con el mentor: preparación para Demo Day (60 minutos) | PENDIENTE | Demostración completa del despliegue, ensayo de la presentación y recepción de feedback sobre comunicación y narrativa. |

**Entregables exigidos:** aplicación desplegada accesible mediante URL pública, vídeo de demostración grabado y README final con enlace de producción y capturas de pantalla. Ninguno se considera completo solo por disponer de una versión funcional en Codespaces.

### 6.2. Próximos pasos (sin ejecutarlos en esta revisión)

1. Elegir plataformas compatibles para frontend y backend; acordar arquitectura de proxy o dominios separados.
2. Preparar el despliegue de la base de datos en Supabase. Se necesitan acceso al proyecto y autorización para aprovisionar recursos y aplicar el esquema o cargar datos en producción; no incluir credenciales en Git.
3. Con autorización, preparar secretos en los proveedores y la base de producción, revisar TLS, cookies y conectividad. No reutilizar ni intervenir sobre el volumen local para esta tarea.
4. Autorizar y realizar el despliegue; verificar sus URLs reales y ejecutar el flujo E2E: catálogo → Matcher → resultados → ficha → solicitud, además de autenticación y recuperación con una cuenta de prueba autorizada.
5. Completar revisión móvil/escritorio, añadir capturas y URL al README y grabar/publicar el vídeo de hasta 3 minutos.
6. Preparar la sesión de 60 minutos con el mentor: demostración completa del despliegue, ensayo de presentación y registro del feedback sobre comunicación y narrativa.

No se han realizado despliegues ni cambios en producción durante esta revisión.
