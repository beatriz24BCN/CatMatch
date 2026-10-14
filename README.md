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

Si quieres, puedo añadir la documentación en formato más formal (archivo YAML OpenAPI o añadir ejemplos en la propia definición del endpoint para que aparezcan en /docs). Dime si lo deseas.

Si necesitas que genere los tipos TypeScript (interfaces) para el frontend con esta response, puedo generarlos también.

Si necesitas que incluya la definición exacta del payload `person` mínima aceptada o que valide campos obligatorios, dime qué campos son imprescindibles y lo añado.
