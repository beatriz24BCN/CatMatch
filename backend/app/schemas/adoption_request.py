from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class AdoptionRequestCreate(BaseModel):
    cat_id: UUID
    contact_email: str
    person_id: Optional[UUID] = None
    contact_phone: Optional[str] = None
    message: Optional[str] = None

class AdoptionRequestRead(AdoptionRequestCreate):
    id: UUID
    person_id: Optional[UUID]
    contact_phone: Optional[str]
    status: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True
