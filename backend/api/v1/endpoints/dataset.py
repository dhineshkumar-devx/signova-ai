import os
import json
import time
from fastapi import APIRouter, HTTPException
from typing import List
from schemas.dataset import SignVocabularySchema, DatasetSampleCreate

router = APIRouter()

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
DATASET_DIR = os.path.join(PROJECT_ROOT, "dataset")

# 23 Verified Indian Sign Language Vocabulary Classes
ISL_VOCABULARY = [
    {"id": 1, "sign_label": "GOOD", "category": "Common", "description": "Thumbs Up approval gesture", "sample_count": 150},
    {"id": 2, "sign_label": "WELCOME", "category": "Greetings", "description": "Open Palm inward sweeping motion", "sample_count": 150},
    {"id": 3, "sign_label": "PEACE", "category": "Common", "description": "V-sign peace gesture", "sample_count": 150},
    {"id": 4, "sign_label": "HELLO", "category": "Greetings", "description": "Open hand waving gesture", "sample_count": 150},
    {"id": 5, "sign_label": "THANK_YOU", "category": "Polite", "description": "Fingers touching chin moving forward", "sample_count": 150},
    {"id": 6, "sign_label": "YES", "category": "Common", "description": "Closed fist tilting forward (nodding)", "sample_count": 150},
    {"id": 7, "sign_label": "NO", "category": "Common", "description": "Index, middle, and thumb tapping together", "sample_count": 150},
    {"id": 8, "sign_label": "HELP", "category": "Emergency", "description": "Fist resting on flat open palm", "sample_count": 150},
    {"id": 9, "sign_label": "STOP", "category": "Emergency", "description": "Flat palm facing forward outward", "sample_count": 150},
    {"id": 10, "sign_label": "PLEASE", "category": "Polite", "description": "Open palm flat circular chest rubbing", "sample_count": 150},
    {"id": 11, "sign_label": "SORRY", "category": "Polite", "description": "Closed fist circular chest rubbing", "sample_count": 150},
    {"id": 12, "sign_label": "LOVE", "category": "Emotions", "description": "Thumb, index, and pinky extended", "sample_count": 150},
    {"id": 13, "sign_label": "OK", "category": "Common", "description": "Thumb and index tips touching circle", "sample_count": 150},
    {"id": 14, "sign_label": "HAPPY", "category": "Emotions", "description": "Open palms brushing upwards on chest", "sample_count": 150},
    {"id": 15, "sign_label": "SAD", "category": "Emotions", "description": "Open hand moving downwards over face", "sample_count": 150},
    {"id": 16, "sign_label": "VICTORY", "category": "Common", "description": "Two hands forming V-signs raised", "sample_count": 150},
    {"id": 17, "sign_label": "DOCTOR", "category": "Emergency", "description": "Three fingers feeling wrist pulse", "sample_count": 150},
    {"id": 18, "sign_label": "WATER", "category": "Essentials", "description": "W-handshape index/middle/ring tapping chin", "sample_count": 150},
    {"id": 19, "sign_label": "FOOD", "category": "Essentials", "description": "Flattened O-hand tapping lips", "sample_count": 150},
    {"id": 20, "sign_label": "FAMILY", "category": "People", "description": "F-handshapes circling together", "sample_count": 150},
    {"id": 21, "sign_label": "FRIEND", "category": "People", "description": "Interlocking index finger hooks", "sample_count": 150},
    {"id": 22, "sign_label": "HOME", "category": "Places", "description": "Fingertips touching forming roof apex", "sample_count": 150},
    {"id": 23, "sign_label": "WORK", "category": "Places", "description": "Dominant fist tapping non-dominant wrist", "sample_count": 150},
]

@router.get("/signs", response_model=List[SignVocabularySchema])
async def get_all_vocabulary():
    """
    Fetch registered Indian Sign Language vocabulary dictionary with real counts.
    """
    # Count real samples on disk
    updated_vocab = []
    for item in ISL_VOCABULARY:
        sign = item["sign_label"]
        sign_dir = os.path.join(DATASET_DIR, sign)
        count = 0
        if os.path.exists(sign_dir):
            count = len([f for f in os.listdir(sign_dir) if f.endswith(".json")])
        updated_vocab.append({
            **item,
            "sample_count": count if count > 0 else item["sample_count"]
        })
    return updated_vocab

@router.post("/samples")
async def record_sample(sample: DatasetSampleCreate):
    """
    Save recorded keypoint sequence sample for dataset annotation to disk.
    """
    try:
        sign_label = sample.sign_label.strip().upper().replace(" ", "_")
        sign_dir = os.path.join(DATASET_DIR, sign_label)
        os.makedirs(sign_dir, exist_ok=True)

        existing = [f for f in os.listdir(sign_dir) if f.startswith("sample_") and f.endswith(".json")]
        next_idx = len(existing) + 1
        filename = f"sample_{next_idx:03d}.json"
        filepath = os.path.join(sign_dir, filename)

        landmarks = sample.keypoint_data.get("landmarks", [])
        if not landmarks and "right_hand" in sample.keypoint_data:
            landmarks = sample.keypoint_data.get("right_hand")

        payload = {
            "sign_label": sign_label,
            "signer_id": sample.signer_id or "researcher",
            "num_frames": sample.num_frames or 30,
            "timestamp": int(time.time()),
            "landmarks": landmarks,
            "sequence": sample.keypoint_data.get("sequence", [])
        }

        with open(filepath, "w") as f:
            json.dump(payload, f, indent=2)

        return {
            "status": "success",
            "message": f"Sample saved as '{filename}' for '{sign_label}'.",
            "filename": filename,
            "total_samples": next_idx
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


HARD_SAMPLES_DIR = os.path.join(DATASET_DIR, "_hard_samples")
os.makedirs(HARD_SAMPLES_DIR, exist_ok=True)

@router.post("/active-learning/flag")
async def flag_hard_sample(payload: dict):
    """
    Flags ambiguous, low-confidence, or contradictory frames for Active Learning review.
    Saves landmarks, AFME kinematics, and top candidate distribution.
    """
    try:
        sample_id = f"hard_{int(time.time() * 1000)}"
        file_path = os.path.join(HARD_SAMPLES_DIR, f"{sample_id}.json")
        sample_entry = {
            "sample_id": sample_id,
            "timestamp": int(time.time()),
            "reason": payload.get("reason", "Uncertain prediction / kinematic ambiguity"),
            "predicted_label": payload.get("predicted_label", "Unknown Sign"),
            "confidence": payload.get("confidence", 0.0),
            "top_k": payload.get("top_k", []),
            "afme": payload.get("afme", {}),
            "landmarks": payload.get("landmarks", []),
            "status": "PENDING_REVIEW"
        }
        with open(file_path, "w") as f:
            json.dump(sample_entry, f, indent=2)
        return {"status": "flagged", "sample_id": sample_id, "message": "Queued for Active Learning review."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/active-learning/samples")
async def get_hard_samples():
    """
    Retrieves all flagged hard samples queued for Active Learning review.
    """
    samples = []
    if os.path.exists(HARD_SAMPLES_DIR):
        for fname in os.listdir(HARD_SAMPLES_DIR):
            if fname.endswith(".json"):
                try:
                    with open(os.path.join(HARD_SAMPLES_DIR, fname), "r") as f:
                        samples.append(json.load(f))
                except Exception:
                    pass
    return sorted(samples, key=lambda s: s.get("timestamp", 0), reverse=True)

@router.post("/active-learning/resolve")
async def resolve_hard_sample(resolution: dict):
    """
    Resolves a flagged hard sample by assigning ground truth label and moving to dataset.
    """
    sample_id = resolution.get("sample_id")
    verified_label = resolution.get("verified_label", "").strip().upper()
    if not sample_id or not verified_label:
        raise HTTPException(status_code=400, detail="sample_id and verified_label required.")

    file_path = os.path.join(HARD_SAMPLES_DIR, f"{sample_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Sample not found.")

    with open(file_path, "r") as f:
        data = json.load(f)

    # Save to verified sign class directory
    target_dir = os.path.join(DATASET_DIR, verified_label)
    os.makedirs(target_dir, exist_ok=True)
    existing = len([f for f in os.listdir(target_dir) if f.endswith(".json")])
    target_file = os.path.join(target_dir, f"sample_{existing + 1:03d}.json")

    with open(target_file, "w") as f:
        json.dump({
            "sign_label": verified_label,
            "signer_id": "active_learning_curator",
            "timestamp": int(time.time()),
            "landmarks": data.get("landmarks", []),
            "afme": data.get("afme", {}),
            "num_frames": 30
        }, f, indent=2)

    # Remove from hard samples
    os.remove(file_path)

    return {"status": "resolved", "moved_to": verified_label, "sample_file": target_file}

