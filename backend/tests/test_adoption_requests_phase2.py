import os
import unittest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from backend.app.main import app
from backend.app.crud import adoption_requests as ar_crud
from backend.app.api.deps import get_current_admin
from backend.app.models.user import User

client = TestClient(app)

fake_admin = type('AdminUser', (), {'id': '00000000-0000-0000-0000-000000000001', 'role': 'admin', 'is_active': True})()

class AdoptionRequestsPhase2ApiTestCase(unittest.TestCase):
    def setUp(self):
        self._orig_list = getattr(ar_crud, 'list_adoption_requests', None)
        self._orig_get = getattr(ar_crud, 'get_adoption_request', None)
        self._orig_update = getattr(ar_crud, 'update_adoption_request_status', None)
        # Mock admin autenticado para este caso de prueba específico
        app.dependency_overrides[get_current_admin] = lambda: fake_admin

    def tearDown(self):
        app.dependency_overrides.pop(get_current_admin, None)
        if self._orig_list:
            ar_crud.list_adoption_requests = self._orig_list
        if self._orig_get:
            ar_crud.get_adoption_request = self._orig_get
        if self._orig_update:
            ar_crud.update_adoption_request_status = self._orig_update

    def test_list_requests_success(self):
        from datetime import datetime
        def fake_list(db, status=None, limit=100, offset=0):
            return [type('AR', (), {
                'id': '00000000-0000-0000-0000-000000000021',
                'cat_id': '00000000-0000-0000-0000-000000000031',
                'contact_email': 'x@x.com',
                'person_id': None,
                'contact_phone': None,
                'message': None,
                'status': status or 'pending',
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            })()]

        ar_crud.list_adoption_requests = fake_list
        resp = client.get('/api/adoption_requests/?status=pending')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIsInstance(data, list)
        self.assertGreaterEqual(len(data), 1)

    def test_update_status_success(self):
        from datetime import datetime
        def fake_get(db, req_id):
            return type('AR', (), {
                'id': req_id,
                'cat_id': '00000000-0000-0000-0000-000000000041',
                'contact_email': 'y@y.com',
                'person_id': None,
                'contact_phone': None,
                'message': None,
                'status': 'pending',
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            })()

        def fake_update(db, req_id, new_status):
            return type('AR', (), {
                'id': req_id,
                'cat_id': '00000000-0000-0000-0000-000000000041',
                'contact_email': 'y@y.com',
                'person_id': None,
                'contact_phone': None,
                'message': None,
                'status': new_status,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            })()

        ar_crud.get_adoption_request = fake_get
        ar_crud.update_adoption_request_status = fake_update

        payload = {"status": "in_review"}
        resp = client.patch('/api/adoption_requests/00000000-0000-0000-0000-000000000041', json=payload)
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body.get('status'), 'in_review')

    def test_update_status_invalid(self):
        # missing or invalid status
        payload = {"name": "bad"}
        resp = client.patch('/api/adoption_requests/doesnotexist', json=payload)
        # this should return 422 because missing 'status'
        self.assertIn(resp.status_code, (400, 422, 404))

    def test_update_status_not_found(self):
        ar_crud.get_adoption_request = lambda db, req_id: None
        payload = {"status": "accepted"}
        resp = client.patch('/api/adoption_requests/00000000-0000-0000-0000-000000000099', json=payload)
        self.assertEqual(resp.status_code, 404)


if __name__ == '__main__':
    unittest.main()
