# Indian Sign Language (ISL) Recognition Research System

An end-to-end, full-stack research framework for real-time and offline Indian Sign Language (ISL) recognition using MediaPipe holistic keypoint extraction, PyTorch deep learning architectures, FastAPI async services, PostgreSQL database, and React + Vite frontend interface.

---

## 🏗️ System Architecture

```
   ┌─────────────────────────────────────────────────────────┐
   │                   React + Vite UI                       │
   │  (Webcam Feed, MediaPipe Canvas, Live Predictions)      │
   └───────────────────────────┬─────────────────────────────┘
                               │ WebSocket / REST API
                               ▼
   ┌─────────────────────────────────────────────────────────┐
   │                    FastAPI Backend                      │
   │    (API Router, Async SQLAlchemy, Real-time Stream)     │
   └───────────────┬─────────────────────────┬───────────────┘
                   │                         │
                   ▼                         ▼
   ┌───────────────────────────────┐ ┌───────────────────────┐
   │   PyTorch ML Pipeline         │ │  PostgreSQL Database  │
   │ (ST-GCN, Transformer, LSTM)   │ │ (Users, Dataset,      │
   │ (Preprocessing, Datasets)     │ │  Model Checkpoints)   │
   └───────────────────────────────┘ └───────────────────────┘
```

---

## 🛠️ Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite, TypeScript, TailwindCSS / CSS Modules | Real-time camera capture & visual feedback UI |
| **Keypoint Engine** | MediaPipe Holistic | 543 3D landmarks (33 Pose, 21 Left Hand, 21 Right Hand, 468 Face Mesh) |
| **Backend API** | Python 3.10+, FastAPI, AsyncIO, WebSockets | Async REST endpoints & real-time streaming sockets |
| **ML Framework** | PyTorch, PyTorch Lightning stubs | ST-GCN, Spatial Transformer, Bi-LSTM model stubs |
| **Database** | PostgreSQL 15+, SQLAlchemy 2.0 (Async), Alembic | Relational data store for dataset metadata & model registry |
| **Containerization** | Docker, Docker Compose | Microservices orchestration |

---

## 📁 Repository Structure

```
indian-sign-language-research/
├── docs/                      # Technical & Research specifications
│   ├── ARCHITECTURE.md        # System architecture & data flows
│   ├── DATASET_SPECIFICATION.md # ISL dataset standards & formats
│   ├── MEDIAPIPE_PIPELINE.md  # Keypoint extraction & normalizers
│   ├── MODEL_ROADMAP.md       # ML architectures & evaluation roadmap
│   └── API_SPECIFICATION.md   # FastAPI REST & WebSocket documentation
├── frontend/                  # React + Vite + TypeScript application
├── backend/                   # FastAPI application & PostgreSQL ORM models
├── ml/                        # PyTorch dataset modules, preprocessors, & model stubs
└── database/                  # Alembic migrations & DB seed scripts
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js >= 18.x
- Python >= 3.10
- PostgreSQL >= 15 (or Docker)

### 1. Run via Docker Compose (Recommended)

```bash
docker-compose up --build
```

### 2. Manual Development Setup

#### Backend & ML Setup
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 📄 Documentation Links
- [System Architecture Specification](docs/ARCHITECTURE.md)
- [ISL Dataset Specification](docs/DATASET_SPECIFICATION.md)
- [MediaPipe Landmark Pipeline Spec](docs/MEDIAPIPE_PIPELINE.md)
- [ML Architecture & Research Roadmap](docs/MODEL_ROADMAP.md)
- [API Documentation](docs/API_SPECIFICATION.md)

---

## 🎙️ Speech ➔ 3D Avatar ISL Signing Engine

A bidirectional assistive communication pipeline that converts spoken input into Indian Sign Language (ISL) gloss and animates a 3D humanoid avatar:

1. **Multilingual Speech-to-Text**: Streaming microphone capture supporting Indian English (`en-IN`), Hindi (`hi-IN`), Tamil, Telugu, Kannada, and Bengali with Voice Activity Detection (VAD).
2. **ISL Gloss Translator**: Strict ISL grammar transformer (Topic-Comment / SOV order, article omission, tense simplification, negation/questions at clause-final position).
3. **Sign Library (`sign_library/`)**: 24 dataset-derived mean normalized keyframe poses + 26 canonical manual alphabet fingerspelling keyframes (`FS_A` to `FS_Z`).
4. **3D Avatar Engine (Three.js)**: Articulated rigged humanoid avatar with inverse kinematics (analytical 2-bone arm IK + palm basis quaternion orientations), One-Euro 3D jitter filtering, and smooth Hermite pose blending.
5. **Privacy by Design**: Audio is processed purely in-memory; zero audio recordings are stored on disk or externally.

### ⚠️ Honest Limits Statement
> **Dataset & Motion Scope:** The current dataset provides 24 static gesture classes (150 samples each). The 3D avatar output renders verified signs from the library and manual alphabet fingerspelling for out-of-vocabulary words with smooth kinematic easing. It does **not** claim fluent continuous sentence-level ISL until continuous word-level motion sequences are added.

---

## 📜 License
MIT License - Research Project Scaffolding

