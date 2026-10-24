import uuid
from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from ..db.session import SessionLocal
from ..core.security import decode_access_token
from ..crud.users import get_user_by_id
from ..models.user import User

bearer_scheme = HTTPBearer(auto_error=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_token_from_request(
    request: Request,
    auth: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> Optional[str]:
    """Extrae el token JWT ya sea desde la cabecera Authorization Bearer o desde la cookie catmatch_token."""
    if auth and auth.credentials:
        return auth.credentials
    # Soporte para cookie de sesión HttpOnly
    cookie_token = request.cookies.get("catmatch_token")
    if cookie_token:
        return cookie_token
    return None

def get_current_user(
    token: Optional[str] = Depends(get_token_from_request),
    db: Session = Depends(get_db)
) -> User:
    """Valida el token JWT y recupera el usuario autenticado. Lanza HTTP 401 si es inválido o no existe."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado. Proporcione un token de acceso válido.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token no contiene identificador de usuario válido.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identificador de usuario inválido en el token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_id(db, user_uuid)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta de usuario inactiva.",
        )
    return user

def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """Verifica que el usuario autenticado cuente con privilegios de administrador ('admin')."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Se requieren privilegios de administrador.",
        )
    return current_user
