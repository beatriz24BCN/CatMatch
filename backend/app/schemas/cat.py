from pydantic import BaseModel
from typing import Optional, Any
from uuid import UUID
from datetime import datetime

class CatBase(BaseModel):
    name: str
    age_stage: str

class CatRead(CatBase):
    id: UUID
    age_months: Optional[int]
    sex: Optional[str]
    breed: Optional[str]
    size: Optional[str]
    activity_level: Optional[str]
    personality_traits: Optional[Any]
    good_with_children: Optional[bool]
    good_with_dogs: Optional[bool]
    vaccinated: Optional[bool]
    neutered: Optional[bool]
    health_status: Optional[str]
    description: Optional[str]
    image_urls: Optional[Any]
    location: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True
