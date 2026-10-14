from typing import Optional
from sqlalchemy import select
from backend.app.models.person import Person


def get_person(db, person_id: str) -> Optional[Person]:
    stmt = select(Person).where(Person.id == person_id)
    result = db.execute(stmt)
    return result.scalars().first()


def create_person(db, person_data: dict) -> Person:
    """Create and persist a Person from a dict of data.

    This function expects a mapping of field names to values (usually a Pydantic
    .dict()). It will construct a Person model, add it to the session, flush/commit
    and return the persisted instance.
    """
    p = Person()
    # assign only attributes that exist on the model
    for key, value in person_data.items():
        if hasattr(Person, key) or hasattr(p, key):
            try:
                setattr(p, key, value)
            except Exception:
                # ignore attributes that cannot be set
                pass
    db.add(p)
    # flush to assign defaults/PKs
    try:
        db.flush()
        db.commit()
        db.refresh(p)
    except Exception:
        db.rollback()
        raise
    return p
