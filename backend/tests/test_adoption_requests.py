import os
import unittest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from backend.app.main import app
from backend.app.crud import adoption_requests as ar_crud
from backend.app.crud import cats as cats_crud

client = TestClient(app)

class AdoptionRequestsApiTestCase(unittest.TestCase):
    def setUp(self):
        self._orig_create = getattr(ar_crud, 'create_adoption_request', None)
        self._orig_get_cat = getattr(cats_crud, 'get_cat', None)

    def tearDown(self):
        if self._orig_create:
            ar_crud.create_adoption_request = self._orig_create
        if self._orig_get_cat:
            cats_crud.get_cat = self._orig_get_cat

    def test_create_adoption_request_success(self):
        from datetime import datetime

        def fake_get_cat(db, cid):
            return type('C', (), {"id": cid, "name": "Michi"})()

        def fake_create(db, data):
            attrs = dict(data, **{
                "id": "00000000-0000-0000-0000-000000000011",
                "person_id": data.get("person_id"),
                "contact_phone": None,
                "status": "pending",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
            return type('AR', (), attrs)()

        cats_crud.get_cat = fake_get_cat
        ar_crud.create_adoption_request = fake_create

        payload = {
            "cat_id": "00000000-0000-0000-0000-000000000011",
            "contact_email": "a@a.com",
            "message": "Hi",
            "person_id": "00000000-0000-0000-0000-000000000099"
        }
        resp = client.post('/api/adoption_requests/', json=payload)
        self.assertEqual(resp.status_code, 201)
        body = resp.json()
        self.assertEqual(body.get('id'), "00000000-0000-0000-0000-000000000011")
        self.assertEqual(body.get('contact_email'), "a@a.com")
        self.assertEqual(body.get('person_id'), "00000000-0000-0000-0000-000000000099")

    def test_create_adoption_request_validation(self):
        # missing cat_id should yield 422
        resp = client.post('/api/adoption_requests/', json={"contact_email": "a@a.com"})
        self.assertEqual(resp.status_code, 422)

    def test_create_adoption_request_cat_not_found(self):
        cats_crud.get_cat = lambda db, cid: None
        payload = {"cat_id": "00000000-0000-0000-0000-000000000012", "contact_email": "a@a.com"}
        resp = client.post('/api/adoption_requests/', json=payload)
        self.assertEqual(resp.status_code, 404)

    def test_create_adoption_request_db_error(self):
        def fake_get_cat(db, cid):
            return type('C', (), {"id": cid})()

        from sqlalchemy.exc import SQLAlchemyError
        def fake_create(db, data):
            raise SQLAlchemyError('db error')

        cats_crud.get_cat = fake_get_cat
        ar_crud.create_adoption_request = fake_create

        payload = {"cat_id": "00000000-0000-0000-0000-000000000013", "contact_email": "a@a.com"}
        resp = client.post('/api/adoption_requests/', json=payload)
        self.assertEqual(resp.status_code, 500)


if __name__ == '__main__':
    unittest.main()
