import torch
import torch.nn as nn
from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseSignModel(nn.Module, ABC):
    """
    Abstract Base Class for all ISL Recognition PyTorch Model Architectures.
    Enforces unified forward signature and export interface.
    """

    def __init__(self, num_classes: int, num_keypoints: int = 75, in_channels: int = 3):
        super(BaseSignModel, self).__init__()
        self.num_classes = num_classes
        self.num_keypoints = num_keypoints
        self.in_channels = in_channels

    @abstractmethod
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass signature.
        x tensor shape: (B, T, V, C) or (B, T, D)
        returns logits tensor shape: (B, num_classes)
        """
        pass

    def predict_logits(self, x: torch.Tensor) -> torch.Tensor:
        """
        Computes softmax class probability distribution.
        """
        logits = self.forward(x)
        return torch.softmax(logits, dim=-1)
