import numpy as np

class LandmarkAugmentation:
    """
    Data augmentation transforms for keypoint sequences:
    - Random 3D Rotation
    - Random Gaussian Jitter
    - Random Scaling
    """

    def __init__(self, rotation_std: float = 0.1, jitter_std: float = 0.01, scale_range=(0.9, 1.1)):
        self.rotation_std = rotation_std
        self.jitter_std = jitter_std
        self.scale_range = scale_range

    def __call__(self, sequence: np.ndarray) -> np.ndarray:
        augmented = sequence.copy()

        # 1. Random Gaussian Jitter
        if self.jitter_std > 0:
            noise = np.random.normal(0, self.jitter_std, size=augmented.shape)
            augmented += noise

        # 2. Random Scaling
        if self.scale_range:
            scale = np.random.uniform(self.scale_range[0], self.scale_range[1])
            augmented[:, :, :3] *= scale

        return augmented
