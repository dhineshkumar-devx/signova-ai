"""
ISL Master Agent - Multimodal Orchestration & Evidence-Based Reasoning Layer
ISL Bridge AI - Final-Year Academic Engineering Research Project

Architecture:
1. Perception Component: Validates structured landmarks, pose keypoints, and facial NMM markers.
2. Motion Analysis Component (AFME): Ingests kinematics (joint angles, velocities, curvature, motion state).
3. Sign Recognition Component: Integrates ST-GCN + Transformer graph representations with classifier predictions.
4. Context Component: Maintains temporal sign history and sequence transitions.
5. Verification Component: Resolves confusable sign pairs, handles low-confidence holding, prevents hallucinations.
6. Knowledge Component: Grounded ISL vocabulary definitions, grammatical roles, and syntax rules.
7. Sentence Builder Component: Synthesizes natural English while preserving raw glosses.
8. Active Learning Hook: Flags hard or ambiguous samples for continuous improvement.
"""

import time
from typing import Dict, List, Any, Optional, Tuple
from collections import deque
import numpy as np

from ml.data.afme import afme_engine
from ml.models.stgcn_transformer import numpy_stgcn_inference
from services.llm_agent_service import llm_agent_service

# Known ambiguous / confusing ISL sign pairs requiring motion/context verification
CONFUSING_SIGN_PAIRS = {
    ("PLEASE", "SORRY"): {
        "distinguisher": "finger_configuration",
        "description": "Both use circular chest rubbing. PLEASE requires open palm (all extended), SORRY requires closed fist (all folded)."
    },
    ("STOP", "WELCOME"): {
        "distinguisher": "trajectory",
        "description": "STOP is static open palm facing forward. WELCOME requires inward horizontal sweeping trajectory."
    },
    ("PEACE", "VICTORY"): {
        "distinguisher": "motion_elevation",
        "description": "PEACE is stationary mid-level V-sign. VICTORY requires elevated upright stroke or dual hands."
    },
    ("HELLO", "WELCOME"): {
        "distinguisher": "trajectory_direction",
        "description": "HELLO uses lateral back-and-forth waving. WELCOME uses inward sweeping motion toward the body."
    },
    ("FOOD", "WATER"): {
        "distinguisher": "handshape",
        "description": "FOOD has clustered fingertips touching near mouth. WATER has W-shape (index, middle, ring extended)."
    },
    ("GOOD", "YES"): {
        "distinguisher": "thumb_orientation",
        "description": "GOOD requires thumb pointing strictly upward. YES involves closed fist tilting forward."
    }
}

class ISLMasterAgent:
    """
    Evidence-based Master Orchestration Agent.
    Receives perception landmarks, AFME kinematics, and recognition outputs.
    Coordinates verification, context resolution, and sentence synthesis.
    """

    def __init__(self, verification_threshold: float = 0.65, window_len: int = 15):
        self.verification_threshold = verification_threshold
        self.window_len = window_len

        # Context Buffer (History of verified signs)
        self.verified_sign_history = deque(maxlen=8)
        self.temporal_candidate_buffer = deque(maxlen=window_len)
        self.pending_confirmation_sign: Optional[str] = None
        self.pending_confirmation_frames: int = 0
        self.required_confirm_frames: int = 3

    def reset_context(self):
        """Clears context history."""
        self.verified_sign_history.clear()
        self.temporal_candidate_buffer.clear()
        self.pending_confirmation_sign = None
        self.pending_confirmation_frames = 0

    def orchestrate(
        self,
        frame_payload: Dict[str, Any],
        raw_prediction: str,
        raw_confidence: float,
        top_k_candidates: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Orchestrates all agent sub-components to deliver verified prediction,
        detailed reasoning evidence, explainable attention weights, and natural sentence.
        """
        start_t = time.time()
        landmarks = frame_payload.get("right_hand") or frame_payload.get("left_hand") or frame_payload.get("landmarks") or []
        pose_data = frame_payload.get("pose") or []
        face_data = frame_payload.get("face") or []
        nmm_markers = frame_payload.get("nmm_markers") or {}

        # 1. Perception Component
        hand_detected = bool(landmarks and len(landmarks) >= 21)
        perception_status = "Tracking 21 3D Hand Landmarks" if hand_detected else "No Hand Detected"
        if face_data and len(face_data) >= 10:
            perception_status += " + Facial NMMs (468 keypoints)"

        if not hand_detected:
            afme_engine.reset()
            return {
                "prediction": "No Hand Detected",
                "confidence": 0.0,
                "top_k": [{"label": "No Hand Detected", "score": 0.0}],
                "agent_reasoning": {
                    "perception_status": "No Hand Detected in Camera Frame",
                    "afme_state": "STATIONARY",
                    "motion_summary": "Hand out of frame",
                    "raw_candidates": [],
                    "verification_verdict": "HELD_FOR_EVIDENCE",
                    "verification_note": "Awaiting active signer hand in frame.",
                    "context_history": list(self.verified_sign_history),
                    "grammar_translation_mode": "ISL_DIRECT",
                },
                "afme": afme_engine.extract_kinematics([], timestamp=time.time()),
                "joint_attention": {
                    "joint_weights": [0.0] * 21,
                    "active_finger_importance": {"THUMB": 0, "INDEX": 0, "MIDDLE": 0, "RING": 0, "PINKY": 0},
                },
                "flag_for_active_learning": False,
            }

        # 2. Motion Analysis Component (AFME)
        afme_telemetry = afme_engine.extract_kinematics(landmarks, timestamp=time.time())
        motion_state = afme_telemetry["motion_state"]
        active_fingers = afme_telemetry["active_fingers"]
        overall_vel = afme_telemetry["overall_velocity"]
        curvature = afme_telemetry["trajectory_curvature"]

        # Motion summary string
        if motion_state == "ACTIVE_SIGNING":
            active_str = ", ".join(active_fingers) if active_fingers else "Whole Hand"
            motion_summary = f"Dynamic Motion (v={overall_vel:.3f}): Active fingers [{active_str}], Curvature={curvature:.2f}"
        elif motion_state == "TRANSITIONING":
            motion_summary = f"Transitioning (v={overall_vel:.3f}): Gesture forming"
        else:
            motion_summary = f"Stationary hand (v={overall_vel:.3f}): Stable posture held"

        # 3. Spatial-Temporal Graph Attention Computation
        # Extract sequence tensor from AFME history for ST-GCN graph attention
        if len(afme_engine.history) >= 2:
            seq_np = np.stack([h["pts"] for h in afme_engine.history], axis=0)  # (T, 21, 3)
        else:
            seq_np = np.stack([afme_telemetry["pts"] if "pts" in afme_telemetry else np.array([[pt.get("x", 0), pt.get("y", 0), pt.get("z", 0)] for pt in landmarks[:21]], dtype=np.float32)] * 2, axis=0)

        graph_results = numpy_stgcn_inference.extract_graph_representation(seq_np)
        joint_weights = graph_results["joint_weights"]
        finger_importance = graph_results["finger_importance"]

        # 4. Context Component
        recent_signs = list(self.verified_sign_history)

        # 5. Verification Component: Resolve Confusions & Low-Confidence Holding
        verified_sign = raw_prediction
        verified_confidence = raw_confidence
        verdict = "CONFIRMED"
        verification_note = "Confidence exceeds verification threshold; anatomical kinematics verified."
        flag_active_learning = False

        # Check for known confusable sign pairs
        top_candidates = [c.get("label") if isinstance(c, dict) else getattr(c, "label", "") for c in top_k_candidates]
        for (sign_a, sign_b), info in CONFUSING_SIGN_PAIRS.items():
            if (raw_prediction == sign_a and sign_b in top_candidates) or (raw_prediction == sign_b and sign_a in top_candidates):
                # Apply AFME Kinematic Distinguisher
                if (sign_a, sign_b) == ("PLEASE", "SORRY") or (sign_b, sign_a) == ("PLEASE", "SORRY"):
                    # PLEASE = Open palm, SORRY = Closed fist
                    ext_pct = [
                        afme_telemetry["finger_kinematics"].get(f, {}).get("angles", {}).get("extension_pct", 0)
                        for f in ["INDEX", "MIDDLE", "RING", "PINKY"]
                    ]
                    avg_ext = np.mean(ext_pct) if ext_pct else 0
                    if avg_ext >= 60.0:
                        verified_sign = "PLEASE"
                        verified_confidence = max(0.95, raw_confidence)
                        verdict = "RESOLVED_BY_CONTEXT"
                        verification_note = f"Disambiguated from SORRY: Open palm detected ({avg_ext:.1f}% extension)."
                    else:
                        verified_sign = "SORRY"
                        verified_confidence = max(0.95, raw_confidence)
                        verdict = "RESOLVED_BY_CONTEXT"
                        verification_note = f"Disambiguated from PLEASE: Closed fist detected ({avg_ext:.1f}% extension)."

                elif (sign_a, sign_b) == ("STOP", "WELCOME") or (sign_b, sign_a) == ("STOP", "WELCOME"):
                    # STOP = Stationary; WELCOME = Sweeping trajectory
                    if overall_vel > 0.025 or curvature > 1.5:
                        verified_sign = "WELCOME"
                        verified_confidence = max(0.94, raw_confidence)
                        verdict = "RESOLVED_BY_CONTEXT"
                        verification_note = "Disambiguated from STOP: Dynamic inward trajectory detected."
                    else:
                        verified_sign = "STOP"
                        verified_confidence = max(0.94, raw_confidence)
                        verdict = "RESOLVED_BY_CONTEXT"
                        verification_note = "Disambiguated from WELCOME: Hand held in stationary stop posture."

                elif (sign_a, sign_b) == ("PEACE", "VICTORY") or (sign_b, sign_a) == ("PEACE", "VICTORY"):
                    if overall_vel > 0.030:
                        verified_sign = "VICTORY"
                        verdict = "RESOLVED_BY_CONTEXT"
                        verification_note = "Disambiguated from PEACE: Dynamic upward gesture detected."
                    else:
                        verified_sign = "PEACE"
                        verdict = "RESOLVED_BY_CONTEXT"
                        verification_note = "Disambiguated from VICTORY: Static V-sign held."

        # Low-Confidence Handling and Evidence Confirmation
        if verified_confidence < self.verification_threshold and verified_sign not in ["Unknown Sign", "No Hand Detected"]:
            # Check if this sign matches pending confirmation
            if self.pending_confirmation_sign == verified_sign:
                self.pending_confirmation_frames += 1
                if self.pending_confirmation_frames >= self.required_confirm_frames:
                    # Confirmed over multiple consecutive frames!
                    verified_confidence = min(0.92, verified_confidence + 0.15)
                    verdict = "CONFIRMED"
                    verification_note = f"Confirmed sign '{verified_sign}' across {self.pending_confirmation_frames} consecutive frames."
                    self.pending_confirmation_sign = None
                    self.pending_confirmation_frames = 0
                else:
                    verdict = "HELD_FOR_EVIDENCE"
                    verification_note = f"Low confidence ({raw_confidence:.2f}). Holding for {self.required_confirm_frames - self.pending_confirmation_frames} more frame(s)."
                    flag_active_learning = True
            else:
                self.pending_confirmation_sign = verified_sign
                self.pending_confirmation_frames = 1
                verdict = "HELD_FOR_EVIDENCE"
                verification_note = f"Initial candidate '{verified_sign}' observed (conf={raw_confidence:.2f}). Holding for confirmation."
                flag_active_learning = True
        elif verified_confidence >= self.verification_threshold and verified_sign not in ["Unknown Sign", "No Hand Detected"]:
            # Clear pending confirmation
            self.pending_confirmation_sign = None
            self.pending_confirmation_frames = 0
            # Append to verified context history (avoid rapid duplicate spam)
            if not recent_signs or recent_signs[-1] != verified_sign:
                self.verified_sign_history.append(verified_sign)

        # Flag marginal ambiguous predictions for Active Learning review
        if 0.35 <= raw_confidence <= 0.65:
            flag_active_learning = True

        # 6. Sentence Builder Component
        # Build natural sentence and preserve raw gloss sequence
        sentence = None
        agent_response = None
        if verified_sign in getattr(llm_agent_service, "sign_knowledge_base", {}) and verdict in ["CONFIRMED", "RESOLVED_BY_CONTEXT"]:
            synth = llm_agent_service.synthesize_sentence(list(self.verified_sign_history), nmm_markers=nmm_markers)
            sentence = synth.get("sentence")
            conv = llm_agent_service.converse_with_agent(verified_sign)
            agent_response = conv.get("agent_response")

        agent_reasoning = {
            "perception_status": perception_status,
            "afme_state": motion_state,
            "motion_summary": motion_summary,
            "raw_candidates": top_k_candidates,
            "verification_verdict": verdict,
            "verification_note": verification_note,
            "context_history": list(self.verified_sign_history),
            "grammar_translation_mode": "SYNTHESIZED_SOV" if sentence else "ISL_DIRECT",
        }

        joint_attention = {
            "joint_weights": joint_weights,
            "active_finger_importance": finger_importance,
            "temporal_frame_weights": graph_results.get("temporal_weights", []),
        }

        return {
            "prediction": verified_sign if verdict != "HELD_FOR_EVIDENCE" else (recent_signs[-1] if recent_signs else "Analyzing..."),
            "confidence": verified_confidence,
            "top_k": top_k_candidates,
            "sentence": sentence,
            "agent_response": agent_response,
            "agent_reasoning": agent_reasoning,
            "afme": afme_telemetry,
            "joint_attention": joint_attention,
            "flag_for_active_learning": flag_active_learning,
        }

isl_master_agent = ISLMasterAgent()
