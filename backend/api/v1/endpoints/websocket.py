import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.prediction_service import prediction_service

logger = logging.getLogger(__name__)
router = APIRouter()

@router.websocket("/ws/predict")
async def websocket_predict_endpoint(websocket: WebSocket):
    """
    Real-time duplex WebSocket stream for keypoint landmarks transmission
    and live sign recognition predictions.
    """
    await websocket.accept()
    logger.info("WebSocket client connected to /ws/predict stream.")

    try:
        while True:
            raw_data = await websocket.receive_text()
            frame_data = json.loads(raw_data)
            
            # Perform real-time inference on landmark frame
            result = await prediction_service.predict_frame_sequence(frame_data)
            
            await websocket.send_text(result.model_dump_json())

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close()
