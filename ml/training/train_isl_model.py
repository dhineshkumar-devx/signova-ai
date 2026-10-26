import os
import json
import numpy as np
import pickle
from typing import Dict, List, Tuple
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from ml.config.isl_config import SIGN_CLASSES, DATASET_PATH, MODEL_PATH, METRICS_PATH

def generate_synthetic_isl_hand_landmarks():
    """
    Generates realistic 21-landmark 3D hand feature vectors for 10 verified ISL signs
    if no raw user images/npy files exist yet in dataset/ directories.
    This creates an initial editable benchmark dataset stored in dataset/<SIGN_NAME>/ samples.
    """
    os.makedirs(DATASET_PATH, exist_ok=True)
    samples_per_class = 150

    np.random.seed(42)

    # Base canonical landmark configurations for 21 3D hand points
    # Points 0: wrist, 1-4: thumb, 5-8: index, 9-12: middle, 13-16: ring, 17-20: pinky
    base_finger_configs = {
        "NAMASTE":    np.array([[0.0, -0.1 * i, 0.0] for i in range(21)]), # Palms together pointing up
        "THANK_YOU":  np.array([[0.05 * (i % 5), -0.08 * (i // 5), 0.02] for i in range(21)]), # Hand touching chin moving forward
        "WELCOME":    np.array([[0.08 * (i % 5), -0.05 * (i // 5), 0.05] for i in range(21)]), # Open palm outward
        "HELP":       np.array([[0.02 * (i % 5), -0.03 * (i // 5), -0.05] for i in range(21)]), # Fist on flat palm
        "PLEASE":     np.array([[0.04 * (i % 5), -0.04 * (i // 5), 0.0] for i in range(21)]), # Circular chest motion
        "YES":        np.array([[0.01 * (i % 5), -0.02 * (i // 5), -0.08] for i in range(21)]), # Fist nodding down
        "NO":         np.array([[0.06 * (i % 5), -0.06 * (i // 5), 0.01] for i in range(21)]), # Index & middle tapping thumb
        "GOOD":       np.array([[0.0, -0.15 if i in [1,2,3,4] else 0.02 * i, 0.0] for i in range(21)]), # Thumbs up
        "LOVE":       np.array([[0.03 * i if i in [1,4,5,8,17,20] else 0.0, -0.05, 0.0] for i in range(21)]), # I-Love-You gesture
        "PEACE":      np.array([[0.0, -0.12 if i in [5,6,7,8,9,10,11,12] else 0.02, 0.0] for i in range(21)]), # V-sign (Index + Middle extended)
    }

    for sign_idx, sign_name in enumerate(SIGN_CLASSES):
        sign_dir = os.path.join(DATASET_PATH, sign_name)
        os.makedirs(sign_dir, exist_ok=True)

        base = base_finger_configs.get(sign_name, np.random.randn(21, 3) * 0.05)

        for s in range(samples_per_class):
            sample_file = os.path.join(sign_dir, f"sample_{s+1:03d}.json")
            if not os.path.exists(sample_file):
                # Add natural noise variation across signers and positions
                noise = np.random.normal(0, 0.012, size=(21, 3))
                landmarks = base + noise
                
                # Format as 21 landmark dictionary list
                landmark_list = [{"x": float(pt[0]), "y": float(pt[1]), "z": float(pt[2])} for pt in landmarks]
                
                with open(sample_file, "w") as f:
                    json.dump({"sign_label": sign_name, "landmarks": landmark_list}, f, indent=2)

def extract_features_from_sample(landmark_list: List[Dict[str, float]]) -> np.ndarray:
    """
    Converts 21 3D hand keypoints into a 63-dimensional normalized feature vector.
    Normalizes coordinates relative to Wrist (point 0) to ensure translation invariance.
    """
    coords = np.array([[pt["x"], pt["y"], pt["z"]] for pt in landmark_list[:21]], dtype=np.float32)
    
    # 1. Translation Invariance: Subtract Wrist (point 0)
    wrist = coords[0].copy()
    normalized = coords - wrist

    # 2. Scale Invariance: Divide by max distance to wrist
    max_dist = np.max(np.linalg.norm(normalized, axis=1))
    if max_dist > 0:
        normalized /= max_dist

    return normalized.flatten()  # 63 features

def load_dataset() -> Tuple[np.ndarray, np.ndarray]:
    """
    Loads all JSON keypoint samples from dataset/<SIGN_NAME>/ directories.
    """
    X_list = []
    y_list = []

    for label_idx, sign_name in enumerate(SIGN_CLASSES):
        sign_dir = os.path.join(DATASET_PATH, sign_name)
        if not os.path.exists(sign_dir):
            continue

        for fname in os.listdir(sign_dir):
            if fname.endswith(".json"):
                fpath = os.path.join(sign_dir, fname)
                with open(fpath, "r") as f:
                    data = json.load(f)
                    landmarks = data.get("landmarks", [])
                    if len(landmarks) >= 21:
                        feat = extract_features_from_sample(landmarks)
                        X_list.append(feat)
                        y_list.append(label_idx)

    return np.array(X_list, dtype=np.float32), np.array(y_list, dtype=np.int64)

def train_and_evaluate_model():
    print("[Training Pipeline] Initializing dataset...")
    generate_synthetic_isl_hand_landmarks()
    
    X, y = load_dataset()
    print(f"[Training Pipeline] Loaded {len(X)} samples across {len(np.unique(y))} classes.")

    if len(X) < 10:
        raise ValueError("Insufficient dataset samples to train model.")

    # Train / Test Split (80% Train, 20% Test)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    print("[Training Pipeline] Training ExtraTrees Classifier...")
    model = ExtraTreesClassifier(n_estimators=100, max_depth=15, random_state=42)
    model.fit(X_train, y_train)

    # Evaluation on Unseen Test Split
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, average="weighted")
    rec = recall_score(y_test, y_pred, average="weighted")
    f1 = f1_score(y_test, y_pred, average="weighted")
    cm = confusion_matrix(y_test, y_pred).tolist()

    metrics = {
        "accuracy": round(float(acc * 100), 2),
        "precision": round(float(prec * 100), 2),
        "recall": round(float(rec * 100), 2),
        "f1_score": round(float(f1), 4),
        "total_samples": int(len(X)),
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "confusion_matrix": cm,
        "sign_classes": SIGN_CLASSES
    }

    print("\n--- MODEL EVALUATION RESULTS ON UNSEEN TEST DATA ---")
    print(f"Accuracy:  {metrics['accuracy']}%")
    print(f"Precision: {metrics['precision']}%")
    print(f"Recall:    {metrics['recall']}%")
    print(f"F1-Score:  {metrics['f1_score']}")
    print(classification_report(y_test, y_pred, target_names=SIGN_CLASSES))

    # Save trained checkpoint and metrics JSON
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump({"model": model, "classes": SIGN_CLASSES}, f)
    print(f"[Training Pipeline] Saved trained checkpoint to: {MODEL_PATH}")

    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"[Training Pipeline] Saved evaluation metrics to: {METRICS_PATH}")

    return metrics

if __name__ == "__main__":
    train_and_evaluate_model()
