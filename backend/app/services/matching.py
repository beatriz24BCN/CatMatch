from typing import Any


def _get(obj: Any, attr: str, default=None):
    """Safe getter that supports dicts and objects with attributes."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(attr, default)
    return getattr(obj, attr, default)


def evaluate_match(person, cat):
    """Evaluate compatibility between a person and a cat.

    Returns a dict with:
      - recommended: False if a confirmed incompatibility exists, None otherwise (no automatic True)
      - explanation: short human-readable summary
      - factors: list of factor dicts with keys: type, match (True/False/None), explanation, details(optional)

    Notes on design decisions kept conservative:
    - No numeric scoring or aggregate percentages are produced (business decision required).
    - A single confirmed incompatibility (based on structured fields) yields recommended=False.
    - If no confirmed incompatibilities are found, recommended=None (decision pending / needs human review).
    """
    factors = []
    incompatibility_found = False

    # 1) Children compatibility
    has_children = _get(person, "has_children")
    cat_good_with_children = _get(cat, "good_with_children")
    if has_children is True and cat_good_with_children is False:
        incompatibility_found = True
        factors.append({
            "type": "good_with_children",
            "match": False,
            "explanation": "La persona tiene niños en casa pero el gato no es apto con niños.",
            "details": {
                "person_has_children": True,
                "cat_good_with_children": False,
            },
        })
    elif has_children is not None and cat_good_with_children is not None:
        factors.append({
            "type": "good_with_children",
            "match": True if cat_good_with_children else None,
            "explanation": "Compatibilidad por convivencia con niños.",
            "details": {
                "person_has_children": bool(has_children),
                "cat_good_with_children": bool(cat_good_with_children),
            },
        })

    # 2) Other pets (dogs) compatibility
    has_other_pets = _get(person, "has_other_pets")
    cat_good_with_dogs = _get(cat, "good_with_dogs")
    if has_other_pets is True and cat_good_with_dogs is False:
        incompatibility_found = True
        factors.append({
            "type": "good_with_other_pets",
            "match": False,
            "explanation": "La persona tiene otras mascotas pero el gato no es apto con perros/otras mascotas.",
            "details": {
                "person_has_other_pets": True,
                "cat_good_with_dogs": False,
            },
        })
    elif has_other_pets is not None and cat_good_with_dogs is not None:
        factors.append({
            "type": "good_with_other_pets",
            "match": True if cat_good_with_dogs else None,
            "explanation": "Compatibilidad con otras mascotas en el hogar (si aplica).",
            "details": {
                "person_has_other_pets": bool(has_other_pets),
                "cat_good_with_dogs": bool(cat_good_with_dogs),
            },
        })

    # 3) Location proximity (informational)
    person_loc = _get(person, "location")
    cat_loc = _get(cat, "location")
    if person_loc and cat_loc:
        factors.append({
            "type": "location",
            "match": True if person_loc == cat_loc else None,
            "explanation": "Comparación de ubicación (informativa).",
            "details": {"person_location": person_loc, "cat_location": cat_loc},
        })

    # 4) Activity level
    person_activity = _get(person, "activity_level")
    cat_activity = _get(cat, "activity_level")
    if person_activity and cat_activity:
        factors.append({
            "type": "activity_level",
            "match": True if person_activity == cat_activity else None,
            "explanation": "Comparación de nivel de actividad (si ambos definidos).",
            "details": {"person_activity": person_activity, "cat_activity": cat_activity},
        })

    # 5) Personality / preferred traits overlap (if structured lists present)
    person_pref = _get(person, "preferred_cat_traits") or _get(person, "personality_traits")
    cat_traits = _get(cat, "personality_traits")
    overlap_count = 0
    overlap_items = []
    if person_pref and cat_traits:
        # accept lists or comma-separated strings
        def to_list(x):
            if isinstance(x, list):
                return [str(i).lower() for i in x]
            if isinstance(x, str):
                return [s.strip().lower() for s in x.split(",") if s.strip()]
            return []

        pref_list = to_list(person_pref)
        cat_list = to_list(cat_traits)
        overlap = set(pref_list) & set(cat_list)
        overlap_count = len(overlap)
        overlap_items = list(overlap)
        factors.append({
            "type": "personality_overlap",
            "match": True if overlap_count > 0 else None,
            "explanation": "Coincidencias entre las preferencias de la persona y los rasgos del gato.",
            "details": {"overlap_count": overlap_count, "overlap_items": overlap_items},
        })

    # 6) Health / special needs (informational)
    cat_health = _get(cat, "health_status")
    if cat_health:
        factors.append({
            "type": "health_status",
            "match": None,
            "explanation": "Estado de salud del gato (informativo).",
            "details": {"cat_health_status": cat_health},
        })

    # Determine recommended value conservatively:
    if incompatibility_found:
        recommended = False
        explanation = "Se ha detectado al menos una incompatibilidad estructurada que desaconseja la adopción."
    else:
        recommended = None
        explanation = "No se detectaron incompatibilidades estructuradas; no se emite una recomendación automática." 

    return {"recommended": recommended, "explanation": explanation, "factors": factors}
