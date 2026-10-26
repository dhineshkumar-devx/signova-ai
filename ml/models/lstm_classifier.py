import torch
import torch.nn as nn
from ml.models.base_model import BaseSignModel

class BiLSTMClassifier(BaseSignModel):
    """
    Baseline Bidirectional LSTM Architecture Stub for ISL Sign Classification.
    """

    def __init__(
        self,
        num_classes: int = 100,
        num_keypoints: int = 75,
        in_channels: int = 3,
        hidden_dim: int = 128,
        num_layers: int = 2,
    ):
        super(BiLSTMClassifier, self).__init__(num_classes, num_keypoints, in_channels)

        input_dim = num_keypoints * in_channels
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=True,
        )
        self.classifier = nn.Linear(hidden_dim * 2, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Input x shape: (B, T, V, C) or (B, T, D)
        Returns: logits of shape (B, num_classes)
        """
        if x.dim() == 4:
            B, T, V, C = x.shape
            x = x.view(B, T, V * C)

        out, (hn, cn) = self.lstm(x)  # out shape: (B, T, hidden_dim * 2)
        # Take the final temporal time step output
        last_step_out = out[:, -1, :]  # (B, hidden_dim * 2)
        logits = self.classifier(last_step_out)
        return logits
