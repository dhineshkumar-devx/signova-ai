from pydantic import BaseModel
from typing import List, Optional

class Keypoint3D(BaseModel):
    x: float
    y: float
    z: float
    visibility: Optional[float] = 1.0

class MediaPipeFrameSchema(BaseModel):
    timestamp: int
    frame_index: int
    pose: List[Keypoint3D]
    left_hand: List[Keypoint3D]
    right_hand: List[Keypoint3D]
    face: Optional[List[Keypoint3D]] = []
