"""
Automated Unit Tests for ISL Gloss Translator
Validates:
- Article and copula verb removal
- SOV & Topic-Comment word order (Time first, Negation/Questions last)
- Direct sign library class mapping
- Fingerspelling decomposition for out-of-vocabulary words
- Strict JSON structure compliance
- Hindi transliterated phrase handling
"""

import os
import sys
import unittest

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.gloss_translator import ISLGlossTranslator


class TestISLGlossTranslator(unittest.TestCase):

    def setUp(self):
        self.translator = ISLGlossTranslator()

    def test_article_and_copula_omission(self):
        """Articles ('a', 'an', 'the') and auxiliary verbs ('is', 'are', 'was') must be omitted."""
        res = self.translator.translate("The teacher is a good friend", prefer_llm=False)
        glosses = res["isl_glosses"]
        
        # None of the stopwords should appear in the gloss sequence
        for stop in ["THE", "IS", "A", "AN", "ARE", "WAS"]:
            self.assertNotIn(stop, glosses)
            
        # Valid keywords must be retained
        self.assertIn("TEACHER", glosses)
        self.assertIn("GOOD", glosses)
        self.assertIn("FRIEND", glosses)

    def test_time_topic_fronting(self):
        """In ISL, time adverbials are topicalized to the beginning of the clause."""
        res = self.translator.translate("I will visit home tomorrow", prefer_llm=False)
        glosses = res["isl_glosses"]
        self.assertTrue(len(glosses) > 0)
        # 'tomorrow' or 'FS_T...' should be at or near index 0
        first_token = res["tokens"][0]
        self.assertTrue("tomorrow" in first_token["source_word"].lower())

    def test_question_and_negation_ending(self):
        """In ISL, question markers and negation move to clause-final position."""
        res_neg = self.translator.translate("Please do not stop", prefer_llm=False)
        glosses_neg = res_neg["isl_glosses"]
        # 'NO' should be at the end
        self.assertEqual(glosses_neg[-1], "NO")

        res_q = self.translator.translate("Where is water?", prefer_llm=False)
        tokens_q = res_q["tokens"]
        # Question token should be at the end
        last_tok = tokens_q[-1]
        self.assertEqual(last_tok["source_word"].lower(), "where")

    def test_sign_library_mapping(self):
        """Synonyms should map cleanly to verified dataset classes."""
        res = self.translator.translate("thanks for the fresh drink and meal", prefer_llm=False)
        glosses = res["isl_glosses"]
        self.assertIn("THANK_YOU", glosses)
        self.assertIn("WATER", glosses)
        self.assertIn("FOOD", glosses)

    def test_fingerspelling_decomposition(self):
        """Out-of-vocabulary words should decompose into manual fingerspelling tokens."""
        res = self.translator.translate("Meet Amit", prefer_llm=False)
        tokens = res["tokens"]
        
        # Check that AMIT is broken down into fingerspelled characters
        fs_tokens = [t["token"] for t in tokens if t["type"] == "fingerspelling" and t["source_word"].lower() == "amit"]
        self.assertEqual(fs_tokens, ["FS_A", "FS_M", "FS_I", "FS_T"])

    def test_strict_output_format(self):
        """Verifies strict schema response keys and token structure."""
        res = self.translator.translate("Hello welcome", prefer_llm=False)
        self.assertIn("input_text", res)
        self.assertIn("detected_language", res)
        self.assertIn("isl_glosses", res)
        self.assertIn("tokens", res)
        self.assertIn("explanation", res)
        self.assertIn("engine_used", res)

        for tok in res["tokens"]:
            self.assertIn("token", tok)
            self.assertIn("type", tok)
            self.assertIn("source_word", tok)
            self.assertIn("duration_ms", tok)
            self.assertIn(tok["type"], ["library_sign", "fingerspelling"])

    def test_hindi_transliterated_support(self):
        """Hindi transliterated speech (e.g. namaste, kripya, paani, dost) maps accurately."""
        res = self.translator.translate("namaste kripya paani", prefer_llm=False)
        glosses = res["isl_glosses"]
        self.assertIn("NAMASTE", glosses)
        self.assertIn("PLEASE", glosses)
        self.assertIn("WATER", glosses)


if __name__ == "__main__":
    unittest.main()
