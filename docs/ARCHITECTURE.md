# System Architecture & Technical Specification

## Overview

The Indian Sign Language (ISL) Recognition Research System is built to support real-time sign recognition from webcam feeds, dataset management for sign language research, and ML model experimentation.

---

## Data Flow Diagram

```
[ Webcam Feed (Client Browser) ]
               │
               ▼
[ MediaPipe Holistic JS API ]
   Extracts 543 3D Keypoints per Frame
               │
               ▼
[ WebSocket Streaming Client ]
   Encodes Keypoint Frame (JSON / ArrayBuffer)
               │
               ▼
[ FastAPI WebSocket Endpoint ] (`/api/v1/ws/predict`)
   Receives sequence buffer & passes to preprocessor
               │
               ▼
[ MediaPipe Preprocessor (`ml.data.preprocess`) ]
   Normalizes (Scale, Translate, Align Keypoints)
               │
               ▼
[ PyTorch Model Engine (`ml.models`) ]
   ST-GCN / Transformer / LSTM Inference
               │
               ▼
[ Prediction Result + Confidence Scores ]
               │
               ▼
[ WebSocket Response to React UI ] -> Renders Prediction & Landmark Overlay
```

---

## Key Modules & Responsibilities

### 1. Frontend Layer (`/frontend`)
- **Webcam Feed Component**: Captures video stream at up to 30 FPS.
- **MediaPipe Landmark Engine**: Client-side execution of `@mediapipe/holistic` to offload frame extraction from the server.
- **Landmark Visualizer**: HTML5 Canvas rendering of pose, hand, and facial landmarks overlaying video feed.
- **State Management & Services**: Custom hooks for WebSocket streaming and REST API integration.

### 2. Backend API Layer (`/backend`)
- **FastAPI Framework**: High-performance async Python backend.
- **WebSocket Streaming Manager**: Manages duplex connections for real-time sign inference.
- **PostgreSQL ORM (`SQLAlchemy 2.0`)**: Asynchronous database models tracking sign vocabulary, user annotations, keypoint recordings, and model performance metrics.
- **Security & Auth**: JWT-based authentication for researchers uploading/editing datasets.

### 3. ML Research Core (`/ml`)
- **MediaPipe Normalizer**: Translates raw pixel coordinate keypoints into invariant coordinate space centered at chest/shoulder midpoint.
- **PyTorch Dataset Pipeline**: Modular `Dataset` and `DataLoader` for loading fixed sequence length tensors `(B, T, V, C)`.
- **Model Registry Stubs**: Abstract interfaces (`BaseSignModel`) for swapping between Graph Convolutional Networks (ST-GCN), Spatial-Temporal Transformers, and Recurrent Networks.

### 4. Database Storage (`/database`)
- **PostgreSQL Database**: Storage for ISL vocabulary dictionary, video file metadata, landmark sequence blobs, and model validation logs.
