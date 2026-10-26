import os
import sys
import json
import unittest
import numpy as np

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sign_library.builder import SignLibraryBuilder, LANDMARK_NAMES

class TestSignLibraryBuilder(unittest.TestCase):
    def setUp(self):
        self.builder = SignLibraryBuilder()

    def test_labels_file_exists_and_valid(self):
        self.assertTrue(os.path.exists(self.builder.labels_path), "labels.json must exist")
        with open(self.builder.labels_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertIn("classes", data)
        self.assertGreater(len(data["classes"]), 0, "labels.json must have at least 1 class")
        first_class = data["classes"][0]
        self.assertIn("sign_name", first_class)
        self.assertIn("dataset_folder", first_class)

    def test_normalize_landmarks_centers_wrist(self):
        # Create arbitrary 21-point hand where wrist is at (10, 20, 30)
        raw = np.random.uniform(5, 50, size=(21, 3)).astype(np.float32)
        raw[0] = [10.0, 20.0, 30.0]

        normalized = self.builder.normalize_landmarks(raw)

        self.assertEqual(normalized.shape, (21, 3))
        # Wrist (index 0) must be exactly at origin (0, 0, 0)
        np.testing.assert_allclose(normalized[0], [0.0, 0.0, 0.0], atol=1e-6)

        # Maximum distance from wrist must be <= 1.0
        dists = np.linalg.norm(normalized, axis=1)
        self.assertAlmostEqual(float(np.max(dists)), 1.0, places=5)

    def test_compute_mean_pose(self):
        # Create 3 synthetic samples
        sample1 = np.ones((21, 3), dtype=np.float32) * 1.0
        sample2 = np.ones((21, 3), dtype=np.float32) * 2.0
        sample3 = np.ones((21, 3), dtype=np.float32) * 3.0

        stats = self.builder.compute_mean_pose([sample1, sample2, sample3])
        self.assertEqual(stats["sample_count"], 3)
        self.assertEqual(stats["mean_pose"].shape, (21, 3))
        # Mean of 1, 2, 3 is 2.0
        np.testing.assert_allclose(stats["mean_pose"], np.ones((21, 3)) * 2.0, atol=1e-6)

    def test_finger_states_analysis(self):
        # Test extended open palm
        hand = np.zeros((21, 3), dtype=np.float32)
        # Position tips far from wrist
        for tip in [4, 8, 12, 16, 20]:
            hand[tip] = [0.0, 1.0, 0.0]
        # Position MCPs close to wrist
        for mcp in [2, 5, 9, 13, 17]:
            hand[mcp] = [0.0, 0.2, 0.0]

        states = self.builder.analyze_finger_states(hand)
        self.assertIn("index_extended", states)
        self.assertTrue(states["index_extended"])
        self.assertTrue(states["middle_extended"])

    def test_index_json_generated_and_matches_signs(self):
        self.assertTrue(os.path.exists(self.builder.index_path), "index.json must exist")
        with open(self.builder.index_path, "r", encoding="utf-8") as f:
            index = json.load(f)
        self.assertIn("total_signs", index)
        self.assertIn("signs", index)
        self.assertEqual(index["total_signs"], len(index["signs"]))
        self.assertGreaterEqual(index["total_signs"], 24)

        # Check that individual sign files exist and match index
        for sign_name, info in index["signs"].items():
            sign_file = os.path.join(self.builder.library_dir, info["file"])
            self.assertTrue(os.path.exists(sign_file), f"{sign_file} must exist on disk")
            with open(sign_file, "r", encoding="utf-8") as sf:
                sign_doc = json.load(sf)
            self.assertEqual(sign_doc["sign_name"], sign_name)
            self.assertEqual(len(sign_doc["normalized_landmarks"]), 21)

if __name__ == "__main__":
    unittest.main()
