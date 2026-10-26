"""
Speech & ISL Gloss Translation API Endpoints
Endpoints for:
- POST /api/v1/speech/transcribe
- POST /api/v1/speech/translate-to-gloss
- POST /api/v1/speech/get-sign-sequence
- WebSocket /api/v1/speech/transcribe-ws
"""

import os
import json
import logging
import base64
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from pydantic import BaseModel

try:
    from services.stt_service import SpeechToTextService
    from services.gloss_translator import ISLGlossTranslator
except ImportError:
    from backend.services.stt_service import SpeechToTextService
    from backend.services.gloss_translator import ISLGlossTranslator


logger = logging.getLogger(__name__)

router = APIRouter()

stt_service = SpeechToTextService()
gloss_translator = ISLGlossTranslator()

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
SIGNS_DIR = os.path.join(PROJECT_ROOT, "sign_library", "signs")


# Request Schemas
class TranscribeTextRequest(BaseModel):
    text: str
    language: Optional[str] = "en"


class TranscribeAudioRequest(BaseModel):
    audio_base64: str
    language: Optional[str] = "en"
    sample_rate: Optional[int] = 16000


class TranslateToGlossRequest(BaseModel):
    text: str
    prefer_llm: Optional[bool] = True


class GetSignSequenceRequest(BaseModel):
    text: Optional[str] = None
    glosses: Optional[List[str]] = None


@router.post("/transcribe")
async def transcribe_speech(request: TranscribeTextRequest):
    """
    Processes speech transcript with language normalization, VAD confirmation,
    privacy protection (in-memory only), and latency measurement.
    """
    if not request.text:
        raise HTTPException(status_code=400, detail="Text field cannot be empty.")
    result = stt_service.process_transcript_event(request.text, request.language or "en")
    return result


@router.post("/transcribe-audio")
async def transcribe_audio_base64(request: TranscribeAudioRequest):
    """
    Transcribes audio bytes in-memory using VAD. Audio is never stored to disk.
    """
    try:
        audio_bytes = base64.b64decode(request.audio_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 audio payload: {e}")

    result = stt_service.transcribe_audio_bytes(
        audio_bytes,
        language=request.language or "en",
        sample_rate=request.sample_rate or 16000
    )
    return result


@router.post("/translate-to-gloss")
async def translate_speech_to_gloss(request: TranslateToGlossRequest):
    """
    Converts transcript into ISL gloss tokens using SOV grammar rules and sign library matching.
    Words not in the sign library fall back to fingerspelling.
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    result = gloss_translator.translate(request.text, prefer_llm=request.prefer_llm)
    return result


@router.post("/get-sign-sequence")
async def get_sign_sequence(request: GetSignSequenceRequest):
    """
    Resolves gloss sequence into full 3D keyframes from sign_library/signs/
    along with timing offsets for avatar animation playback.
    """
    tokens = []
    text_input = request.text or ""

    if request.text:
        translation = gloss_translator.translate(request.text)
        tokens = translation.get("tokens", [])
    elif request.glosses:
        # Build tokens from provided gloss list
        for g in request.glosses:
            clean = g.strip().upper().replace(" ", "_")
            if clean.startswith("FS_"):
                tokens.append({
                    "token": clean,
                    "type": "fingerspelling",
                    "source_word": clean.replace("FS_", ""),
                    "duration_ms": 600
                })
            else:
                tokens.append({
                    "token": clean,
                    "type": "library_sign",
                    "source_word": clean.lower(),
                    "duration_ms": 1200
                })

    if not tokens:
        raise HTTPException(status_code=400, detail="Must provide either 'text' or 'glosses'.")

    # Load keyframe landmark poses for each token
    sequence_items = []
    current_time_offset_ms = 0

    for token_obj in tokens:
        tok_name = token_obj["token"]
        tok_type = token_obj["type"]
        duration = token_obj.get("duration_ms", 1200)

        keyframe_data = None
        sign_file = os.path.join(SIGNS_DIR, f"{tok_name}.json")
        if os.path.exists(sign_file):
            try:
                with open(sign_file, "r", encoding="utf-8") as f:
                    keyframe_data = json.load(f)
            except Exception as e:
                logger.warning(f"Could not load keyframe file for {tok_name}: {e}")


        sequence_items.append({
            "token": tok_name,
            "type": tok_type,
            "source_word": token_obj.get("source_word", tok_name),
            "start_time_ms": current_time_offset_ms,
            "duration_ms": duration,
            "end_time_ms": current_time_offset_ms + duration,
            "keyframe": keyframe_data,
        })
        current_time_offset_ms += duration

    return {
        "input_text": text_input,
        "total_signs": len(sequence_items),
        "total_duration_ms": current_time_offset_ms,
        "sequence": sequence_items
    }


@router.websocket("/transcribe-ws")
async def websocket_transcribe(websocket: WebSocket):
    """
    Real-time streaming WebSocket endpoint for continuous speech-to-gloss translation.
    Clients stream text or audio chunks, and receive live gloss token updates.
    """
    await websocket.accept()
    logger.info("Speech WebSocket client connected.")

    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                text = payload.get("text", "")
                language = payload.get("language", "en")

                if text:
                    # Translate to gloss in real time
                    gloss_res = gloss_translator.translate(text)
                    await websocket.send_json({
                        "event": "gloss_update",
                        "transcript": text,
                        "language": language,
                        "isl_glosses": gloss_res["isl_glosses"],
                        "tokens": gloss_res["tokens"],
                        "explanation": gloss_res["explanation"]
                    })
                else:
                    await websocket.send_json({"event": "ping", "status": "listening"})
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON format."})
    except WebSocketDisconnect:
        logger.info("Speech WebSocket client disconnected.")
    except Exception as e:
        logger.error(f"Speech WebSocket error: {e}")
        try:
            await websocket.close()
        except Exception:
            pass
