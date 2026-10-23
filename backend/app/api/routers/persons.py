from fastapi import APIRouter, Depends, HTTPException
from backend.app.api.deps import get_db
from backend.app.schemas.person import PersonCreate, PersonRead, PersonUpdate
from backend.app.crud import persons as persons_crud

router = APIRouter(prefix="/api/persons", tags=["persons"])


@router.post(
    "/",
    response_model=PersonRead,
    summary="Create a person profile (no auth)",
    description=(
        "Create a Person profile without authentication. The request body must match the PersonCreate schema. "
        "If validation succeeds the profile is persisted and the created PersonRead is returned."
    ),
)
def create_person(person_in: PersonCreate, db=Depends(get_db)):
    """Create a Person profile (no authentication required).

    The endpoint validates the input against PersonCreate and persists the new record.
    Returns the created PersonRead representation.
    """
    try:
        person = persons_crud.create_person(db, person_in.dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to create person")
    return person


@router.get("/{person_id}", response_model=PersonRead, summary="Get person by id")
def get_person(person_id: str, db=Depends(get_db)):
    """Retrieve a Person profile by id.

    Returns 404 if the person does not exist.
    """
    person = persons_crud.get_person(db, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person


@router.put("/{person_id}", response_model=PersonRead, summary="Update person by id")
@router.patch("/{person_id}", response_model=PersonRead, summary="Patch person by id")
def update_person(person_id: str, person_in: PersonUpdate, db=Depends(get_db)):
    """Update an existing Person profile by id (no authentication required for anonymous profile)."""
    existing = persons_crud.get_person(db, person_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Person not found")

    payload = person_in.dict(exclude_unset=True)
    try:
        updated = persons_crud.update_person(db, person_id, payload)
        if not updated:
            raise HTTPException(status_code=404, detail="Person not found")
        return updated
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to update person")
