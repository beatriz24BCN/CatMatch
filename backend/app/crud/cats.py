from typing import List, Optional
from sqlalchemy import select
from backend.app.models.cat import Cat


def get_cat(db, cat_id: str) -> Optional[Cat]:
    stmt = select(Cat).where(Cat.id == cat_id)
    result = db.execute(stmt)
    return result.scalars().first()


def list_cats(db, limit: int = 100, offset: int = 0) -> List[Cat]:
    stmt = select(Cat).limit(limit).offset(offset)
    result = db.execute(stmt)
    return result.scalars().all()
