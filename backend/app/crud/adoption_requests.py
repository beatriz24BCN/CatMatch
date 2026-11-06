from typing import Optional
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from backend.app.models.adoption_request import AdoptionRequest


def get_adoption_request(db, req_id: str) -> Optional[AdoptionRequest]:
    stmt = select(AdoptionRequest).where(AdoptionRequest.id == req_id)
    result = db.execute(stmt)
    return result.scalars().first()


def create_adoption_request(db, data: dict) -> AdoptionRequest:
    """Create and persist an AdoptionRequest from an explicit set of allowed fields.

    Assign only approved fields to avoid silently ignoring errors or accepting unexpected keys.
    """
    ar = AdoptionRequest()

    # Explicitly assign allowed fields only (explicit assignments, no dynamic setattr)
    if "cat_id" in data:
        ar.cat_id = data["cat_id"]
    if "contact_email" in data:
        ar.contact_email = data["contact_email"]
    if "contact_phone" in data:
        ar.contact_phone = data["contact_phone"]
    if "message" in data:
        ar.message = data["message"]
    if "person_id" in data:
        ar.person_id = data["person_id"]
    if "status" in data:
        ar.status = data["status"]

    db.add(ar)
    try:
        db.flush()
        db.commit()
        db.refresh(ar)
    except SQLAlchemyError:
        db.rollback()
        raise
    return ar


def list_adoption_requests(db, status: str | None = None, limit: int = 100, offset: int = 0):
    """List AdoptionRequest records, optional filter by status."""
    from sqlalchemy import select
    stmt = select(AdoptionRequest)
    if status is not None:
        stmt = stmt.where(AdoptionRequest.status == status)
    stmt = stmt.limit(limit).offset(offset)
    result = db.execute(stmt)
    return result.scalars().all()


def update_adoption_request_status(db, req_id: str, new_status: str):
    """Update only the status field of an AdoptionRequest and return the updated record.

    Preserves transactional semantics and rolls back on SQLAlchemyError.
    """
    stmt = select(AdoptionRequest).where(AdoptionRequest.id == req_id)
    result = db.execute(stmt)
    ar = result.scalars().first()
    if not ar:
        return None
    # assign status explicitly
    ar.status = new_status
    try:
        db.flush()
        db.commit()
        db.refresh(ar)
    except SQLAlchemyError:
        db.rollback()
        raise
    return ar
