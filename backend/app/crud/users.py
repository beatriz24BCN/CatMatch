import uuid
from typing import Optional
from sqlalchemy.orm import Session
from ..models.user import User

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    normalized_email = email.strip().lower()
    return db.query(User).filter(User.email == normalized_email).first()

def get_user_by_id(db: Session, user_id: uuid.UUID) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()

def create_user(db: Session, email: str, hashed_password: str, role: str = "user") -> User:
    normalized_email = email.strip().lower()
    # Garantizar rol seguro
    safe_role = "admin" if role == "admin" else "user"
    user = User(
        email=normalized_email,
        hashed_password=hashed_password,
        role=safe_role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
