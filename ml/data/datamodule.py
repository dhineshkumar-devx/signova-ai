from torch.utils.data import DataLoader
from typing import List, Tuple
import numpy as np
from ml.data.dataset import ISLKeypointDataset
from ml.data.transforms import LandmarkAugmentation

class ISLDataModule:
    """
    DataLoader wrapper managing Train, Validation, and Test datasets.
    """

    def __init__(
        self,
        samples: List[np.ndarray],
        labels: List[int],
        batch_size: int = 32,
        val_split: float = 0.1,
        test_split: float = 0.1,
    ):
        self.batch_size = batch_size
        num_total = len(samples)

        num_val = int(num_total * val_split)
        num_test = int(num_total * test_split)
        num_train = num_total - num_val - num_test

        train_samples, train_labels = samples[:num_train], labels[:num_train]
        val_samples, val_labels = samples[num_train:num_train + num_val], labels[num_train:num_train + num_val]
        test_samples, test_labels = samples[num_train + num_val:], labels[num_train + num_val:]

        self.train_dataset = ISLKeypointDataset(train_samples, train_labels, transform=LandmarkAugmentation())
        self.val_dataset = ISLKeypointDataset(val_samples, val_labels)
        self.test_dataset = ISLKeypointDataset(test_samples, test_labels)

    def train_dataloader(self) -> DataLoader:
        return DataLoader(self.train_dataset, batch_size=self.batch_size, shuffle=True, num_workers=2)

    def val_dataloader(self) -> DataLoader:
        return DataLoader(self.val_dataset, batch_size=self.batch_size, shuffle=False)

    def test_dataloader(self) -> DataLoader:
        return DataLoader(self.test_dataset, batch_size=self.batch_size, shuffle=False)
