import os
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from unittest import mock

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select, update
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.api.deps import get_db
from backend.app.core.config import settings
from backend.app.core.security import (
    create_access_token,
    get_password_hash,
    hash_reset_token,
    verify_password,
)
from backend.app.db.base import Base
from backend.app.models.password_reset_token import PasswordResetToken
from backend.app.models.user import User
from backend.app.services import email as email_service
import backend.app.api.deps as deps
import backend.app.crud.users as users_crud

OLD_PASSWORD = "OldPassword123"
NEW_PASSWORD = "NewPassword456"
EMAIL = "reset@example.com"

SMTP_SETTINGS = {
    "SMTP_HOST": "smtp.test.invalid",
    "SMTP_PORT": 587,
    "SMTP_FROM": "CatMatch <no-reply@test.invalid>",
    "SMTP_USERNAME": "",
    "SMTP_PASSWORD": "",
    "SMTP_SECURITY": "starttls",
    "FRONTEND_BASE_URL": "https://catmatch.test.invalid",
}


class FakeSMTP:
    """Sustituye smtplib.SMTP: registra los mensajes sin conectarse a ningún servidor."""
    sent = []
    fail = False

    def __init__(self, host, port, timeout=None):
        self.host, self.port = host, port

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self, context=None):
        pass

    def login(self, user, password):
        pass

    def send_message(self, msg):
        if FakeSMTP.fail:
            raise ConnectionRefusedError("connection refused")
        FakeSMTP.sent.append(msg)


class PasswordResetTestCase(unittest.TestCase):
    def setUp(self):
        # Las demás suites sustituyen funciones CRUD; aquí se usan las reales.
        self._orig = {
            "users_get_by_email": users_crud.get_user_by_email,
            "deps_get_by_id": deps.get_user_by_id,
        }
        self.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )

        @event.listens_for(self.engine, "connect")
        def _sqlite_now(dbapi_conn, _):
            dbapi_conn.create_function(
                "now", 0, lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")
            )

        Base.metadata.create_all(
            self.engine, tables=[User.__table__, PasswordResetToken.__table__]
        )
        self.Session = sessionmaker(bind=self.engine, autoflush=False, autocommit=False, future=True)

        def _get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = _get_db
        self.client = TestClient(app)

        with self.Session() as db:
            user = User(
                id=uuid.uuid4(),
                email=EMAIL,
                hashed_password=get_password_hash(OLD_PASSWORD),
                role="user",
                is_active=True,
            )
            db.add(user)
            db.commit()
            self.user_id = user.id

        FakeSMTP.sent = []
        FakeSMTP.fail = False
        self._patches = [mock.patch.object(settings, k, v) for k, v in SMTP_SETTINGS.items()]
        self._patches.append(mock.patch.object(email_service.smtplib, "SMTP", FakeSMTP))
        for p in self._patches:
            p.start()

    def tearDown(self):
        for p in self._patches:
            p.stop()
        app.dependency_overrides.pop(get_db, None)
        users_crud.get_user_by_email = self._orig["users_get_by_email"]
        deps.get_user_by_id = self._orig["deps_get_by_id"]
        self.engine.dispose()

    # ---------- utilidades ----------
    def _tokens(self):
        with self.Session() as db:
            return db.execute(select(PasswordResetToken)).scalars().all()

    def _user(self):
        with self.Session() as db:
            return db.get(User, self.user_id)

    def _request(self, email=EMAIL):
        return self.client.post("/api/auth/password-reset/request", json={"email": email})

    def _request_and_get_raw_token(self):
        resp = self._request()
        self.assertEqual(resp.status_code, 202)
        self.assertEqual(len(FakeSMTP.sent), 1)
        body = FakeSMTP.sent[-1].get_content()
        marker = "/auth/reset-password#token="
        start = body.index(marker) + len(marker)
        return body[start:].split()[0]

    def _confirm(self, token, password=NEW_PASSWORD, client=None):
        return (client or self.client).post(
            "/api/auth/password-reset/confirm", json={"token": token, "new_password": password}
        )

    def _login(self, password, remember_me=None):
        client = TestClient(app)
        body = {"email": EMAIL, "password": password}
        if remember_me is not None:
            body["remember_me"] = remember_me
        resp = client.post("/api/auth/login", json=body)
        return client, resp

    # ---------- solicitud ----------
    def test_request_known_email_creates_hashed_token_and_sends_email(self):
        raw = self._request_and_get_raw_token()
        tokens = self._tokens()
        self.assertEqual(len(tokens), 1)
        stored = tokens[0]
        self.assertEqual(stored.token_hash, hash_reset_token(raw))
        self.assertNotEqual(stored.token_hash, raw)
        self.assertIsNone(stored.used_at)
        self.assertGreaterEqual(len(raw), 40)
        expires = stored.expires_at.replace(tzinfo=timezone.utc)
        remaining = (expires - datetime.now(timezone.utc)).total_seconds()
        self.assertTrue(29 * 60 < remaining <= 30 * 60, remaining)
        msg = FakeSMTP.sent[0]
        self.assertEqual(msg["To"], EMAIL)
        self.assertIn("https://catmatch.test.invalid/auth/reset-password#token=", msg.get_content())

    def test_request_response_does_not_reveal_account_existence(self):
        known = self._request()
        unknown = self._request("nobody@example.com")
        self.assertEqual(known.status_code, 202)
        self.assertEqual(unknown.status_code, 202)
        self.assertEqual(known.json(), unknown.json())
        # Sin token ni correo para el desconocido; ningún token en la respuesta
        self.assertEqual(len(self._tokens()), 1)
        self.assertEqual(len(FakeSMTP.sent), 1)
        self.assertNotIn("token", known.text.lower().replace("token_type", ""))

    def test_request_inactive_user_is_silent(self):
        with self.Session() as db:
            db.execute(update(User).where(User.id == self.user_id).values(is_active=False))
            db.commit()
        resp = self._request()
        self.assertEqual(resp.status_code, 202)
        self.assertEqual(self._tokens(), [])
        self.assertEqual(FakeSMTP.sent, [])

    def test_request_invalid_email_format_rejected(self):
        resp = self._request("no-es-un-correo")
        self.assertEqual(resp.status_code, 422)

    def test_request_throttled_within_min_interval(self):
        self._request()
        self._request()
        self.assertEqual(len(self._tokens()), 1)
        self.assertEqual(len(FakeSMTP.sent), 1)

    def test_new_request_invalidates_previous_pending_token(self):
        with mock.patch.object(settings, "PASSWORD_RESET_MIN_INTERVAL_SECONDS", 0):
            first = self._request_and_get_raw_token()
            FakeSMTP.sent = []
            second = self._request_and_get_raw_token()
        self.assertEqual(self._confirm(first).status_code, 400)
        self.assertEqual(self._confirm(second).status_code, 200)

    def test_request_without_smtp_config_returns_503_and_logs_no_secrets(self):
        with mock.patch.object(settings, "SMTP_HOST", ""), \
                self.assertLogs("backend.app.api.routers.auth", level="ERROR") as logs:
            resp = self._request()
        self.assertEqual(resp.status_code, 503)
        self.assertEqual(self._tokens(), [])
        self.assertEqual(FakeSMTP.sent, [])
        joined = "\n".join(logs.output)
        self.assertIn("SMTP_HOST", joined)
        self.assertNotIn(EMAIL, joined)
        # Mismo resultado para un correo desconocido: no revela existencia
        with mock.patch.object(settings, "SMTP_HOST", ""), self.assertLogs(level="ERROR"):
            self.assertEqual(self._request("nobody@example.com").json(), resp.json())

    def test_smtp_failure_is_logged_without_sensitive_data(self):
        FakeSMTP.fail = True
        with self.assertLogs("backend.app.services.email", level="ERROR") as logs:
            resp = self._request()
        self.assertEqual(resp.status_code, 202)
        raw_hash = self._tokens()[0].token_hash
        joined = "\n".join(logs.output)
        self.assertIn("ConnectionRefusedError", joined)
        for sensitive in (EMAIL, "reset-password", "#token=", raw_hash):
            self.assertNotIn(sensitive, joined)

    # ---------- confirmación ----------
    def test_confirm_valid_token_changes_password_and_consumes_token(self):
        raw = self._request_and_get_raw_token()
        before = self._user().token_version
        resp = self._confirm(raw)
        self.assertEqual(resp.status_code, 200)
        user = self._user()
        self.assertTrue(verify_password(NEW_PASSWORD, user.hashed_password))
        self.assertFalse(verify_password(OLD_PASSWORD, user.hashed_password))
        self.assertTrue(user.hashed_password.startswith("pbkdf2_sha256$"))
        self.assertEqual(user.token_version, before + 1)
        self.assertIsNotNone(self._tokens()[0].used_at)
        # Borra la cookie de sesión de este navegador
        set_cookie = resp.headers.get("set-cookie", "").lower()
        self.assertIn("catmatch_token=", set_cookie)
        self.assertIn("max-age=0", set_cookie)

    def test_confirm_reused_token_rejected(self):
        raw = self._request_and_get_raw_token()
        self.assertEqual(self._confirm(raw).status_code, 200)
        resp = self._confirm(raw, password="AnotherPassword789")
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(verify_password(NEW_PASSWORD, self._user().hashed_password))
        self.assertEqual(self._user().token_version, 1)

    def test_confirm_invalid_token_rejected(self):
        self._request_and_get_raw_token()
        resp = self._confirm("x" * 43)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("no es válido o ha caducado", resp.json()["detail"])
        self.assertTrue(verify_password(OLD_PASSWORD, self._user().hashed_password))

    def test_confirm_expired_token_rejected(self):
        raw = self._request_and_get_raw_token()
        with self.Session() as db:
            db.execute(update(PasswordResetToken).values(
                expires_at=datetime.now(timezone.utc) - timedelta(minutes=1)))
            db.commit()
        resp = self._confirm(raw)
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(verify_password(OLD_PASSWORD, self._user().hashed_password))
        self.assertEqual(self._user().token_version, 0)

    def test_confirm_rejects_invalid_payloads(self):
        raw = self._request_and_get_raw_token()
        for body in (
            {"token": raw, "new_password": "short"},
            {"token": raw},
            {"new_password": NEW_PASSWORD},
            {"token": "abc", "new_password": NEW_PASSWORD},
            {"token": "a" * 300, "new_password": NEW_PASSWORD},
        ):
            resp = self.client.post("/api/auth/password-reset/confirm", json=body)
            self.assertEqual(resp.status_code, 422, body)
        # El token sigue siendo válido tras los intentos rechazados
        self.assertEqual(self._confirm(raw).status_code, 200)

    def test_concurrent_consumption_only_one_succeeds(self):
        from backend.app.crud import password_resets
        raw = self._request_and_get_raw_token()
        with self.Session() as db1, self.Session() as db2:
            self.assertTrue(password_resets.is_token_usable(db1, raw))
            self.assertTrue(password_resets.is_token_usable(db2, raw))
            first = password_resets.reset_password_with_token(db1, raw, get_password_hash(NEW_PASSWORD))
            second = password_resets.reset_password_with_token(db2, raw, get_password_hash("Other123456"))
        self.assertEqual(first, self.user_id)
        self.assertIsNone(second)
        self.assertTrue(verify_password(NEW_PASSWORD, self._user().hashed_password))
        self.assertEqual(self._user().token_version, 1)

    # ---------- sesiones ----------
    def test_reset_invalidates_previous_sessions(self):
        normal_client, normal = self._login(OLD_PASSWORD)
        remember_client, remembered = self._login(OLD_PASSWORD, remember_me=True)
        self.assertEqual(normal.status_code, 200)
        self.assertEqual(remembered.status_code, 200)
        bearer = normal.json()["access_token"]
        legacy = create_access_token({"sub": str(self.user_id), "email": EMAIL, "role": "user"})

        self.assertEqual(normal_client.get("/api/auth/me").status_code, 200)
        self.assertEqual(remember_client.get("/api/auth/me").status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {bearer}"}).status_code, 200)
        # Token emitido antes de existir la claim "ver": válido mientras token_version = 0
        self.assertEqual(self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {legacy}"}).status_code, 200)

        raw = self._request_and_get_raw_token()
        self.assertEqual(self._confirm(raw).status_code, 200)

        self.assertEqual(normal_client.get("/api/auth/me").status_code, 401)
        self.assertEqual(remember_client.get("/api/auth/me").status_code, 401)
        self.assertEqual(self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {bearer}"}).status_code, 401)
        self.assertEqual(self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {legacy}"}).status_code, 401)

        # Contraseña antigua rechazada; la nueva funciona con y sin «Recordarme»
        self.assertEqual(self._login(OLD_PASSWORD)[1].status_code, 401)
        new_client, new_login = self._login(NEW_PASSWORD)
        self.assertEqual(new_login.status_code, 200)
        self.assertEqual(new_client.get("/api/auth/me").status_code, 200)
        new_remember_client, new_remember = self._login(NEW_PASSWORD, remember_me=True)
        self.assertEqual(new_remember.status_code, 200)
        self.assertIn("max-age=2592000", new_remember.headers["set-cookie"].lower())
        self.assertEqual(new_remember_client.get("/api/auth/me").status_code, 200)

    def test_token_with_wrong_version_type_rejected(self):
        bad = create_access_token({"sub": str(self.user_id), "email": EMAIL, "role": "user", "ver": "0"})
        resp = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {bad}"})
        self.assertEqual(resp.status_code, 401)


if __name__ == "__main__":
    unittest.main()
