from typing import List, Optional, Dict, Any
from .document import RAGDocument

SPANISH_CITIES = [
    'barcelona', 'madrid', 'valencia', 'sevilla', 'zaragoza',
    'malaga', 'murcia', 'palma', 'bilbao', 'alicante', 'cordoba',
    'valladolid', 'vigo', 'gijon', 'hospitalet', 'sant miquel de balanya'
]

def extract_user_intent(full_text: str) -> Dict[str, Any]:
    """Extrae intenciones clave y ubicación del texto acumulado de la conversación."""
    t = full_text.lower()
    t = t.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u').replace('ñ', 'n')

    needs_children = any(w in t for w in ['nino', 'ninos', 'nina', 'ninas', 'hijo', 'hijos', 'familia', 'peque'])
    needs_dogs = any(w in t for w in ['perro', 'perros', 'can', 'canino', 'mascota', 'mascotas'])
    needs_calm = any(w in t for w in ['tranquil', 'calmad', 'sosegad', 'relax', 'piso', 'no se mueva', 'no se mueve'])
    needs_active = any(w in t for w in ['activ', 'jugueton', 'juegos', 'energi'])
    needs_sociable = any(w in t for w in ['sociabl', 'amigabl'])
    needs_affectionate = any(w in t for w in ['carinos', 'mimos', 'afectuos'])
    is_adoption_process = any(w in t for w in ['proceso', 'como funciona', 'requisito', 'adopcion responsable', 'pasos'])

    detected_city: Optional[str] = None
    for city in SPANISH_CITIES:
        if city in t:
            detected_city = city
            break

    return {
        "children": needs_children,
        "dogs": needs_dogs,
        "calm": needs_calm,
        "active": needs_active,
        "sociable": needs_sociable,
        "affectionate": needs_affectionate,
        "adoption_process": is_adoption_process,
        "city": detected_city
    }

def filter_compatible_cats(
    rag_results: List[tuple[RAGDocument, float]],
    intent: Dict[str, Any]
) -> List[tuple[RAGDocument, float]]:
    """Filtra y reordena los resultados de gatos garantizando que cumplan las restricciones confirmadas.

    - Si el usuario convive con niños, NUNCA recomienda un gato con good_with_children == False.
    - Si el usuario convive con perros, NUNCA recomienda un gato con good_with_dogs == False.
    - Si busca un gato tranquilo/piso, prioriza gatos con actividad 'low' o 'medium'.
    - Si indica una ciudad, da un impulso positivo a los gatos de esa ciudad sin excluir los de otras.
    """
    filtered = []
    for doc, score in rag_results:
        if doc.source_type != "cat_profile":
            filtered.append((doc, score))
            continue

        meta = doc.metadata or {}
        # Restricción crítica: niños
        if intent["children"] and meta.get("good_with_children") is False:
            continue

        # Restricción crítica: perros
        if intent["dogs"] and meta.get("good_with_dogs") is False:
            continue

        # Re-ranking según preferencia de energía
        adjusted_score = score
        activity = str(meta.get("activity_level", "")).lower()
        if intent["calm"] and activity in ["low", "medium"]:
            adjusted_score += 1.5
        elif intent["active"] and activity in ["high", "very_high"]:
            adjusted_score += 1.5

        # Impulso de ubicación si coincide con la ciudad del usuario
        cat_loc = str(meta.get("location", "")).lower()
        if intent["city"] and intent["city"] in cat_loc:
            adjusted_score += 1.0

        filtered.append((doc, adjusted_score))

    filtered.sort(key=lambda x: x[1], reverse=True)
    return filtered

def format_cat_explanation(doc: RAGDocument, intent: Dict[str, Any]) -> str:
    """Genera una explicación clara y fundamentada basada estrictamente en la ficha oficial."""
    meta = doc.metadata or {}
    name = meta.get("cat_name") or doc.title.replace("Ficha oficial de ", "")
    age_stage = meta.get("age_stage")
    age_months = meta.get("age_months")
    breed = meta.get("breed")
    loc = meta.get("location")

    # Edad formateada en español correcto: "1 año", "2 años", etc.
    age_str = ""
    if age_months is not None:
        if age_months < 12:
            age_str = f", {age_months} meses" if age_months != 1 else ", 1 mes"
        else:
            years = age_months // 12
            age_str = f", {years} año" if years == 1 else f", {years} años"
    elif age_stage:
        age_str = f" ({age_stage})"

    loc_str = f" en {loc}" if loc else ""
    breed_str = f" ({breed})" if breed else ""

    reasons: List[str] = []

    # Rasgos de personalidad documentados oficialmente
    traits_raw = meta.get("personality_traits") or []
    traits_list = [str(t).lower() for t in traits_raw] if isinstance(traits_raw, list) else [str(traits_raw).lower()]

    if intent.get("sociable"):
        if any("sociabl" in t for t in traits_list):
            reasons.append("carácter sociable documentado en su ficha")
        else:
            reasons.append("rasgo sociable no especificado en su ficha")

    if intent.get("affectionate"):
        if any("cariños" in t or "carinos" in t for t in traits_list):
            reasons.append("carácter cariñoso documentado")
        else:
            reasons.append("rasgo cariñoso no especificado en su ficha")

    # 1. Niños: confirmar solo si está documentado
    if meta.get("good_with_children") is True:
        reasons.append("convivencia positiva con niños confirmada")
    elif meta.get("good_with_children") is False:
        reasons.append("no apto con niños (no recomendado para familias)")
    else:
        if intent.get("children"):
            reasons.append("compatibilidad con niños pendiente de valorar por el refugio")

    # 2. Perros: confirmar solo si está documentado
    if meta.get("good_with_dogs") is True:
        reasons.append("apto para convivir con perros")
    elif meta.get("good_with_dogs") is False:
        reasons.append("no apto con perros")
    else:
        if intent.get("dogs"):
            reasons.append("compatibilidad con perros pendiente de valorar")

    # 3. Nivel de energía / piso
    act = str(meta.get("activity_level", "")).lower()
    if act == "low":
        reasons.append("nivel de actividad bajo ideal para pisos o ambientes tranquilos")
    elif act == "medium":
        reasons.append("nivel de actividad moderado")
    elif act in ["high", "very_high"]:
        reasons.append("nivel de actividad alto, juguetón y enérgico")

    # 4. Ubicación de la persona (sin inventar traslados ni visitas no documentadas)
    user_city = intent.get("city")
    if user_city and loc:
        if user_city in loc.lower():
            reasons.append(f"ubicado en tu misma ciudad ({loc})")
        else:
            reasons.append(f"ubicado en {loc}")

    reasons_text = "; ".join(reasons) if reasons else "características afines a tu búsqueda"
    url_part = f" [Ver ficha oficial]({doc.url})" if doc.url else ""

    return f"• **{name}**{breed_str}{age_str}{loc_str}: Recomendado por {reasons_text}.{url_part}"

def generate_contextual_response(
    intent: Dict[str, Any],
    results: List[tuple[RAGDocument, float]],
    snippets: List[str]
) -> str:
    """Genera una respuesta amigable, explicativa y libre de inventos."""
    if not results:
        # Preguntas de seguimiento progresivas no repetitivas
        if intent["children"] and not intent["dogs"]:
            return (
                "He tomado nota de que convives con niños. "
                "Para afinar la recomendación, ¿tienes también perros u otras mascotas en casa, o buscas un gato con algún nivel de actividad en particular (tranquilo o juguetón)?"
            )
        elif intent["dogs"] and not intent["children"]:
            return (
                "Entiendo que convives con perro. "
                "Para garantizar una convivencia segura, ¿hay también niños en el hogar o prefieres un gato joven o adulto?"
            )
        elif intent["calm"]:
            return (
                "Buscas un compañero tranquilo. "
                "¿Podrías decirme si convives con niños, perros u otros animales para asegurarnos de que el gato encaje bien en tu hogar?"
            )
        return (
            "No he encontrado información específica en el catálogo o en nuestras guías para esa consulta. "
            "¿Podrías contarme un poco más sobre tu vivienda (piso, casa) o si convives con niños u otras mascotas?"
        )

    # Identificar qué condiciones se han satisfecho
    conditions = []
    if intent["children"]:
        conditions.append("aptos para convivir con niños")
    if intent["dogs"]:
        conditions.append("aptos con perros u otras mascotas")
    if intent["calm"]:
        conditions.append("de carácter tranquilo o adecuados para piso")
    elif intent["active"]:
        conditions.append("con energía y ganas de jugar")

    intro = "Según los datos oficiales de CatMatch y nuestras guías de adopción:"
    if conditions:
        intro = f"Teniendo en cuenta tus preferencias ({', '.join(conditions)}), hemos seleccionado los siguientes gatos según sus fichas oficiales:"

    points_text = "\n".join(snippets)
    closing = (
        "\n\nTe recomendamos revisar las fichas oficiales completas para conocer todos los detalles de salud y carácter. "
        "Si deseas que el sistema realice una evaluación detallada de compatibilidad con todos los gatos disponibles, puedes completar tu perfil en cualquier momento."
    )
    return f"{intro}\n\n{points_text}{closing}"
