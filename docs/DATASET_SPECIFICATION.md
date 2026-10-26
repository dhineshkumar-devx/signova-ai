# ISL Dataset Specification

## 1. Overview

Indian Sign Language (ISL) differs significantly from ASL (American Sign Language) and BSL (British Sign Language) in grammar, syntax, and gesture forms. This research project standardizes keypoint dataset structures for both isolated sign recognition (word-level) and continuous sign language translation (sentence-level).

---

## 2. Standard Benchmark Datasets Compatibility

The data ingestion pipeline supports metadata mapping for:
1. **INCLUDE Dataset**: 0.28 million frames across 263 isolated ISL signs performed by 7 signers.
2. **ISL-CSL Dataset**: Continuous ISL sentence benchmark dataset.
3. **Custom Research Recording**: Web-based keypoint recording format generated via the frontend collector.

---

## 3. Keypoint Data Schema

Keypoints are saved as compressed NumPy arrays (`.npy`) or JSON sequence blobs with the following shape:

$$\text{Shape: } (T, V, C)$$

Where:
- **$T$ (Sequence Length)**: Number of frames (default fixed size: 30 or 60 frames, padded/sampled).
- **$V$ (Vertices / Landmarks)**: 75 selected keypoints (Pose: 33, Left Hand: 21, Right Hand: 21) or full 543 MediaPipe Holistic keypoints.
- **$C$ (Channels)**: 3 ($x, y, z$ coordinates) or 4 ($x, y, z, \text{visibility}$).

### Data Directory Structure
```
dataset_root/
├── metadata.json
├── vocabulary.json
├── raw_videos/
│   ├── SIGN_HELLO_001.mp4
│   └── SIGN_THANKYOU_001.mp4
└── processed_keypoints/
    ├── SIGN_HELLO_001.npy
    └── SIGN_THANKYOU_001.npy
```

---

## 4. Metadata JSON Schema Example

```json
{
  "sample_id": "ISL_ISO_00142",
  "sign_label": "NAMASTE",
  "category": "GREETINGS",
  "signer_id": "RESEARCHER_01",
  "num_frames": 45,
  "fps": 30,
  "resolution": [1280, 720],
  "keypoint_format": "MEDIAPIPE_HOLISTIC_V1",
  "created_at": "2026-08-24T19:50:00Z"
}
```
