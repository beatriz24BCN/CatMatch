import logging
from datetime import timedelta
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from ...core.config import settings
from ...core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    TOKEN_VERSION_CLAIM,
    user_token_version,
)
from ...crud import users as users_crud
from ...crud import password_resets as password_resets_crud
from ...services import email as email_service
from ...services import dev_outbox
from ...schemas.user import (
    DevOutboxItem,
    DevOutboxResponse,
    UserRegister,
    UserLogin,
    UserRead,
    Token,
    PasswordResetRequest,
    PasswordResetConfirm,
    MessageResponse,
)
from ..deps import get_db, get_current_user
from ...models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

dev_outbox.log_startup_status()

PASSWORD_RESET_REQUEST_MESSAGE = (
    "Si existe una cuenta asociada a ese correo, recibirás un enlace para restablecer la contraseña."
)
PASSWORD_RESET_INVALID_TOKEN = "El enlace de recuperación no es válido o ha caducado. Solicita uno nuevo."

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
        TOKEN_VERSION_CLAIM: user_token_version(user),
    }
    access_token = create_access_token(data=token_data, expires_delta=access_token_expires)

    # Fijar cookie HttpOnly para navegadores.
    # - Sin remember_me: cookie de sesión (sin Max-Age/Expires) con el token de 60 min.
    # - Con remember_me: cookie persistente con un token propio de larga duración que
    #   solo viaja en la cookie HttpOnly; nunca se devuelve en el JSON.
    # Limitación: no hay revocación en servidor; el logout solo borra la cookie del navegador.
    if payload.remember_me:
        remember_expires = timedelta(days=settings.REMEMBER_ME_EXPIRE_DAYS)
        cookie_token = create_access_token(data=token_data, expires_delta=remember_expires)
        cookie_max_age = int(remember_expires.total_seconds())
    else:
        cookie_token = access_token
        cookie_max_age = None

    response.set_cookie(
        key="catmatch_token",
        value=cookie_token,
        httponly=True,
        max_age=cookie_max_age,
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


@router.post(
    "/password-reset/request",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Solicitar recuperación de contraseña",
    description=(
        "Si el correo pertenece a una cuenta activa, envía un enlace de un solo uso. "
        "La respuesta es siempre la misma para no revelar si la cuenta existe."
    ),
)
def request_password_reset(
    payload: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    use_dev_outbox = dev_outbox.is_enabled()

    # Si el correo no está configurado, se rechazan todas las solicitudes por igual
    # (no revela si la cuenta existe y no simula un envío).
    missing = [] if use_dev_outbox else email_service.missing_email_settings()
    if missing:
        logger.error("Password reset unavailable: email settings missing or invalid: %s", ", ".join(missing))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La recuperación de contraseña no está disponible en este momento. Inténtalo más tarde.",
        )

    user = users_crud.get_user_by_email(db, payload.email)
    if (
        user is not None
        and user.is_active
        and not password_resets_crud.has_recent_token(db, user.id, settings.PASSWORD_RESET_MIN_INTERVAL_SECONDS)
    ):
        raw_token = password_resets_crud.create_reset_token(db, user.id, settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
        if use_dev_outbox:
            # Solo dev/test: no se envía correo; el enlace queda en el buzón en memoria.
            dev_outbox.store(user.email, raw_token)
        else:
            # Envío tras responder, para que el tiempo de respuesta no delate si la cuenta existe.
            background_tasks.add_task(email_service.send_password_reset_email, user.email, raw_token)

    return MessageResponse(message=PASSWORD_RESET_REQUEST_MESSAGE)


@router.post(
    "/password-reset/dev-outbox",
    response_model=DevOutboxResponse,
    include_in_schema=False,
)
def read_password_reset_dev_outbox(
    payload: PasswordResetRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """SOLO DESARROLLO. Devuelve los enlaces pendientes del correo indicado.

    Responde 404 (como si no existiera) salvo con PASSWORD_RESET_DEV_OUTBOX=true y env dev/test.
    Usa POST para que el correo no aparezca en la URL ni en los logs de acceso.
    """
    if not dev_outbox.is_enabled():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")

    response.headers["Cache-Control"] = "no-store"
    items = [
        DevOutboxItem(
            reset_path=dev_outbox.build_reset_path(entry.raw_token),
            created_at=entry.created_at,
            expires_at=entry.expires_at,
        )
        for entry in dev_outbox.entries_for(payload.email)
        # La base de datos decide: se omiten los tokens ya usados, sustituidos o caducados.
        if password_resets_crud.is_token_usable(db, entry.raw_token)
    ]
    return DevOutboxResponse(items=items)


@router.post(
    "/password-reset/confirm",
    response_model=MessageResponse,
    summary="Establecer una contraseña nueva con un token de recuperación",
    description=(
        "Valida el token (existencia, caducidad y uso previo), actualiza la contraseña, "
        "consume el token e invalida todas las sesiones anteriores de la cuenta."
    ),
)
def confirm_password_reset(payload: PasswordResetConfirm, response: Response, db: Session = Depends(get_db)):
    invalid_token = HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=PASSWORD_RESET_INVALID_TOKEN)

    # Comprobación previa barata para no calcular el hash PBKDF2 con tokens inválidos.
    if not password_resets_crud.is_token_usable(db, payload.token):
        raise invalid_token

    new_hashed = get_password_hash(payload.new_password)
    if password_resets_crud.reset_password_with_token(db, payload.token, new_hashed) is None:
        raise invalid_token

    # La cookie de este navegador (si existe) ya no es válida tras incrementar token_version.
    response.delete_cookie(key="catmatch_token", samesite="lax")
    return MessageResponse(message="Tu contraseña se ha actualizado. Ya puedes iniciar sesión con la nueva contraseña.")

@router.get(
    "/me",
    response_model=UserRead,
    summary="Obtener perfil del usuario autenticado",
    description="Devuelve la identidad y rol del usuario correspondiente al token proporcionado."
)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
