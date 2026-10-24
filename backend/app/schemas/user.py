import uuid
import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

class UserBase(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        v_clean = v.strip().lower()
        if not EMAIL_REGEX.match(v_clean):
            raise ValueError("Formato de correo electrónico no válido")
        return v_clean

class UserRegister(BaseModel):
    email: str
    password: str = Field(..., min_length=8, description="Contraseña de al menos 8 caracteres")
    # Nota de seguridad: No se aceptan campos 'role' ni 'is_admin' en el registro público.

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        v_clean = v.strip().lower()
        if not EMAIL_REGEX.match(v_clean):
            raise ValueError("Formato de correo electrónico no válido")
        return v_clean

class UserLogin(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        v_clean = v.strip().lower()
        if not EMAIL_REGEX.match(v_clean):
            raise ValueError("Formato de correo electrónico no válido")
        return v_clean

class UserRead(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
