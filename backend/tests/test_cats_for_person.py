import os
import unittest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from backend.app.main import app
from backend.app.crud import cats as cats_crud
from backend.app.services import matching as matching_service

client = TestClient(app)

class CatsForPersonTestCase(unittest.TestCase):
    def setUp(self):
        # keep originals
        self._orig_list_cats = cats_crud.list_cats
        self._orig_evaluate = matching_service.evaluate_match

    def tearDown(self):
        cats_crud.list_cats = self._orig_list_cats
        matching_service.evaluate_match = self._orig_evaluate

    def test_ordering_by_incompatibility_count(self):
        # three cats
        cats = [
            {"id": "c1"},
            {"id": "c2"},
            {"id": "c3"},
        ]
        def fake_list_cats(db, limit=100, offset=0):
            return cats
        cats_crud.list_cats = fake_list_cats

        # fake evaluate_match: c1 -> 2 incompatibilities, c2 -> 0, c3 -> 1
        def fake_evaluate(person, cat):
            cid = cat.get("id") if isinstance(cat, dict) else getattr(cat, "id", None)
            if cid == "c1":
                return {"recommended": False, "explanation": "", "factors": [{"match": False}, {"match": False}]}
            if cid == "c2":
                return {"recommended": None, "explanation": "", "factors": []}
            return {"recommended": None, "explanation": "", "factors": [{"match": False}]}
        matching_service.evaluate_match = fake_evaluate
        # also patch the router-level evaluate_match reference
        from backend.app.api import routers
        routers.cats.evaluate_match = fake_evaluate

        payload = {"person": {"id": "p1"}}
        resp = client.post("/api/cats/for_person", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        # expected order: c2 (0), c3 (1), c1 (2)
        ids = [item["cat"]["id"] for item in data]
        self.assertEqual(ids, ["c2", "c3", "c1"])

    def test_requires_person(self):
        resp = client.post("/api/cats/for_person", json={})
        self.assertEqual(resp.status_code, 400)

    def test_preserve_recommendation_field(self):
        cats = [{"id": "c1"}]
        cats_crud.list_cats = lambda db, limit=100, offset=0: cats
        matching_service.evaluate_match = lambda p, c: {"recommended": False, "explanation": "x", "factors": [{"match": False}]}
        from backend.app.api import routers
        routers.cats.evaluate_match = matching_service.evaluate_match
        resp = client.post("/api/cats/for_person", json={"person": {"id": "p1"}})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data[0]["match"]["recommended"], False)

    def test_factors_present_in_response(self):
        cats = [{"id": "c1"}]
        cats_crud.list_cats = lambda db, limit=100, offset=0: cats
        # return a match with detailed factors
        matching_service.evaluate_match = lambda p, c: {
            "recommended": None,
            "explanation": "No incompatibilities estructuradas.",
            "factors": [
                {"type": "location", "match": True, "explanation": "Ubicación igual", "details": {"person_location":"A","cat_location":"A"}},
                {"type": "personality_overlap", "match": True, "explanation": "Coincidencia de rasgos", "details": {"overlap_count":1, "overlap_items":["calm"]}}
            ]
        }
        from backend.app.api import routers
        routers.cats.evaluate_match = matching_service.evaluate_match
        resp = client.post("/api/cats/for_person", json={"person": {"id": "p1"}})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("factors", data[0]["match"])
        self.assertIsInstance(data[0]["match"]["factors"], list)
        self.assertGreaterEqual(len(data[0]["match"]["factors"]), 1)

    def test_tiebreaker_positive_matches(self):
        # three cats with equal incompatibility_count but different numbers of positive matches
        cats = [
            {"id": "a"},
            {"id": "b"},
            {"id": "c"},
        ]
        cats_crud.list_cats = lambda db, limit=100, offset=0: cats

        def fake_eval(person, cat):
            cid = cat.get("id") if isinstance(cat, dict) else getattr(cat, "id", None)
            if cid == "a":
                return {"recommended": None, "explanation": "", "factors": []}  # 0 positive
            if cid == "b":
                return {"recommended": None, "explanation": "", "factors": [{"match": True}]}  # 1 positive
            return {"recommended": None, "explanation": "", "factors": [{"match": True}, {"match": True}]}  # 2 positives

        matching_service.evaluate_match = fake_eval
        from backend.app.api import routers
        routers.cats.evaluate_match = fake_eval

        resp = client.post("/api/cats/for_person", json={"person": {"id": "p1"}})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        ids = [item["cat"]["id"] for item in data]
        # expect order: c (2 positives), b (1), a (0)
        self.assertEqual(ids, ["c", "b", "a"])

    def test_tiebreaker_overlap_count(self):
        # two cats with same incompatibility_count and same positive_matches but different overlap_count
        cats = [
            {"id": "x"},
            {"id": "y"},
        ]
        cats_crud.list_cats = lambda db, limit=100, offset=0: cats

        def fake_eval(person, cat):
            cid = cat.get("id") if isinstance(cat, dict) else getattr(cat, "id", None)
            if cid == "x":
                return {
                    "recommended": None,
                    "explanation": "",
                    "factors": [
                        {"match": True},
                        {"type": "personality_overlap", "match": True, "details": {"overlap_count": 2}}
                    ]
                }
            return {
                "recommended": None,
                "explanation": "",
                "factors": [
                    {"match": True},
                    {"type": "personality_overlap", "match": True, "details": {"overlap_count": 1}}
                ]
            }

        matching_service.evaluate_match = fake_eval
        from backend.app.api import routers
        routers.cats.evaluate_match = fake_eval

        resp = client.post("/api/cats/for_person", json={"person": {"id": "p1"}})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        ids = [item["cat"]["id"] for item in data]
        # expect x (overlap 2) before y (overlap 1)
        self.assertEqual(ids, ["x", "y"])

    def test_missing_overlap_counts_treated_as_zero(self):
        # if overlap_count is missing or invalid it is treated as 0 — a cat with a positive overlap_count should rank before one with missing/zero overlap
        cats = [
            {"id": "m"},
            {"id": "n"},
        ]
        cats_crud.list_cats = lambda db, limit=100, offset=0: cats

        def fake_eval(person, cat):
            cid = cat.get("id")
            if cid == "m":
                # both have one generic positive factor plus a personality_overlap with no overlap_count
                return {"recommended": None, "explanation": "", "factors": [{"match": True}, {"type": "personality_overlap", "match": True, "details": {}}]}
            # same number of positive factors but with an explicit overlap_count
            return {"recommended": None, "explanation": "", "factors": [{"match": True}, {"type": "personality_overlap", "match": True, "details": {"overlap_count": 1}}]}

        matching_service.evaluate_match = fake_eval
        from backend.app.api import routers
        routers.cats.evaluate_match = fake_eval

        resp = client.post("/api/cats/for_person", json={"person": {"id": "p1"}})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        ids = [item["cat"]["id"] for item in data]
        # expect n (overlap_count 1) before m (overlap_count missing treated as 0)
        self.assertEqual(ids, ["n", "m"])

if __name__ == "__main__":
    unittest.main()
