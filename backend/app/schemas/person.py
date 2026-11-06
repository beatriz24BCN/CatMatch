from pydantic import BaseModel
from typing import Optional, Any
from uuid import UUID
from datetime import datetime

class PersonBase(BaseModel):
    full_name: Optional[str]
    bio: Optional[str]
    location: Optional[str]

class PersonCreate(PersonBase):
    activity_level: Optional[str] = None
    home_type: Optional[str] = None
    home_size: Optional[str] = None
    has_outdoor_space: Optional[bool] = None
    work_hours_per_day: Optional[int] = None
    has_children: Optional[bool] = None
    has_other_pets: Optional[bool] = None
    other_pets_details: Optional[Any] = None
    personality_traits: Optional[Any] = None
    preferred_cat_traits: Optional[Any] = None
    # Qualitative time fields (MVP)
    time_outside: Optional[str] = None
    time_available: Optional[str] = None


class PersonUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    activity_level: Optional[str] = None
    home_type: Optional[str] = None
    home_size: Optional[str] = None
    has_outdoor_space: Optional[bool] = None
    work_hours_per_day: Optional[int] = None
    has_children: Optional[bool] = None
    has_other_pets: Optional[bool] = None
    other_pets_details: Optional[Any] = None
    personality_traits: Optional[Any] = None
    preferred_cat_traits: Optional[Any] = None
    time_outside: Optional[str] = None
    time_available: Optional[str] = None

class PersonRead(PersonBase):
    id: UUID
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
    time_outside: Optional[str]
    time_available: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True
