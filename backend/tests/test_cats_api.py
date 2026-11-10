import os
# ensure a safe DATABASE_URL is present for imports (tests use mocks and must not require real Postgres)
os.environ.setdefault('DATABASE_URL', 'sqlite:///:memory:')

import unittest
from fastapi.testclient import TestClient
from backend.app.main import app

# import router module to monkeypatch CRUD functions
import backend.app.api.routers.cats as cats_router

class CatsApiTestCase(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        # backup original functions if present
        self._orig_list = getattr(cats_router, 'crud').list_cats if hasattr(cats_router, 'crud') else None
        self._orig_get = getattr(cats_router, 'crud').get_cat if hasattr(cats_router, 'crud') else None

        self.fake_cat = {
            "id": "11111111-1111-1111-1111-111111111111",
            "name": "Whiskers",
            "age_stage": "adult",
            "age_months": 36,
            "sex": "F",
            "breed": "European",
            "size": "M",
            "activity_level": "medium",
            "personality_traits": {},
            "good_with_children": True,
            "good_with_dogs": False,
            "vaccinated": True,
            "neutered": True,
            "health_status": "good",
            "description": "Friendly",
            "image_urls": [],
            "location": "Shelter",
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z"
        }

        # monkeypatch CRUD functions to avoid DB access
        cats_router.crud.list_cats = lambda db, limit=100, offset=0, location=None, age_stage=None, activity_level=None: [
            c for c in [self.fake_cat]
            if (not location or location.lower() in c['location'].lower())
            and (not age_stage or age_stage == c['age_stage'])
            and (not activity_level or activity_level == c['activity_level'])
        ]
        cats_router.crud.get_cat = lambda db, cid: self.fake_cat if cid == self.fake_cat['id'] else None

    def tearDown(self):
        # restore originals
        if self._orig_list is not None:
            cats_router.crud.list_cats = self._orig_list
        if self._orig_get is not None:
            cats_router.crud.get_cat = self._orig_get

    def test_list_cats_returns_list(self):
        r = self.client.get('/api/cats')
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['name'], 'Whiskers')

    def test_list_cats_with_filters(self):
        # Match location
        r = self.client.get('/api/cats?location=Shelter&age_stage=adult&activity_level=medium')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()), 1)

        # Mismatch age_stage
        r_empty = self.client.get('/api/cats?age_stage=kitten')
        self.assertEqual(r_empty.status_code, 200)
        self.assertEqual(len(r_empty.json()), 0)

    def test_get_cat_found(self):
        r = self.client.get(f"/api/cats/{self.fake_cat['id']}")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data['id'], self.fake_cat['id'])

    def test_get_cat_not_found(self):
        r = self.client.get('/api/cats/00000000-0000-0000-0000-000000000000')
        self.assertEqual(r.status_code, 404)

if __name__ == '__main__':
    unittest.main()
