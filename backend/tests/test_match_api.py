import os
import unittest
from fastapi.testclient import TestClient

# Ensure app can import without real DATABASE_URL
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from backend.app.main import app

from backend.app.crud import cats as cats_crud
from backend.app.crud import persons as persons_crud

client = TestClient(app)

class MatchApiTestCase(unittest.TestCase):
    def setUp(self):
        # keep references to original functions to restore later
        self._orig_get_cat = cats_crud.get_cat
        self._orig_get_person = persons_crud.get_person

    def tearDown(self):
        cats_crud.get_cat = self._orig_get_cat
        persons_crud.get_person = self._orig_get_person

    def test_evaluate_with_payload_objects_no_incompatibility(self):
        payload = {
            "person": {
                "id": "00000000-0000-0000-0000-000000000001",
                "activity_level": "low",
                "preferred_cat_traits": ["calm"],
            },
            "cat": {
                "id": "00000000-0000-0000-0000-000000000002",
                "personality_traits": ["calm"],
                "activity_level": "low"
            }
        }
        resp = client.post("/api/match/evaluate", json=payload)
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIsNone(body.get("recommended"))

    def test_evaluate_incompatibility_children_by_id(self):
        # mock DB getters
        def fake_get_person(db, pid):
            return type('P', (), {"has_children": True})()
        def fake_get_cat(db, cid):
            return type('C', (), {"good_with_children": False})()
        persons_crud.get_person = fake_get_person
        cats_crud.get_cat = fake_get_cat

        resp = client.post("/api/match/evaluate", json={"person_id": "p1", "cat_id": "c1"})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body.get("recommended"), False)
        self.assertTrue(any(f.get("type") == "good_with_children" and f.get("match") is False for f in body.get("factors", [])))

    def test_evaluate_incompatibility_other_pets_by_id(self):
        def fake_get_person(db, pid):
            return type('P', (), {"has_other_pets": True})()
        def fake_get_cat(db, cid):
            return type('C', (), {"good_with_dogs": False})()
        persons_crud.get_person = fake_get_person
        cats_crud.get_cat = fake_get_cat

        resp = client.post("/api/match/evaluate", json={"person_id": "p2", "cat_id": "c2"})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body.get("recommended"), False)
        self.assertTrue(any(f.get("type") == "good_with_other_pets" and f.get("match") is False for f in body.get("factors", [])))

    def test_evaluate_not_found(self):
        # mock to return None
        persons_crud.get_person = lambda db, pid: None
        cats_crud.get_cat = lambda db, cid: type('C', (), {"good_with_dogs": True})()

        resp = client.post("/api/match/evaluate", json={"person_id": "missing", "cat_id": "c2"})
        self.assertEqual(resp.status_code, 404)

if __name__ == "__main__":
    unittest.main()
