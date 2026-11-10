# CatMatch

1. Descripción del proyecto

CatMatch ayuda a encontrar gatos compatibles con el estilo de vida de una persona. El objetivo de la primera tanda (MVP) es permitir que una persona sin cuenta cree un perfil, compare ese perfil con los perfiles de gatos disponibles y obtenga resultados de compatibilidad claramente explicados que le permitan solicitar la adopción desde la ficha del gato.

2. Technology Stack

- **Frontend:** Next.js (React 19, TypeScript, CSS modular) en `frontend-next/`
- **Backend:** FastAPI (Python 3.11 / 3.14) con Pydantic v2 y SQLAlchemy en `backend/`
- **Base de datos:** PostgreSQL 15 con extensiones y soporte JSONB / UUID
- **Migraciones:** Alembic en `backend/alembic/`
- **Contenerización y Red:** Docker, docker-compose (`docker-compose.yml`, `compose.codespaces.yml`) y scripts de red en `scripts/`
- **Tests:** Suite automatizada en `backend/tests/` (ejecución y estado actual en el apartado 10.4)
- **IA / RAG:** Pipeline RAG local (Okapi BM25) y asistente conversacional flotante integrados en la Semana 3 (100% local, sin APIs de pago)

2.1. Estructura del repositorio

```text
/workspaces/CatMatch
├── backend/                  # API FastAPI, modelos, schemas, CRUD, routers y tests
│   ├── alembic/              # Migraciones de base de datos Alembic
│   ├── app/                  # Código fuente de la aplicación (api, crud, models, schemas, services)
│   ├── scripts/              # Scripts auxiliares (p. ej. seed_demo_cats.py)
│   ├── tests/                # Suite de pruebas unitarias e integración (pytest)
│   └── requirements.txt      # Dependencias Python
├── frontend-next/            # Aplicación Next.js (Pages Router)
│   ├── components/           # Componentes UI (Navbar, Layout, CatCard, ProfileForm...)
│   ├── pages/                # Rutas: /, /adopt/profile, /adopt/results, /adopt/cat/[id], /admin/...
│   ├── public/               # Archivos estáticos y fotografías
│   ├── styles/               # Estilos globales y responsive
│   └── package.json          # Dependencias Node.js
├── docs/                     # Documentación técnica y funcional
│   ├── backlog.md            # Backlog de épicas e historias de usuario (Semana 1)
│   ├── data_model.md         # Diseño conceptual del modelo de datos
│   ├── wireframes.md         # Wireframes y blueprint de interfaces
│   ├── Prioridades_CatMatch.md # Alcance funcional aprobado del proyecto
│   ├── DEV_ENVIRONMENT.md    # Guía detallada del entorno de desarrollo
│   └── CATMATCH_RECOVERY.md  # Procedimientos de diagnóstico y recuperación
├── scripts/                  # Scripts de automatización y chequeo del entorno
│   ├── dev-up.sh             # Arranque idempotente y no destructivo del entorno
│   ├── dev-check.sh          # Comprobación de salud de contenedores, red, backend y proxy
│   └── fix-docker-net.sh     # Regla de firewall DOCKER-USER para catmatch-net
├── compose.codespaces.yml    # Especificación declarativa de servicios Docker
├── docker-compose.yml        # Docker Compose base
├── .env.example              # Plantilla de variables de entorno (sin secretos)
└── README.md                 # Este documento
```

2.2. Entorno de producción y URLs oficiales

CatMatch cuenta con un despliegue operativo en producción sobre infraestructura PaaS desacoplada:

| Capa | Proveedor / Servicio | Identificador / URL pública | Configuración y comunicación |
|---|---|---|---|
| **Frontend** | Vercel | `catmatch-frontend-next`<br>[https://catmatch-frontend-next.vercel.app/](https://catmatch-frontend-next.vercel.app/) | Next.js 16 (Pages Router), React 19, TypeScript. Utiliza la variable `BACKEND_URL` para reescribir peticiones `/api/*` hacia Render (`next.config.js`). Las peticiones en navegador usan rutas relativas sin exponer CORS ni requerir `NEXT_PUBLIC_API_BASE`. |
| **Backend** | Render | `catmatch-backend`<br>[https://catmatch-75g4.onrender.com](https://catmatch-75g4.onrender.com) | FastAPI + Uvicorn sobre contenedor Docker (`backend/Dockerfile`, puerto 8000, `entrypoint.sh`). Expone endpoints REST y asistente RAG local. |
| **Base de datos** | Supabase | `ocxpapccorgqzziaapwc`<br>Región Frankfurt (`eu-central-1`) | PostgreSQL 15 gestionado. Conexión segura con SSL (`sslmode=require`) y Session Pooler. Migraciones Alembic aplicadas hasta `0005_add_users_name`. |

3. MVP — Primera tanda (prioridad)

La primera tanda incluye únicamente las siguientes características y entidades, sin cuentas de usuario:

- Entidades: Person, Cat, Match, AdoptionRequest
- Flujo principal: Perfil de persona (sin cuenta) → Perfil de gato → Matching → Resultado (compatibilidad + explicación) → Ficha del gato → Solicitud de adopción

4. Flujo principal (resumen)

- El usuario crea un perfil de persona (sin necesidad de registrarse).
- Se muestran gatos disponibles; el sistema puede ordenar y presentar gatos por compatibilidad con ese perfil.
- Desde la ficha del gato se muestra la explicación de compatibilidad y un CTA "Quiero adoptar a este gato" que abre el formulario de solicitud.
- El formulario envía una AdoptionRequest y retorna confirmación "Solicitud enviada"; los estados posteriores de la solicitud se gestionan en fases posteriores.

5. Matching (planteamiento funcional)

El matching es un componente central del MVP. Su comportamiento funcional es:

- Cruzar los datos de Person y Cat buscando un equilibrio entre ambos — no buscar únicamente igualdad de atributos.
- Tener en cuenta, al menos, los siguientes aspectos:
  - carácter (personality_traits)
  - nivel de actividad (activity_level)
  - estilo de vida / tiempo fuera de casa (work_hours_per_day u otro campo equivalente)
  - vivienda (home_type) y tamaño de vivienda (home_size)
  - espacio exterior (has_outdoor_space)
  - otros animales en el hogar y sus características (other_pets_details)
  - relación del gato con otros animales (good_with_children, good_with_dogs, etc.)
  - independencia / necesidad de compañía del gato
  - necesidades relevantes del gato (health_status / special needs)
- Detectar combinaciones claramente no recomendables basadas en campos estructurados (por ejemplo, incompatibilidades directas entre otros animales y la tolerancia del gato).
- Devolver una recomendación de compatibilidad acompañada de una explicación legible que detalle los factores considerados (por qué se recomienda o no la pareja).

Importante: en la fase inicial se priorizó producir un resultado cualitativo sin inventar porcentajes numéricos ficticios. En la mejora del flujo de adopción, se ha formalizado el **semáforo de compatibilidad de tres estados** en la interfaz:
- 🟢 **Verde (`badge-ok`):** Compatible (`match: true`).
- ⚪ **Gris neutro (`badge-info`):** Factor informativo (`match: null`).
- 🔴 **Rojo (`badge-danger`):** Incompatibilidad confirmada (`match: false`).

Asimismo, la regla de convivencia se aplica de forma simétrica y fidedigna: un hogar sin niños o sin mascotas satisface plenamente las necesidades de un gato que requiere un entorno sin niños o sin mascotas (validado con el caso de Oreo). Se mantiene la recomendación general conservadora (`recommended: None` salvo confirmación de incompatibilidad `recommended: False`), dejando la decisión definitiva al equipo del refugio.

En la vista de resultados (`/adopt/results`), las fichas de recomendación presentan un diseño en dos columnas equilibradas (50% / 50% en escritorio): a la izquierda, el panel de compatibilidad completo con todos los factores evaluados, semáforo visual cualitativo (rojo, verde y gris), desplegables interactivos `<details><summary>Detalles</summary>` que exponen los datos comparados de cada factor y el botón secundario «Ver ficha» centrado en su base; a la derecha, la fotografía apaisada grande 16:9, los datos del animal (nombre jerarquizado a 1.4rem, edad, ubicación), descripción original procedente de la base de datos y el botón principal «Solicitar adopción» centrado en su base. Ambos botones disponen de dimensiones homogéneas (190px de ancho y 44px de altura mínima, garantizando el área táctil recomendada) y quedan alineados visualmente a la misma altura en escritorio. En móvil (≤ 860px), el diseño colapsa a una columna mostrando primero el panel de compatibilidad y la fotografía y ficha a continuación. En esta vista de resultados de Matcher se acota la visualización a cuatro gatos de referencia (**Milo**, **Luna**, **Nube** y **Oreo**), conservando a **Nala** y **Simba** intactos en Supabase y plenamente disponibles en el catálogo general de adopción (`/adopt`).

6. Modelo de datos (primera tanda)

Entidades usadas en el MVP inicial:
- Person
- Cat
- Match (resultado de compatibilidad — puede calcularse on-demand)
- AdoptionRequest

La entidad `User` (cuentas y autenticación) se incorporó en la segunda tanda junto con el registro, inicio de sesión mediante JWT/cookies y recuperación de contraseña, ampliándose posteriormente para incluir el nombre del usuario (`name`). `Favorites` permanece reservado para fases posteriores.

- **Person.time_outside — Tipo: `VARCHAR(100)` — Opcional**  
  Campo cualitativo que describe el tiempo que la persona pasa fuera de casa (por ejemplo: «trabajo principalmente desde casa» o «paso gran parte del día fuera»). No implica que la vivienda quede vacía — puede haber otras personas en el hogar. No debe confundirse con `work_hours_per_day`, que es un dato numérico laboral independiente.

- **Person.time_available — Tipo: `VARCHAR(100)` — Opcional**  
  Campo cualitativo que describe el tiempo que la persona puede dedicar al gato (por ejemplo: «unas horas por la tarde», «mucho tiempo los fines de semana», «disponibilidad limitada»). Es conceptualmente independiente de `time_outside` y de `work_hours_per_day`: `time_available` describe la disponibilidad efectiva para cuidado e interacción con la mascota.

- **Person.personality_traits — Tipo: `JSONB` — Opcional**  
  Los rasgos de la persona se almacenan como JSONB. Consulta `docs/data_model.md` para conocer la documentación disponible sobre su estructura. Los criterios definitivos de compatibilidad y las reglas del matching siguen pendientes de definición.

Ver el diseño detallado: docs/data_model.md

7. Solicitud de adopción (flujo)

- Origen: ficha del gato.
- Acción: botón "Quiero adoptar a este gato".
- Proceso: abrir formulario (contacto, mensaje opcional, vinculación opcional a Person si existe), enviar AdoptionRequest.
- Resultado inmediato: confirmación "Solicitud enviada".
- Estados posteriores (gestión futura): Enviada → En revisión → Aceptada / No aceptada.

Nota: la consulta y gestión de solicitudes (historial, panel administrativo) se implementarán en la segunda tanda.

8. Tareas planificadas para fases posteriores (Semanas 4-6)

- Normalización relacional de `other_pets_details` si se requiere modelo propio.
- Panel de adoptante con historial de solicitudes y lista de Favoritos (marcar gatos con corazón).
- Integración opcional de modelos generativos comerciales (LLM externo) sobre la infraestructura RAG local existente.

9. Estado actual del desarrollo y Verificación (Semanas 1–3)

- **Backend y Base de Datos:**
  - El backend está implementado con FastAPI (Python) estructurado en routers, schemas Pydantic v2, modelos SQLAlchemy y capa CRUD.
  - Base de datos PostgreSQL en contenedor `catmatch-db-recover` (desarrollo local) y Supabase en producción, con migraciones Alembic aplicadas hasta `0005_add_users_name` (head). La migración 0004 incorporó `users.token_version` y la tabla `password_reset_tokens`; la migración 0005 incorporó `users.name VARCHAR(100) NULL` para reflejar el nombre del usuario en el registro y en el Navbar.
  - Tabla `users` implementada con hashing seguro PBKDF2-HMAC-SHA256 (600.000 iteraciones) e índices únicos en `email`.
  - Autenticación JWT mediante tokens firmados HMAC-SHA256 y soporte para cookies `HttpOnly` (`catmatch_token`).
  - «Recordarme» (`remember_me`, opcional, solo `true`/`false`): sin marcar, la cookie es de sesión (se borra al cerrar el navegador) y el token caduca a los 60 min; marcado, la cookie y su token duran `REMEMBER_ME_EXPIRE_DAYS` (30 días). El token largo solo viaja en la cookie `HttpOnly`; el JSON de respuesta siempre contiene el token de 60 min.
  - Recuperación de contraseña («¿Has olvidado tu contraseña?» → `/auth/forgot-password`): el backend genera un token aleatorio (`secrets.token_urlsafe`), guarda solo su hash SHA-256 en `password_reset_tokens`, caduca a los `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES` (30 min) y se consume una sola vez de forma atómica. El enlace del correo lleva el token en el fragmento (`/auth/reset-password#token=…`), que no se envía al servidor ni queda en logs. La respuesta de solicitud es siempre genérica y no revela si el correo existe; solo se admite una solicitud por cuenta cada `PASSWORD_RESET_MIN_INTERVAL_SECONDS` (60 s).
  - Invalidación de sesiones: cada JWT incluye la versión `ver` de `users.token_version`. Al restablecer la contraseña, la versión se incrementa en la misma transacción, por lo que todos los tokens emitidos antes (incluidos los de «Recordarme») dejan de ser válidos.
  - Limitación: no hay revocación individual de sesiones. El logout solo borra la cookie del navegador; un token copiado sigue siendo válido hasta su caducidad, salvo que se restablezca la contraseña o se desactive la cuenta (`is_active=false`). Tampoco hay limitación de solicitudes por IP.
  - Autorización por roles (`user` vs `admin`): protección de endpoints administrativos de solicitudes de adopción (`GET /api/adoption_requests/`, `PATCH /api/adoption_requests/{id}`).
  - Conservación íntegra del flujo público: catálogo de gatos, creación de perfil de adoptante, matching y envío de solicitudes de adopción son 100% accesibles sin cuenta.
  - Seed de datos de prueba (`backend/scripts/seed_demo_cats.py`) cargado con 6 perfiles representativos de gatos (Milo, Nala, Simba, Luna, Nube, Oreo) para pruebas completas de compatibilidad.
  - Pipeline RAG local (`backend/app/services/rag/`) con motor Okapi BM25 e indexación de guías del refugio y fichas oficiales.
  - Endpoint de asistente conversacional público: `POST /api/assistant/chat`.
  - Suite de pruebas automatizadas: pruebas unitarias y de integración en `backend/tests/` ejecutadas y superadas con éxito, incluyendo validaciones específicas de compatibilidad y convivencia en `test_matching.py`.
- **Frontend Next.js:**
  - Desarrollado en Next.js 16.4.3 (Pages Router) y TypeScript en `frontend-next/`.
  - Conexión al backend mediante proxy local en `next.config.js` (`/api/*` reescrito a `http://localhost:8001/api/*`), evitando problemas de CORS en navegador.
  - Vistas funcionales: portada (`/` con CTAs principales «Encuentra a tu felino» dirigiendo directamente al catálogo `/adopt` y botón secundario «Cómo funciona» con ancla `/#como-funciona`), catálogo de adopción con filtros dinámicos y sugerencias felinas en estados sin coincidencias (`/adopt`), creación y edición de perfil (`/adopt/profile`), resultados de matching (`/adopt/results`), ficha detallada de gato (`/adopt/cat/[id]`), formulario de solicitud de adopción (`/adopt/cat/[id]/request`), inicio de sesión (`/auth/login`), registro (`/auth/register`), recuperación de contraseña (`/auth/forgot-password` y `/auth/reset-password`) y panel administrativo (`/admin/adoption-requests`).
  - **Matcher** (`frontend-next/components/ChatAssistant.tsx`): Asistente de compatibilidad accesible desde el Navbar como entrada principal al matching, con extracción de preferencias conversacionales y acceso directo a `/adopt/results`.
- **Matcher Assistant y Flujo Conversacional de Adopción:**
  - *Evolución a Matcher Assistant:* Transformación de Matcher en un asistente conversacional natural y cercano montado en el Navbar como punto de entrada interactivo para visitantes con o sin cuenta.
  - *Conversación progresiva y sin formularios:* Diálogo empático con bienvenida acogedora y preguntas formuladas de una en una adaptadas a las respuestas previas del adoptante, evitando cuestionarios rígidos y repetición de temas.
  - *Interpretación contextual de respuestas cortas:* Reconocimiento contextual de respuestas breves («sí», «no», «ninguna», «tampoco», «tengo un perro», «no tenemos otras mascotas») según el tema de la última pregunta formulada por el asistente (niños, mascotas, vivienda, etc.), eliminando bucles repetitivos y avanzando con fluidez.
  - *Consultas libres con RAG oficial:* Soporte para resolver dudas sobre el proceso de adopción, requisitos, vacunas, adaptación (regla 3-3-3) y cuidados utilizando las fuentes oficiales del refugio, sin volcar listados prematuros ni enlaces de gatos individuales antes de completar la compatibilidad.
  - *Ritmo de matches recurrente y controlado:* Primera oferta de compatibilidad tras acumular **3 respuestas útiles** con información real nueva. Tras pulsar «Seguir hablando», se activan ofertas sucesivas cada **2 respuestas útiles adicionales** (a las 5, 7, 9... respuestas útiles), manteniendo siempre acumuladas todas las preferencias en `localStorage.catmatch_profile_draft`.
  - *Tarjeta visual de compatibilidad simplificada:* Bloque de matches con la animación de búsqueda original de 5 barras (`.assistant-search-card`) y las opciones principales: botón primario **«Ir a tus matches →»** (navega a `/adopt/results`), botón secundario **«Seguir hablando»** (continúa el diálogo sin forzar navegación), **«✎ Cambiar mis preferencias»** y **«↺ Empezar de nuevo»** (con modal de confirmación). Se retiraron opciones redundantes y se ocultó el bloque visual de fuentes en el chat para mantener la interfaz despejada, preservando el RAG intacto internamente.
  - *Catálogo con estado vacío resiliente:* Cuando los filtros no devuelven resultados en `/adopt`, se mantiene el aviso original y el botón «Ver todos los gatos», integrando debajo sugerencias directas con hasta dos gatos reales (`GET /api/cats/?limit=2`) bajo el mensaje «Quizás alguno te robe el corazón ❤️» para ofrecer alternativas reales sin tarjetas ficticias.
  - *Semáforo visual de 3 estados:* Factores coloreados como verde (compatible), gris neutro (informativo) y rojo (incompatibilidad).
  - *Corrección de convivencia (caso Oreo):* Regla simétrica para gatos con necesidades de hogar exclusivo (un hogar sin niños ni mascotas satisface las necesidades de gatos no tolerantes con niños/mascotas).
- **Tipografía, Jerarquía Visual y Accesibilidad:**
  - *Ajuste de jerarquía tipográfica en resultados:* Nombre del gato en las tarjetas de compatibilidad moderado de `1.8rem` a `1.4rem` (`.result-title`) y encabezado del panel elevado a `1.125rem` con semántica accesible `<h3>` (`.match-panel-title`), reequilibrando el protagonismo entre el animal y la evaluación de afinidad.
  - *Unificación de textos secundarios:* Escala simplificada y armoniosa en 3 escalones (`0.92rem` para descripciones y explicaciones, `0.875rem` para metadatos y factores, y `0.8125rem` para insignias y detalles técnicos).
  - *Tipografías declaradas:* Mantenimiento estricto de `Fraunces` como serif declarada en títulos y sans-serif del sistema para el resto de textos e interfaz, sin instalar nuevas fuentes ni dependencias externas.
  - *Acabado visual prémium en tarjetas:* Sombras compuestas de dos capas (`box-shadow: 0 2px 6px ..., 0 8px 22px ...`), elevación sutil de 2px al pasar el cursor y micro-zoom suave del 2% en la fotografía, ambos estrictamente condicionados a `@media (hover: hover)` y respetando `prefers-reduced-motion: no-preference`.
  - *Insignias y factores pulidos:* Insignias de compatibilidad (`.badge`) con borde fino entonado de 1px conservando sus colores originales; bloques de factores (`.factor`) con esquinas redondeadas a 10px y sombra refinada.
  - *Reorganización y área interactiva accesible (44 × 44 px):* Distribución en dos columnas con panel de compatibilidad a la izquierda y fotografía con descripción a la derecha; botón «Ver ficha» centrado en la base izquierda y botón «Solicitar adopción» con sombra de realce centrado en la base derecha. Ambos botones cuentan con dimensiones igualadas (190px de ancho y 44px de altura mínima garantizada), quedando visualmente alineados a la misma altura en escritorio. En móvil (≤ 860px), el diseño colapsa a una columna mostrando la compatibilidad primero y la fotografía y descripción a continuación.

10. Entorno de desarrollo, configuración y ejecución

### 10.1. Requisitos previos
- Docker y Docker Compose (o entorno GitHub Codespaces).
- Node.js >= 20.9.0 (en este Codespace v24.21.0) y npm >= 10.
- Python 3.11 / 3.14.

### 10.2. Variables de entorno (`.env.example`)

Las variables de entorno se definen en el archivo `.env` en la raíz del proyecto (basado en `.env.example`). No almacenar contraseñas reales ni secretos en el repositorio.

| Variable | Finalidad | Obligatoria | Valor por defecto / Ejemplo |
|---|---|---|---|
| `POSTGRES_USER` | Usuario de PostgreSQL para el backend | Sí (si no se define `DATABASE_URL`) | `postgres` |
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL | Sí (si no se define `DATABASE_URL`) | `changeme` (en local) |
| `POSTGRES_DB` | Nombre de la base de datos | Sí (si no se define `DATABASE_URL`) | `catmatch` |
| `DATABASE_URL` | URI de conexión completa a PostgreSQL | Opcional (calculada a partir de los campos anteriores) | `postgresql://user:pass@db:5432/catmatch` |
| `BACKEND_URL` | URL de destino usada por el proxy de Next.js | Opcional | `http://localhost:8001` (por defecto en Next.js) |
| `JWT_SECRET_KEY` | Clave secreta para firma criptográfica HMAC-SHA256 de tokens JWT | Opcional en dev (genera efímera), obligatoria en prod | `cambiar_por_un_secreto_largo_y_aleatorio_en_produccion` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Tiempo de validez del token de acceso JWT en minutos | Opcional | `60` |
| `REMEMBER_ME_EXPIRE_DAYS` | Duración en días de la cookie y el token cuando se marca «Recordarme» | Opcional | `30` |
| `FRONTEND_BASE_URL` | URL pública del frontend usada en el enlace de recuperación (http/https, sin barra final) | Sí para recuperar contraseña | `https://<codespace>-3000.app.github.dev` |
| `SMTP_HOST` / `SMTP_PORT` | Servidor y puerto SMTP del proveedor de correo | Sí para recuperar contraseña (`SMTP_PORT` por defecto `587`) | `smtp.proveedor.example` / `587` |
| `SMTP_SECURITY` | `starttls`, `ssl` o `none` (solo servidores de prueba locales) | Opcional | `starttls` |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | Credenciales SMTP (deben definirse las dos o ninguna) | Según el proveedor | — |
| `SMTP_FROM` | Remitente de los correos | Sí para recuperar contraseña | `CatMatch <no-reply@tu-dominio.example>` |
| `SMTP_TIMEOUT_SECONDS` | Tiempo máximo de conexión SMTP | Opcional | `10` |
| `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES` | Caducidad del enlace de recuperación | Opcional | `30` |
| `PASSWORD_RESET_MIN_INTERVAL_SECONDS` | Espera mínima entre solicitudes de recuperación por cuenta | Opcional | `60` |
| `PASSWORD_RESET_DEV_OUTBOX` | **Solo desarrollo.** Guarda el enlace de recuperación en un buzón en memoria en lugar de enviar correo. Se ignora si `env` no es `dev` o `test` | Opcional | `false` |

**Configurar el correo de recuperación.** Sin `SMTP_HOST`, `SMTP_FROM` y `FRONTEND_BASE_URL`, `POST /api/auth/password-reset/request` responde `503` a todas las solicitudes y no envía nada; el log del backend solo indica los nombres de las variables que faltan. En este Codespace el backend (`catmatch-backend-perm`) no lee ningún `.env`: las variables deben añadirse al servicio del backend en `compose.codespaces.yml` (o a un `env_file` no versionado) y el contenedor debe recrearse para que las use. Recrear el contenedor requiere autorización previa (ver `docs/CATMATCH_RECOVERY.md`). No guardes credenciales SMTP en archivos versionados.

Pasos para probar el envío real (pendiente: todavía no se ha configurado ningún proveedor ni enviado ningún correo real):
1. Obtener del proveedor de correo el host, puerto, modo de seguridad, usuario/contraseña y un remitente verificado.
2. Definir `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURITY`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM` y `FRONTEND_BASE_URL` (la URL del puerto 3000 que muestra la pestaña **Ports**) en el entorno del backend, sin versionar las credenciales, y recrear solo el backend (con autorización): `docker compose -f compose.codespaces.yml up -d --no-deps backend`.
3. Ejecutar `./scripts/dev-check.sh`, solicitar la recuperación desde `/auth/forgot-password` con una cuenta propia y comprobar que el correo llega, que el enlace permite cambiar la contraseña una sola vez y que las sesiones anteriores quedan cerradas.
4. Si la solicitud devuelve `503`, revisar `docker logs catmatch-backend-perm`: solo indica los nombres de las variables que faltan o el tipo de error SMTP.

**Probar la recuperación sin correo (solo desarrollo).** Con `PASSWORD_RESET_DEV_OUTBOX=true` y `env` igual a `dev` (valor por defecto) o `test`, el backend no exige SMTP ni envía correos: el enlace se guarda en memoria del proceso y la página `/auth/forgot-password` muestra un aviso «Modo desarrollo» con el botón **Abrir enlace de recuperación**. Se mantienen la caducidad de 30 minutos, el uso único, la validación de contraseñas y la invalidación de sesiones. El enlace se obtiene mediante `POST /api/auth/password-reset/dev-outbox` (`{"email": ...}`), oculto en OpenAPI y con respuesta `404` si el modo no está activo. Con `env=prod` o cualquier otro valor, el modo queda bloqueado aunque la variable sea `true`, y el backend lo registra al arrancar. Advertencias: cualquiera que acceda al backend puede obtener el enlace de cualquier cuenta y saber si existe, así que no lo actives en un entorno compartido o público; los enlaces se pierden al recargar el backend y no funcionan con varios workers. Como el resto de variables, en este Codespace debe añadirse al servicio del backend y recrear el contenedor (con autorización). Es exclusivamente para desarrollo: debe permanecer en `false` (o sin definir) en producción y no debe quedar activada en `compose.codespaces.yml` ni en ningún commit; tras probarla, quitar la variable y recrear de nuevo solo el backend.

### 10.3. Iniciar y detener CatMatch

El entorno de desarrollo en Codespaces cuenta con scripts conservadores y no destructivos:

**Abrir el entorno de desarrollo:**

```bash
cd /workspaces/CatMatch
./scripts/dev-up.sh
```
*Este script inicia los contenedores existentes sin recrearlos, aplica la regla de red necesaria para Docker, comprueba PostgreSQL y levanta Next.js en el puerto 3000 si está libre.*

Puertos: **3000** (Next.js), **5432** (PostgreSQL) y **8001** (backend). Estado actual, limitaciones tras reiniciar el Codespace y error `RWLayer is unexpectedly nil`: ver [docs/CATMATCH_RECOVERY.md](docs/CATMATCH_RECOVERY.md).

**Cerrar los contenedores Docker:**

Este comando sirve para detener los contenedores de CatMatch:

```bash
docker stop catmatch-backend-perm catmatch-db-recover
```

**Comprobación de salud del entorno (solo lectura):**

```bash
./scripts/dev-check.sh
```
*Verifica que los contenedores estén activos, que PostgreSQL responda, que la API `/api/cats/` devuelva datos y que el proxy de Next.js entregue la respuesta idéntica.*

**Abrir la aplicación en el navegador:**
- Desde la pestaña **Ports** de VS Code / Codespaces, abrir el puerto **3000** (**Open in Browser**).

Para consultar las instrucciones completas, ver [`docs/DEV_ENVIRONMENT.md`](docs/DEV_ENVIRONMENT.md).

### 10.4. Ejecución de pruebas

Para ejecutar la suite de pruebas automatizadas del backend:

```bash
cd /workspaces/CatMatch
DATABASE_URL="sqlite:///:memory:" pytest backend/tests/ -v
```

En este Codespace `pytest` no está instalado en el Python del sistema, así que las pruebas se ejecutan con `unittest` desde la raíz del repositorio:

```bash
cd /workspaces/CatMatch
# Autenticación, «Recordarme» y recuperación de contraseña (incluido el modo de desarrollo sin correo)
DATABASE_URL="sqlite:///:memory:" env=test python3 -m unittest \
  backend.tests.test_auth_api backend.tests.test_password_reset backend.tests.test_password_reset_dev_outbox
# Suite completa: test_assistant_api y test_rag importan pytest y fallan al cargarse sin él (problema del entorno)
DATABASE_URL="sqlite:///:memory:" env=test python3 -m unittest $(ls backend/tests/test_*.py | sed 's#/#.#g; s#\.py$##')
```

Comprobación de tipos del frontend:

```bash
cd /workspaces/CatMatch/frontend-next && npx --no-install tsc --noEmit -p .
```

Las pruebas de recuperación de contraseña usan SQLite en memoria y un servidor SMTP simulado: no envían correos reales.

11. Catálogo de Endpoints de la API

FastAPI expone la documentación interactiva OpenAPI en `http://localhost:8001/docs` y `http://localhost:8001/redoc`.

| Método | Ruta | Finalidad | Código éxito |
|---|---|---|---|
| `GET` | `/health` | Chequeo de salud del servicio | 200 OK |
| `GET` | `/api/cats/` | Listar catálogo de gatos disponibles (soporta paginación `limit`, `offset`) | 200 OK |
| `GET` | `/api/cats/{cat_id}` | Obtener ficha detallada de un gato por UUID | 200 OK / 404 |
| `POST` | `/api/cats/for_person` | Evaluar y ordenar gatos por compatibilidad con un perfil de persona | 200 OK / 404 |
| `POST` | `/api/match/evaluate` | Evaluación atómica de compatibilidad entre un perfil de persona y un gato | 200 OK |
| `POST` | `/api/persons/` | Crear perfil de adoptante anónimo (sin cuenta ni contraseña) | 201 Created |
| `GET` | `/api/persons/{person_id}` | Obtener perfil de adoptante por UUID | 200 OK / 404 |
| `POST` | `/api/adoption_requests/` | Enviar solicitud de adopción para un gato (público sin cuenta) | 201 Created |
| `GET` | `/api/adoption_requests/` | Listar solicitudes registradas (requiere rol de administrador) | 200 OK / 401 / 403 |
| `GET` | `/api/adoption_requests/{req_id}` | Consultar detalle de una solicitud (requiere rol de administrador) | 200 OK / 401 / 403 / 404 |
| `PATCH` | `/api/adoption_requests/{req_id}` | Actualizar estado de solicitud (requiere rol de administrador) | 200 OK / 400 / 401 / 403 |
| `POST` | `/api/auth/register` | Registrar nueva cuenta de usuario con nombre ('name'), email y contraseña (rol estándar 'user') | 201 Created / 409 / 422 |
| `POST` | `/api/auth/login` | Iniciar sesión y emitir token Bearer JWT / cookie HttpOnly | 200 OK / 401 |
| `POST` | `/api/auth/logout` | Cerrar sesión y limpiar cookie de acceso | 200 OK |
| `POST` | `/api/auth/password-reset/request` | Solicitar enlace de recuperación por correo (respuesta genérica) | 202 Accepted / 422 / 503 (correo no configurado) |
| `POST` | `/api/auth/password-reset/confirm` | Establecer contraseña nueva con el token del enlace e invalidar sesiones anteriores | 200 OK / 400 / 422 |
| `GET` | `/api/auth/me` | Obtener perfil del usuario autenticado (id, nombre, email y rol) | 200 OK / 401 |
| `POST` | `/api/assistant/chat` | Conversación con el asistente RAG sobre catálogo y adopción | 200 OK / 422 |

12. Documentación técnica y funcional

- **Backlog de Épicas e Historias de Usuario:** [docs/backlog.md](docs/backlog.md)
- **Alcance Funcional Aprobado:** [docs/Prioridades_CatMatch.md](docs/Prioridades_CatMatch.md)
- **Documentación del Asistente y RAG Local:** [docs/rag-assistant.md](docs/rag-assistant.md)
- **Guía de Despliegue en Producción:** [docs/deployment.md](docs/deployment.md)
- **Modelo de Datos y Vocabularios:** [docs/data_model.md](docs/data_model.md)
- **Wireframes e Interfaces:** [docs/wireframes.md](docs/wireframes.md)
- **Guía de Entorno de Desarrollo:** [docs/DEV_ENVIRONMENT.md](docs/DEV_ENVIRONMENT.md)
- **Protocolo de Recuperación y Contingencia:** [docs/CATMATCH_RECOVERY.md](docs/CATMATCH_RECOVERY.md)

### 12.1. Avances del 5 y 6 de noviembre de 2026

- **Matcher (05-11):** mejoras de respuestas contextuales RAG y del flujo conversacional: preparación de matches con estado de búsqueda, acceso a resultados, cambio de preferencias y reinicio de conversación con confirmación. Se mantienen minimización y reapertura; las preferencias recogidas se combinan con el borrador o perfil existente. Evidencia: commit `3076638` y componente `ChatAssistant.tsx`.
- **Docker, Codespaces y red:** se incorporaron comprobaciones de Docker/containerd, carga privada de variables del backend y reglas granulares para tráfico interno, respuestas, DNS y SMTP. El [registro de validación](docs/CATMATCH_RECOVERY.md#11-registro-de-validación-de-desarrollo--5-y-6-de-noviembre-de-2026) detalla las comprobaciones reales y sus límites, sin publicar credenciales.
- **Correo de recuperación (06-11):** configuración de Brevo cargada en el backend y autenticación STARTTLS aceptada (`235`). Una única solicitud real de recuperación respondió `202`, sin errores SMTP en los logs revisados. La destinataria comunicó posteriormente la recepción del correo; no se consultaron eventos de entrega en Brevo ni se consumió el token. Configuración, autenticación, intento y recepción son evidencias distintas; véase el registro anterior.
- **Responsive de resultados (06-11):** hasta 860px inclusive, cada tarjeta muestra compatibilidad → fotografía → descripción y acciones. Por encima de 860px conserva las dos columnas de escritorio, compatibilidad a la izquierda y foto/ficha a la derecha. Solo cambia el orden CSS móvil; no cambian datos, API, criterios ni porcentajes.

**Validación de este ajuste:** TypeScript pasó con `cd frontend-next && ./node_modules/.bin/tsc --noEmit --incremental false -p .`. Las comprobaciones CSS con PostCSS validaron el orden a 320, 375, 390, 430, 760 y 860px, y estilos idénticos a la versión anterior a 861, 1024 y 1440px. Se verificó el renderizado real de `CatCard` en servidor (React): un solo panel de compatibilidad, fotografía y descripción, en ese orden en el DOM. Son comprobaciones estructurales y de reglas CSS, no una prueba visual en navegador. No hay navegador automatizable disponible en este entorno; quedan pendientes capturas y revisión visual móvil/escritorio. No se repitió la suite de backend ni una compilación de producción para este cambio exclusivamente CSS y documental.

### 12.2. Semana 5 de Labs y entrega

La [matriz de requisitos, evidencias y próximos pasos](docs/deployment.md#61-revisión-de-evidencias--semana-5-06-11-2026) es la referencia única del seguimiento. Se ha actualizado con el texto de Semana 5 de GeekFORCE Labs aportado por la responsable del proyecto el 06-11-2026; no se ha consultado directamente el PDF.

**Pendiente de entrega:** URL pública verificada, base de datos desplegada en **Supabase** (requisito explícito), variables en los proveedores, E2E desplegado con corrección de incidencias, revisión visual completa, capturas actuales y vídeo demo de máximo 3 minutos que muestre las funcionalidades principales. También queda pendiente la sesión de 60 minutos con el mentor para demostrar el despliegue, ensayar la presentación y recibir feedback sobre comunicación y narrativa. No se publica una URL de ejemplo como si fuera un despliegue real.

---

API: POST /api/cats/for_person

Descripción

- Este endpoint devuelve la lista de gatos disponibles evaluados frente a un perfil de persona (sin necesidad de cuenta).
- Entrada: JSON con `person_id` (opcional) o `person` (un objeto con datos de perfil). Debe proporcionarse al menos una de las dos cosas.
  - Si se envía `person_id`, el backend intenta recuperar la persona con `get_person(db, person_id)` (lectura sólo). Si no existe, devuelve 404.
  - Si se envía `person` como objeto JSON, el servidor lo usa tal cual (no se validan todos los campos del schema PersonRead para permitir perfiles mínimos desde el frontend).
- Proceso: el servidor recupera todos los gatos mediante `list_cats(db, limit=1000)` y para cada gato invoca `evaluate_match(person, cat)`.
- Orden: los resultados se ordenan por `incompatibility_count` ascendente, donde `incompatibility_count` es el número de factores devueltos por `evaluate_match` cuyo campo `match` es `false`.
  - No se aplica ningún peso ni umbral adicional; el conteo es la única métrica objetiva usada para ordenar bajo las reglas actuales.

Respuesta (por elemento)

- cat: objeto con los datos del gato (serialización directa del registro retornado por CRUD).
- match: el dict retornado por `evaluate_match`, con la siguiente semántica:
  - recommended: `False` si se detectó una incompatibilidad estructurada que desaconseja la adopción; `None` si no se emite recomendación automática. (No se genera `True` automáticamente bajo las reglas actuales.)
  - explanation: texto legible que resume la conclusión (proviene de evaluate_match).
  - factors: lista de factores analizados; cada factor tiene al menos `type`, `match` (True/False/None), `explanation` y opcionalmente `details`.
- incompatibility_count: entero con el número de factores donde `match == false`.

Interpretación importante

- Un `incompatibility_count` de 0 significa que las reglas actuales no han detectado incompatibilidades estructuradas; NO implica que exista una compatibilidad confirmada.
- Para saber si el sistema explícitamente desaconseja un emparejamiento, comprobar `match.recommended == False`.

POST /api/persons/ (crear perfil de persona)

- Endpoint: POST /api/persons/
- Request: payload que debe ajustarse al schema PersonCreate (el esquema actual exige múltiples campos; ver backend/app/schemas/person.py).
- Response: PersonRead (el backend devuelve la representación creada, incluyendo id y timestamps). Si la validación falla se devuelve 422. Si hay un fallo en persistencia se devuelve 500.
- Nota: el esquema actual de PersonCreate tiene muchos campos sin default; esto hace que la validación espere un conjunto amplio de campos en la petición. Si se desea aceptar un payload mínimo, los schemas deben relajarse.

GET /api/persons/{person_id}

- Endpoint: GET /api/persons/{person_id}
- Response: PersonRead si existe; 404 si no existe.

Ejemplo de petición

POST /api/cats/for_person

{
"person": {
  "id": "00000000-0000-0000-0000-000000000001",
  "activity_level": "low",
  "preferred_cat_traits": ["calm"]
}
}

Ejemplo de respuesta (fragmento)

[
{
  "cat": {"id": "uuid", "name": "Michi", "location": "Shelter"},
  "match": {
    "recommended": null,
    "explanation": "No se detectaron incompatibilidades estructuradas; no se emite una recomendación automática.",
    "factors": [
      {"type": "location", "match": null, "explanation": "Comparación de ubicación (informativa).", "details": {"person_location": "A", "cat_location": "A"}}
    ]
  },
  "incompatibility_count": 0
}
]

---
