import torch
from torch.utils.data import Dataset
import numpy as np
from typing import List, Tuple, Optional
from ml.data.preprocess import MediaPipePreprocessor

class ISLKeypointDataset(Dataset):
    """
    PyTorch Dataset for loading ISL sign keypoint sequences.
    """

    def __init__(
        self,
        samples: List[np.ndarray],
        labels: List[int],
        preprocessor: Optional[MediaPipePreprocessor] = None,
        transform=None,
    ):
        self.samples = samples
        self.labels = labels
        self.preprocessor = preprocessor or MediaPipePreprocessor(target_seq_len=30)
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        raw_sample = self.samples[idx]  # Shape: (T, V, C)
        label = self.labels[idx]

        # Apply preprocessing (normalization + resampling)
        normalized = self.preprocessor.normalize_landmarks(raw_sample)
        resampled = self.preprocessor.resample_sequence(normalized)

        if self.transform:
            resampled = self.transform(resampled)

        # Convert to float tensor: (T, V, C)
        tensor_data = torch.from_numpy(resampled).float()
        label_tensor = torch.tensor(label, dtype=torch.long)

        return tensor_data, label_tensor
