**Título: CatMatch — Planteamiento funcional y flujo de la aplicación**

Después de ir definiendo la idea de CatMatch, he concretado mejor cuál quiero que sea la funcionalidad principal de la aplicación, qué información necesito recoger y cómo quiero que sea el recorrido de una persona desde que entra en la web hasta que inicia una solicitud de adopción.

La idea principal de CatMatch es intentar encontrar gatos que puedan encajar con la persona que quiere adoptar, teniendo en cuenta su forma de vida, su carácter y el entorno en el que vive.

El objetivo no es simplemente mostrar gatos, sino intentar encontrar una combinación que pueda funcionar bien para ambas partes.

## 1. Página de inicio

Quiero que la página de inicio sea una única vista dividida en diferentes secciones.

Tendrá un navbar desde el que se podrá acceder a las diferentes partes de la página:

- Inicio.
- Adopta.
- Sobre nosotros.
- Contacto.

Al pulsar sobre las opciones del navbar, el usuario se desplazará a la sección correspondiente.

La idea principal de la página será:

**«Encontramos el equilibrio entre el gato y la persona»**

El objetivo de la portada es explicar brevemente la misión, mostrar un acceso rápido para empezar a buscar y presentar un ejemplo ilustrativo del flujo de adopción.

## 2. Flujo de adopción (visión general)

1. Persona llega a la web y explora la sección Adopta.
2. Puede navegar por perfiles de gatos filtrados por ubicación, edad o características principales.
3. Para iniciar una solicitud de adopción, la persona completa un pequeño formulario de perfil (perfil público, no requiere cuenta en la primera fase).
4. A partir del perfil y las preferencias del adoptante, el sistema sugiere gatos compatibles.
5. La persona revisa el perfil del gato y puede iniciar una solicitud de adopción rellenando un mensaje y datos de contacto.
6. Las solicitudes se gestionan en el sistema con estados: Enviada → En revisión → Aceptada / No aceptada. “En proceso de adopción” no equivale a aceptación definitiva.

## 3. Objetivos funcionales del MVP

- Permitir perfiles de personas sin exigir gestión de cuentas en la primera fase.
- Perfiles de gatos con atributos suficientes para evaluar compatibilidad.
- Formularios de solicitud de adopción con mensaje libre y datos de contacto.
- Capacidad de calcular coincidencias bajo demanda (no persistir tablas de Match en esta fase).
- Documentación y trazabilidad de las decisiones de diseño.

## 4. Entidades principales y campos clave

1. Person (perfil de adoptante)
   - id (UUID)
   - full_name (VARCHAR)
   - bio (TEXT/VARCHAR libre para la biografía)
   - location (VARCHAR)
   - household_type (VARCHAR pequeño)
   - has_children (BOOLEAN)
   - has_other_pets (BOOLEAN)
   - other_pets_details (JSONB) — estructura libre para describir especies, edad, sexo, estado de salud, temperamento
   - activity_level (VARCHAR(10)) — vocabulario controlado recomendado
   - home_type (VARCHAR(20))
   - home_size (VARCHAR(10))
   - has_outdoor_space (BOOLEAN)
   - work_hours_per_day (SMALLINT)
   - personality_traits (JSONB) — set de rasgos clave
   - preferred_cat_traits (JSONB)
   - time_outside (VARCHAR(100)) — libre, descripción cualitativa del tiempo fuera de casa
   - time_available (VARCHAR(100)) — libre, tiempo disponible para dedicar al gato
   - created_at, updated_at (timestamps)

2. Cat (perfil de gato)
   - id (UUID)
   - name (VARCHAR)
   - age_stage (VARCHAR/ENUM: kitten, young, adult, senior)
   - age_months (SMALLINT)
   - sex (VARCHAR)
   - breed (VARCHAR)
   - size (VARCHAR)
   - activity_level (VARCHAR(10))
   - personality_traits (JSONB)
   - good_with_children (BOOLEAN)
   - good_with_dogs (BOOLEAN)
   - vaccinated (BOOLEAN)
   - neutered (BOOLEAN)
   - health_status (TEXT)
   - description (TEXT)
   - image_urls (JSONB)
   - location (VARCHAR)
   - created_at, updated_at

3. AdoptionRequest
   - id (UUID)
   - person_id (FK → persons.id) — nullable para permitir solicitudes anónimas o por terceros
   - cat_id (FK → cats.id)
   - contact_email, contact_phone
   - message (TEXT)
   - status (VARCHAR(20)) — default 'pending'
   - created_at, updated_at

## 5. Decisiones de diseño (importantes)

- No persistir un modelo Match en la BD en la primera fase: los resultados se calculan bajo demanda.
- other_pets_details se mantiene en JSONB para evitar normalizar en una tabla OtherPet en esta fase.
- Vocabularios controlados (activity_level, age_stage) se mantienen en la documentación y en validaciones de aplicación; la imposición de ENUMs o CHECKs en BD se considera una mejora posterior.
- Campos de texto libre largos (bio, description, health_status, message) se modelan como TEXT en migraciones cuando proceda, aunque en SQLAlchemy algunos aparecen como String en modelo; se documenta la divergencia técnica.

## 6. Validaciones y vocabularios recomendados (para la capa de aplicación)

- activity_level: ['low','medium','high','very_high'] (mismo vocabulario para Person y Cat)
- age_stage: ['kitten','young','adult','senior']
- personality_traits: lista de strings cortos seleccionables desde frontend; el backend almacena JSONB con claves y valores (por ejemplo: {'sociable': 3, 'playful':2})

## 7. Flujos UI/UX principales

- Perfil de persona: formulario de 6-8 pasos (progresivo) para recabar la información mínima necesaria (ubicación, tipo de vivienda, presencia de niños, otros animales, disponibilidad de tiempo).
- Página de perfil del gato: ficha con imágenes, rasgos y botón "Solicitar adopción".
- Flujo de solicitud: formulario con mensaje libre y datos de contacto; confirmación visual de envío.

## 8. Privacidad y datos

- No se almacenan contraseñas en la primera fase porque no se exige cuenta.
- Los datos de contacto se guardan en AdoptionRequest para permitir la gestión manual por parte de protectoras.

## 9. Prioridades para desarrollo

1. Perfilar Person y Cat y permitir búsquedas básicas (location, activity_level, age_stage).
2. Formularios de solicitud de adopción y almacenamiento seguro de contact data.
3. Interfaz para revisar solicitudes y cambiar su estado (en revisión, aceptada, no aceptada).
4. API mínima para obtener matches bajo demanda.

## 10. Casos de uso rechazados por ahora

- No se implementa login/registro en la primera fase.
- No se persiste Match ni se automatiza la aprobación de solicitudes.

## 11. Requisitos no funcionales

- La base de datos es PostgreSQL.
- JSONB para estructuras flexibles.
- Timestamps con zona horaria y server defaults.

## 12. Ejemplos y vocabulario (ejemplos de uso)

- time_outside: 'mostly_out', 'part_time_out', 'works_remote', 'rarely_out'
- time_available: 'few_minutes_daily', '1-2_hours', 'mostly_home', 'weekend_only'

## 13. Decisiones pendientes (no implementadas)

- Decidir si imponer ENUMs en BD para age_stage y activity_level.
- Definir la fórmula de compatibilidad y umbrales de colores.
- Definir si en fases posteriores se normaliza other_pets_details en tabla propia.

## 14. Notas finales

Este documento recoge la intención funcional para la primera fase del MVP. Debe mantenerse como referencia para las migraciones y para validar que las decisiones técnicas respetan el diseño funcional aprobado.

--

(Documento guardado como versión de referencia para el repositorio.)