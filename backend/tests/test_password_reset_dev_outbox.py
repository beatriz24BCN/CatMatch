import logging
from unittest import mock

from backend.app.core.config import settings
from backend.app.services import dev_outbox
from backend.tests.test_password_reset import (
    EMAIL,
    NEW_PASSWORD,
    OLD_PASSWORD,
    FakeSMTP,
    PasswordResetTestCase,
)

NO_SMTP = {
    "SMTP_HOST": "",
    "SMTP_FROM": "",
    "FRONTEND_BASE_URL": "",
}


class PasswordResetDevOutboxTestCase(PasswordResetTestCase):
    """Buzón de desarrollo: sin SMTP, el enlace se obtiene de un endpoint solo dev/test."""

    def setUp(self):
        super().setUp()
        dev_outbox.clear()
        # Sin ninguna configuración SMTP, como en el Codespace.
        for k, v in NO_SMTP.items():
            p = mock.patch.object(settings, k, v)
            p.start()
            self._patches.append(p)

    def tearDown(self):
        dev_outbox.clear()
        super().tearDown()

    def _enable(self, enabled=True, env="dev"):
        for k, v in (("PASSWORD_RESET_DEV_OUTBOX", enabled), ("env", env)):
            p = mock.patch.object(settings, k, v)
            p.start()
            self._patches.append(p)

    def _outbox(self, email=EMAIL):
        return self.client.post("/api/auth/password-reset/dev-outbox", json={"email": email})

    def _link_token(self, item):
        path = item["reset_path"]
        prefix = "/auth/reset-password#token="
        self.assertTrue(path.startswith(prefix))
        return path[len(prefix):]

    # ---------- activación ----------
    def test_disabled_by_default(self):
        self.assertFalse(dev_outbox.is_enabled())
        self.assertEqual(self._outbox().status_code, 404)
        # Sin buzón ni SMTP se mantiene el 503 y no se crea ningún token.
        self.assertEqual(self._request().status_code, 503)
        self.assertEqual(self._tokens(), [])

    def test_blocked_in_production_even_if_variable_enabled(self):
        for env in ("prod", "production", "PROD", "staging", ""):
            with self.subTest(env=env):
                self._enable(True, env=env)
                self.assertFalse(dev_outbox.is_enabled())
                self.assertEqual(self._outbox().status_code, 404)
                resp = self._request()
                self.assertEqual(resp.status_code, 503)
                self.assertNotIn("token", resp.text.lower())
                self.assertEqual(self._tokens(), [])
                dev_outbox.store(EMAIL, "x" * 43)
                self.assertEqual(dev_outbox.entries_for(EMAIL), [])

    def test_production_with_smtp_and_variable_still_sends_email_not_outbox(self):
        from backend.tests.test_password_reset import SMTP_SETTINGS
        for k, v in SMTP_SETTINGS.items():
            p = mock.patch.object(settings, k, v)
            p.start()
            self._patches.append(p)
        self._enable(True, env="prod")
        resp = self._request()
        self.assertEqual(resp.status_code, 202)
        self.assertEqual(len(FakeSMTP.sent), 1)
        self.assertEqual(self._outbox().status_code, 404)
        self.assertEqual(len(dev_outbox._entries), 0)

    def test_startup_log_reports_block_without_secrets(self):
        self._enable(True, env="prod")
        with self.assertLogs("backend.app.services.dev_outbox", level="ERROR") as logs:
            dev_outbox.log_startup_status()
        self.assertIn("ignored", logs.output[0])

    # ---------- flujo completo ----------
    def test_request_does_not_expose_token_and_sends_no_email(self):
        self._enable()
        resp = self._request()
        self.assertEqual(resp.status_code, 202)
        self.assertEqual(set(resp.json()), {"message"})
        self.assertNotIn("token", resp.text.lower())
        self.assertNotIn("reset-password", resp.text)
        self.assertEqual(FakeSMTP.sent, [])
        self.assertEqual(len(self._tokens()), 1)

    def test_outbox_link_resets_password_once_and_invalidates_sessions(self):
        self._enable()
        old_client, old_login = self._login(OLD_PASSWORD, remember_me=True)
        self.assertEqual(old_login.status_code, 200)
        self.assertEqual(old_client.get("/api/auth/me").status_code, 200)

        with self.assertLogs(level="DEBUG") as logs:
            self.assertEqual(self._request().status_code, 202)
            out = self._outbox()
            logging.getLogger("probe").debug("probe")
        self.assertEqual(out.status_code, 200)
        self.assertEqual(out.headers.get("cache-control"), "no-store")
        items = out.json()["items"]
        self.assertEqual(len(items), 1)
        raw_token = self._link_token(items[0])
        # El token se guarda solo como hash y nunca aparece en logs.
        self.assertNotEqual(self._tokens()[0].token_hash, raw_token)
        self.assertFalse(any(raw_token in line for line in logs.output))

        resp = self._confirm(raw_token, NEW_PASSWORD)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self._login(NEW_PASSWORD)[1].status_code, 200)
        self.assertEqual(self._login(NEW_PASSWORD, remember_me=True)[1].status_code, 200)
        self.assertEqual(self._login(OLD_PASSWORD)[1].status_code, 401)

        # Uso único: el mismo enlace se rechaza y desaparece del buzón.
        self.assertEqual(self._confirm(raw_token, "OtraPassword789").status_code, 400)
        self.assertEqual(self._outbox().json()["items"], [])

        # La sesión anterior («Recordarme») deja de ser válida.
        self.assertEqual(old_client.get("/api/auth/me").status_code, 401)

    def test_outbox_keeps_password_validation(self):
        self._enable()
        self._request()
        raw_token = self._link_token(self._outbox().json()["items"][0])
        self.assertEqual(self._confirm(raw_token, "corta").status_code, 422)
        # El token no se consume por una contraseña inválida.
        self.assertEqual(len(self._outbox().json()["items"]), 1)

    def test_outbox_omits_expired_and_superseded_links(self):
        self._enable()
        with mock.patch.object(settings, "PASSWORD_RESET_MIN_INTERVAL_SECONDS", 0):
            self._request()
            first = self._link_token(self._outbox().json()["items"][0])
            self._request()
        items = self._outbox().json()["items"]
        self.assertEqual(len(items), 1)
        self.assertNotEqual(self._link_token(items[0]), first)
        self.assertEqual(self._confirm(first, NEW_PASSWORD).status_code, 400)

        # Caducidad de 30 minutos respetada: un token caducado no aparece ni sirve.
        from sqlalchemy import update
        from datetime import datetime, timedelta, timezone
        from backend.app.models.password_reset_token import PasswordResetToken
        with self.Session() as db:
            db.execute(update(PasswordResetToken).values(
                expires_at=datetime.now(timezone.utc) - timedelta(seconds=1)))
            db.commit()
        self.assertEqual(self._outbox().json()["items"], [])
        self.assertEqual(self._confirm(self._link_token(items[0]), NEW_PASSWORD).status_code, 400)

    def test_expiry_is_30_minutes(self):
        self._enable()
        self.assertEqual(settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES, 30)
        self._request()
        item = self._outbox().json()["items"][0]
        from datetime import datetime
        created = datetime.fromisoformat(item["created_at"])
        expires = datetime.fromisoformat(item["expires_at"])
        self.assertEqual(round((expires - created).total_seconds()), 30 * 60)

    def test_outbox_is_per_email_and_silent_for_unknown(self):
        self._enable()
        self.assertEqual(self._request("nadie@example.com").status_code, 202)
        self.assertEqual(self._outbox("nadie@example.com").json()["items"], [])
        self._request()
        self.assertEqual(self._outbox("otra@example.com").json()["items"], [])
        self.assertEqual(self._outbox("not-an-email").status_code, 422)

    def test_outbox_endpoint_hidden_from_openapi(self):
        self._enable()
        schema = self.client.get("/openapi.json").json()
        self.assertNotIn("/api/auth/password-reset/dev-outbox", schema["paths"])


# Las pruebas heredadas de la clase base necesitan SMTP; se ejecutan en su propio módulo.
for _name in dir(PasswordResetTestCase):
    if _name.startswith("test_") and _name not in PasswordResetDevOutboxTestCase.__dict__:
        setattr(PasswordResetDevOutboxTestCase, _name, None)

# Evita que unittest vuelva a ejecutar aquí las pruebas de la clase base importada.
del PasswordResetTestCase
