from pydantic import BaseModel
from typing import Optional
from uuid import UUID

class CatBase(BaseModel):
    name: str
    age_stage: str

class CatRead(CatBase):
    id: UUID

    class Config:
        orm_mode = True
