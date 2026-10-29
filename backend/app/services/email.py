"""Envío de correos transaccionales mediante SMTP (librería estándar).

Nunca se registran tokens, enlaces de recuperación, contraseñas ni direcciones
de correo: los errores se registran solo con el tipo de excepción.
"""
import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import List
from ..core.config import settings

logger = logging.getLogger(__name__)

SMTP_SECURITY_MODES = ("starttls", "ssl", "none")


def missing_email_settings() -> List[str]:
    """Devuelve los nombres de los ajustes que faltan o no son válidos (nunca sus valores)."""
    missing = []
    for name in ("SMTP_HOST", "SMTP_FROM", "FRONTEND_BASE_URL"):
        if not str(getattr(settings, name, "") or "").strip():
            missing.append(name)
    base_url = str(settings.FRONTEND_BASE_URL or "").strip()
    if base_url and not base_url.startswith(("https://", "http://")):
        missing.append("FRONTEND_BASE_URL")
    if settings.SMTP_SECURITY not in SMTP_SECURITY_MODES:
        missing.append("SMTP_SECURITY")
    if bool(settings.SMTP_USERNAME) != bool(settings.SMTP_PASSWORD):
        missing.append("SMTP_USERNAME/SMTP_PASSWORD")
    return missing


def build_password_reset_link(raw_token: str) -> str:
    # El token va en el fragmento (#): el navegador no lo envía al servidor ni en Referer.
    return f"{settings.FRONTEND_BASE_URL.strip().rstrip('/')}/auth/reset-password#token={raw_token}"


def _build_password_reset_message(to_address: str, raw_token: str) -> EmailMessage:
    link = build_password_reset_link(raw_token)
    minutes = settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
    msg = EmailMessage()
    msg["Subject"] = "Restablece tu contraseña de CatMatch"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_address
    msg.set_content(
        "Hola:\n\n"
        "Hemos recibido una solicitud para restablecer la contraseña de tu cuenta de CatMatch.\n"
        f"Abre este enlace para elegir una contraseña nueva (caduca en {minutes} minutos y solo puede usarse una vez):\n\n"
        f"{link}\n\n"
        "Si no has solicitado este cambio, puedes ignorar este correo: tu contraseña no cambiará.\n\n"
        "El equipo de CatMatch\n"
    )
    return msg


def send_password_reset_email(to_address: str, raw_token: str) -> bool:
    """Envía el correo de recuperación. Devuelve True si el servidor SMTP lo aceptó."""
    missing = missing_email_settings()
    if missing:
        logger.error("Password reset email not sent: email settings missing or invalid: %s", ", ".join(missing))
        return False

    msg = _build_password_reset_message(to_address, raw_token)
    timeout = settings.SMTP_TIMEOUT_SECONDS
    try:
        if settings.SMTP_SECURITY == "ssl":
            smtp = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=timeout,
                                    context=ssl.create_default_context())
        else:
            smtp = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=timeout)
        with smtp:
            if settings.SMTP_SECURITY == "starttls":
                smtp.starttls(context=ssl.create_default_context())
            if settings.SMTP_USERNAME:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
        return True
    except Exception as exc:  # noqa: BLE001 - cualquier fallo SMTP se registra sin datos sensibles
        logger.error("Password reset email could not be sent (%s).", type(exc).__name__)
        return False
