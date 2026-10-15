import uuid
from sqlalchemy import Column, String, Boolean, SmallInteger, TIMESTAMP, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from ..db.base import Base

class Cat(Base):
    __tablename__ = "cats"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    age_stage = Column(String(20), nullable=False)
    age_months = Column(SmallInteger, nullable=True)
    sex = Column(String(10), nullable=True)
    breed = Column(String(255), nullable=True)
    size = Column(String(10), nullable=True)
    activity_level = Column(String(10), nullable=True)
    personality_traits = Column(JSONB, nullable=True)
    good_with_children = Column(Boolean, nullable=True)
    good_with_dogs = Column(Boolean, nullable=True)
    vaccinated = Column(Boolean, nullable=True)
    neutered = Column(Boolean, nullable=True)
    health_status = Column(String, nullable=True)
    description = Column(String, nullable=True)
    image_urls = Column(JSONB, nullable=True)
    location = Column(String(255), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=text('now()'))
