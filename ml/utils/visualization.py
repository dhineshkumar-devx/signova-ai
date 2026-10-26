import numpy as np

class LandmarkPlotter:
    """
    Visualization utilities for plotting 3D MediaPipe skeletal points.
    """

    @staticmethod
    def print_skeleton_summary(landmarks: np.ndarray) -> str:
        """
        Prints a text summary of frame landmarks.
        """
        if landmarks.ndim == 2:
            V, C = landmarks.shape
            return f"Frame Keypoints Summary: {V} Vertices, {C} Spatial Channels (X min: {landmarks[:, 0].min():.2f}, Y min: {landmarks[:, 1].min():.2f})"
        elif landmarks.ndim == 3:
            T, V, C = landmarks.shape
            return f"Sequence Keypoints Summary: {T} Frames, {V} Vertices, {C} Channels"
        return "Invalid landmark shape"
