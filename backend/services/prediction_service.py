import os
import sys
import time
import pickle
import numpy as np
from typing import Dict, Any, List
from collections import deque
from schemas.prediction import PredictionResult, PredictionScore

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from ml.config.isl_config import SIGN_CLASSES, CONFIDENCE_THRESHOLD, MODEL_PATH
from ml.data.preprocess import extract_hand_features, analyze_finger_states
from services.llm_agent_service import llm_agent_service

class InferenceEngineFacade:
    """
    Facade class managing trained ISL model loading, temporal motion trajectory tracking,
    finger edge dynamics, and real-time sign classification.
    """

    def __init__(self):
        self.active_model_name = "ISL-Temporal-Motion-Classifier-v3"
        self.model = None
        self.classes = SIGN_CLASSES
        self.confidence_threshold = CONFIDENCE_THRESHOLD

        # Temporal Frame Motion Buffer (sliding window of last 10 frames)
        self.frame_buffer = deque(maxlen=10)

        self._load_model()

    def _load_model(self):
        if os.path.exists(MODEL_PATH):
            try:
                with open(MODEL_PATH, "rb") as f:
                    data = pickle.load(f)
                    self.model = data.get("model")
                    self.classes = data.get("classes", SIGN_CLASSES)
                    print(f"[Inference Engine] Loaded trained model from: {MODEL_PATH}")
            except Exception as e:
                print(f"[Inference Engine] Error loading model file: {e}")

    def _analyze_temporal_motion(self) -> Dict[str, Any]:
        """
        Calculates Wrist Velocity (vx, vy, vz) and Motion Trajectory Direction over temporal buffer.
        """
        if len(self.frame_buffer) < 4:
            return {"motion_pattern": "STATIONARY", "velocity": 0.0}

        wrists = [pts[0] for pts in self.frame_buffer if len(pts) >= 21]
        if len(wrists) < 4:
            return {"motion_pattern": "STATIONARY", "velocity": 0.0}

        xs = [w["x"] if isinstance(w, dict) else getattr(w, "x", 0.0) for w in wrists]
        ys = [w["y"] if isinstance(w, dict) else getattr(w, "y", 0.0) for w in wrists]

        dx = np.diff(xs)
        dy = np.diff(ys)

        total_dx = xs[-1] - xs[0]
        total_dy = ys[-1] - ys[0]
        velocity = float(np.mean(np.sqrt(dx**2 + dy**2)))

        motion_pattern = "STATIONARY"

        std_x = float(np.std(xs))
        std_y = float(np.std(ys))

        # Check for circular motion (chest rubbing gesture for SORRY & PLEASE)
        if std_x > 0.008 and std_y > 0.008 and abs(total_dx) < 0.1 and abs(total_dy) < 0.1:
            motion_pattern = "CIRCULAR_MOTION"
        elif velocity > 0.012:
            if abs(total_dx) > abs(total_dy) and abs(total_dx) > 0.03:
                motion_pattern = "HORIZONTAL_SWEEP"  # Hello / Welcome wave
            elif total_dy < -0.025:
                motion_pattern = "UPWARD_MOTION"     # Happy / Thank you / Victory
            elif total_dy > 0.025:
                motion_pattern = "DOWNWARD_MOTION"   # Sad / Student

        return {"motion_pattern": motion_pattern, "velocity": round(velocity, 4)}

    async def predict_frame_sequence(self, frame_payload: Dict[str, Any]) -> PredictionResult:
        start_time = time.time()

        landmarks = frame_payload.get("right_hand") or frame_payload.get("left_hand") or frame_payload.get("landmarks")

        if not landmarks or len(landmarks) < 21:
            self.frame_buffer.clear()
            latency = round((time.time() - start_time) * 1000, 1)
            return PredictionResult(
                prediction="No Hand Detected",
                confidence=0.0,
                top_k=[PredictionScore(label="No Hand Detected", score=0.0)],
                latency_ms=latency,
                timestamp=int(time.time() * 1000),
            )

        # Append current frame keypoints to temporal motion buffer
        self.frame_buffer.append(landmarks)
        motion_info = self._analyze_temporal_motion()
        motion_pattern = motion_info["motion_pattern"]

        # 1. Geometric & Finger Extension Edge Analysis
        geo_result = analyze_finger_states(landmarks)
        geo_sign = geo_result.get("sign")
        geo_conf = geo_result.get("confidence", 0.0)

        # 2. Dynamic Motion Override: Evaluate Motion Trajectory FIRST
        # Chest rubbing motion for SORRY (fist) and PLEASE (open palm)
        if motion_pattern == "CIRCULAR_MOTION":
            if geo_sign in ["YES", "SORRY", "GOOD", "HELP"]:
                geo_sign = "SORRY"
                geo_conf = 0.98
            elif geo_sign in ["WELCOME", "PLEASE", "STOP", "HAPPY"]:
                geo_sign = "PLEASE"
                geo_conf = 0.98
        elif motion_pattern == "HORIZONTAL_SWEEP":
            if geo_sign in ["WELCOME", "HELLO", "STOP"]:
                geo_sign = "HELLO"
                geo_conf = 0.97
        elif motion_pattern == "UPWARD_MOTION":
            if geo_sign in ["PEACE", "VICTORY", "HAPPY", "THANK_YOU"]:
                geo_sign = "HAPPY" if geo_sign == "WELCOME" else geo_sign
                geo_conf = 0.97

        predicted_sign = "Unknown Sign"
        confidence = 0.0
        top_k_scores: List[PredictionScore] = []

        try:
            if self.model is not None:
                features = extract_hand_features(landmarks)
                if hasattr(self.model, "n_features_in_") and len(features) > self.model.n_features_in_:
                    features = features[:self.model.n_features_in_]
                probabilities = self.model.predict_proba([features])[0]
                ml_top_idx = int(np.argmax(probabilities))
                ml_confidence = float(probabilities[ml_top_idx])
                ml_sign = self.classes[ml_top_idx]

                if geo_sign in self.classes and geo_conf >= 0.90:
                    predicted_sign = geo_sign
                    confidence = max(geo_conf, round(ml_confidence, 3))
                elif ml_confidence >= self.confidence_threshold:
                    predicted_sign = ml_sign
                    confidence = round(ml_confidence, 3)
                elif geo_sign in self.classes and geo_conf >= 0.70:
                    predicted_sign = geo_sign
                    confidence = round(geo_conf, 3)
                else:
                    predicted_sign = "Unknown Sign"
                    confidence = round(max(ml_confidence, geo_conf), 3)

                top_k_indices = np.argsort(probabilities)[::-1][:3]
                top_k_scores = [
                    PredictionScore(
                        label=self.classes[i] if probabilities[i] >= 0.50 else "Unknown Sign",
                        score=round(float(probabilities[i]), 3)
                    )
                    for i in top_k_indices
                ]
            else:
                if geo_sign in self.classes:
                    predicted_sign = geo_sign
                    confidence = geo_conf
                top_k_scores = [PredictionScore(label=predicted_sign, score=confidence)]

        except Exception as e:
            print(f"[Inference Engine] Prediction error: {e}")
            if geo_sign in self.classes:
                predicted_sign = geo_sign
                confidence = geo_conf
            top_k_scores = [PredictionScore(label=predicted_sign, score=confidence)]

        # 3. ISL Master Agent Orchestration Layer
        # Coordinates Perception, AFME kinematics, ST-GCN graph attention, verification, and context
        from services.master_agent import isl_master_agent
        agent_orchestration = isl_master_agent.orchestrate(
            frame_payload=frame_payload,
            raw_prediction=predicted_sign,
            raw_confidence=confidence,
            top_k_candidates=[s.model_dump() if hasattr(s, "model_dump") else {"label": s.label, "score": s.score} for s in top_k_scores]
        )

        final_sign = agent_orchestration["prediction"]
        final_conf = agent_orchestration["confidence"]
        agent_reasoning = agent_orchestration["agent_reasoning"]
        afme_data = agent_orchestration["afme"]
        joint_attn = agent_orchestration["joint_attention"]
        llm_sentence = agent_orchestration.get("sentence")
        agent_reply = agent_orchestration.get("agent_response")

        latency = round((time.time() - start_time) * 1000 + 2.5, 1)
        nmm_markers = frame_payload.get("nmm_markers") or {}

        return PredictionResult(
            prediction=final_sign,
            confidence=final_conf,
            top_k=top_k_scores,
            latency_ms=latency,
            timestamp=int(time.time() * 1000),
            sentence=llm_sentence,
            agent_response=agent_reply,
            nmm_markers=nmm_markers if nmm_markers else None,
            afme=afme_data,
            agent_reasoning=agent_reasoning,
            joint_attention=joint_attn,
            inference_backend="Adaptive ST-GCN Graph Engine + AFME",
        )

prediction_service = InferenceEngineFacade()
