import torch
import torch.nn as nn
from ml.models.base_model import BaseSignModel

class STGCNBlockStub(nn.Module):
    """
    Spatial-Temporal Graph Convolutional Block Stub.
    Applies spatial graph convolution followed by 1D temporal convolution.
    """

    def __init__(self, in_channels: int, out_channels: int, stride: int = 1):
        super(STGCNBlockStub, self).__init__()
        self.spatial_conv = nn.Conv2d(in_channels, out_channels, kernel_size=1)
        self.temporal_conv = nn.Conv2d(out_channels, out_channels, kernel_size=(3, 1), padding=(1, 0), stride=(stride, 1))
        self.relu = nn.ReLU()
        self.bn = nn.BatchNorm2d(out_channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: (B, C, T, V)
        x = self.spatial_conv(x)
        x = self.temporal_conv(x)
        x = self.bn(x)
        return self.relu(x)

class STGCNModel(BaseSignModel):
    """
    Spatial-Temporal Graph Convolutional Network (ST-GCN) Architecture Stub.
    Processes skeletal graphs represented by MediaPipe 3D keypoint vertices and physical graph adjacency matrices.
    """

    def __init__(self, num_classes: int = 100, num_keypoints: int = 75, in_channels: int = 3):
        super(STGCNModel, self).__init__(num_classes, num_keypoints, in_channels)

        self.block1 = STGCNBlockStub(in_channels, 64)
        self.block2 = STGCNBlockStub(64, 128, stride=2)
        self.block3 = STGCNBlockStub(128, 256, stride=2)

        self.global_pool = nn.AdaptiveAvgPool2d((1, 1))
        self.classifier = nn.Linear(256, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Input x shape: (B, T, V, C) -> Permuted to (B, C, T, V)
        Returns: logits of shape (B, num_classes)
        """
        if x.dim() == 4 and x.shape[-1] == self.in_channels:
            x = x.permute(0, 3, 1, 2)  # (B, C, T, V)

        x = self.block1(x)
        x = self.block2(x)
        x = self.block3(x)

        x = self.global_pool(x)  # (B, 256, 1, 1)
        x = x.view(x.size(0), -1)  # (B, 256)
        logits = self.classifier(x)
        return logits
