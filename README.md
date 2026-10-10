# CatMatch

1. Descripción del proyecto

CatMatch ayuda a encontrar gatos compatibles con el estilo de vida de una persona. El objetivo de la primera tanda (MVP) es permitir que una persona sin cuenta cree un perfil, compare ese perfil con los perfiles de gatos disponibles y obtenga resultados de compatibilidad claramente explicados que le permitan solicitar la adopción desde la ficha del gato.

2. Technology Stack (objetivo)

- Frontend: Next.js
- Lenguaje frontend: TypeScript
- Backend: FastAPI (Python)
- Base de datos: PostgreSQL
- Contenerización: Docker / docker-compose
- RAG / IA: prevista para una fase posterior (NO forma parte de la primera tanda)

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

Importante: la primera tanda requiere producir un resultado de compatibilidad y una explicación cualitativa. La fórmula numérica, pesos, porcentajes, umbrales y colores (semáforo) quedan pendientes y NO deben inventarse ahora. Tampoco es necesario integrar RAG/IA en esta fase.

6. Modelo de datos (primera tanda)

Entidades usadas en el MVP inicial:
- Person
- Cat
- Match (resultado de compatibilidad — puede calcularse on-demand)
- AdoptionRequest

User y Favorites quedan fuera de la primera tanda y se introducirán en la segunda tanda cuando se implementen cuentas y gestión de usuarios.

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

8. Segunda tanda / funcionalidades futuras

- Cuentas de usuario: User, registro, login, sesiones.
- Asociar Person a una cuenta.
- Favorites (marcar gatos) y gestión de solicitudes desde el panel de usuario.
- Integración avanzada con IA/RAG para mejorar la explicación y el scoring (fase posterior).

9. Estado actual del desarrollo

- **Backend, dependencias y verificación mínima**
  - El backend está implementado con FastAPI (Python).
  - Las dependencias del backend deben instalarse desde `backend/requirements.txt`.
  - Existe una prueba básica de humo que comprueba el endpoint `/health` mediante FastAPI TestClient. Esta prueba no verifica por sí sola la conexión con PostgreSQL ni el funcionamiento completo de la aplicación.
  - Pendiente de preparar o verificar: el entorno de pruebas necesario para comprobar la conexión real con PostgreSQL, aplicar y validar las migraciones de Alembic y preparar o validar las pruebas de integración correspondientes.

- **Funcionalidades pendientes**
  - El matching definitivo, la autenticación y la integración RAG/IA todavía no están implementados en esta fase.


10. Documentación

- Modelo de datos y vocabularios: docs/data_model.md
- Wireframes y guía UI: docs/wireframes.md

---

Si necesitas que añada una sección con ejemplos de API (OpenAPI skeleton) o un pequeño plan de trabajo dividido en issues, lo preparo siguiendo exactamente el planteamiento funcional y el modelo documentado.
