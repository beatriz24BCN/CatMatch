import uuid
from sqlalchemy import Column, String, Boolean, SmallInteger, TIMESTAMP, text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from ..db.base import Base

class AdoptionRequest(Base):
    __tablename__ = "adoption_requests"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id = Column(UUID(as_uuid=True), ForeignKey('persons.id'), nullable=True)
    cat_id = Column(UUID(as_uuid=True), ForeignKey('cats.id'), nullable=False)
    contact_email = Column(String(255), nullable=False)
    contact_phone = Column(String(50), nullable=True)
    message = Column(String, nullable=True)
    status = Column(String(20), nullable=False, server_default='pending')
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=text('now()'))
