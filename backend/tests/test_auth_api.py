import os
import unittest
import uuid
from datetime import datetime, timezone

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.security import get_password_hash, verify_password, create_access_token, decode_access_token
from backend.app.models.user import User
import backend.app.api.deps as deps
import backend.app.crud.users as users_crud
import backend.app.crud.adoption_requests as ar_crud
import backend.app.crud.cats as cats_crud

client = TestClient(app)

class AuthApiTestCase(unittest.TestCase):
    def setUp(self):
        self._orig_get_by_email = getattr(users_crud, 'get_user_by_email', None)
        self._orig_create_user = getattr(users_crud, 'create_user', None)
        self._orig_get_by_id = getattr(users_crud, 'get_user_by_id', None)
        self._orig_deps_get_by_id = getattr(deps, 'get_user_by_id', None)
        self._orig_list_ar = getattr(ar_crud, 'list_adoption_requests', None)
        self._orig_get_cat = getattr(cats_crud, 'get_cat', None)
        self._orig_create_ar = getattr(ar_crud, 'create_adoption_request', None)

    def tearDown(self):
        if self._orig_get_by_email:
            users_crud.get_user_by_email = self._orig_get_by_email
        if self._orig_create_user:
            users_crud.create_user = self._orig_create_user
        if self._orig_get_by_id:
            users_crud.get_user_by_id = self._orig_get_by_id
        if self._orig_deps_get_by_id:
            deps.get_user_by_id = self._orig_deps_get_by_id
        if self._orig_list_ar:
            ar_crud.list_adoption_requests = self._orig_list_ar
        if self._orig_get_cat:
            cats_crud.get_cat = self._orig_get_cat
        if self._orig_create_ar:
            ar_crud.create_adoption_request = self._orig_create_ar

    # 1. Hashing y verificación unitaria
    def test_password_hashing_and_verification(self):
        pw = "SuperSecret123!"
        hashed = get_password_hash(pw)
        self.assertTrue(hashed.startswith("pbkdf2_sha256$600000$"))
        self.assertTrue(verify_password(pw, hashed))
        self.assertFalse(verify_password("WrongPassword", hashed))

    # 2. Token JWT emision y validacion
    def test_jwt_token_creation_and_decoding(self):
        user_id = str(uuid.uuid4())
        data = {"sub": user_id, "email": "test@catmatch.org", "role": "user"}
        token = create_access_token(data)
        decoded = decode_access_token(token)
        self.assertIsNotNone(decoded)
        self.assertEqual(decoded.get("sub"), user_id)
        self.assertEqual(decoded.get("email"), "test@catmatch.org")

        # Rechazo de token alterado
        tampered_token = token[:-4] + "xxxx"
        self.assertIsNone(decode_access_token(tampered_token))

    # 3. Registro correcto (201)
    def test_register_success(self):
        users_crud.get_user_by_email = lambda db, email: None
        created_user = type('U', (), {
            'id': uuid.uuid4(),
            'email': 'newuser@example.com',
            'role': 'user',
            'is_active': True,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
        })()
        users_crud.create_user = lambda db, email, hashed_password, role: created_user

        resp = client.post("/api/auth/register", json={
            "email": "newuser@example.com",
            "password": "ValidPassword123"
        })
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["email"], "newuser@example.com")
        self.assertEqual(data["role"], "user")
        self.assertNotIn("password", data)
        self.assertNotIn("hashed_password", data)

    # 4. Registro con email duplicado (409)
    def test_register_duplicate_email(self):
        existing_user = type('U', (), {'id': uuid.uuid4(), 'email': 'dup@example.com'})()
        users_crud.get_user_by_email = lambda db, email: existing_user

        resp = client.post("/api/auth/register", json={
            "email": "dup@example.com",
            "password": "ValidPassword123"
        })
        self.assertEqual(resp.status_code, 409)

    # 5. Validación de datos de registro (contraseña corta) (422)
    def test_register_validation_short_password(self):
        resp = client.post("/api/auth/register", json={
            "email": "valid@example.com",
            "password": "short" # < 8 caracteres
        })
        self.assertEqual(resp.status_code, 422)

    # 6. Login correcto (200) y obtención de token
    def test_login_success(self):
        pw = "Password123"
        user_uuid = uuid.uuid4()
        user_obj = type('U', (), {
            'id': user_uuid,
            'email': 'login@example.com',
            'hashed_password': get_password_hash(pw),
            'role': 'user',
            'is_active': True
        })()
        users_crud.get_user_by_email = lambda db, email: user_obj

        resp = client.post("/api/auth/login", json={
            "email": "login@example.com",
            "password": pw
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["token_type"], "bearer")
        # Verificar que fijó cookie catmatch_token
        self.assertIn("catmatch_token", resp.cookies)

    # 7. Login credenciales incorrectas (401)
    def test_login_invalid_password(self):
        user_obj = type('U', (), {
            'id': uuid.uuid4(),
            'email': 'login@example.com',
            'hashed_password': get_password_hash("CorrectPassword"),
            'role': 'user',
            'is_active': True
        })()
        users_crud.get_user_by_email = lambda db, email: user_obj

        resp = client.post("/api/auth/login", json={
            "email": "login@example.com",
            "password": "WrongPassword"
        })
        self.assertEqual(resp.status_code, 401)

    # 8. /api/auth/me sin autenticación (401)
    def test_get_me_unauthorized(self):
        resp = client.get("/api/auth/me")
        self.assertEqual(resp.status_code, 401)

    # 9. /api/auth/me con token válido (200)
    def test_get_me_authorized(self):
        user_uuid = uuid.uuid4()
        user_obj = type('U', (), {
            'id': user_uuid,
            'email': 'me@example.com',
            'role': 'user',
            'is_active': True,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        })()
        users_crud.get_user_by_id = lambda db, uid: user_obj
        deps.get_user_by_id = lambda db, uid: user_obj

        token = create_access_token({"sub": str(user_uuid), "email": "me@example.com", "role": "user"})
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["email"], "me@example.com")

    # 10. Protección de endpoints administrativos frente a anónimos (401)
    def test_admin_routes_reject_anonymous(self):
        resp = client.get("/api/adoption_requests/")
        self.assertEqual(resp.status_code, 401)

    # 11. Rechazo de usuario normal en endpoints administrativos (403)
    def test_admin_routes_reject_normal_user(self):
        user_uuid = uuid.uuid4()
        normal_user = type('U', (), {
            'id': user_uuid,
            'email': 'user@example.com',
            'role': 'user', # NO admin
            'is_active': True,
        })()
        users_crud.get_user_by_id = lambda db, uid: normal_user
        deps.get_user_by_id = lambda db, uid: normal_user

        token = create_access_token({"sub": str(user_uuid), "email": "user@example.com", "role": "user"})
        resp = client.get("/api/adoption_requests/", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(resp.status_code, 403)

    # 12. Acceso permitido a administrador (200)
    def test_admin_routes_allow_admin_user(self):
        admin_uuid = uuid.uuid4()
        admin_user = type('U', (), {
            'id': admin_uuid,
            'email': 'admin@catmatch.org',
            'role': 'admin',
            'is_active': True,
        })()
        users_crud.get_user_by_id = lambda db, uid: admin_user
        deps.get_user_by_id = lambda db, uid: admin_user
        ar_crud.list_adoption_requests = lambda db, status=None, limit=100, offset=0: []

        token = create_access_token({"sub": str(admin_uuid), "email": "admin@catmatch.org", "role": "admin"})
        resp = client.get("/api/adoption_requests/", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(resp.status_code, 200)

    # 13. Conservación del flujo de adopción anónimo (creación de solicitud sin cuenta)
    def test_adoption_request_creation_remains_public(self):
        cat_uuid = "00000000-0000-0000-0000-000000000001"
        cats_crud.get_cat = lambda db, cid: {"id": cat_uuid, "name": "Milo"}
        fake_ar = type('AR', (), {
            'id': uuid.uuid4(),
            'cat_id': cat_uuid,
            'contact_email': 'public_adopter@example.com',
            'person_id': None,
            'contact_phone': None,
            'message': 'Quiero adoptar sin cuenta',
            'status': 'pending',
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        })()
        ar_crud.create_adoption_request = lambda db, data: fake_ar

        resp = client.post("/api/adoption_requests/", json={
            "cat_id": cat_uuid,
            "contact_email": "public_adopter@example.com",
            "message": "Quiero adoptar sin cuenta"
        })
        self.assertEqual(resp.status_code, 201)

if __name__ == "__main__":
    unittest.main()
