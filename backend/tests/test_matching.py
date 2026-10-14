import unittest
from backend.app.services.matching import evaluate_match

class MatchingServiceTestCase(unittest.TestCase):
    def test_incompatibility_children(self):
        person = {"has_children": True}
        cat = {"good_with_children": False}
        result = evaluate_match(person, cat)
        self.assertEqual(result["recommended"], False)
        self.assertTrue(any(f["type"] == "good_with_children" and f["match"] is False for f in result["factors"]))

    def test_incompatibility_other_pets(self):
        person = {"has_other_pets": True}
        cat = {"good_with_dogs": False}
        result = evaluate_match(person, cat)
        self.assertEqual(result["recommended"], False)
        self.assertTrue(any(f["type"] == "good_with_other_pets" and f["match"] is False for f in result["factors"]))

    def test_personality_overlap_and_activity(self):
        person = {"preferred_cat_traits": ["affectionate", "calm"], "activity_level": "low"}
        cat = {"personality_traits": ["calm", "playful"], "activity_level": "low"}
        result = evaluate_match(person, cat)
        # No hard incompatibility -> recommended is None
        self.assertIsNone(result["recommended"])
        # Check personality overlap factor
        overlap = [f for f in result["factors"] if f["type"] == "personality_overlap"]
        self.assertTrue(len(overlap) == 1)
        self.assertTrue(overlap[0]["details"]["overlap_count"] >= 1)
        # Check activity factor
        activity = [f for f in result["factors"] if f["type"] == "activity_level"]
        self.assertTrue(len(activity) == 1)
        self.assertTrue(activity[0]["match"] is True)

    def test_empty_inputs(self):
        result = evaluate_match(None, None)
        self.assertIsNone(result["recommended"])
        self.assertIsInstance(result["factors"], list)

if __name__ == "__main__":
    unittest.main()
