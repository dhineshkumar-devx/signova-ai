# FastAPI REST & WebSocket API Specification

Base URL: `http://localhost:8000/api/v1`

---

## 1. REST Endpoints

### Health Check
- **GET** `/health`
- **Response**: `{"status": "ok", "version": "1.0.0"}`

### Auth Routes
- **POST** `/auth/login`
  - **Body**: `{"username": "admin", "password": "..."}`
  - **Response**: `{"access_token": "...", "token_type": "bearer"}`

### Dataset Routes
- **GET** `/dataset/signs`
  - **Description**: Fetch all registered ISL signs and vocabulary words.
  - **Response**: List of `SignVocabulary` objects.
- **POST** `/dataset/samples`
  - **Description**: Save a recorded keypoint sequence sample for research annotation.

### Model Routes
- **GET** `/models`
  - **Description**: List available loaded model checkpoints and active inference model.
- **POST** `/models/predict`
  - **Description**: Single-shot batch prediction from uploaded keypoint JSON array.

---

## 2. Real-Time Streaming WebSocket

### Real-Time Sign Inference
- **WebSocket URL**: `ws://localhost:8000/api/v1/ws/predict`

#### Client Payload Frame (JSON):
```json
{
  "timestamp": 1756041000000,
  "frame_index": 12,
  "landmarks": {
    "pose": [{"x": 0.5, "y": 0.4, "z": -0.1, "visibility": 0.99}],
    "left_hand": [{"x": 0.4, "y": 0.6, "z": 0.0}],
    "right_hand": [{"x": 0.6, "y": 0.6, "z": 0.0}]
  }
}
```

#### Server Response Frame (JSON):
```json
{
  "prediction": "NAMASTE",
  "confidence": 0.942,
  "top_k": [
    {"label": "NAMASTE", "score": 0.942},
    {"label": "WELCOME", "score": 0.035},
    {"label": "THANK_YOU", "score": 0.011}
  ],
  "latency_ms": 14.2
}
```
