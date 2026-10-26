from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class SignVocabularySchema(BaseModel):
    id: int
    sign_label: str
    category: str
    description: Optional[str] = None
    sample_count: Optional[int] = 0

    class Config:
        from_attributes = True

class DatasetSampleCreate(BaseModel):
    sign_label: str
    signer_id: Optional[str] = "researcher"
    num_frames: int = 30
    keypoint_data: Dict[str, Any]
