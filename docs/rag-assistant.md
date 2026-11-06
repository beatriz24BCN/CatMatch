# CatMatch — Documentación Técnica del Sistema RAG y Matcher

Este documento detalla la arquitectura, algoritmos, fuentes y endpoints del **Pipeline RAG local** y el asistente **Matcher (Guía de Compatibilidad)** implementados en CatMatch (Semanas 3 y 4).

---

## 1. Objetivo y Filosofía de Diseño

**Matcher** ofrece una experiencia conversacional guiada para visitantes (con o sin cuenta) que actúa como punto de entrada al sistema de compatibilidad de CatMatch. Permite explorar el catálogo, resolver dudas sobre adopción responsable y conectar las preferencias del adoptante con el motor de matching.

### Principios Fundamentales:
1. **Separación estricta entre RAG y Matching:**
   - **Motor de Matching (`/api/cats/for_person`):** Evalúa deterministamente el perfil completo de una persona contra el 100% de los gatos del catálogo en `/adopt/results`.
   - **Asistente RAG (`/api/assistant/chat`):** Herramienta conversacional y exploratoria que responde preguntas en lenguaje natural y sugiere fichas afines basándose en las evidencias recuperadas.
2. **Cero Alucinaciones:** Las recomendaciones solo afirman características (convivencia con niños, perros, nivel de energía) si están explícitamente documentadas en los datos oficiales de la base de datos o en las guías del refugio.
3. **Privacidad Total:** No se crean perfiles permanentes en la base de datos `persons` al interactuar con el chat. La memoria conversacional es efímera y reside en el cliente.
4. **Cero Dependencias de Pago:** Funciona de forma 100% local y autónoma mediante Okapi BM25 sin requerir APIs externas de pago.

---

## 2. Arquitectura del Pipeline RAG

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Entrada de Usuario / Chat                    │
│   (Historial reciente + Mensaje actual: "Piso con niños")       │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│               Extracción de Intención y Léxico                  │
│  - Tokenización y normalización (minúsculas, acentos, eñes)     │
│  - Filtrado de palabras vacías (stopwords en español)           │
│  - Diccionario de equivalencias (minino -> gato, etc.)          │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Motor de Recuperación BM25                   │
│  - Ranking probabilístico Okapi BM25 (k1=1.5, b=0.75)           │
│  - Umbral mínimo calibrado (score >= 0.20 y >= 25% del líder)   │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Documentos relevantes
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Filtro de Seguridad de Convivencia              │
│  - Exclusión estricta de gatos no aptos con niños si hay niños  │
│  - Exclusión estricta de gatos no aptos con perros si hay perro │
│  - Priorización de actividad baja/media para pisos/tranquilidad │
│  - Contexto de proximidad geográfica si indica ciudad           │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│               Generación de Respuesta con Citas                 │
│  - Atributos reales: edad en español, raza, ubicación           │
│  - Compatibilidad: confirmada, no apta o pendiente de valorar   │
│  - Enlaces Markdown funcionales: [Ver ficha oficial](/adopt/...)│
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Fuentes de Información Indexadas

El índice RAG (`RAGDocument`) combina dos fuentes complementarias:

### 3.1. Fichas Oficiales de Gatos (PostgreSQL `cats`)
Se extraen dinámicamente mediante SQLAlchemy en `backend/app/services/rag/indexer.py`:
- Nombre, edad (`age_stage` y `age_months`), raza y ubicación.
- Rasgos de personalidad oficiales (`personality_traits`).
- Convivencia evaluada: niños (`good_with_children`) y perros (`good_with_dogs`).
- Nivel de energía (`activity_level`).
- Descripción del refugio.

### 3.2. Guías de Adopción Responsable (`backend/data/shelter_docs/`)
Documentos estructurados en Markdown:
- `adopcion_responsable.md`: Proceso de adopción, habitación de bienvenida, protección de ventanas y regla de adaptación de los 3 días, 3 semanas y 3 meses.
- `convivencia_mascotas.md`: Protocolos de separación olfativa, contacto visual y presentación gradual con perros y convivencia con niños.

---

## 4. Endpoint de la API

### `POST /api/assistant/chat`

- **Acceso:** Público (sin autenticación requerida).
- **Esquema de Entrada (`ChatRequest`):**
  - `message` (string, 1-1000 caracteres, obligatorio).
  - `history` (lista de `ChatMessage` con `role` y `content`, opcional).
- **Esquema de Salida (`ChatResponse`):**
  - `response` (string con texto contextualizado, citas y enlaces Markdown).
  - `sources` (lista de objetos `SourceCitation` con `title`, `source_type`, `url` y `snippet`).
  - `suggested_cat_ids` (lista de UUIDs de gatos sugeridos).

---

## 5. Componente Frontend: Matcher

- **Ubicación:** `frontend-next/components/ChatAssistant.tsx`.
- **Integración:** Montado en `Layout.tsx` y accesible como punto de entrada principal desde el botón «🐱 Matcher» en el `Navbar.tsx`.
- **Características:**
  - Panel flotante responsive anclado en la esquina inferior derecha con encabezado «Matcher — Compatibilidad».
  - Botón visible «✕» de cierre y reapertura sin recarga de página.
  - Parseo de enlaces Markdown a componentes `<Link>` nativos de Next.js.
  - Sugerencias rápidas de convivencia (*«Busco un gato tranquilo para piso»*, *«Tengo niños en casa»*, *«Convivo con perro u otra mascota»*, *«¿Cómo funciona la adopción?»*).
  - Barra de acción integrada: *«¡Encuentra a tu compañero ideal! Descubre tus gatos compatibles y da el primer paso hacia la adopción»* con botón *«Ver mis matches →»*.
  - Extracción cliente de preferencias (`extractPreferencesFromMessages`): analiza el diálogo (ubicación, niños, mascotas, nivel de actividad y rasgos) y lo almacena en el borrador local (`catmatch_profile_draft`) o sincroniza un perfil anónimo para evaluar el catálogo en `/adopt/results` sin exigir registro previo.

---

## 6. Pruebas y Validación

El pipeline RAG y el asistente disponen de tests automatizados dedicados en:
- `backend/tests/test_rag.py`: Comprueba el algoritmo BM25, carga de guías, expansión léxica y priorización de documentos.
- `backend/tests/test_assistant_api.py`: Comprueba el endpoint público, validaciones de entrada, formato de edad en español, citas de fuentes y exclusión de gatos incompatibles.

---

## 7. Alcance Comprobado y Limitaciones Pendientes

- **Funcionalidades comprobadas:**
  - Diálogo conversacional guiado con RAG local sin dependencias externas de pago.
  - Citas oficiales fidedignas y enlaces directos a fichas (`/adopt/cat/[id]`).
  - Extracción de intenciones y preferencias del chat hacia la vista de recomendaciones `/adopt/results`.
  - Acceso al matching completo sin registro previo obligatorio.
- **Limitaciones pendientes:**
  - La extracción de preferencias en el cliente utiliza reglas de reconocimiento léxico e intenciones; el formulario detallado en `/adopt/profile` sigue estando disponible para usuarios que prefieran definir un perfil cuantitativo completo paso a paso.
