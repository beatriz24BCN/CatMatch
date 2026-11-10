"""Buzón de recuperación de contraseña SOLO PARA DESARROLLO.

Con PASSWORD_RESET_DEV_OUTBOX=true y env en ("dev", "test"), los enlaces de
recuperación no se envían por correo: se guardan en memoria del proceso y se
pueden consultar desde el endpoint de desarrollo para abrirlos en el navegador.

En cualquier otro entorno (incluido "prod" o valores desconocidos) el buzón está
bloqueado aunque la variable esté activada. Nunca se registran tokens ni enlaces.
"""
import logging
import threading
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Deque, List

from ..core.config import settings

logger = logging.getLogger(__name__)

ALLOWED_ENVS = ("dev", "test")
MAX_ENTRIES = 20


@dataclass(frozen=True)
class DevOutboxEntry:
    email: str
    raw_token: str
    created_at: datetime
    expires_at: datetime


_entries: Deque[DevOutboxEntry] = deque(maxlen=MAX_ENTRIES)
_lock = threading.Lock()


def is_enabled() -> bool:
    """Lista de permitidos: solo dev/test. Cualquier otro valor de env lo bloquea."""
    return bool(settings.PASSWORD_RESET_DEV_OUTBOX) and str(settings.env).strip().lower() in ALLOWED_ENVS


def build_reset_path(raw_token: str) -> str:
    # Ruta relativa: se abre en el mismo origen del frontend (proxy /api), sin FRONTEND_BASE_URL.
    return f"/auth/reset-password#token={raw_token}"


def store(email: str, raw_token: str) -> None:
    if not is_enabled():
        return
    now = datetime.now(timezone.utc)
    entry = DevOutboxEntry(
        email=email.strip().lower(),
        raw_token=raw_token,
        created_at=now,
        expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
    )
    with _lock:
        _entries.append(entry)


def entries_for(email: str) -> List[DevOutboxEntry]:
    """Entradas no caducadas del correo indicado, de la más reciente a la más antigua."""
    if not is_enabled():
        return []
    key = email.strip().lower()
    now = datetime.now(timezone.utc)
    with _lock:
        return [e for e in reversed(_entries) if e.email == key and e.expires_at > now]


def clear() -> None:
    with _lock:
        _entries.clear()


def log_startup_status() -> None:
    if not settings.PASSWORD_RESET_DEV_OUTBOX:
        return
    if is_enabled():
        logger.warning(
            "PASSWORD_RESET_DEV_OUTBOX is enabled (env=%s): password reset links are NOT emailed; "
            "they are kept in memory and exposed by a development-only endpoint. Never use in production.",
            settings.env,
        )
    else:
        logger.error(
            "PASSWORD_RESET_DEV_OUTBOX is set but ignored because env=%s is not one of %s.",
            settings.env, ", ".join(ALLOWED_ENVS),
        )
