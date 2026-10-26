import io
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import edge_tts
from services.llm_agent_service import llm_agent_service

logger = logging.getLogger(__name__)
router = APIRouter()

class NeuralTTSRequest(BaseModel):
    text: str = Field(..., description="Text to speak in native Indian script or transliteration")
    lang: str = Field(default="hi", description="Language code: hi | ta | te | kn | bn | en")
    gender: Optional[str] = Field(default="female", description="female | male")
    rate: Optional[float] = Field(default=1.0, description="Speed rate multiplier (e.g. 0.95 or 1.0)")
    pitch: Optional[float] = Field(default=1.0, description="Pitch multiplier (e.g. 1.0)")

NEURAL_VOICE_MAP = {
    'hi': {
        'female': 'hi-IN-SwaraNeural',
        'male': 'hi-IN-MadhurNeural',
    },
    'ta': {
        'female': 'ta-IN-PallaviNeural',
        'male': 'ta-IN-ValluvarNeural',
    },
    'te': {
        'female': 'te-IN-ShrutiNeural',
        'male': 'te-IN-MohanNeural',
    },
    'kn': {
        'female': 'kn-IN-SapnaNeural',
        'male': 'kn-IN-GaganNeural',
    },
    'bn': {
        'female': 'bn-IN-TanishaaNeural',
        'male': 'bn-IN-BashkarNeural',
    },
    'en': {
        'female': 'en-IN-NeerjaNeural',
        'male': 'en-IN-PrabhatNeural',
    },
}

class SynthesizeSentenceRequest(BaseModel):
    glosses: List[str] = Field(default_factory=list, description="List of recognized sign glosses in sequence")
    tone: Optional[str] = Field(default="polite", description="Tone: polite | casual | formal | emergency")
    context: Optional[str] = Field(default="general", description="Context domain: general | medical | social")
    nmm_markers: Optional[Dict[str, Any]] = Field(default=None, description="Non-Manual Markers (eyebrow, mouth, emotion)")

class ConverseRequest(BaseModel):
    signed_message: str = Field(..., description="The sign or sentence signed by the user")
    history: Optional[List[Dict[str, str]]] = Field(default_factory=list, description="Previous conversation history")
    tone: Optional[str] = Field(default="polite", description="Tone preference")

class EnglishToISLRequest(BaseModel):
    english_text: str = Field(..., description="Spoken or written English sentence from hearing user")

class DomainProcessRequest(BaseModel):
    domain: str = Field(default="GENERAL", description="Domain: GENERAL | MEDICAL | BANKING | EDUCATION | EMERGENCY")
    sign_or_text: str = Field(..., description="Recognized sign or prompt")
    history: Optional[List[Dict[str, str]]] = Field(default_factory=list)

class MultilingualTranslateRequest(BaseModel):
    glosses: List[str] = Field(default_factory=list)
    target_lang: str = Field(default="en", description="Target language: en | hi | ta | te | kn | bn")
    nmm_markers: Optional[Dict[str, Any]] = Field(default=None)

class AskExpertRequest(BaseModel):
    question: str = Field(..., description="Question about ISL grammar, signs, or multimodal fusion")

@router.post("/synthesize")
async def synthesize_sentence_endpoint(req: SynthesizeSentenceRequest):
    try:
        result = llm_agent_service.synthesize_sentence(
            glosses=req.glosses,
            tone=req.tone or "polite",
            context=req.context or "general",
            nmm_markers=req.nmm_markers
        )
        return result
    except Exception as e:
        logger.error(f"Error in synthesize sentence: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/converse")
async def converse_endpoint(req: ConverseRequest):
    try:
        result = llm_agent_service.converse_with_agent(
            signed_message=req.signed_message,
            history=req.history,
            tone=req.tone or "polite"
        )
        return result
    except Exception as e:
        logger.error(f"Error in agent converse: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/english-to-isl")
async def english_to_isl_endpoint(req: EnglishToISLRequest):
    try:
        result = llm_agent_service.convert_english_to_isl_glosses(req.english_text)
        return result
    except Exception as e:
        logger.error(f"Error in english to isl translation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/domain-process")
async def domain_process_endpoint(req: DomainProcessRequest):
    try:
        result = llm_agent_service.process_domain_agent(
            domain=req.domain,
            sign_or_text=req.sign_or_text,
            history=req.history
        )
        return result
    except Exception as e:
        logger.error(f"Error in domain process: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/multilingual-translate")
async def multilingual_translate_endpoint(req: MultilingualTranslateRequest):
    """Translates ISL signs to regional Indian languages (Hindi, Tamil, Telugu, Kannada, Bengali)."""
    try:
        result = llm_agent_service.translate_multilingual(
            glosses=req.glosses,
            target_lang=req.target_lang,
            nmm_markers=req.nmm_markers
        )
        return result
    except Exception as e:
        logger.error(f"Error in multilingual translation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def _generate_neural_audio(text: str, lang: str = "hi", gender: str = "female", rate: float = 1.0, pitch: float = 1.0):
    try:
        lang = lang.lower() if lang else "hi"
        gender = gender.lower() if gender else "female"
        if gender not in ["female", "male"]:
            gender = "female"

        lang_voices = NEURAL_VOICE_MAP.get(lang, NEURAL_VOICE_MAP.get("hi", {}))
        voice = lang_voices.get(gender, "hi-IN-SwaraNeural")

        rate_str = "+0%"
        if rate and rate != 1.0:
            pct = int((rate - 1.0) * 100)
            rate_str = f"{pct:+d}%"

        pitch_str = "+0Hz"
        if pitch and pitch != 1.0:
            hz = int((pitch - 1.0) * 50)
            pitch_str = f"{hz:+d}Hz"

        communicate = edge_tts.Communicate(text, voice, rate=rate_str, pitch=pitch_str)
        audio_stream = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_stream.write(chunk["data"])

        audio_stream.seek(0)
        return StreamingResponse(
            audio_stream,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3",
                "Cache-Control": "public, max-age=3600",
                "X-Neural-Voice": voice,
            }
        )
    except Exception as e:
        logger.error(f"Error generating neural speech: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/speak-neural")
async def speak_neural_endpoint_post(req: NeuralTTSRequest):
    """Generates authentic high-fidelity human neural audio stream in native Indian languages."""
    return await _generate_neural_audio(req.text, req.lang, req.gender, req.rate, req.pitch)

@router.get("/speak-neural")
async def speak_neural_endpoint_get(
    text: str,
    lang: str = "hi",
    gender: str = "female",
    rate: float = 1.0,
    pitch: float = 1.0
):
    """GET endpoint for direct HTML5 Audio src streaming."""
    return await _generate_neural_audio(text, lang, gender, rate, pitch)

@router.post("/ask-expert")
async def ask_expert_endpoint(req: AskExpertRequest):
    """Interactive Deaf / ISL Expert QA assistant answering queries on ISL linguistics & AI."""
    try:
        result = llm_agent_service.ask_isl_expert(req.question)
        return result
    except Exception as e:
        logger.error(f"Error in ask expert: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/knowledge/signs")
async def get_signs_knowledge_endpoint():
    """Returns the comprehensive ISL sign knowledge base with handshapes, motions, regional notes & multilingual lexicon."""
    return {"signs": llm_agent_service.sign_knowledge_base}

@router.get("/knowledge/alphabet")
async def get_alphabet_knowledge_endpoint():
    """Returns the full ISL fingerspelling alphabet manual system (A-Z)."""
    return {"alphabet": llm_agent_service.fingerspelling_alphabet}

@router.get("/domains")
async def get_domains_endpoint():
    return {
        "domains": [
            {"id": "GENERAL", "name": "General Communication", "icon": "MessageSquare", "description": "Everyday fluent conversation and gloss translation"},
            {"id": "MEDICAL", "name": "Medical & Clinical Triage", "icon": "Stethoscope", "description": "Symptom reporting, pain scale, triage advice & nursing alerts"},
            {"id": "BANKING", "name": "Banking & FinTech", "icon": "Landmark", "description": "Accessible account checks, secure fund transfers & fraud lock"},
            {"id": "EDUCATION", "name": "Education & STEM Classroom", "icon": "GraduationCap", "description": "Classroom Q&A, lesson concepts & peer tutoring"},
            {"id": "EMERGENCY", "name": "Safety & SOS Dispatch", "icon": "ShieldAlert", "description": "Automatic emergency beacon generation with GPS dispatch"}
        ]
    }

@router.get("/status")
async def agent_status_endpoint():
    return {
        "status": "active",
        "agent_name": "ISL-Bridge-LLM-MultiAgent-Engine",
        "capabilities": [
            "Comprehensive ISL Knowledge Base & Lexicon",
            "Regional Multilingual Translation (Hindi, Tamil, Telugu, Kannada, Bengali)",
            "Bidirectional Speech-to-Sign (SOV Gloss Sequence)",
            "3D Avatar Animation Stream Mapping",
            "Multi-Agent Collaborative Reasoning (Medical, Banking, Education, Safety)",
            "Non-Manual Marker (NMM) Emotion & Question Integration",
            "Face Computer Vision 468-Landmark Biometric Fusion",
            "Interactive ISL Linguistics Expert QA"
        ]
    }

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 5 & 7 AGENTIC ORCHESTRATOR WORKFLOW ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────
try:
    from services.agent_workflow import agentic_orchestrator
except ImportError:
    from backend.services.agent_workflow import agentic_orchestrator

class AgentSpeechToSignRequest(BaseModel):
    text: str
    prefer_llm: Optional[bool] = True

class AgentSignToSpeechRequest(BaseModel):
    landmarks: Optional[List[Dict[str, float]]] = None
    raw_prediction: str
    confidence: float
    nmm_markers: Optional[Dict[str, Any]] = None

@router.post("/orchestrate/speech-to-sign")
async def orchestrate_speech_to_sign_endpoint(req: AgentSpeechToSignRequest):
    """
    Coordinates Context -> Translation -> Verification -> Action agents
    to translate speech into validated 3D avatar animation sequence.
    """
    return agentic_orchestrator.process_speech_to_sign(req.text, prefer_llm=req.prefer_llm)

@router.post("/orchestrate/sign-to-speech")
async def orchestrate_sign_to_speech_endpoint(req: AgentSignToSpeechRequest):
    """
    Coordinates Perception -> Context -> Verification -> Translation -> Action agents
    to interpret hand sign gestures and facial NMMs into spoken sentence with zero hallucination.
    """
    return agentic_orchestrator.process_sign_to_speech(
        landmarks=req.landmarks or [],
        raw_prediction=req.raw_prediction,
        confidence=req.confidence,
        nmm_markers=req.nmm_markers
    )

@router.post("/context/reset")
async def reset_conversation_context_endpoint():
    """Resets temporary conversation context memory."""
    return agentic_orchestrator.reset_conversation()

@router.get("/context/history")
async def get_conversation_history_endpoint():
    """Returns conversation turn history."""
    return {"history": agentic_orchestrator.context.get_conversation_history()}

