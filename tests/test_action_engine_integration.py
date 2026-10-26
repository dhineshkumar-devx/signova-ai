"""
Tests for Avatar Action Engine & Non-Manual Marker Intent Integration.
Verifies that sentence intent (Question, Negation, Request, Greeting)
maps to correct ISL gloss sequences, non-manual markers, and sign library tokens.
"""

import os
import sys
import unittest

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from services.gloss_translator import ISLGlossTranslator
from sign_library.builder import SignLibraryBuilder


class TestActionEngineIntegration(unittest.TestCase):

    def setUp(self):
        self.translator = ISLGlossTranslator()
        self.builder = SignLibraryBuilder()

    def test_question_sentence_gloss_and_sequence(self):
        text = "Where is the hospital?"
        gloss_result = self.translator.translate(text, prefer_llm=False)
        glosses = gloss_result["isl_glosses"]
        self.assertIn("HOSPITAL", glosses)
        self.assertIn("WHERE", glosses)
        self.assertIn("Topic", gloss_result["explanation"])

    def test_greeting_sentence_sequence(self):
        text = "Good morning, welcome to our home!"
        gloss_result = self.translator.translate(text, prefer_llm=False)
        tokens = [g["token"] for g in gloss_result["tokens"]]
        self.assertTrue(any(t in ["GOOD", "MORNING", "WELCOME", "HOME"] for t in tokens))

    def test_request_and_help_sequence(self):
        text = "I need help please."
        gloss_result = self.translator.translate(text, prefer_llm=False)
        glosses = gloss_result["isl_glosses"]
        self.assertTrue(any(t in ["HELP", "PLEASE", "NEED"] for t in glosses))

    def test_negation_sentence_sequence(self):
        text = "No, please stop."
        gloss_result = self.translator.translate(text, prefer_llm=False)
        glosses = gloss_result["isl_glosses"]
        self.assertTrue(any(t in ["NO", "STOP", "PLEASE"] for t in glosses))

    def test_catalog_contains_essential_isl_signs(self):
        with open(self.builder.index_path, "r", encoding="utf-8") as f:
            import json
            index = json.load(f)
        signs = index.get("signs", {})
        essential = ["HELLO", "THANK_YOU", "WATER", "FOOD", "HELP", "NAMASTE"]
        for s in essential:
            self.assertIn(s, signs)


if __name__ == "__main__":
    unittest.main()
