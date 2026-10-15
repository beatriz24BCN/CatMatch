from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.app.api.deps import get_db
from backend.app.services.matching import evaluate_match
from backend.app.crud import cats as cats_crud
from backend.app.crud import persons as persons_crud

router = APIRouter(prefix="/api/match", tags=["match"])


class MatchEvaluateRequest(BaseModel):
    person_id: Optional[str] = None
    cat_id: Optional[str] = None
    # Accept arbitrary person/cat payloads (dict) to avoid strict schema validation here
    person: Optional[Dict[str, Any]] = None
    cat: Optional[Dict[str, Any]] = None


@router.post("/evaluate")
def evaluate(payload: MatchEvaluateRequest, db=Depends(get_db)):
    # Resolve person
    person_obj = None
    if payload.person_id:
        person_obj = persons_crud.get_person(db, payload.person_id)
        if not person_obj:
            raise HTTPException(status_code=404, detail="Person not found")
    elif payload.person is not None:
        # use the provided dict
        person_obj = payload.person

    # Resolve cat
    cat_obj = None
    if payload.cat_id:
        cat_obj = cats_crud.get_cat(db, payload.cat_id)
        if not cat_obj:
            raise HTTPException(status_code=404, detail="Cat not found")
    elif payload.cat is not None:
        cat_obj = payload.cat

    if person_obj is None or cat_obj is None:
        raise HTTPException(status_code=400, detail="Provide both person and cat data or their IDs")

    result = evaluate_match(person_obj, cat_obj)
    return result
