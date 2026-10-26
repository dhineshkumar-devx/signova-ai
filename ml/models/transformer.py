import torch
import torch.nn as nn
import math
from ml.models.base_model import BaseSignModel

class PositionalEncoding(nn.Module):
    """
    Sinusoidal positional encoding for sequence Transformer layers.
    """

    def __init__(self, d_model: int, max_len: int = 100):
        super(PositionalEncoding, self).__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))

        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer('pe', pe.unsqueeze(0))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: (B, T, D)
        return x + self.pe[:, :x.size(1)]

class LandmarkTransformer(BaseSignModel):
    """
    Spatial-Temporal Landmark Transformer Architecture Stub.
    Applies multi-head self-attention over keypoint landmark sequences.
    """

    def __init__(
        self,
        num_classes: int = 100,
        num_keypoints: int = 75,
        in_channels: int = 3,
        d_model: int = 256,
        nhead: int = 8,
        num_layers: int = 4,
    ):
        super(LandmarkTransformer, self).__init__(num_classes, num_keypoints, in_channels)

        input_dim = num_keypoints * in_channels
        self.input_projection = nn.Linear(input_dim, d_model)
        self.pos_encoder = PositionalEncoding(d_model)

        encoder_layer = nn.TransformerEncoderLayer(d_model=d_model, nhead=nhead, dim_feedforward=512, batch_first=True)
        self.transformer_encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)

        self.classifier = nn.Linear(d_model, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Input x shape: (B, T, V, C) or (B, T, D)
        Returns: logits of shape (B, num_classes)
        """
        if x.dim() == 4:
            B, T, V, C = x.shape
            x = x.view(B, T, V * C)  # Flatten vertices and channels into vector D

        x = self.input_projection(x)  # (B, T, d_model)
        x = self.pos_encoder(x)
        out = self.transformer_encoder(x)  # (B, T, d_model)

        # Average pool across temporal dimension T
        out = out.mean(dim=1)  # (B, d_model)
        logits = self.classifier(out)
        return logits
