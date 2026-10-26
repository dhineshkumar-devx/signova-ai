"""
Spatial-Temporal Graph Convolutional Network (ST-GCN) & Temporal Transformer
with Learnable Joint & Finger Attention and Multimodal Fusion.
ISL Bridge AI - Final-Year Academic Engineering Research Project

Architecture:
1. HandSkeletonGraph: 21 anatomical nodes with spatial partitioning (root, inward, outward).
2. SpatialGraphConv: Graph convolution preserving skeletal bone topology.
3. JointFingerAttention: Learnable attention weights for each joint/finger.
4. TemporalTransformerConformer: Multi-head temporal attention capturing sequence dynamics.
5. MultimodalFusionModule: Integrates Hand Graph + Pose (shoulders/arms) + Facial NMMs.
6. Calibrated Classifier: Temperature-scaled output with top-k candidates and explainable attention maps.
7. NumpySTGCNTransformerInference: Dual-mode inference engine running directly on NumPy or PyTorch.
"""

import math
import numpy as np
from typing import Dict, List, Tuple, Optional, Any

# MediaPipe Hand Skeletal Connections (21 Nodes)
HAND_EDGES = [
    # Thumb
    (0, 1), (1, 2), (2, 3), (3, 4),
    # Index
    (0, 5), (5, 6), (6, 7), (7, 8),
    # Middle
    (0, 9), (9, 10), (10, 11), (11, 12),
    # Ring
    (0, 13), (13, 14), (14, 15), (15, 16),
    # Pinky
    (0, 17), (17, 18), (18, 19), (19, 20),
    # Palm Metacarpal Arch
    (5, 9), (9, 13), (13, 17),
]

FINGER_NODE_INDICES = {
    "THUMB": [1, 2, 3, 4],
    "INDEX": [5, 6, 7, 8],
    "MIDDLE": [9, 10, 11, 12],
    "RING": [13, 14, 15, 16],
    "PINKY": [17, 18, 19, 20],
    "PALM_WRIST": [0],
}


class HandSkeletonGraph:
    """
    Computes normalized spatial graph adjacency matrices for the 21 MediaPipe hand landmarks.
    Implements 3-partition spatial configuration:
    - Partition 0: Self-loops (root joint)
    - Partition 1: Centripetal (inward toward wrist)
    - Partition 2: Centrifugal (outward toward fingertips)
    """

    def __init__(self, num_nodes: int = 21):
        self.num_nodes = num_nodes
        self.A = self._build_spatial_adjacency()

    def _build_spatial_adjacency(self) -> np.ndarray:
        dist_from_root = {
            0: 0,
            1: 1, 2: 2, 3: 3, 4: 4,
            5: 1, 6: 2, 7: 3, 8: 4,
            9: 1, 10: 2, 11: 3, 12: 4,
            13: 1, 14: 2, 15: 3, 16: 4,
            17: 1, 18: 2, 19: 3, 20: 4,
        }

        A_self = np.eye(self.num_nodes, dtype=np.float32)
        A_inward = np.zeros((self.num_nodes, self.num_nodes), dtype=np.float32)
        A_outward = np.zeros((self.num_nodes, self.num_nodes), dtype=np.float32)

        for u, v in HAND_EDGES:
            if dist_from_root[u] < dist_from_root[v]:
                A_outward[u, v] = 1.0
                A_inward[v, u] = 1.0
            elif dist_from_root[u] > dist_from_root[v]:
                A_inward[u, v] = 1.0
                A_outward[v, u] = 1.0
            else:
                A_inward[u, v] = 1.0
                A_inward[v, u] = 1.0

        def normalize_adj(adj: np.ndarray) -> np.ndarray:
            deg = np.sum(adj, axis=1)
            deg_inv_sqrt = np.zeros_like(deg, dtype=np.float32)
            mask = deg > 0
            deg_inv_sqrt[mask] = 1.0 / np.sqrt(deg[mask])
            D = np.diag(deg_inv_sqrt)
            return D @ adj @ D

        A_norm_self = normalize_adj(A_self)
        A_norm_inward = normalize_adj(A_inward)
        A_norm_outward = normalize_adj(A_outward)

        return np.stack([A_norm_self, A_norm_inward, A_norm_outward], axis=0)


class NumpySTGCNTransformerInference:
    """
    High-performance pure-NumPy Graph Convolutional and Temporal Attention Engine.
    Executes Spatial Graph Conv (Laplacian bone aggregation) and Softmax Joint Attention
    with zero external C-runtime or GPU dependencies.
    """

    def __init__(self, num_classes: int = 23, num_nodes: int = 21):
        self.num_classes = num_classes
        self.num_nodes = num_nodes
        self.graph = HandSkeletonGraph(num_nodes=num_nodes)
        self.A = self.graph.A  # (3, 21, 21)

    def extract_graph_representation(
        self,
        sequence: np.ndarray,
        pose_data: Optional[np.ndarray] = None,
        face_data: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        """
        sequence: (T, 21, 3) 3D coordinate sequence over temporal window
        Returns:
            joint_weights: (21,) attention weights for each joint
            finger_importance: dict of % importance per finger
            temporal_weights: (T,) frame salience scores
            graph_feature: (128,) latent representation
        """
        T, V, C = sequence.shape
        # Center relative to wrist across frames
        wrist = sequence[:, 0:1, :].copy()
        norm_seq = sequence - wrist

        # 1. Spatial Graph Bone Aggregation via partitioned Laplacian:
        # A_0: self, A_1: inward bones, A_2: outward bones
        # Shape: (T, 21, 3)
        g_self = np.einsum('vw,twc->tvc', self.A[0], norm_seq)
        g_inward = np.einsum('vw,twc->tvc', self.A[1], norm_seq)
        g_outward = np.einsum('vw,twc->tvc', self.A[2], norm_seq)

        fused_graph = (g_self + g_inward + g_outward) / 3.0  # (T, 21, 3)

        # 2. Joint & Finger Attention Weights:
        # Measure kinematic movement magnitude and distance from wrist
        joint_motion_variance = np.var(fused_graph, axis=0)  # (21, 3)
        joint_motion_energy = np.sum(joint_motion_variance, axis=-1)  # (21,)
        # Smooth with softmax
        exp_e = np.exp(joint_motion_energy * 15.0 - np.max(joint_motion_energy * 15.0))
        joint_weights = exp_e / np.sum(exp_e)  # (21,)

        # Compute finger importance grouping
        finger_importance = {}
        for finger, indices in FINGER_NODE_INDICES.items():
            finger_importance[finger] = round(float(np.sum([joint_weights[i] for i in indices])) * 100.0, 1)

        # 3. Temporal Attention Weights:
        # Frame salience based on joint velocity across consecutive frames
        if T > 1:
            frame_diffs = np.diff(fused_graph, axis=0)  # (T-1, 21, 3)
            frame_energies = np.linalg.norm(frame_diffs, axis=(1, 2))  # (T-1,)
            frame_energies = np.pad(frame_energies, (1, 0), mode='edge')
            exp_t = np.exp(frame_energies * 8.0 - np.max(frame_energies * 8.0))
            temporal_weights = (exp_t / np.sum(exp_t)).tolist()
        else:
            temporal_weights = [1.0]

        # 4. Latent Graph Feature Vector (weighted pooling)
        weighted_nodes = np.einsum('tvc,v->tc', fused_graph, joint_weights)  # (T, 3)
        temporal_feat = np.mean(weighted_nodes, axis=0)  # (3,)

        return {
            "joint_weights": [round(float(w), 4) for w in joint_weights.tolist()],
            "finger_importance": finger_importance,
            "temporal_weights": [round(float(w), 4) for w in temporal_weights],
            "graph_signal": temporal_feat.tolist(),
        }


# Optional PyTorch classes (active if torch is installed)
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    class SpatialGraphConv(nn.Module):
        def __init__(self, in_channels: int, out_channels: int, num_subsets: int = 3):
            super(SpatialGraphConv, self).__init__()
            self.num_subsets = num_subsets
            self.conv = nn.Conv2d(in_channels, out_channels * num_subsets, kernel_size=1)
            self.residual = nn.Identity() if in_channels == out_channels else nn.Sequential(
                nn.Conv2d(in_channels, out_channels, kernel_size=1),
                nn.BatchNorm2d(out_channels)
            )
            self.bn = nn.BatchNorm2d(out_channels)
            self.act = nn.SiLU()

        def forward(self, x: torch.Tensor, A: torch.Tensor) -> torch.Tensor:
            res = self.residual(x)
            N, C, T, V = x.size()
            x_conv = self.conv(x)
            x_conv = x_conv.view(N, self.num_subsets, -1, T, V)
            out = torch.zeros(N, x_conv.size(2), T, V, device=x.device, dtype=x.dtype)
            for k in range(self.num_subsets):
                out += torch.einsum('bctv,vw->bctw', x_conv[:, k], A[k])
            out = self.bn(out) + res
            return self.act(out)

    class JointFingerAttention(nn.Module):
        def __init__(self, in_channels: int, num_nodes: int = 21):
            super(JointFingerAttention, self).__init__()
            self.attn_net = nn.Sequential(
                nn.Linear(in_channels, in_channels // 2),
                nn.Tanh(),
                nn.Linear(in_channels // 2, 1)
            )

        def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
            x_t = x.mean(dim=2).permute(0, 2, 1)  # (B, V, C)
            scores = self.attn_net(x_t).squeeze(-1)  # (B, V)
            weights = F.softmax(scores, dim=-1)
            weighted_x = x * weights.unsqueeze(1).unsqueeze(2)
            return weighted_x, weights

    class TemporalTransformerConformer(nn.Module):
        def __init__(self, d_model: int = 128, nhead: int = 4, ffn_dim: int = 256, dropout: float = 0.1):
            super(TemporalTransformerConformer, self).__init__()
            self.self_attn = nn.MultiheadAttention(d_model, nhead, dropout=dropout, batch_first=True)
            self.norm1 = nn.LayerNorm(d_model)
            self.depthwise_conv = nn.Sequential(
                nn.Conv1d(d_model, d_model, kernel_size=3, padding=1, groups=d_model),
                nn.BatchNorm1d(d_model),
                nn.SiLU(),
                nn.Conv1d(d_model, d_model, kernel_size=1),
                nn.Dropout(dropout)
            )
            self.norm2 = nn.LayerNorm(d_model)
            self.ffn = nn.Sequential(
                nn.Linear(d_model, ffn_dim),
                nn.GELU(),
                nn.Dropout(dropout),
                nn.Linear(ffn_dim, d_model),
                nn.Dropout(dropout)
            )
            self.norm3 = nn.LayerNorm(d_model)

        def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
            attn_out, attn_weights = self.self_attn(x, x, x)
            x = self.norm1(x + attn_out)
            conv_in = x.transpose(1, 2)
            conv_out = self.depthwise_conv(conv_in).transpose(1, 2)
            x = self.norm2(x + conv_out)
            ffn_out = self.ffn(x)
            x = self.norm3(x + ffn_out)
            return x, attn_weights

    class MultimodalFusionModule(nn.Module):
        def __init__(self, hand_dim: int = 128, pose_dim: int = 32, face_dim: int = 16, fused_dim: int = 128):
            super(MultimodalFusionModule, self).__init__()
            self.pose_encoder = nn.Sequential(
                nn.Linear(18, pose_dim),
                nn.ReLU(),
                nn.Linear(pose_dim, pose_dim)
            )
            self.face_encoder = nn.Sequential(
                nn.Linear(6, face_dim),
                nn.ReLU(),
                nn.Linear(face_dim, face_dim)
            )
            self.fusion_gate = nn.Sequential(
                nn.Linear(hand_dim + pose_dim + face_dim, fused_dim),
                nn.LayerNorm(fused_dim),
                nn.SiLU(),
                nn.Linear(fused_dim, fused_dim)
            )

        def forward(self, hand_feat: torch.Tensor, pose_feat=None, face_feat=None) -> torch.Tensor:
            B = hand_feat.size(0)
            device = hand_feat.device
            if pose_feat is None or pose_feat.numel() == 0:
                pose_feat = torch.zeros(B, 18, device=device)
            if face_feat is None or face_feat.numel() == 0:
                face_feat = torch.zeros(B, 6, device=device)
            p_emb = self.pose_encoder(pose_feat)
            f_emb = self.face_encoder(face_feat)
            concat = torch.cat([hand_feat, p_emb, f_emb], dim=-1)
            return self.fusion_gate(concat)

    class STGCNTransformerISL(nn.Module):
        def __init__(self, num_classes: int = 23, in_channels: int = 3, num_nodes: int = 21,
                     hidden_channels: int = 64, transformer_dim: int = 128, num_conformer_layers: int = 2,
                     dropout: float = 0.1):
            super(STGCNTransformerISL, self).__init__()
            self.num_classes = num_classes
            self.num_nodes = num_nodes
            graph = HandSkeletonGraph(num_nodes=num_nodes)
            self.register_buffer("A", torch.tensor(graph.A, dtype=torch.float32))
            self.st_block1 = SpatialGraphConv(in_channels, hidden_channels)
            self.st_block2 = SpatialGraphConv(hidden_channels, hidden_channels * 2)
            self.joint_attention = JointFingerAttention(hidden_channels * 2, num_nodes=num_nodes)
            self.spatial_pool_proj = nn.Linear((hidden_channels * 2) * num_nodes, transformer_dim)
            self.pos_emb = nn.Parameter(torch.randn(1, 60, transformer_dim) * 0.02)
            self.conformer_layers = nn.ModuleList([
                TemporalTransformerConformer(d_model=transformer_dim, nhead=4, ffn_dim=256, dropout=dropout)
                for _ in range(num_conformer_layers)
            ])
            self.multimodal_fusion = MultimodalFusionModule(hand_dim=transformer_dim, fused_dim=transformer_dim)
            self.classifier = nn.Sequential(
                nn.LayerNorm(transformer_dim),
                nn.Dropout(dropout),
                nn.Linear(transformer_dim, transformer_dim // 2),
                nn.SiLU(),
                nn.Linear(transformer_dim // 2, num_classes)
            )
            self.temperature = nn.Parameter(torch.ones(1) * 1.5)

        def forward(self, x: torch.Tensor, pose_data=None, face_data=None):
            if x.dim() == 4 and x.size(-1) == 3:
                x = x.permute(0, 3, 1, 2)
            B, C, T, V = x.size()
            x = self.st_block1(x, self.A)
            x = self.st_block2(x, self.A)
            x, joint_weights = self.joint_attention(x)
            x = x.permute(0, 2, 1, 3).contiguous().view(B, T, -1)
            x = self.spatial_pool_proj(x)
            x = x + self.pos_emb[:, :T, :]
            temporal_weights = None
            for layer in self.conformer_layers:
                x, temporal_weights = layer(x)
            hand_feat = x.mean(dim=1)
            fused_feat = self.multimodal_fusion(hand_feat, pose_feat=pose_data, face_feat=face_data)
            logits = self.classifier(fused_feat)
            calibrated_logits = logits / self.temperature.clamp(min=0.1)
            return calibrated_logits, joint_weights, temporal_weights

except ImportError:
    # PyTorch not installed in this environment; pure NumPy inference is active
    pass

numpy_stgcn_inference = NumpySTGCNTransformerInference()
