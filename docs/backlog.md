# CatMatch — Backlog de Producto (Épicas e Historias de Usuario)

Este documento define el backlog de producto del MVP de **CatMatch** para GeekFORCE Labs (Semana 1), organizado en épicas e historias de usuario con criterios de aceptación verificables, priorización y su estado de implementación real en el repositorio.

---

## Metodología y Estados

- **P0 — Crítico:** Funcionalidad nuclear del flujo de adopción o requisito bloqueante de seguridad/estabilidad.
- **P1 — Imprescindible:** Requisitos necesarios para completar el flujo funcional o entregables académicos evaluables.
- **P2 — Secundario:** Mejoras de experiencia de usuario, enriquecimiento visual o calidad que no bloquean el flujo.
- **Estados de historia:**
  - `Completada`: Implementada y verificada mediante tests automáticos o comprobación funcional en vivo.
  - `En curso`: Implementada parcialmente o con incidencias pendientes de resolución.
  - `Pendiente`: Planificada pero no implementada en la fase actual.
  - `Pospuesta (Fase 2)`: Fuera del alcance del MVP aprobado en `Prioridades_CatMatch.md`.

---

## Épica 1: Perfil del Adoptante sin Fricción (EP-01)

Objetivo: Permitir que cualquier persona defina su estilo de vida, entorno de convivencia y disponibilidad sin exigir registro previo ni contraseñas.

### US-01: Creación de perfil de adoptante anónimo
- **ID:** US-01
- **Épica:** EP-01
- **Historia:** Como persona interesada en adoptar, quiero completar un formulario sobre mi estilo de vida y vivienda sin tener que crearme una cuenta ni poner contraseña, para poder ver qué gatos encajan conmigo de inmediato y sin barreras de entrada.
- **Prioridad:** P0
- **Dependencias:** Ninguna.
- **Estado:** Completada.
- **Criterios de aceptación:**
  1. El formulario recoge: nivel de actividad (`activity_level`), tipo de vivienda (`home_type`), espacio exterior (`has_outdoor_space`), presencia de niños (`has_children`), presencia de otras mascotas (`has_other_pets`, `other_pets_details`), tiempo fuera de casa (`time_outside`) y tiempo disponible (`time_available`).
  2. No solicita contraseñas ni datos sensibles en este paso.
  3. Al enviar, la API (`POST /api/persons/`) persiste la entidad `Person` generando un UUID y devolviendo código HTTP 201/200.
  4. El frontend almacena el identificador `catmatch_person_id` localmente para enlazarlo con las consultas de matching.

### US-02: Edición y consulta del perfil creado
- **ID:** US-02
- **Épica:** EP-01
- **Historia:** Como adoptante, quiero poder consultar o reajustar los datos de mi perfil si mis circunstancias cambian o deseo ajustar mis preferencias.
- **Prioridad:** P1
- **Dependencias:** US-01.
- **Estado:** Completada.
- **Criterios de aceptación:**
  1. La API expone `GET /api/persons/{person_id}` devolviendo el esquema `PersonRead`.
  2. Si el ID no existe en base de datos, devuelve HTTP 404 con mensaje explicativo.
  3. La interfaz permite regresar desde la vista de resultados a «Crear o editar mi perfil».

---

## Épica 2: Catálogo y Fichas de Gatos (EP-02)

Objetivo: Gestionar y consultar la información completa de los gatos en adopción con atributos relevantes para la convivencia.

### US-03: Catálogo público de gatos en adopción
- **ID:** US-03
- **Épica:** EP-02
- **Historia:** Como persona visitante, quiero ver un listado de gatos disponibles para adopción con sus fotos, edad y ubicación, para conocer a los animales del refugio.
- **Prioridad:** P1
- **Dependencias:** Ninguna.
- **Estado:** Completada.
- **Criterios de aceptación:**
  1. La API expone `GET /api/cats/` con soporte de paginación (`limit`, `offset`).
  2. Devuelve una lista JSON con nombre, edad, fotos (`image_urls`), rasgos de personalidad y ubicación.
  3. La vista principal `/` y `/adopt` muestran los gatos obtenidos de la API real.

### US-04: Ficha detallada del gato
- **ID:** US-04
- **Épica:** EP-02
- **Historia:** Como adoptante, quiero entrar en la ficha individual de un gato para conocer su historia, necesidades médicas, nivel de actividad y carácter antes de solicitar su adopción.
- **Prioridad:** P0
- **Dependencias:** US-03.
- **Estado:** Completada y verificada.
- **Criterios de aceptación:**
  1. Ruta dedicada `/adopt/cat/[id]` que consulta `GET /api/cats/{cat_id}`.
  2. Muestra fotografía con relación de aspecto 4:3 protegida (sin recortes bruscos ni deformaciones), descripción completa, edad, rasgos (chips visuales), nivel de actividad, convivencia con niños/perros, estado de salud y estado de vacunación/esterilización.
  3. Contiene un botón CTA prominente: «Quiero adoptar a este gato» que redirige al formulario de solicitud.
  4. Manejo controlado de identificadores inexistentes (estado vacío y enlace a catálogo) y errores de red.

---

## Épica 3: Matching Inteligente y Explicabilidad (EP-03)

Objetivo: Evaluar la compatibilidad mutua entre persona y gato, ordenando por idoneidad y explicando de forma transparente los motivos de coincidencia o incompatibilidad.

### US-05: Cálculo de compatibilidad bajo demanda (on-demand)
- **ID:** US-05
- **Épica:** EP-03
- **Historia:** Como sistema y como adoptante, quiero evaluar la compatibilidad de mi perfil frente a todos los gatos disponibles en tiempo de consulta sin persistir registros redundantes de Match en base de datos, para obtener recomendaciones siempre actualizadas.
- **Prioridad:** P0
- **Dependencias:** US-01, US-03.
- **Estado:** Completada.
- **Criterios de aceptación:**
  1. Endpoint `POST /api/cats/for_person` acepta `person_id` o el objeto `person` completo.
  2. Evalúa factores clave: compatibilidad con niños (`good_with_children`), compatibilidad con otros animales (`good_with_dogs` / `has_other_pets`), nivel de actividad (`activity_level`), rasgos afines (`personality_overlap`), ubicación y estado de salud.
  3. Retorna cada factor con su resultado booleano/informativo y explicación textual legible.

### US-06: Ordenación por compatibilidad y desempate objetivo
- **ID:** US-06
- **Épica:** EP-03
- **Historia:** Como adoptante, quiero ver a los gatos ordenados de mayor a menor idoneidad, de modo que los gatos con posibles conflictos aparezcan al final.
- **Prioridad:** P0
- **Dependencias:** US-05.
- **Estado:** Completada.
- **Criterios de aceptación:**
  1. Los resultados se ordenan primariamente por menor número de incompatibilidades (`incompatibility_count ASC`).
  2. Como criterio de desempate objetivo, se prioriza el mayor número de rasgos positivos en común (`personality_overlap`).
  3. No se inventan fórmulas matemáticas opacas ni porcentajes ficticios mientras no estén definidos en la especificación de producto.

### US-07: Detección y explicación clara de incompatibilidades críticas
- **ID:** US-07
- **Épica:** EP-03
- **Historia:** Como adoptante, quiero entender con claridad por qué un gato específico no es recomendable para mi hogar (por ejemplo, si tengo niños pequeños y el gato no tolera niños), para evitar adopciones fallidas que perjudiquen al animal y a la familia.
- **Prioridad:** P0
- **Dependencias:** US-05, US-06.
- **Estado:** Completada.
- **Criterios de aceptación:**
  1. Si un factor es incompatible (`match: false`), el resultado general marca `match.recommended = false`.
  2. La tarjeta de resultados (`CatCard.tsx`) resalta en primer lugar los factores desaconsejados con badges de advertencia (`badge-danger`).
  3. El texto explica de forma cualitativa y directa la causa (ej.: «No recomendado: este gato no es apto con niños y has indicado que tienes niños en casa»).

---

## Épica 4: Proceso de Solicitud de Adopción (EP-04)

Objetivo: Facilitar el envío de solicitudes de adopción vinculadas al gato seleccionado y su gestión por parte del equipo protector.

### US-08: Formulario y envío de solicitud de adopción
- **ID:** US-08
- **Épica:** EP-04
- **Historia:** Como adoptante que ha encontrado un gato compatible, quiero rellenar un formulario sencillo con mi email y una carta de motivación para enviar mi solicitud de adopción al refugio.
- **Prioridad:** P0
- **Dependencias:** US-04.
- **Estado:** Completada.
- **Criterios de aceptación:**
  1. Formulario en `/adopt/cat/[id]/request` validando sintaxis de email y capturando mensaje libre opcional.
  2. Se envía mediante `POST /api/adoption_requests/` con `cat_id`, `contact_email`, `message` y vinculación opcional a `person_id`.
  3. La API valida que el `cat_id` exista en base de datos (o retorna 404) y guarda el registro con estado inicial `pending`.
  4. El frontend deshabilita el botón durante el envío para evitar duplicados.

### US-09: Confirmación visual inmediata de la solicitud
- **ID:** US-09
- **Épica:** EP-04
- **Historia:** Como adoptante, quiero recibir una confirmación clara e inmediata en pantalla de que mi solicitud ha sido recibida con éxito, para quedarme tranquilo sabiendo que el refugio se pondrá en contacto.
- **Prioridad:** P0
- **Dependencias:** US-08.
- **Estado:** Completada.
- **Criterios de aceptación:**
  1. Al recibir respuesta HTTP 200/201 del servidor, la vista oculta el formulario y muestra un mensaje de éxito: «¡Solicitud enviada!».
  2. Proporciona instrucciones sobre los siguientes pasos y enlaces para volver al catálogo.

### US-10: Panel de gestión de solicitudes para la protectora (Backoffice)
- **ID:** US-10
- **Épica:** EP-04
- **Historia:** Como gestor o voluntario del refugio, quiero revisar las solicitudes de adopción entrantes y actualizar su estado, para tramitar las adopciones de forma ordenada.
- **Prioridad:** P1
- **Dependencias:** US-08.
- **Estado:** Completada.
- **Criterios de aceptación:**
  1. Vista administrativa en `/admin/adoption-requests` conectada a `GET /api/adoption_requests/`.
  2. Permite actualizar el estado de cada solicitud mediante `PATCH /api/adoption_requests/{req_id}` con estados válidos: `pending`, `reviewing`, `approved`, `rejected`.
  3. Respuestas de error validadas por API si el estado no pertenece al vocabulario permitido (HTTP 400).

---

## Épica 5: Experiencia Visual, Calidad y Rendimiento (EP-05)

Objetivo: Garantizar que la interfaz sea accesible, visualmente impecable, responsive y libre de errores en consola.

### US-11: Presentación del Hero e identidad gráfica
- **ID:** US-11
- **Épica:** EP-05
- **Historia:** Como visitante, quiero ver una cabecera atractiva y sin elementos rotos que comunique el propósito del proyecto y me invite a iniciar el proceso.
- **Prioridad:** P1
- **Dependencias:** Ninguna.
- **Estado:** Completada y verificada.
- **Criterios de aceptación:**
  1. El hero no emite peticiones a recursos ausentes ni genera errores HTTP 404 (eliminada referencia a `hero-cat.jpg` inexistente, preservando la identidad visual con la silueta SVG de marca).
  2. Dispone de favicons válidos (`favicon.ico` y `favicon.svg`) configurados en `Layout.tsx` que eliminan los errores 404 de favicon en el navegador.

### US-12: Seguridad y actualización de dependencias críticas
- **ID:** US-12
- **Épica:** EP-05
- **Historia:** Como equipo técnico, quiero mantener las dependencias del framework actualizadas frente a vulnerabilidades conocidas para garantizar un entorno seguro y confiable.
- **Prioridad:** P0
- **Dependencias:** Ninguna.
- **Estado:** Completada y verificada.
- **Criterios de aceptación:**
  1. Actualizar `next` a la versión corregida oficial (Next.js 16.4.3) en `frontend-next/package.json` y `package-lock.json`.
  2. `npm audit --omit=dev` reporta 0 vulnerabilidades.
  3. Los checks de `./scripts/dev-check.sh` pasan al 100% (código 0, `All checks passed.`).

---

## Épica 6: Segunda Tanda y Funcionalidades Futuras (EP-06)

Objetivo: Funcionalidades identificadas que quedan pospuestas formalmente para la Fase 2 según lo acordado en `Prioridades_CatMatch.md`.

### US-13: Cuentas de usuario, Registro, Login y Protección de Rutas
- **ID:** US-13
- **Épica:** EP-06
- **Historia:** Como usuario o administrador, quiero registrarme e iniciar sesión de forma opcional con credenciales seguras (JWT), para acceder a funcionalidades restringidas según mi rol manteniendo el flujo público accesible sin cuenta.
- **Prioridad:** P1 (Entregable GeekFORCE Labs Semana 2).
- **Estado:** Completada.
- **Criterios de aceptación:**
  1. Endpoints backend operativos: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
  2. Almacenamiento seguro de contraseñas mediante PBKDF2-HMAC-SHA256 y tokens JWT con algoritmo explícito HS256 y expiración.
  3. Soporte para cookies `HttpOnly` y cabeceras `Authorization: Bearer`.
  4. Vistas frontend en `frontend-next/`: `/auth/login`, `/auth/register` y estado de sesión integrado en el Navbar.
  5. Protección de rutas administrativas (`/api/adoption_requests/` y panel `/admin/adoption-requests`) restringidas a administradores (401/403).
  6. Catálogo, matching y solicitudes de adopción permanecen 100% públicos sin cuenta.

### US-14: Historial personal de solicitudes y Favoritos
- **ID:** US-14
- **Épica:** EP-06
- **Historia:** Como adoptante con cuenta, quiero ver el historial de solicitudes enviadas y marcar gatos favoritos con un icono de corazón.
- **Prioridad:** Pospuesta (Fase 2).
- **Estado:** Pendiente / Pospuesta.

### US-15: Asistente de Adopción Responsable potenciado por RAG Local
- **ID:** US-15
- **Épica:** EP-06
- **Historia:** Como persona visitante o adoptante, quiero consultar dudas sobre gatos y el proceso de adopción mediante un asistente conversacional que recupere información oficial fidedigna sin inventar datos.
- **Prioridad:** P1 (Entregable GeekFORCE Labs Semana 3).
- **Estado:** Completada y verificada.
- **Criterios de aceptación:**
  1. Pipeline RAG local basado en Okapi BM25 sin dependencias de pago ni claves externas.
  2. Indexación híbrida de fichas oficiales de gatos (PostgreSQL) y guías del refugio (Markdown).
  3. Endpoint `POST /api/assistant/chat` público que responde con citas a fuentes verificables y enlaces `/adopt/cat/[id]`.
  4. Widget flotante interactivo en frontend accesible desde el Navbar, con cierre y reapertura sin recarga de página.
  5. Cero alucinaciones: las compatibilidades con niños y perros solo se afirman si están documentadas en la base de datos oficial.
  6. Suite de tests automatizados específica en `backend/tests/test_rag.py` y `test_assistant_api.py`.
