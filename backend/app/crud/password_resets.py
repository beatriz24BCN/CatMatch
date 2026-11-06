import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from ..core.security import generate_reset_token, hash_reset_token
from ..models.password_reset_token import PasswordResetToken
from ..models.user import User


def _now() -> datetime:
    return datetime.now(timezone.utc)


def has_recent_token(db: Session, user_id: uuid.UUID, min_interval_seconds: int) -> bool:
    """Indica si ya se emitió un token para el usuario hace menos de min_interval_seconds."""
    if min_interval_seconds <= 0:
        return False
    since = _now() - timedelta(seconds=min_interval_seconds)
    stmt = select(PasswordResetToken.id).where(
        PasswordResetToken.user_id == user_id,
        PasswordResetToken.created_at >= since,
    ).limit(1)
    return db.execute(stmt).first() is not None


def create_reset_token(db: Session, user_id: uuid.UUID, expire_minutes: int) -> str:
    """Crea un token nuevo y devuelve su valor en claro (solo se persiste el hash).

    Los tokens pendientes anteriores del usuario se marcan como usados para que
    solo el enlace más reciente sea válido.
    """
    now = _now()
    db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user_id, PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
        .execution_options(synchronize_session=False)
    )
    raw_token = generate_reset_token()
    db.add(PasswordResetToken(
        id=uuid.uuid4(),
        user_id=user_id,
        token_hash=hash_reset_token(raw_token),
        expires_at=now + timedelta(minutes=expire_minutes),
        created_at=now,
    ))
    db.commit()
    return raw_token


def is_token_usable(db: Session, raw_token: str) -> bool:
    """Comprobación previa (sin modificar nada): existe, no está usado y no ha caducado."""
    stmt = select(PasswordResetToken.id).where(
        PasswordResetToken.token_hash == hash_reset_token(raw_token),
        PasswordResetToken.used_at.is_(None),
        PasswordResetToken.expires_at > _now(),
    ).limit(1)
    return db.execute(stmt).first() is not None


def reset_password_with_token(db: Session, raw_token: str, new_hashed_password: str) -> Optional[uuid.UUID]:
    """Consume el token y cambia la contraseña en una única transacción.

    El UPDATE condicional (used_at IS NULL AND expires_at > now) es atómico: si dos
    peticiones usan el mismo token a la vez, solo una obtiene la fila. En la misma
    transacción se actualiza la contraseña y se incrementa token_version para
    invalidar todos los JWT emitidos antes. Devuelve el id del usuario o None.
    """
    now = _now()
    try:
        row = db.execute(
            update(PasswordResetToken)
            .where(
                PasswordResetToken.token_hash == hash_reset_token(raw_token),
                PasswordResetToken.used_at.is_(None),
                PasswordResetToken.expires_at > now,
            )
            .values(used_at=now)
            .returning(PasswordResetToken.user_id)
            .execution_options(synchronize_session=False)
        ).first()
        if row is None:
            db.rollback()
            return None
        user_id = row[0]

        result = db.execute(
            update(User)
            .where(User.id == user_id, User.is_active.is_(True))
            .values(
                hashed_password=new_hashed_password,
                token_version=User.token_version + 1,
                updated_at=now,
            )
            .execution_options(synchronize_session=False)
        )
        if result.rowcount != 1:
            db.rollback()
            return None

        db.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.user_id == user_id, PasswordResetToken.used_at.is_(None))
            .values(used_at=now)
            .execution_options(synchronize_session=False)
        )
        db.commit()
        return user_id
    except Exception:
        db.rollback()
        raise
