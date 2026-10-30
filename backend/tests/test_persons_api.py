import os
import unittest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from backend.app.main import app
from backend.app.crud import persons as persons_crud

client = TestClient(app)

class PersonsApiTestCase(unittest.TestCase):
    def setUp(self):
        # preserve original create_person and get_person
        self._orig_create = getattr(persons_crud, 'create_person', None)
        self._orig_get = getattr(persons_crud, 'get_person', None)

    def tearDown(self):
        if self._orig_create:
            persons_crud.create_person = self._orig_create
        if self._orig_get:
            persons_crud.get_person = self._orig_get

    def test_create_person_success(self):
        # mock create_person to avoid DB
        from datetime import datetime
        def fake_create(db, data):
            attrs = dict(data, **{"id": "00000000-0000-0000-0000-000000000010", "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()})
            return type('P', (), attrs)()
        persons_crud.create_person = fake_create

        payload = {
            "full_name": "Alice",
            "bio": "About Alice",
            "location": "City",
            "activity_level": "low",
            "home_type": "apartment",
            "home_size": "medium",
            "has_outdoor_space": False,
            "work_hours_per_day": 8,
            "has_children": False,
            "has_other_pets": False,
            "other_pets_details": None,
            "personality_traits": ["calm"],
            "preferred_cat_traits": ["calm"],
            "time_outside": "part_time",
            "time_available": "evenings",
        }
        resp = client.post('/api/persons/', json=payload)
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body.get('id'), "00000000-0000-0000-0000-000000000010")
        self.assertEqual(body.get('full_name'), 'Alice')

    def test_get_person_success(self):
        from datetime import datetime
        def fake_get(db, pid):
            return type('P', (), {
                "id": pid,
                "full_name": "Charlie",
                "bio": "x",
                "location": "City",
                "activity_level": "low",
                "home_type": "apartment",
                "home_size": "small",
                "has_outdoor_space": False,
                "work_hours_per_day": 8,
                "has_children": False,
                "has_other_pets": False,
                "other_pets_details": None,
                "personality_traits": ["calm"],
                "preferred_cat_traits": ["calm"],
                "time_outside": "part_time",
                "time_available": "evenings",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            })()
        persons_crud.get_person = fake_get
        resp = client.get('/api/persons/00000000-0000-0000-0000-000000000099')
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body.get('id'), '00000000-0000-0000-0000-000000000099')

    def test_get_person_not_found(self):
        persons_crud.get_person = lambda db, pid: None
        resp = client.get('/api/persons/missing')
        self.assertEqual(resp.status_code, 404)

    def test_create_person_validation(self):
        # PersonCreate has optional fields; sending extra unknown fields should be rejected by pydantic
        # Attempt to send an extra unknown field triggers validation error
        payload = {"invalid_field": "x"}
        resp = client.post('/api/persons/', json=payload)
        self.assertEqual(resp.status_code, 422)

    def test_create_person_db_error(self):
        def fake_create(db, data):
            raise RuntimeError('db error')
        persons_crud.create_person = fake_create
        payload = {
            "full_name": "Bob",
            "bio": "About Bob",
            "location": "City",
            "activity_level": "low",
            "home_type": "house",
            "home_size": "large",
            "has_outdoor_space": True,
            "work_hours_per_day": 6,
            "has_children": False,
            "has_other_pets": False,
            "other_pets_details": None,
            "personality_traits": ["friendly"],
            "preferred_cat_traits": ["calm"],
            "time_outside": "part_time",
            "time_available": "mornings",
        }
        resp = client.post('/api/persons/', json=payload)
        self.assertEqual(resp.status_code, 500)

    def test_update_person_success(self):
        from datetime import datetime
        def fake_get(db, pid):
            return type('P', (), {
                "id": pid,
                "full_name": "Bob",
                "location": "City A",
                "activity_level": "low",
                "home_type": "apartment",
                "home_size": "medium",
                "has_outdoor_space": False,
                "work_hours_per_day": 8,
                "has_children": False,
                "has_other_pets": False,
                "other_pets_details": None,
                "personality_traits": ["calm"],
                "preferred_cat_traits": ["calm"],
                "time_outside": "part_time",
                "time_available": "evenings",
                "bio": None,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            })()
        def fake_update(db, pid, data):
            return type('P', (), {
                "id": pid,
                "full_name": data.get("full_name", "Bob"),
                "location": data.get("location", "City B"),
                "activity_level": "medium",
                "home_type": "apartment",
                "home_size": "medium",
                "has_outdoor_space": False,
                "work_hours_per_day": 8,
                "has_children": False,
                "has_other_pets": False,
                "other_pets_details": None,
                "personality_traits": ["calm"],
                "preferred_cat_traits": ["calm"],
                "time_outside": "part_time",
                "time_available": "evenings",
                "bio": None,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            })()

        persons_crud.get_person = fake_get
        persons_crud.update_person = fake_update

        resp = client.patch('/api/persons/00000000-0000-0000-0000-000000000010', json={"location": "City B", "activity_level": "medium"})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body.get('location'), "City B")
        self.assertEqual(body.get('activity_level'), "medium")

    def test_update_person_not_found(self):
        persons_crud.get_person = lambda db, pid: None
        resp = client.patch('/api/persons/missing', json={"location": "City B"})
        self.assertEqual(resp.status_code, 404)

if __name__ == '__main__':
    unittest.main()
