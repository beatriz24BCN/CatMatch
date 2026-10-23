from typing import List, Optional
from sqlalchemy import select
from backend.app.models.cat import Cat


def get_cat(db, cat_id: str) -> Optional[Cat]:
    stmt = select(Cat).where(Cat.id == cat_id)
    result = db.execute(stmt)
    return result.scalars().first()


def list_cats(
    db,
    limit: int = 100,
    offset: int = 0,
    location: Optional[str] = None,
    age_stage: Optional[str] = None,
    activity_level: Optional[str] = None,
) -> List[Cat]:
    stmt = select(Cat)
    if location:
        stmt = stmt.where(Cat.location.ilike(f"%{location.strip()}%"))
    if age_stage:
        stmt = stmt.where(Cat.age_stage == age_stage.strip())
    if activity_level:
        stmt = stmt.where(Cat.activity_level == activity_level.strip())
    stmt = stmt.limit(limit).offset(offset)
    result = db.execute(stmt)
    return result.scalars().all()
