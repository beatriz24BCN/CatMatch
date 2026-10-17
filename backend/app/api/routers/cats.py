from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from backend.app.api.deps import get_db
from backend.app.schemas.cat import CatRead
from backend.app.crud import cats as crud
from backend.app.services.matching import evaluate_match

router = APIRouter(prefix="/api/cats", tags=["cats"])

@router.get("/", response_model=List[CatRead])
def list_cats(limit: int = 100, offset: int = 0, db=Depends(get_db)):
    cats_list = crud.list_cats(db, limit=limit, offset=offset)
    return cats_list


@router.get("/{cat_id}", response_model=CatRead)
def get_cat(cat_id: str, db=Depends(get_db)):
    cat = crud.get_cat(db, cat_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Cat not found")
    return cat


@router.post(
    "/for_person",
    summary="List cats evaluated for a person",
    description=(
        "Return a list of available cats evaluated against a person profile. "
        "The request must include either `person_id` (to fetch the person record) or a `person` object with profile fields. "
        "The response is an array of objects with the cat record, the matching result from evaluate_match, and "
        "an `incompatibility_count` which counts factors where `match == false`. A zero count means no incompatibilities were detected by the current rules, "
        "it does NOT imply that the cat is automatically compatible; the `match.recommended` field (from evaluate_match) must be consulted."
    ),
    responses={
        200: {
            "description": "List of evaluated cats (ordered ascending by incompatibility_count).",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "cat": {"id": "uuid", "name": "Michi", "location": "Shelter"},
                            "match": {
                                "recommended": None,
                                "explanation": "No se detectaron incompatibilidades estructuradas; no se emite una recomendación automática.",
                                "factors": [
                                    {"type": "location", "match": None, "explanation": "Comparación de ubicación (informativa).", "details": {"person_location": "A", "cat_location": "A"}}
                                ]
                            },
                            "incompatibility_count": 0
                        }
                    ]
                }
            }
        },
        400: {"description": "Missing person or person_id in request."},
        404: {"description": "Person not found if person_id provided and no record exists."},
    },
)
def list_cats_for_person(payload: Dict[str, Any], db=Depends(get_db)):
    """Return list of cats evaluated against a person.

    Payload may include:
      - person_id: to fetch the person via CRUD
      - person: a dict with person data

    Response: list of items {cat: <cat dict>, match: <evaluate_match result>, incompatibility_count: int}
    Sorted asc by incompatibility_count (fewer confirmed incompatibilities first).

    Notes:
      - Does not claim compatibility when incompatibility_count == 0; recommended value from evaluate_match is respected.
      - Uses evaluate_match (no duplicated logic).
    """
    person_obj = None
    if payload.get("person_id"):
        # lazily import to avoid circulars; caller must have CRUD person implemented
        from backend.app.crud.persons import get_person
        person_obj = get_person(db, payload["person_id"])  # type: ignore[arg-type]
        if not person_obj:
            raise HTTPException(status_code=404, detail="Person not found")
    elif payload.get("person") is not None:
        person_obj = payload["person"]

    if person_obj is None:
        raise HTTPException(status_code=400, detail="Provide person or person_id in payload")

    cats_list = crud.list_cats(db, limit=1000, offset=0)

    results = []
    for cat in cats_list:
        # evaluate_match accepts ORM objects or dicts
        match_result = evaluate_match(person_obj, cat)
        factors = match_result.get("factors", []) if isinstance(match_result, dict) else []
        incompatibility_count = sum(1 for f in factors if f.get("match") is False)
        # serialize cat: if it's an ORM with .__dict__ or pydantic expects, simply attempt dict()
        try:
            cat_serialized = cat.__dict__
        except Exception:
            # fallback for plain dicts
            cat_serialized = dict(cat) if isinstance(cat, dict) else {"id": getattr(cat, "id", None)}
        results.append({"cat": cat_serialized, "match": match_result, "incompatibility_count": incompatibility_count})

    # sort by incompatibility_count ascending; tie-break by positive matches (desc) and personality overlap (desc)
    def _positive_and_overlap(match_obj: Optional[Dict[str, Any]]):
        """Return (positive_matches_count, overlap_count) safely from a match object.

        - positive_matches_count: number of factors with match is True
        - overlap_count: integer from personality_overlap.details.overlap_count or 0
        """
        factors = match_obj.get("factors", []) if isinstance(match_obj, dict) else []
        positive = 0
        overlap = 0
        for f in factors:
            try:
                if f.get("match") is True:
                    positive += 1
                if f.get("type") == "personality_overlap":
                    details = f.get("details") or {}
                    val = details.get("overlap_count") if isinstance(details, dict) else None
                    if val is None:
                        continue
                    try:
                        overlap = int(val)
                    except Exception:
                        # ignore invalid overlap_count values
                        overlap = 0
            except Exception:
                # be defensive: ignore malformed factor entries
                continue
        return positive, overlap

    # compute sort keys once per item to avoid repeated extraction
    keyed = []
    for item in results:
        match_obj = item.get("match", {}) or {}
        positive, overlap = _positive_and_overlap(match_obj)
        key = (item.get("incompatibility_count", 0), -positive, -overlap)
        keyed.append((key, item))

    keyed.sort(key=lambda x: x[0])
    results = [it for _, it in keyed]
    return results
