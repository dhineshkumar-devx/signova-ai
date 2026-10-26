from fastapi import APIRouter
from api.v1.endpoints import auth, predict, dataset, models, websocket, agent, avatar, speech

api_v1_router = APIRouter()

api_v1_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_v1_router.include_router(predict.router, tags=["Prediction"])
api_v1_router.include_router(dataset.router, prefix="/dataset", tags=["Dataset"])
api_v1_router.include_router(models.router, prefix="/models", tags=["Models"])
api_v1_router.include_router(websocket.router, tags=["WebSocket"])
api_v1_router.include_router(agent.router, prefix="/agent", tags=["Agentic AI & LLM"])
api_v1_router.include_router(avatar.router, prefix="/avatar", tags=["3D Avatar & Sign Library"])
api_v1_router.include_router(speech.router, prefix="/speech", tags=["Speech & ISL Gloss Translation"])

