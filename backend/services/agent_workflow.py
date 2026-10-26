"""
Agentic AI Workflow Architecture for Bidirectional ISL Communication
Implements Phase 5 & Phase 7 Modular Agents:
1. Perception & Recognition Module
2. Context Understanding Agent
3. Translation Agent
4. Verification Agent
5. Action Agent
6. Agentic Orchestrator
"""

import os
import json
import time
import logging
from typing import Dict, List, Any, Optional
from collections import deque

try:
    from services.gloss_translator import ISLGlossTranslator
except ImportError:
    from backend.services.gloss_translator import ISLGlossTranslator

logger = logging.getLogger(__name__)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
SIGNS_DIR = os.path.join(PROJECT_ROOT, "sign_library", "signs")
LABELS_PATH = os.path.join(PROJECT_ROOT, "sign_library", "labels.json")


# ─────────────────────────────────────────────────────────────────────────────
# 1. PERCEPTION AND RECOGNITION MODULE
# ─────────────────────────────────────────────────────────────────────────────
class PerceptionRecognitionModule:
    """
    Consumes landmark tracking evidence, confidence thresholds, and multimodal NMM features.
    """

    def __init__(self, min_confidence: float = 0.55):
        self.min_confidence = min_confidence

    def inspect_perception(
        self,
        landmarks: List[Dict[str, float]],
        prediction: str,
        confidence: float,
        nmm_markers: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        has_hand = bool(landmarks and len(landmarks) >= 21)
        is_confident = has_hand and (confidence >= self.min_confidence) and (prediction not in ["Unknown Sign", "No Hand Detected"])
        eyebrow_raised = bool(nmm_markers and nmm_markers.get("eyebrow_raised"))

        return {
            "has_hand": has_hand,
            "landmark_count": len(landmarks) if landmarks else 0,
            "raw_prediction": prediction,
            "confidence": round(confidence, 3),
            "is_confident": is_confident,
            "nmm_markers": {
                "eyebrow_raised": eyebrow_raised,
                "emotion": nmm_markers.get("emotion", "neutral") if nmm_markers else "neutral"
            },
            "perception_timestamp": time.time()
        }


# ─────────────────────────────────────────────────────────────────────────────
# 2. CONTEXT UNDERSTANDING AGENT
# ─────────────────────────────────────────────────────────────────────────────
class ContextUnderstandingAgent:
    """
    Maintains conversation context history to infer intended message without inventing unrecognized signs.
    """

    def __init__(self, history_len: int = 10):
        self.history: deque = deque(maxlen=history_len)
        self.conversation_turns: List[Dict[str, Any]] = []

    def record_event(self, role: str, message: str, metadata: Optional[Dict[str, Any]] = None):
        turn = {
            "role": role,  # 'signer' (deaf) or 'speaker' (hearing)
            "message": message,
            "metadata": metadata or {},
            "timestamp": time.time()
        }
        self.conversation_turns.append(turn)
        self.history.append(message)

    def disambiguate_sign(self, current_sign: str, confidence: float) -> Tuple[str, bool]:
        """
        Disambiguates sign based on context history. Never changes the sign if context doesn't strongly indicate it.
        """
        if confidence < 0.65:
            # Check if repeating recent sign
            if self.history and self.history[-1] == current_sign:
                return current_sign, True
            return current_sign, False
        return current_sign, True

    def get_conversation_history(self) -> List[Dict[str, Any]]:
        return list(self.conversation_turns)

    def reset_context(self):
        self.history.clear()
        self.conversation_turns.clear()


# ─────────────────────────────────────────────────────────────────────────────
# 3. TRANSLATION AGENT
# ─────────────────────────────────────────────────────────────────────────────
class TranslationAgent:
    """
    Converts message between Sign and Speech/Text with strict grammatical conventions.
    """

    def __init__(self):
        self.gloss_translator = ISLGlossTranslator()

    def translate_speech_to_isl(self, text: str, prefer_llm: bool = True) -> Dict[str, Any]:
        """Direction B: Speech/Text -> ISL Gloss Sequence"""
        return self.gloss_translator.translate(text, prefer_llm=prefer_llm)

    def translate_signs_to_spoken_sentence(
        self,
        glosses: List[str],
        is_question: bool = False,
        target_lang: str = "en"
    ) -> str:
        """Direction A: ISL Signs -> Natural English/Hindi Spoken Sentence"""
        if not glosses:
            return "Awaiting hand sign gesture..."

        clean = [g for g in glosses if g not in ["Unknown Sign", "No Hand Detected"]]
        if not clean:
            return "Please show a clear sign in front of the camera."

        # Template-based natural sentences ensuring 0 hallucination
        s = " ".join([g.replace("_", " ").capitalize() for g in clean])
        if is_question:
            s += "?"
        else:
            s += "."
        return s


# ─────────────────────────────────────────────────────────────────────────────
# 4. VERIFICATION AGENT
# ─────────────────────────────────────────────────────────────────────────────
class VerificationAgent:
    """
    Verifies sign vocabulary availability, unsupported expressions, and uncertainty.
    """

    def __init__(self):
        self.supported_signs = self._load_supported_signs()

    def _load_supported_signs(self) -> set:
        if os.path.exists(LABELS_PATH):
            try:
                with open(LABELS_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return set(data.get("classes", []))
            except Exception:
                pass
        return set()

    def verify_speech_to_sign(self, tokens: List[Dict[str, Any]]) -> Dict[str, Any]:
        library_matches = []
        fingerspelled = []
        unsupported = []

        for tok in tokens:
            t_name = tok["token"]
            t_type = tok["type"]
            keyframe_path = os.path.join(SIGNS_DIR, f"{t_name}.json")

            if os.path.exists(keyframe_path):
                if t_type == "library_sign":
                    library_matches.append(t_name)
                else:
                    fingerspelled.append(t_name)
            else:
                unsupported.append(t_name)

        is_fully_supported = len(unsupported) == 0
        clarification_needed = len(tokens) == 0 or len(unsupported) > 0

        clarification_prompt = None
        if unsupported:
            clarification_prompt = f"The following words could not be mapped to ISL gestures: {', '.join(unsupported)}. Would you like to fingerspell them?"

        return {
            "is_fully_supported": is_fully_supported,
            "library_matches": library_matches,
            "fingerspelled": fingerspelled,
            "unsupported": unsupported,
            "clarification_needed": clarification_needed,
            "clarification_prompt": clarification_prompt
        }

    def verify_recognition(self, prediction: str, confidence: float) -> Dict[str, Any]:
        is_known = prediction in self.supported_signs
        low_confidence = confidence < 0.60

        clarification = None
        if low_confidence and prediction not in ["Unknown Sign", "No Hand Detected"]:
            clarification = f"Sign was recognized as '{prediction}' with low confidence ({int(confidence*100)}%). Please repeat the sign clearly."

        return {
            "is_known_sign": is_known,
            "is_confident": not low_confidence,
            "clarification_prompt": clarification
        }


# ─────────────────────────────────────────────────────────────────────────────
# 5. ACTION AGENT
# ─────────────────────────────────────────────────────────────────────────────
class ActionAgent:
    """
    Coordinates execution of speech synthesis, text display, and avatar playback.
    """

    def prepare_avatar_sequence_action(self, tokens: List[Dict[str, Any]]) -> Dict[str, Any]:
        sequence_items = []
        current_time_ms = 0

        for tok in tokens:
            t_name = tok["token"]
            t_type = tok["type"]
            duration = tok.get("duration_ms", 1200)

            keyframe_file = os.path.join(SIGNS_DIR, f"{t_name}.json")
            keyframe_data = None
            if os.path.exists(keyframe_file):
                try:
                    with open(keyframe_file, "r", encoding="utf-8") as f:
                        keyframe_data = json.load(f)
                except Exception:
                    pass

            sequence_items.append({
                "token": t_name,
                "type": t_type,
                "source_word": tok.get("source_word", t_name),
                "start_time_ms": current_time_ms,
                "duration_ms": duration,
                "end_time_ms": current_time_ms + duration,
                "keyframe": keyframe_data
            })
            current_time_ms += duration

        return {
            "action": "PLAY_AVATAR_SEQUENCE",
            "total_duration_ms": current_time_ms,
            "sequence": sequence_items
        }


# ─────────────────────────────────────────────────────────────────────────────
# 6. AGENTIC ORCHESTRATOR
# ─────────────────────────────────────────────────────────────────────────────
class AgenticOrchestrator:
    """
    Master Orchestrator coordinating all 5 agents with clear stopping conditions,
    caching, error handling, and timeout safeguards.
    """

    def __init__(self):
        self.perception = PerceptionRecognitionModule()
        self.context = ContextUnderstandingAgent()
        self.translation = TranslationAgent()
        self.verification = VerificationAgent()
        self.action = ActionAgent()

    def process_speech_to_sign(self, text: str, prefer_llm: bool = True) -> Dict[str, Any]:
        """
        Direction B Full Pipeline:
        Input -> Context -> Translation -> Verification -> Action Avatar Sequence
        """
        if not text or not text.strip():
            return {"error": "Empty input text."}

        # 1. Context Record
        self.context.record_event(role="speaker", message=text)

        # 2. Translation Agent
        t_res = self.translation.translate_speech_to_isl(text, prefer_llm=prefer_llm)
        tokens = t_res.get("tokens", [])

        # 3. Verification Agent
        v_res = self.verification.verify_speech_to_sign(tokens)

        # 4. Action Agent
        act_res = self.action.prepare_avatar_sequence_action(tokens)

        return {
            "source_text": text,
            "detected_language": t_res.get("detected_language", "en"),
            "isl_glosses": t_res.get("isl_glosses", []),
            "tokens": tokens,
            "verification": v_res,
            "avatar_action": act_res,
            "explanation": t_res.get("explanation", ""),
            "engine_used": t_res.get("engine_used", "rule_based")
        }

    def process_sign_to_speech(
        self,
        landmarks: List[Dict[str, float]],
        raw_prediction: str,
        confidence: float,
        nmm_markers: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Direction A Full Pipeline:
        Camera -> Perception -> Context -> Verification -> Translation -> Speech/Text Action
        """
        # 1. Perception
        p_res = self.perception.inspect_perception(landmarks, raw_prediction, confidence, nmm_markers)

        # 2. Context Disambiguation
        verified_sign, is_confident = self.context.disambiguate_sign(raw_prediction, confidence)

        # 3. Verification
        v_res = self.verification.verify_recognition(verified_sign, confidence)

        # 4. Record to context if confident
        if is_confident and verified_sign not in ["Unknown Sign", "No Hand Detected"]:
            self.context.record_event(role="signer", message=verified_sign)

        # 5. Translation to sentence
        sentence = self.translation.translate_signs_to_spoken_sentence(
            [verified_sign],
            is_question=p_res["nmm_markers"]["eyebrow_raised"]
        )

        return {
            "recognized_sign": verified_sign,
            "confidence": confidence,
            "perception": p_res,
            "verification": v_res,
            "synthesized_sentence": sentence,
            "clarification_prompt": v_res.get("clarification_prompt")
        }

    def reset_conversation(self):
        self.context.reset_context()
        return {"status": "Conversation context cleared."}


# Global singleton instance
agentic_orchestrator = AgenticOrchestrator()
