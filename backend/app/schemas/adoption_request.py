from pydantic import BaseModel
from typing import Optional
from uuid import UUID

class AdoptionRequestCreate(BaseModel):
    cat_id: UUID
    contact_email: str
    message: Optional[str] = None

class AdoptionRequestRead(AdoptionRequestCreate):
    id: UUID

    class Config:
        orm_mode = True
