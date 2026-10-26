import os

# Centralized Editable Configuration for ISL Recognition Project

# 23 Verified Indian Sign Language (ISL) Recognition Classes
SIGN_CLASSES = [
    # 1. Core Preserved Signs
    "GOOD",         # Thumbs-up approval gesture
    "WELCOME",      # Open palm inward sweep gesture
    "PEACE",        # V-sign gesture
    
    # 2. General Conversation Signs
    "HELLO",        # Open palm greeting sweep
    "THANK_YOU",    # Chin touch forward gesture
    "YES",          # Fist nod gesture
    "NO",           # Index/Middle tap thumb gesture
    "HELP",         # Fist on open palm gesture
    "STOP",         # Flat open palm raised toward camera
    "PLEASE",       # Circular open palm chest rub gesture
    "SORRY",        # Closed fist rubbing chest
    "LOVE",         # I-Love-You gesture (Thumb, Index, Pinky extended)
    "OK",           # O-circle with Thumb & Index, remaining fingers extended
    
    # 3. 10 Additional Verified ISL Signs
    "FAMILY",       # F-circle hands joined together
    "FRIEND",       # Interlocked Index fingers gesture
    "TEACHER",      # Both hands near temples moving forward
    "STUDENT",      # Flat palm taking knowledge toward head
    "HOME",         # Fingertips forming A-frame roof shape
    "WATER",        # W-hand shape touching chin/lips
    "FOOD",         # Fingertips gathered touching lips/mouth
    "HAPPY",        # Open palms patting chest upwards
    "SAD",          # Open hand wiping down face
    "VICTORY",      # Dual V-signs raised in victory
]

# Recognition & Confidence Thresholds
CONFIDENCE_THRESHOLD = 0.60  
STABILITY_FRAMES = 5  

# Audio & Text-to-Speech Settings
AUDIO_ENABLED = True
TTS_VOLUME = 1.0  # 100% Maximum safe audio volume
TTS_RATE = 0.95   # Clear, natural speech rate
TTS_PITCH = 1.0   # Natural pitch

# Feature Toggles Defaults
TOGGLES = {
    "SHOW_3D_HAND": True,
    "SHOW_LANDMARKS": True,
    "SHOW_CONNECTIONS": True,
    "SHOW_CONFIDENCE": True,
    "SHOW_RECOGNIZED_TEXT": True,
    "AUTOMATIC_VOICE": True,
    "PREDICTION_STABILIZATION": True,
    "SHOW_SIGN_HISTORY": True,
    "DEBUG_MODE": False,
}

# Camera Settings
CAMERA_SETTINGS = {
    "width": 1280,
    "height": 720,
    "ideal_fps": 30,
}

# File & Directory Paths
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
DATASET_PATH = os.path.join(PROJECT_ROOT, "dataset")
MODEL_PATH = os.path.join(PROJECT_ROOT, "ml", "checkpoints", "isl_classifier.pkl")
METRICS_PATH = os.path.join(PROJECT_ROOT, "ml", "checkpoints", "evaluation_metrics.json")
