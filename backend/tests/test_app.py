import unittest

from fastapi.testclient import TestClient
from backend.app.main import app


class AppTestCase(unittest.TestCase):
    def setUp(self):
        # Use FastAPI TestClient against the existing FastAPI app instance
        self.client = TestClient(app)

    def test_health_returns_success(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        # The health endpoint returns JSON with a 'status' key
        self.assertIn("status", response.json())


if __name__ == "__main__":
    unittest.main()
