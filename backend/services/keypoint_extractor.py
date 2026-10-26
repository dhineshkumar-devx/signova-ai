import numpy as np
from typing import Dict, Any, List

class MediaPipeExtractor:
    """
    Backend service helper for parsing, validating, and formatting
    MediaPipe keypoints transmitted from client video frames.
    """

    @staticmethod
    def extract_flat_vector(frame_data: Dict[str, Any]) -> np.ndarray:
        """
        Flattens 3D pose, left hand, and right hand landmarks into a 1D feature vector.
        """
        pose = frame_data.get("pose", [])
        left_hand = frame_data.get("left_hand", [])
        right_hand = frame_data.get("right_hand", [])

        vec = []
        for pt in pose:
            vec.extend([pt.get("x", 0.0), pt.get("y", 0.0), pt.get("z", 0.0)])
        for pt in left_hand:
            vec.extend([pt.get("x", 0.0), pt.get("y", 0.0), pt.get("z", 0.0)])
        for pt in right_hand:
            vec.extend([pt.get("x", 0.0), pt.get("y", 0.0), pt.get("z", 0.0)])

        return np.array(vec, dtype=np.float32)
