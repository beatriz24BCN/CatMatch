# CatMatch — Wireframes

Este documento define los wireframes para el MVP de CatMatch y sirve como blueprint visual y funcional para la futura implementación del frontend. Está pensado para guiar a diseñadores y desarrolladores sin incluir código ni activos finales.

## 1. Objetivo

Estos wireframes describen la estructura visual y funcional inicial del MVP antes de la implementación de las interfaces. Establecen la jerarquía de información, componentes clave, flujos de usuario y consideraciones responsive, con la intención de que el equipo de frontend traduzca estas pautas a componentes y vistas concretas respetando la identidad visual de CatMatch.

## 2. Home / Landing

Resumen: la landing presenta a CatMatch, facilita el acceso al matching y destaca la propuesta de valor (adopción responsable potenciada por CatMatch AI). Debe ser moderna, limpia y profesional, con tonos crema/blanco y verde, tarjetas redondeadas, fotografías grandes y espacio para la funcionalidad de AI.

### Header
- Logo CatMatch (izquierda)
- Navegación principal: Inicio, Gatos, Sobre, Cómo funciona
- Enlaces secundarios: Centro de ayuda, Blog (si aplica)
- Botones: Inicio de sesión (link) y CTA principal "Encuentra tu match" (botón destacado)
- Header sticky opcional en scroll

### Hero
- Mensaje principal: titular claro y emocional (ej. "Encuentra al compañero felino perfecto" / "Encuentra un gato compatible contigo")
- Texto descriptivo: una frase que explique brevemente el servicio y su valor
- CTA principal: botón prominente "Encuentra a tu felino" (color verde, enlace directo al catálogo `/adopt`)
- CTA secundario: "Cómo funciona" (estilo secundario, enlace de ancla `/#como-funciona`)
- Imagen principal de gato: fotografía grande y prominente a la derecha o en background con máscara suave
- Tarjeta/elemento visual de CatMatch AI: pequeño panel dentro del hero que muestra un ejemplo de "Compatibilidad" o un micro-visual (por ejemplo, un indicador de MatchScore y un avatar del adoptante)
- Indicador visual de compatibilidad: pequeño medidor o badge sobre la tarjeta de AI que muestre un porcentaje o icono de afinidad

### Estadísticas
- Línea de estadísticas con iconos: Gatos disponibles, Adopciones realizadas, Matches generados
- Datos numéricos con tipografía destacada y microtexto explicativo

### Beneficios
Tres o cuatro tarjetas horizontales o icon cards:
- Matching inteligente — sistema que empareja por personalidad y necesidades
- Conexiones personalizadas — perfiles claros del adoptante y del gato
- Adopción responsable — procesos y verificación
- CatMatch AI — asistente que mejora la precisión del match

### Cómo funciona
Sección en 4 pasos visuales (iconos + breve texto):
1. Crear perfil — datos básicos y preferencias
2. Completar perfil del adoptante — estilo de vida, experiencia, hogar
3. Descubrir matches — lista de gatos compatibles
4. Conocer/adoptar al gato — contacto/solicitud y seguimiento

### Gatos destacados
Grid horizontal o sección de cards destacadas:
Cada card debe contemplar:
- Imagen grande del gato (preferible figura completa o retrato)
- Nombre
- Edad (o rango: p.ej. 2 años)
- Ubicación (ciudad / refugio)
- Características (etiquetas: tranquilo, activo, sociable)
- Compatibilidad (MatchScore visual: barra/punto/porcentaje)
- Favorito (icono corazón, acción rápida)
- Botón/acción: "Ver perfil"

### CatMatch AI (en la landing)
- Sección explicativa con visualización simplificada del matching:
  - Mini-diagrama: Perfil adoptante ↔ Perfil gato → MatchScore
  - Explicación corta sobre qué factores se consideran (personalidad, entorno, necesidades médicas, compatibilidad de convivencia)
  - Pequeño ejemplo con 1-2 razones legibles por qué un gato es compatible

### CTA final
- Sección de cierre con llamada clara: "Cada gato merece un hogar que encaje con él" y botón prominente "Encuentra a tu felino" (enlace a `/adopt`)

## 3. Cat Listing / Gatos en adopción

Vista que prioriza exploración y filtrado.

- Header (consistente con la landing):
  - Título de la página: "Gatos en adopción"
  - Texto introductorio explicativo (sin botón redundante de recomendaciones, consolidando el acceso a la afinidad a través de Matcher)
- Filtros (barra en grid responsiva):
  - Ubicación (búsqueda por texto)
  - Edad (etapas: cachorro, joven, adulto, senior)
  - Nivel de actividad (bajo, medio, alto, muy alto)
  - Acción: "Limpiar filtros"
- Listado / Grid de gatos:
  - Layout en columnas responsivas (3 en desktop, 2 en tablet, 1 en móvil)
  - Cards de gato (`CatTile`) con foto, nombre, edad, ubicación, descripción y botón "Ver ficha"
- Estado vacío resiliente (cuando los filtros no arrojan resultados):
  - Icono y mensaje: "No se encontraron gatos con estos filtros"
  - Texto explicativo y botón de acción rápida: "Ver todos los gatos" (restablece los filtros)
  - Sección de sugerencias felinas directas: bajo el botón, se muestra el título "Quizás alguno te robe el corazón ❤️" y hasta dos tarjetas de gatos reales obtenidas del catálogo general (`GET /api/cats/?limit=2`) para mantener la experiencia de exploración continua sin salir de la vista

## 4. Cat Profile / Perfil del gato

Página dedicada con información completa.

- Imagen principal: gran foto arriba (carrusel opcional si hay varias)
- Nombre del gato (prominente)
- Edad
- Ubicación (refugio/ciudad)
- Personalidad (listado de atributos / etiquetas)
- Características (vacunación, esterilizado, necesidades especiales)
- Descripción larga: historia y notas del cuidador
- Compatibilidad con el adoptante:
  - MatchScore grande y razones resumidas (puntos destacados: por qué es compatible)
  - Comparativa con el perfil del adoptante (lista corta)
- Botón de favorito (acción rápida)
- CTA principal: "Iniciar proceso de adopción" o "Contactar refugio"
- Información adicional: contacto del refugio, detalles logísticos, requisitos de adopción

## 5. User Flow

Flujo esperado (documentar como pasos claros):
1. Registro / Login (email, social opcional)
2. Perfil del adoptante (form con secciones: estilo de vida, experiencia, vivienda, restricciones)
3. Matching (algoritmo ejecuta y muestra lista de matches)
4. Lista de gatos compatibles (Cat Listing filtrada por compatibilidad)
5. Perfil del gato (ver detalles, favoritar, solicitar adopción)
6. Favorito / proceso de adopción (estado de solicitud, mensajes)

Notas: al final de cada paso mostrar acciones siguientes sugeridas (micro-CTAs) y explicar estados intermedios (p.ej. perfil incompleto — mostrar prompt para completar).

## 6. Responsive

Consideraciones generales: mantener jerarquía visual y priorizar acciones principales (CTAs). Usar breakpoints comunes (desktop ≥ 1024px, tablet 768–1023px, mobile ≤ 767px).

- Desktop:
  - Layout amplio con grid para cards y barra lateral de filtros completa
  - Hero con imagen y tarjeta AI lado a lado
  - Estadísticas en línea
- Tablet:
  - Grid reducido (2 columnas para cats)
  - Header compacto (menú hamburguesa opcional)
  - Hero: imagen arriba, texto y CTAs debajo o en una columna
- Mobile:
  - Priorizar CTAs principales en zona visible (fold)
  - Hero simplificado: titular, CTA y una imagen recortada
  - Filtros en un panel deslizable/overlay
  - Cards en 1 columna, acciones grandes y fáciles de tocar

En todas las resoluciones, mantener consistencia tipográfica, espacio y patrones de interacción.

## 7. Componentes previstos

Lista inicial de componentes y su responsabilidad (documental, no implementar ahora):

- Navbar
  - Responsabilidad: navegar entre secciones, acceso a login/CTA principal y estado del usuario
- Hero
  - Responsabilidad: presentar propuesta de valor, CTAs y visual de CatMatch AI
- CTAButton
  - Responsabilidad: botón primario reutilizable, variantes: primary, secondary, ghost
- Stats
  - Responsabilidad: fila de indicadores numéricos con iconos
- FeatureCard
  - Responsabilidad: presentar beneficios/ventajas con icono, título y texto corto
- HowItWorks
  - Responsabilidad: pasos del proceso con iconos y descripciones
- CatCard
  - Responsabilidad: visualización resumida del gato para listados y destacados
- CatGrid
  - Responsabilidad: layout responsivo de CatCard y manejo de paginación/scroll
- MatchScore
  - Responsabilidad: visualización del indicador de compatibilidad (barra, porcentaje, badge)
- AIAssistant
  - Responsabilidad: presentación y explicación del matching AI, razones de compatibilidad
- Footer
  - Responsabilidad: enlaces legales, contacto y redes

Cada componente debe recibir datos y handlers mínimos para mantener separación de responsabilidades (props para datos, callbacks para acciones: ver perfil, favorito, CTA).

## 8. Decisiones de diseño

- Paleta visual general:
  - Fondo: crema / blanco suave
  - Acentos: verde (CTA primary), tonos tierra suaves para microelementos
  - Texto: gris oscuro para cuerpo, negro suave para titulares
- Estilo de tarjetas:
  - Bordes redondeados (8–16px), sombra sutil para elevar tarjetas sobre fondo
  - Uso de imágenes grandes en la parte superior de la tarjeta
  - Espaciado generoso y tipografía legible
  - Panel de compatibilidad (`match-panel` en fichas de resultados): contenedor exterior cálido con fondo melocotón suave (`#FFF1E5`) y borde naranja claro (`#EBCBAF`), enmarcando tarjetas interiores de factores en blanco (`#FFFFFF`) y etiquetas semafóricas (verde, gris neutro y rojo)
- Jerarquía visual:
  - Titulares grandes y CTAs prominentes en hero
  - MatchScore y CTAs de adopción con alto contraste y posición fija en la vista de perfil
- Uso de imágenes:
  - Fotografías grandes y de alta calidad para los gatos
  - Imágenes recortadas con foco en el animal y espacio negativo para texto sobre imagen si es necesario
  - Evitar superponer demasiada información sobre la imagen principal
- CTAs:
  - Primary CTA en verde, secundario en crema/borde
  - CTAs persistentes en mobile para facilitar conversión (barra inferior sticky opcional en perfil)
- Responsive:
  - Mantener la misma jerarquía visual en todas las pantallas: titular → imagen → información clave → CTA
  - Menú y filtros accesibles mediante overlays/panels en mobile
- Papel visual de CatMatch AI:
  - Debe destacarse como elemento de confianza y ayuda (no intrusiva)
  - Representarla con una tarjeta explicativa y ejemplos de "por qué" del match
  - Evitar lenguaje técnico; usar frases claras y concretas sobre beneficios

## 9. Referencia visual

El diseño toma como referencia el boceto proporcionado para CatMatch: un estilo moderno, limpio y profesional asociado a adopción de gatos. La implementación final deberá adaptar esta referencia a la identidad, funcionalidades y arquitectura del proyecto (colores, tipografías, accesibilidad y performance).

---

Revisión de coherencia con el proyecto y backlog:
- El documento prioriza los flujos acordados en el backlog: registro y perfil del adoptante, matching, listado de gatos y perfil detallado.
- No incluye implementación ni decisiones técnicas de frontend; se limita a la especificación visual y de interacción para su traducción a componentes.

Notas finales:
- Este archivo es solo documentación de wireframes. No tocar código ni rutas.
- Cuando el equipo esté listo para implementar, usar estos wireframes como guía para crear componentes reutilizables y respetar la identidad visual.
