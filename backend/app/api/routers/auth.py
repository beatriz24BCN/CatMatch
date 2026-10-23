from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from ...core.config import settings
from ...core.security import get_password_hash, verify_password, create_access_token
from ...crud import users as users_crud
from ...schemas.user import UserRegister, UserLogin, UserRead, Token
from ..deps import get_db, get_current_user
from ...models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar una nueva cuenta de usuario",
    description="Crea una nueva cuenta de usuario con rol estándar ('user'). No permite asignación de privilegios administrativos."
)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    # Comprobar si el email ya existe
    existing_user = users_crud.get_user_by_email(db, payload.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El correo electrónico ya está registrado.",
        )

    hashed_pw = get_password_hash(payload.password)
    # Seguridad: siempre rol 'user' en registro público
    user = users_crud.create_user(db, email=payload.email, hashed_password=hashed_pw, role="user")
    return user

@router.post(
    "/login",
    response_model=Token,
    summary="Iniciar sesión y obtener token de acceso",
    description="Valida las credenciales y devuelve un token Bearer JWT. Opcionalmente fija una cookie de sesión HttpOnly."
)
def login(payload: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = users_crud.get_user_by_email(db, payload.email)
    # Mensaje genérico para evitar enumeración de usuarios registrados
    generic_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales incorrectas.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not user:
        raise generic_error

    if not verify_password(payload.password, user.hashed_password):
        raise generic_error

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta de usuario inactiva.",
        )

    # Generar token JWT
    access_token_expires = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
    }
    access_token = create_access_token(data=token_data, expires_delta=access_token_expires)

    # Fijar cookie HttpOnly para navegadores
    response.set_cookie(
        key="catmatch_token",
        value=access_token,
        httponly=True,
        max_age=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=settings.env == "prod",
    )

    return Token(access_token=access_token, token_type="bearer")

@router.post(
    "/logout",
    summary="Cerrar sesión",
    description="Limpia la cookie de sesión en el navegador."
)
def logout(response: Response):
    response.delete_cookie(key="catmatch_token", samesite="lax")
    return {"message": "Sesión cerrada correctamente"}

@router.get(
    "/me",
    response_model=UserRead,
    summary="Obtener perfil del usuario autenticado",
    description="Devuelve la identidad y rol del usuario correspondiente al token proporcionado."
)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
