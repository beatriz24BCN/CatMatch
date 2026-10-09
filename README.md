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

Ver el diseño detallado: docs/data_model_week1.md

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

- El planteamiento funcional, el modelo de datos y los wireframes están definidos y documentados en `docs/`.
- El desarrollo del stack objetivo (FastAPI + Next.js + TypeScript + PostgreSQL + Docker) está en curso. Algunas piezas aún deben implementarse; cuando estén disponibles se añadirán instrucciones concretas de ejecución y Docker compose.
- Este README refleja la decisión técnica actual; no describe stacks antiguos ni instrucciones de scaffolds previos.

10. Documentación

- Modelo de datos y vocabularios: docs/data_model_week1.md
- Wireframes y guía UI: docs/wireframes.md

---

Si necesitas que añada una sección con ejemplos de API (OpenAPI skeleton) o un pequeño plan de trabajo dividido en issues, lo preparo siguiendo exactamente el planteamiento funcional y el modelo documentado.
