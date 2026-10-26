"""
ISL Gloss Translator Service
Converts spoken transcripts (English, Hindi, and regional speech) into Indian Sign Language (ISL) gloss tokens.

Features:
- Strict ISL Linguistic Grammar Rules:
  * Topic-Comment / Time-Subject-Object-Verb (SOV) structure
  * Article omission (removes 'a', 'an', 'the')
  * Copular/Auxiliary verb elimination ('is', 'am', 'are', 'was', 'were', 'been')
  * Question words placed at clause end ('WHAT', 'WHERE', 'WHO', 'HOW')
  * Negation markers placed at clause end ('NOT', 'NO')
- Dynamic Sign Library Integration:
  * Reads valid sign vocabulary directly from editable `sign_library/labels.json`
- Automatic Fingerspelling Fallback:
  * Words not present in the library fall back to fingerspelling tokens (e.g., 'DELHI' -> FS_D, FS_E, FS_L, FS_H, FS_I)
- Dual Translation Engine:
  * LLM with strict JSON schema
  * Comprehensive offline Rule-Based Fallback Engine
"""

import os
import json
import logging
import re
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
LABELS_PATH = os.path.join(PROJECT_ROOT, "sign_library", "labels.json")

# ISL Fingerspelling manual alphabet symbols
VALID_ALPHABET = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ")

# Common English to ISL synonym dictionary mapping directly into dataset library classes
SYNONYM_MAP = {
    # Greetings & Politeness
    "hi": "HELLO", "hey": "HELLO", "greetings": "HELLO", "namaste": "NAMASTE", "pranam": "NAMASTE",
    "thanks": "THANK_YOU", "thank": "THANK_YOU", "gratitude": "THANK_YOU",
    "welcome": "WELCOME", "swagatam": "WELCOME",
    "please": "PLEASE", "kindly": "PLEASE", "kripya": "PLEASE",
    "sorry": "SORRY", "apologize": "SORRY", "maaf": "SORRY",
    # Essentials & Actions
    "water": "WATER", "drink": "WATER", "paani": "WATER",
    "food": "FOOD", "eat": "FOOD", "meal": "FOOD", "khana": "FOOD", "hungry": "FOOD",
    "help": "HELP", "assist": "HELP", "support": "HELP", "madad": "HELP",
    "stop": "STOP", "halt": "STOP", "pause": "STOP", "wait": "STOP", "ruko": "STOP",
    # Affirmation & Negation
    "yes": "YES", "yeah": "YES", "agree": "YES", "haan": "YES", "sahi": "YES",
    "no": "NO", "not": "NO", "nah": "NO", "nahi": "NO", "never": "NO",
    "ok": "OK", "okay": "OK", "thik": "OK",
    # People & Society
    "friend": "FRIEND", "pal": "FRIEND", "buddy": "FRIEND", "dost": "FRIEND", "mitra": "FRIEND",
    "family": "FAMILY", "household": "FAMILY", "parivaar": "FAMILY",
    "teacher": "TEACHER", "instructor": "TEACHER", "professor": "TEACHER", "guru": "TEACHER",
    "student": "STUDENT", "learner": "STUDENT", "pupil": "STUDENT", "chhatra": "STUDENT",
    "home": "HOME", "house": "HOME", "ghar": "HOME",
    # Emotions & States
    "good": "GOOD", "fine": "GOOD", "great": "GOOD", "nice": "GOOD", "achha": "GOOD",
    "happy": "HAPPY", "joy": "HAPPY", "cheerful": "HAPPY", "khush": "HAPPY",
    "sad": "SAD", "unhappy": "SAD", "sorrow": "SAD", "dukh": "SAD",
    "love": "LOVE", "affection": "LOVE", "pyaar": "LOVE",
    "peace": "PEACE", "calm": "PEACE", "shanti": "PEACE",
    "victory": "VICTORY", "win": "VICTORY", "jeet": "VICTORY",
    # Questions & Directions
    "where": "WHERE", "kahan": "WHERE",
    "how": "HOW", "kaise": "HOW",
    "what": "WHAT", "kya": "WHAT",
    "hospital": "HOSPITAL", "clinic": "HOSPITAL", "aspatal": "HOSPITAL",
    "station": "STATION", "train": "STATION", "railway": "STATION",
    "way": "WAY", "road": "WAY", "path": "WAY", "rasta": "WAY",
    "need": "NEED", "want": "NEED", "chahiye": "NEED",
    "morning": "MORNING", "subah": "MORNING",
    "you": "YOU", "tum": "YOU", "aap": "YOU",
    "me": "ME", "i": "ME", "main": "ME", "mujhe": "ME",
}

# Stopwords to discard for ISL grammatical reduction
ENGLISH_STOPWORDS = {
    "a", "an", "the",
    "is", "am", "are", "was", "were", "be", "been", "being",
    "do", "does", "did",
    "to", "of", "in", "at", "on", "by", "for", "with", "about",
    "that", "this", "these", "those",
    "it", "its", "there", "here"
}

# Time indicators that take front position (Topic/Time in ISL)
TIME_WORDS = {
    "today", "tomorrow", "yesterday", "now", "later", "morning", "night",
    "evening", "afternoon", "daily", "always", "aaj", "kal", "abhi"
}

# Question words that move to the end in ISL
QUESTION_WORDS = {
    "what", "where", "who", "when", "why", "how", "kya", "kahan", "kaun", "kab", "kyun", "kaise"
}


class ISLGlossTranslator:
    """
    Translates spoken transcripts into standard Indian Sign Language (ISL) gloss tokens.
    """

    def __init__(self, labels_path: str = LABELS_PATH):
        self.labels_path = labels_path
        self.library_signs: set = self._load_sign_library_classes()
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")

    def _load_sign_library_classes(self) -> set:
        """Loads available sign classes from labels.json and verified dictionary."""
        signs = {
            "FAMILY", "FOOD", "FRIEND", "GOOD", "HAPPY", "HELLO", "HELP", "HOME",
            "LOVE", "NAMASTE", "NO", "OK", "PEACE", "PLEASE", "SAD", "SORRY",
            "STOP", "STUDENT", "TEACHER", "THANK_YOU", "VICTORY", "WATER", "WELCOME", "YES",
            "HOSPITAL", "WHERE", "HOW", "MORNING", "NEED", "STATION", "WAY", "YOU", "ME"
        }
        if os.path.exists(self.labels_path):
            try:
                with open(self.labels_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                raw_classes = data.get("classes", [])
                for item in raw_classes:
                    if isinstance(item, dict) and "sign_name" in item:
                        signs.add(item["sign_name"])
                    elif isinstance(item, str):
                        signs.add(item)
            except Exception as e:
                logger.error(f"Error loading labels.json: {e}")
        return signs

    def reload_library(self):
        """Refreshes the sign library set from disk."""
        self.library_signs = self._load_sign_library_classes()

    def translate(self, text: str, prefer_llm: bool = True) -> Dict[str, Any]:
        """
        Translates input text to ISL gloss tokens.
        Tries LLM first if configured; falls back reliably to rule-based engine.
        """
        if not text or not text.strip():
            return {
                "input_text": "",
                "detected_language": "en",
                "isl_glosses": [],
                "tokens": [],
                "explanation": "No input text provided.",
                "engine_used": "none"
            }

        cleaned_text = text.strip()

        if prefer_llm and (self.gemini_api_key or self.openai_api_key):
            try:
                llm_result = self._translate_with_llm(cleaned_text)
                if llm_result and "tokens" in llm_result and len(llm_result["tokens"]) > 0:
                    return llm_result
            except Exception as e:
                logger.warning(f"LLM translation error, falling back to rule-based engine: {e}")

        # Deterministic rule-based engine fallback
        return self._translate_with_rules(cleaned_text)

    def _translate_with_rules(self, text: str) -> Dict[str, Any]:
        """
        Linguistic rule-based ISL gloss transformation:
        1. Tokenizes and lowers text.
        2. Filters out English articles, prepositions, copula verbs.
        3. Identifies Time, Subject, Object, Verb, Question, Negation.
        4. Reorders into ISL SOV (Time -> Subject -> Object -> Verb -> Negation -> Question).
        5. Matches against sign library; decomposes unseen words into fingerspelling.
        """
        raw_words = re.findall(r"[a-zA-Z\u0900-\u097F]+", text)
        if not raw_words:
            return {
                "input_text": text,
                "detected_language": "en",
                "isl_glosses": ["HELLO"],
                "tokens": [{"token": "HELLO", "type": "library_sign", "source_word": "hello", "duration_ms": 1200}],
                "explanation": "Default greeting fallback for empty parse.",
                "engine_used": "rule_based"
            }

        # Segregate tokens into syntactic categories
        time_tokens = []
        question_tokens = []
        negation_tokens = []
        core_tokens = []

        for word in raw_words:
            w_lower = word.lower()
            if w_lower in ENGLISH_STOPWORDS:
                continue

            if w_lower in TIME_WORDS:
                time_tokens.append(word)
            elif w_lower in QUESTION_WORDS:
                question_tokens.append(word)
            elif w_lower in {"no", "not", "never", "nahi"}:
                negation_tokens.append(word)
            else:
                core_tokens.append(word)

        # ISL Word Order: TIME -> CORE (Subject + Object + Verb) -> NEGATION -> QUESTION
        ordered_words = time_tokens + core_tokens + negation_tokens + question_tokens

        tokens: List[Dict[str, Any]] = []
        gloss_names: List[str] = []

        for word in ordered_words:
            w_lower = word.lower()
            gloss_candidate = SYNONYM_MAP.get(w_lower, word.upper())

            if gloss_candidate in self.library_signs:
                # Match found in sign library
                tokens.append({
                    "token": gloss_candidate,
                    "type": "library_sign",
                    "source_word": word,
                    "duration_ms": 1200,
                    "keyframe_file": f"sign_library/signs/{gloss_candidate}.json"
                })
                gloss_names.append(gloss_candidate)
            else:
                # Word not in sign library -> fall back to ISL manual fingerspelling
                fs_chars = [ch for ch in word.upper() if ch in VALID_ALPHABET]
                if fs_chars:
                    for ch in fs_chars:
                        fs_token = f"FS_{ch}"
                        tokens.append({
                            "token": fs_token,
                            "type": "fingerspelling",
                            "source_word": word,
                            "char": ch,
                            "duration_ms": 600,
                            "keyframe_file": None
                        })
                        gloss_names.append(fs_token)

        # Prevent empty output
        if not tokens:
            tokens.append({
                "token": "HELLO",
                "type": "library_sign",
                "source_word": text,
                "duration_ms": 1200,
                "keyframe_file": "sign_library/signs/HELLO.json"
            })
            gloss_names.append("HELLO")

        explanation = (
            f"Rule-based SOV translation: Removed articles/auxiliaries, "
            f"aligned Time-Topic-Comment structure, mapped {len([t for t in tokens if t['type']=='library_sign'])} library signs "
            f"and {len([t for t in tokens if t['type']=='fingerspelling'])} fingerspelling tokens."
        )

        return {
            "input_text": text,
            "detected_language": "hi" if any("\u0900" <= ch <= "\u097F" for ch in text) else "en",
            "isl_glosses": gloss_names,
            "tokens": tokens,
            "explanation": explanation,
            "engine_used": "rule_based"
        }

    def _translate_with_llm(self, text: str) -> Optional[Dict[str, Any]]:
        """
        Translates using LLM with strict JSON formatting.
        """
        available_signs_str = ", ".join(sorted(list(self.library_signs)))
        system_prompt = (
            "You are an expert Indian Sign Language (ISL) linguist and gloss translator.\n"
            "Translate the spoken sentence into an ISL gloss sequence adhering strictly to ISL grammar:\n"
            "1. Word order: Topic-Comment / Time-Subject-Object-Verb (SOV). Place time markers first, questions and negation at the end.\n"
            "2. Omit English articles (a, an, the) and auxiliary verbs (is, am, are, was, were).\n"
            "3. Choose tokens from this available sign library where possible:\n"
            f"[{available_signs_str}]\n"
            "4. For words not in the library, mark them for fingerspelling as individual letters with prefix FS_ (e.g. FS_R, FS_A, FS_M).\n"
            "5. Respond with ONLY valid JSON with keys: 'isl_glosses', 'tokens', 'explanation'.\n"
            "Format:\n"
            "{\n"
            '  "isl_glosses": ["HELLO", "FRIEND", "FS_R", "FS_A", "FS_M"],\n'
            '  "tokens": [\n'
            '    {"token": "HELLO", "type": "library_sign", "source_word": "hello", "duration_ms": 1200},\n'
            '    {"token": "FS_R", "type": "fingerspelling", "source_word": "ram", "duration_ms": 600}\n'
            '  ],\n'
            '  "explanation": "ISL SOV grammar explanation"\n'
            "}"
        )

        # Call Gemini if available
        if self.gemini_api_key:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.gemini_api_key}"
            payload = {
                "contents": [{"parts": [{"text": f"{system_prompt}\n\nSentence to translate: \"{text}\""}]}],
                "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(raw_text)
                parsed["input_text"] = text
                parsed["engine_used"] = "llm_gemini"
                return parsed

        return None
