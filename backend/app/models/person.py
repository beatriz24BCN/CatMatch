import uuid
from sqlalchemy import Column, String, Boolean, SmallInteger, TIMESTAMP, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from ..db.base import Base

class Person(Base):
    __tablename__ = "persons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(255), nullable=True)
    bio = Column(String, nullable=True)
    location = Column(String(255), nullable=True)
    household_type = Column(String(20), nullable=True)
    has_children = Column(Boolean, nullable=True, server_default=text('false'))
    has_other_pets = Column(Boolean, nullable=True, server_default=text('false'))
    other_pets_details = Column(JSONB, nullable=True)
    activity_level = Column(String(10), nullable=True)
    home_type = Column(String(20), nullable=True)
    home_size = Column(String(10), nullable=True)
    has_outdoor_space = Column(Boolean, nullable=True)
    work_hours_per_day = Column(SmallInteger, nullable=True)
    personality_traits = Column(JSONB, nullable=True)
    preferred_cat_traits = Column(JSONB, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=text('now()'))
