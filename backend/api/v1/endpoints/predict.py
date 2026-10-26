from fastapi import APIRouter
from schemas.prediction import PredictionResult
from services.prediction_service import prediction_service

router = APIRouter()

@router.post("/predict", response_model=PredictionResult)
async def predict_single_sample(landmarks: dict):
    """
    Perform single-shot sign prediction from uploaded landmark JSON frame payload.
    """
    return await prediction_service.predict_frame_sequence(landmarks)
