from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from core.security import create_access_token, verify_password, get_password_hash

router = APIRouter()

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest):
    # Stub authentication for development / research setup
    if credentials.username == "admin" and credentials.password == "admin123":
        access_token = create_access_token(subject=credentials.username)
        return TokenResponse(access_token=access_token)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username or password",
    )
