import uuid
import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, StrictBool, field_validator

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
    # Opcional: los clientes que solo envían email y password mantienen el comportamiento anterior.
    remember_me: StrictBool = False

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


class PasswordResetRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        v_clean = v.strip().lower()
        if not EMAIL_REGEX.match(v_clean):
            raise ValueError("Formato de correo electrónico no válido")
        return v_clean


class PasswordResetConfirm(BaseModel):
    token: str = Field(..., min_length=16, max_length=256)
    # Misma regla que en el registro
    new_password: str = Field(..., min_length=8, description="Contraseña de al menos 8 caracteres")


class MessageResponse(BaseModel):
    message: str


class DevOutboxItem(BaseModel):
    reset_path: str
    created_at: datetime
    expires_at: datetime


class DevOutboxResponse(BaseModel):
    items: list[DevOutboxItem]
