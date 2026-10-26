import os
import json
import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter()

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
LIBRARY_DIR = os.path.join(PROJECT_ROOT, "sign_library")
INDEX_PATH = os.path.join(LIBRARY_DIR, "index.json")
SIGNS_DIR = os.path.join(LIBRARY_DIR, "signs")

@router.get("/signs")
async def get_library_signs():
    """Returns the catalog of all available 3D sign keyframes in the sign library."""
    if not os.path.exists(INDEX_PATH):
        raise HTTPException(status_code=404, detail="Sign library index not found. Run builder.py to generate.")

    try:
        with open(INDEX_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except Exception as e:
        logger.error(f"Error reading sign library index: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sign/{sign_name}")
async def get_sign_keyframe(sign_name: str):
    """Returns the normalized 3D keyframe landmarks for a specific sign."""
    clean_name = sign_name.strip().upper().replace(" ", "_")
    sign_file = os.path.join(SIGNS_DIR, f"{clean_name}.json")

    if not os.path.exists(sign_file):
        raise HTTPException(status_code=404, detail=f"Sign '{clean_name}' not found in library.")

    try:
        with open(sign_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except Exception as e:
        logger.error(f"Error reading sign file {sign_file}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
