"""
Session management service with Redis
"""
import json
import secrets
from datetime import datetime, timedelta
from typing import Optional
import redis.asyncio as redis
import logging
from cryptography.fernet import Fernet
import base64

from config import settings
from models import SessionData, UserInfo

logger = logging.getLogger(__name__)


class SessionService:
    """Service for managing user sessions with Redis"""
    
    def __init__(self):
        self.redis_client = redis.from_url(settings.redis_url)
        self.session_prefix = "bionicpro:session:"
        self.user_session_prefix = "bionicpro:user_sessions:"
        
        # Initialize encryption for sensitive data
        key = base64.urlsafe_b64encode(settings.session_secret_key.ljust(32)[:32].encode())
        self.cipher = Fernet(key)
        
    def generate_session_id(self) -> str:
        """Generate secure session ID"""
        return secrets.token_urlsafe(32)
    
    def _encrypt_sensitive_data(self, data: str) -> str:
        """Encrypt sensitive data like tokens"""
        return self.cipher.encrypt(data.encode()).decode()
    
    def _decrypt_sensitive_data(self, encrypted_data: str) -> str:
        """Decrypt sensitive data"""
        return self.cipher.decrypt(encrypted_data.encode()).decode()
    
    async def create_session(
        self, 
        user_info: UserInfo, 
        access_token: str, 
        refresh_token: str, 
        id_token: str,
        expires_in: int
    ) -> str:
        """
        Create new user session
        """
        session_id = self.generate_session_id()
        now = datetime.utcnow()
        expires_at = now + timedelta(seconds=expires_in)
        
        # Create session data with encrypted tokens
        session_data = SessionData(
            session_id=session_id,
            user_id=user_info.sub,
            username=user_info.username,
            email=user_info.email,
            given_name=user_info.given_name,
            family_name=user_info.family_name,
            roles=user_info.roles,
            access_token=self._encrypt_sensitive_data(access_token),
            refresh_token=self._encrypt_sensitive_data(refresh_token),
            id_token=self._encrypt_sensitive_data(id_token),
            expires_at=expires_at,
            created_at=now,
            last_used_at=now
        )
        
        # Store session in Redis
        session_key = f"{self.session_prefix}{session_id}"
        user_sessions_key = f"{self.user_session_prefix}{user_info.sub}"
        
        # Store session data
        await self.redis_client.setex(
            session_key,
            settings.session_max_age,
            session_data.model_dump_json()
        )
        
        # Track user sessions (for cleanup)
        await self.redis_client.sadd(user_sessions_key, session_id)
        await self.redis_client.expire(user_sessions_key, settings.session_max_age)
        
        logger.info(f"Created session {session_id} for user {user_info.username}")
        return session_id
    
    async def get_session(self, session_id: str) -> Optional[SessionData]:
        """
        Get session data by session ID
        """
        session_key = f"{self.session_prefix}{session_id}"
        
        session_json = await self.redis_client.get(session_key)
        if not session_json:
            return None
            
        try:
            session_dict = json.loads(session_json)
            session_data = SessionData(**session_dict)
            
            # Decrypt sensitive data only if they are encrypted
            try:
                session_data.access_token = self._decrypt_sensitive_data(session_data.access_token)
                session_data.refresh_token = self._decrypt_sensitive_data(session_data.refresh_token)  
                session_data.id_token = self._decrypt_sensitive_data(session_data.id_token)
            except Exception:
                # If decryption fails, tokens might not be encrypted (backward compatibility)
                pass
            
            return session_data
        except Exception as e:
            logger.error(f"Failed to deserialize session {session_id}")
            return None
    
    async def update_session_tokens(
        self, 
        session_id: str, 
        access_token: str, 
        refresh_token: str, 
        id_token: str,
        expires_in: int
    ) -> bool:
        """
        Update session with new tokens
        """
        session_data = await self.get_session(session_id)
        if not session_data:
            return False
            
        # Update tokens and expiration
        now = datetime.utcnow()
        session_data.access_token = self._encrypt_sensitive_data(access_token)
        session_data.refresh_token = self._encrypt_sensitive_data(refresh_token)
        session_data.id_token = self._encrypt_sensitive_data(id_token)
        session_data.expires_at = now + timedelta(seconds=expires_in)
        session_data.last_used_at = now
        
        # Store updated session
        session_key = f"{self.session_prefix}{session_id}"
        await self.redis_client.setex(
            session_key,
            settings.session_max_age,
            session_data.model_dump_json()
        )
        
        return True
    
    async def rotate_session(self, old_session_id: str) -> Optional[str]:
        """
        Rotate session ID for security (prevent session fixation)
        """
        # Get old session data
        old_session = await self.get_session(old_session_id)
        if not old_session:
            return None
        
        # Generate new session ID
        new_session_id = self.generate_session_id()
        
        # Update session data with new ID
        old_session.session_id = new_session_id
        old_session.last_used_at = datetime.utcnow()
        
        # Store with new session ID
        new_session_key = f"{self.session_prefix}{new_session_id}"
        await self.redis_client.setex(
            new_session_key,
            settings.session_max_age,
            old_session.model_dump_json()
        )
        
        # Update user sessions tracking
        user_sessions_key = f"{self.user_session_prefix}{old_session.user_id}"
        await self.redis_client.srem(user_sessions_key, old_session_id)
        await self.redis_client.sadd(user_sessions_key, new_session_id)
        
        # Delete old session
        await self.delete_session(old_session_id)
        
        logger.info(f"Rotated session {old_session_id} -> {new_session_id}")
        return new_session_id
    
    async def update_last_used(self, session_id: str):
        """
        Update session last used timestamp
        """
        session_data = await self.get_session(session_id)
        if session_data:
            session_data.last_used_at = datetime.utcnow()
            session_key = f"{self.session_prefix}{session_id}"
            await self.redis_client.setex(
                session_key,
                settings.session_max_age,
                session_data.model_dump_json()
            )
    
    async def delete_session(self, session_id: str):
        """
        Delete session
        """
        session_key = f"{self.session_prefix}{session_id}"
        
        # Get session data to clean up user sessions tracking
        session_data = await self.get_session(session_id)
        if session_data:
            user_sessions_key = f"{self.user_session_prefix}{session_data.user_id}"
            await self.redis_client.srem(user_sessions_key, session_id)
        
        # Delete session
        await self.redis_client.delete(session_key)
        logger.info(f"Deleted session {session_id}")
    
    
    async def is_session_valid(self, session_id: str) -> bool:
        """
        Check if session is valid and not expired
        """
        session_data = await self.get_session(session_id)
        if not session_data:
            return False
            
        # Check if session is expired
        if datetime.utcnow() > session_data.expires_at:
            await self.delete_session(session_id)
            return False
            
        return True
