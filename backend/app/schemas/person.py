from pydantic import BaseModel
from typing import Optional, List, Any
from uuid import UUID

class PersonBase(BaseModel):
    full_name: Optional[str]
    bio: Optional[str]
    location: Optional[str]

class PersonCreate(PersonBase):
    activity_level: Optional[str]
    home_type: Optional[str]
    home_size: Optional[str]
    has_outdoor_space: Optional[bool]
    work_hours_per_day: Optional[int]
    has_children: Optional[bool]
    has_other_pets: Optional[bool]
    other_pets_details: Optional[Any]
    personality_traits: Optional[Any]
    preferred_cat_traits: Optional[Any]

class PersonRead(PersonBase):
    id: UUID

    class Config:
        orm_mode = True
