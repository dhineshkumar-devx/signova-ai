# ML Architecture & Research Roadmap

## 1. Research Objectives

1. Evaluate graph-based vs temporal transformer models for isolated ISL sign classification.
2. Optimize keypoint-based models for low latency real-time inference in browser/edge environments.
3. Formulate continuous sign language recognition (CSLR) using Connectionist Temporal Classification (CTC) loss.

---

## 2. Targeted Model Architectures

### Architecture 1: Spatial-Temporal Graph Convolutional Network (ST-GCN)
- **Input Topology**: Graph $G = (V, E)$ where nodes $V$ are 75 keypoints and edges $E$ reflect physical skeleton connections plus temporal intra-frame edges.
- **Advantages**: Preserves physical skeletal constraints and movement dynamics.
- **Stub Implementation**: `ml/models/stgcn.py`

### Architecture 2: Spatial Transformer with Temporal Convolutions (Landmark Transformer)
- **Input Tensor**: $(B, T, V \cdot C)$ sequence embedding.
- **Mechanism**: Multi-head self-attention over spatial landmarks followed by 1D temporal convolutions.
- **Advantages**: Captures long-range dependencies across sign sequences.
- **Stub Implementation**: `ml/models/transformer.py`

### Architecture 3: Bidirectional LSTM Baseline (Bi-LSTM)
- **Input Tensor**: Flattened landmark vectors $(B, T, D)$.
- **Mechanism**: 2-layer Bi-LSTM with linear classifier head.
- **Advantages**: Low computational overhead and robust baseline.
- **Stub Implementation**: `ml/models/lstm_classifier.py`

---

## 3. Evaluation Metrics

- **Top-1 Accuracy (%)**: Standard classification metric.
- **Top-5 Accuracy (%)**: Accounts for visually similar signs.
- **F1-Score (Macro & Weighted)**: Evaluates dataset class imbalance.
- **Inference Latency (ms)**: Time per window inference (Target: < 30ms for real-time 30 FPS playback).
