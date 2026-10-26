from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class PredictionScore(BaseModel):
    label: str
    score: float

class PredictionResult(BaseModel):
    prediction: str
    confidence: float
    top_k: List[PredictionScore]
    latency_ms: float
    timestamp: int
    sentence: Optional[str] = None
    agent_response: Optional[str] = None
    nmm_markers: Optional[Dict[str, Any]] = None
    domain: Optional[str] = None
    afme: Optional[Dict[str, Any]] = None
    agent_reasoning: Optional[Dict[str, Any]] = None
    joint_attention: Optional[Dict[str, Any]] = None
    inference_backend: Optional[str] = "Adaptive ST-GCN Graph Engine"

class PredictionResponseSchema(BaseModel):
    prediction: str
    confidence: float
    top_k: List[PredictionScore]
    latency_ms: float
    sentence: Optional[str] = None
    agent_response: Optional[str] = None
    nmm_markers: Optional[Dict[str, Any]] = None
    domain: Optional[str] = None
    afme: Optional[Dict[str, Any]] = None
    agent_reasoning: Optional[Dict[str, Any]] = None
    joint_attention: Optional[Dict[str, Any]] = None
    inference_backend: Optional[str] = "Adaptive ST-GCN Graph Engine"
