# PyTorch ML Research Component for ISL Recognition

This directory contains the machine learning pipelines, MediaPipe keypoint preprocessing modules, PyTorch datasets, and model architecture stubs for Indian Sign Language (ISL) research.

---

## 📁 Directory Layout

```
ml/
├── config/                  # Training & dataset YAML configurations
│   ├── dataset_config.yaml
│   └── model_config.yaml
├── data/                    # PyTorch Data Pipeline
│   ├── preprocess.py        # 3D Landmark normalization & centering
│   ├── dataset.py           # PyTorch Dataset for ISL keypoint tensors
│   ├── transforms.py        # Data augmentation (rotation, jitter, scaling)
│   └── datamodule.py        # DataLoader generator & split logic
├── models/                  # PyTorch Model Architectures (Stubs)
│   ├── base_model.py        # Abstract BaseSignModel interface
│   ├── stgcn.py             # Spatial-Temporal Graph Convolutional Network stub
│   ├── transformer.py       # Landmark Spatial-Temporal Transformer stub
│   └── lstm_classifier.py   # Baseline Bi-LSTM model stub
├── training/                # Training & Evaluation Loops
│   ├── trainer.py           # Training loop skeleton
│   ├── evaluator.py         # Metrics calculator (Top-k, F1, Latency)
│   └── loss.py              # Custom loss function stubs (Label Smoothing, CTC)
└── utils/                   # Utilities
    ├── visualization.py     # Skeleton plotting & animation tools
    └── export.py            # ONNX & TorchScript export utilities
```

---

## 📐 Data Tensor Conventions

Keypoint sequence tensors follow standard PyTorch shapes:

- **Graph Neural Networks (ST-GCN)**: $(B, C, T, V)$
  - $B$: Batch Size (e.g., 32)
  - $C$: Coordinates $(x, y, z)$ (3 channels)
  - $T$: Sequence Length (e.g., 30 frames)
  - $V$: Number of Vertices / Keypoints (75 landmarks)

- **Transformers & Bi-LSTM**: $(B, T, D)$
  - $D = V \times C = 75 \times 3 = 225$ dimensional feature vector
