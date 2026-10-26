import os
import json
import logging
from typing import Dict, Any, List, Optional
import numpy as np

logger = logging.getLogger(__name__)

# Joint names matching MediaPipe Hand 21 Landmark standard
LANDMARK_NAMES = [
    "wrist",
    "thumb_cmc", "thumb_mcp", "thumb_ip", "thumb_tip",
    "index_mcp", "index_pip", "index_dip", "index_tip",
    "middle_mcp", "middle_pip", "middle_dip", "middle_tip",
    "ring_mcp", "ring_pip", "ring_dip", "ring_tip",
    "pinky_mcp", "pinky_pip", "pinky_dip", "pinky_tip"
]

class SignLibraryBuilder:
    """
    Builds and manages an extensible library of normalized 3D ISL sign keyframes
    from the raw dataset using exact wrist-centered scale normalization.
    """

    def __init__(self, root_dir: Optional[str] = None):
        if root_dir is None:
            # Default to project root
            self.root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        else:
            self.root_dir = os.path.abspath(root_dir)

        self.library_dir = os.path.join(self.root_dir, "sign_library")
        self.signs_dir = os.path.join(self.library_dir, "signs")
        self.labels_path = os.path.join(self.library_dir, "labels.json")
        self.dataset_dir = os.path.join(self.root_dir, "dataset")
        self.index_path = os.path.join(self.library_dir, "index.json")

        os.makedirs(self.signs_dir, exist_ok=True)

    def normalize_landmarks(self, raw_coords: np.ndarray) -> np.ndarray:
        """
        Applies exact wrist-centered scale normalization from ml/data/preprocess.py:
        1. Centers origin (0, 0, 0) at wrist (landmark 0).
        2. Scales coordinates by the maximum Euclidean distance from the wrist.
        """
        if len(raw_coords) < 21:
            pad = np.zeros((21 - len(raw_coords), 3), dtype=np.float32)
            raw_coords = np.vstack([raw_coords, pad])
        elif len(raw_coords) > 21:
            raw_coords = raw_coords[:21]

        coords = raw_coords.astype(np.float32)
        wrist = coords[0].copy()
        centered = coords - wrist

        max_dist = float(np.max(np.linalg.norm(centered, axis=1)))
        if max_dist > 1e-6:
            normalized = centered / max_dist
        else:
            normalized = centered

        return normalized

    def load_class_samples(self, folder_name: str) -> List[np.ndarray]:
        """
        Loads and normalizes all sample JSON files in dataset/<folder_name>.
        """
        class_dir = os.path.join(self.dataset_dir, folder_name)
        if not os.path.exists(class_dir):
            logger.warning(f"Dataset directory not found: {class_dir}")
            return []

        sample_files = [f for f in os.listdir(class_dir) if f.endswith(".json")]
        normalized_samples = []

        for f in sorted(sample_files):
            file_path = os.path.join(class_dir, f)
            try:
                with open(file_path, "r", encoding="utf-8") as jf:
                    data = json.load(jf)
                    raw_pts = data.get("landmarks", [])
                    if len(raw_pts) >= 21:
                        coords = []
                        for pt in raw_pts[:21]:
                            coords.append([
                                float(pt.get("x", 0.0)),
                                float(pt.get("y", 0.0)),
                                float(pt.get("z", 0.0))
                            ])
                        norm_pts = self.normalize_landmarks(np.array(coords, dtype=np.float32))
                        normalized_samples.append(norm_pts)
            except Exception as e:
                logger.error(f"Error reading sample file {file_path}: {e}")

        return normalized_samples

    def compute_mean_pose(self, samples: List[np.ndarray]) -> Dict[str, Any]:
        """
        Computes mean normalized 3D pose, variance/std per joint across all samples.
        """
        if not samples:
            # Fallback identity hand if no samples exist
            default_pose = np.zeros((21, 3), dtype=np.float32)
            return {
                "mean_pose": default_pose,
                "std_pose": default_pose,
                "sample_count": 0
            }

        samples_arr = np.array(samples)  # Shape: (N, 21, 3)
        mean_pose = np.mean(samples_arr, axis=0)  # Shape: (21, 3)
        std_pose = np.std(samples_arr, axis=0)    # Shape: (21, 3)

        return {
            "mean_pose": mean_pose,
            "std_pose": std_pose,
            "sample_count": len(samples)
        }

    def analyze_finger_states(self, coords: np.ndarray) -> Dict[str, bool]:
        """
        Estimates extension states of the 5 fingers from the mean normalized pose.
        """
        wrist = coords[0]
        def is_ext(tip_idx: int, mcp_idx: int, thresh: float = 1.3) -> bool:
            d_tip = np.linalg.norm(coords[tip_idx] - wrist)
            d_mcp = np.linalg.norm(coords[mcp_idx] - wrist)
            return bool((d_tip / max(0.001, d_mcp)) > thresh)

        return {
            "thumb_extended": is_ext(4, 2, 1.15),
            "index_extended": is_ext(8, 5, 1.35),
            "middle_extended": is_ext(12, 9, 1.35),
            "ring_extended": is_ext(16, 13, 1.35),
            "pinky_extended": is_ext(20, 17, 1.35)
        }

    def build_library(self) -> Dict[str, Any]:
        """
        Builds the entire sign library from labels.json and dataset samples.
        Saves individual sign JSON keyframes and the index.json manifest.
        """
        if not os.path.exists(self.labels_path):
            raise FileNotFoundError(f"labels.json not found at {self.labels_path}")

        with open(self.labels_path, "r", encoding="utf-8") as f:
            labels_data = json.load(f)

        classes = labels_data.get("classes", [])
        built_signs = {}

        print(f"[SignLibraryBuilder] Processing {len(classes)} classes from labels.json...")

        for item in classes:
            sign_name = item["sign_name"]
            folder = item.get("dataset_folder", sign_name)
            hand_type = item.get("hand_type", "right")

            samples = self.load_class_samples(folder)
            pose_stats = self.compute_mean_pose(samples)

            mean_pose = pose_stats["mean_pose"]
            std_pose = pose_stats["std_pose"]
            sample_count = pose_stats["sample_count"]

            landmarks_list = []
            for i in range(21):
                landmarks_list.append({
                    "index": i,
                    "name": LANDMARK_NAMES[i],
                    "x": round(float(mean_pose[i][0]), 6),
                    "y": round(float(mean_pose[i][1]), 6),
                    "z": round(float(mean_pose[i][2]), 6),
                    "std": round(float(np.mean(std_pose[i])), 6)
                })

            finger_states = self.analyze_finger_states(mean_pose)

            sign_doc = {
                "sign_name": sign_name,
                "type": "static_pose",
                "version": "1.0",
                "category": item.get("category", "General"),
                "hand_type": hand_type,
                "description": item.get("description", ""),
                "sample_count": sample_count,
                "normalized_landmarks": landmarks_list,
                "finger_states": finger_states,
                "metadata": {
                    "source_folder": folder,
                    "landmark_count": 21,
                    "normalization": "wrist_centered_max_distance_scaled"
                }
            }

            # Save individual sign keyframe JSON
            sign_filename = f"{sign_name}.json"
            sign_filepath = os.path.join(self.signs_dir, sign_filename)
            with open(sign_filepath, "w", encoding="utf-8") as sf:
                json.dump(sign_doc, sf, indent=2, ensure_ascii=False)

            built_signs[sign_name] = {
                "sign_name": sign_name,
                "category": item.get("category", "General"),
                "hand_type": hand_type,
                "description": item.get("description", ""),
                "sample_count": sample_count,
                "file": f"signs/{sign_filename}"
            }

            print(f"  [OK] Built '{sign_name}' ({sample_count} samples)")

        # Save consolidated index.json
        index_doc = {
            "version": "1.0",
            "total_signs": len(built_signs),
            "signs": built_signs,
            "extensible_config": {
                "supports_static_pose": True,
                "supports_temporal_sequence": True,
                "custom_signs_directory": "signs/"
            }
        }

        with open(self.index_path, "w", encoding="utf-8") as idxf:
            json.dump(index_doc, idxf, indent=2, ensure_ascii=False)

        print(f"[SignLibraryBuilder] Successfully built {len(built_signs)} signs into {self.library_dir}")
        return index_doc


if __name__ == "__main__":
    builder = SignLibraryBuilder()
    builder.build_library()
