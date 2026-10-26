"""
Unit Tests for Agentic AI Workflow (Phase 5 & Phase 7)
Validates:
- Perception & Recognition Module
- Context Understanding Agent (Conversation history, disambiguation)
- Translation Agent (Direction A & B)
- Verification Agent (Vocabulary validation, fingerspelling fallback, unsupported expression detection)
- Action Agent (Avatar sequence creation)
- Agentic Orchestrator end-to-end execution
"""

import os
import sys
import unittest

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.agent_workflow import (
    PerceptionRecognitionModule,
    ContextUnderstandingAgent,
    TranslationAgent,
    VerificationAgent,
    ActionAgent,
    AgenticOrchestrator,
)


class TestAgentWorkflow(unittest.TestCase):

    def setUp(self):
        self.orchestrator = AgenticOrchestrator()

    def test_perception_module(self):
        perception = PerceptionRecognitionModule()
        fake_landmarks = [{"x": 0.1, "y": 0.2, "z": 0.0} for _ in range(21)]
        res = perception.inspect_perception(
            landmarks=fake_landmarks,
            prediction="HELLO",
            confidence=0.88,
            nmm_markers={"eyebrow_raised": True, "emotion": "happy"}
        )
        self.assertTrue(res["has_hand"])
        self.assertTrue(res["is_confident"])
        self.assertEqual(res["raw_prediction"], "HELLO")
        self.assertTrue(res["nmm_markers"]["eyebrow_raised"])

    def test_context_understanding_and_reset(self):
        context = ContextUnderstandingAgent()
        context.record_event("speaker", "Hello friend")
        context.record_event("signer", "WELCOME")
        
        hist = context.get_conversation_history()
        self.assertEqual(len(hist), 2)
        self.assertEqual(hist[0]["role"], "speaker")
        self.assertEqual(hist[1]["role"], "signer")
        
        # Test reset
        context.reset_context()
        self.assertEqual(len(context.get_conversation_history()), 0)

    def test_verification_agent(self):
        verification = VerificationAgent()
        tokens = [
            {"token": "HELLO", "type": "library_sign"},
            {"token": "FS_A", "type": "fingerspelling"},
        ]
        res = verification.verify_speech_to_sign(tokens)
        self.assertTrue(res["is_fully_supported"])
        self.assertIn("HELLO", res["library_matches"])
        self.assertIn("FS_A", res["fingerspelled"])
        self.assertEqual(len(res["unsupported"]), 0)

    def test_orchestrator_speech_to_sign(self):
        """Direction B: Speech -> Context -> Translation -> Verification -> Avatar Action"""
        res = self.orchestrator.process_speech_to_sign("Good morning welcome friend", prefer_llm=False)
        self.assertIn("source_text", res)
        self.assertIn("isl_glosses", res)
        self.assertIn("tokens", res)
        self.assertIn("avatar_action", res)
        self.assertEqual(res["avatar_action"]["action"], "PLAY_AVATAR_SEQUENCE")
        self.assertTrue(len(res["avatar_action"]["sequence"]) > 0)

    def test_orchestrator_sign_to_speech(self):
        """Direction A: Camera Landmarks -> Perception -> Context -> Verification -> Spoken Sentence"""
        fake_lms = [{"x": 0.0, "y": 0.0, "z": 0.0} for _ in range(21)]
        res = self.orchestrator.process_sign_to_speech(
            landmarks=fake_lms,
            raw_prediction="THANK_YOU",
            confidence=0.92,
            nmm_markers={"eyebrow_raised": False}
        )
        self.assertEqual(res["recognized_sign"], "THANK_YOU")
        self.assertTrue(res["perception"]["is_confident"])
        self.assertIn("Thank you", res["synthesized_sentence"])


if __name__ == "__main__":
    unittest.main()
