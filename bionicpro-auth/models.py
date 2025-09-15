"""
Data models for BionicPRO Auth Service
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class TokenResponse(BaseModel):
    """Keycloak token response"""
    access_token: str
    refresh_token: str
    id_token: str
    token_type: str = "Bearer"
    expires_in: int
    scope: str


class UserInfo(BaseModel):
    """User information from ID token"""
    sub: str
    username: str
    email: str
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    roles: List[str] = []


class SessionData(BaseModel):
    """Session data stored in Redis"""
    session_id: str
    user_id: str
    username: str
    email: str
    roles: List[str]
    access_token: str
    refresh_token: str
    id_token: str
    expires_at: datetime
    created_at: datetime
    last_used_at: datetime


class AuthResponse(BaseModel):
    """Authentication response to frontend"""
    success: bool
    message: Optional[str] = None
    user_info: Optional[UserInfo] = None
    session_id: Optional[str] = None
