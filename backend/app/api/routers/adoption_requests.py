from fastapi import APIRouter, Depends, HTTPException
from backend.app.api.deps import get_db, get_current_admin
from backend.app.schemas.adoption_request import AdoptionRequestCreate, AdoptionRequestRead
from backend.app.crud import adoption_requests as crud
from backend.app.crud import cats as cats_crud
from sqlalchemy.exc import SQLAlchemyError
from backend.app.models.user import User

router = APIRouter(prefix="/api/adoption_requests", tags=["adoption_requests"])


@router.post("/", response_model=AdoptionRequestRead, status_code=201)
def create_adoption_request(payload: AdoptionRequestCreate, db=Depends(get_db)):
    """Create a new AdoptionRequest.

    PÚBLICO: No requiere autenticación previa.
    Validates the referenced cat exists before persisting.
    Returns 201 with the created AdoptionRequestRead.
    """
    # validate cat exists
    cat = cats_crud.get_cat(db, payload.cat_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Cat not found")

    try:
        ar = crud.create_adoption_request(db, payload.dict())
        return ar
    except SQLAlchemyError:
        # Persistence error; avoid exposing internals but return 500
        raise HTTPException(status_code=500, detail="Error creating adoption request")


@router.get("/", response_model=list[AdoptionRequestRead])
def list_requests(
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
    db=Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """List adoption requests. PROTEGIDO: Requiere rol de administrador."""
    try:
        items = crud.list_adoption_requests(db, status=status, limit=limit, offset=offset)
        return items
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Error listing adoption requests")


@router.get("/{req_id}", response_model=AdoptionRequestRead)
def get_request(
    req_id: str,
    db=Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Obtener detalle de solicitud. PROTEGIDO: Requiere rol de administrador."""
    ar = crud.get_adoption_request(db, req_id)
    if not ar:
        raise HTTPException(status_code=404, detail="Adoption request not found")
    return ar


class StatusUpdatePayload:
    # simple inline model to validate status payload; keep lightweight to avoid schema churn
    def __init__(self, status: str):
        self.status = status


@router.patch("/{req_id}", response_model=AdoptionRequestRead)
def update_request_status(
    req_id: str,
    payload: dict,
    db=Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Actualizar estado de solicitud. PROTEGIDO: Requiere rol de administrador."""
    allowed = {"pending", "in_review", "accepted", "rejected"}
    new_status = payload.get("status")
    if not new_status or not isinstance(new_status, str):
        raise HTTPException(status_code=422, detail="Missing or invalid 'status' field")
    if new_status not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {sorted(allowed)}")

    ar = crud.get_adoption_request(db, req_id)
    if not ar:
        raise HTTPException(status_code=404, detail="Adoption request not found")

    try:
        updated = crud.update_adoption_request_status(db, req_id, new_status)
        if not updated:
            raise HTTPException(status_code=404, detail="Adoption request not found")
        return updated
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Error updating adoption request status")
