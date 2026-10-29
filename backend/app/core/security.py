import hmac
import hashlib
import secrets
import base64
import json
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from .config import settings

# Algoritmo y configuración de hashing según recomendaciones OWASP (PBKDF2-HMAC-SHA256, 600.000 iteraciones)
PBKDF2_ITERATIONS = 600000
ALGORITHM = "HS256"
# Claim JWT con la versión de credenciales del usuario (users.token_version).
TOKEN_VERSION_CLAIM = "ver"


def user_token_version(user: Any) -> int:
    return getattr(user, "token_version", None) or 0


def hash_reset_token(raw_token: str) -> str:
    """Hash SHA-256 (hex) de un token de recuperación. Es lo único que se guarda en BD."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_reset_token() -> str:
    """Token de recuperación aleatorio (256 bits, URL-safe)."""
    return secrets.token_urlsafe(32)

def get_password_hash(password: str) -> str:
    """Calcula el hash de la contraseña usando PBKDF2-HMAC-SHA256 y un salt criptográfico."""
    if not isinstance(password, str) or not password:
        raise ValueError("Password must be a non-empty string")
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    salt_hex = salt.hex()
    dk_hex = dk.hex()
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt_hex}${dk_hex}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si la contraseña en texto plano coincide con el hash almacenado."""
    try:
        parts = hashed_password.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return False
        iterations = int(parts[1])
        salt = bytes.fromhex(parts[2])
        expected_dk = bytes.fromhex(parts[3])

        computed_dk = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(expected_dk, computed_dk)
    except Exception:
        return False

def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

def _b64decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data.encode("ascii"))

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Genera un token JWT firmado mediante HMAC-SHA256 (HS256) con algoritmo explícito."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp())
    })

    header = {"alg": ALGORITHM, "typ": "JWT"}

    header_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
    payload_bytes = json.dumps(to_encode, separators=(",", ":")).encode("utf-8")

    header_b64 = _b64encode(header_bytes)
    payload_b64 = _b64encode(payload_bytes)

    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    secret_bytes = settings.JWT_SECRET_KEY.encode("utf-8")

    signature = hmac.new(secret_bytes, signing_input, hashlib.sha256).digest()
    signature_b64 = _b64encode(signature)

    return f"{header_b64}.{payload_b64}.{signature_b64}"

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodifica y valida rigurosamente un token JWT.
    Rechaza explícitamente tokens manipulados, algoritmos no permitidos ('none', etc.) o tokens expirados.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        header_b64, payload_b64, signature_b64 = parts

        # Verificar cabecera y algoritmo explícito
        header_bytes = _b64decode(header_b64)
        header = json.loads(header_bytes.decode("utf-8"))
        if header.get("alg") != ALGORITHM or header.get("typ") != "JWT":
            # Rechazar algoritmos arbitrarios o no permitidos
            return None

        # Verificar firma criptográfica
        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        secret_bytes = settings.JWT_SECRET_KEY.encode("utf-8")
        expected_sig = hmac.new(secret_bytes, signing_input, hashlib.sha256).digest()
        provided_sig = _b64decode(signature_b64)

        if not hmac.compare_digest(expected_sig, provided_sig):
            return None

        # Decodificar y validar payload
        payload_bytes = _b64decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))

        now_ts = int(datetime.now(timezone.utc).timestamp())
        if "exp" in payload and payload["exp"] < now_ts:
            # Token expirado
            return None

        return payload
    except Exception:
        return None
