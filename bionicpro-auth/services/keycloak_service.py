"""
Keycloak integration service
"""
import httpx
import base64
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
import logging

from config import settings
from models import TokenResponse, UserInfo

logger = logging.getLogger(__name__)


class KeycloakService:
    """Service for Keycloak integration"""
    
    def __init__(self):
        self.base_url = f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
        self.client_id = settings.keycloak_client_id
        self.client_secret = settings.keycloak_client_secret
        
    async def exchange_code_for_tokens(self, code: str, redirect_uri: str, code_verifier: str) -> TokenResponse:
        """
        Exchange authorization code for tokens using PKCE
        """
        token_url = f"{self.base_url}/protocol/openid-connect/token"
        
        data = {
            "grant_type": "authorization_code",
            "client_id": self.client_id,
            "code": code,
            "redirect_uri": redirect_uri,
            "code_verifier": code_verifier,  # PKCE parameter
        }
        
        # Add client_secret if available (confidential client)
        if self.client_secret:
            data["client_secret"] = self.client_secret
            
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code != 200:
                logger.error(f"Token exchange failed: {response.status_code} - {response.text}")
                raise Exception(f"Token exchange failed: {response.status_code}")
                
            token_data = response.json()
            return TokenResponse(**token_data)
    
    async def refresh_access_token(self, refresh_token: str) -> TokenResponse:
        """
        Refresh access token using refresh token
        """
        token_url = f"{self.base_url}/protocol/openid-connect/token"
        
        data = {
            "grant_type": "refresh_token",
            "client_id": self.client_id,
            "refresh_token": refresh_token,
        }
        
        if self.client_secret:
            data["client_secret"] = self.client_secret
            
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code != 200:
                logger.error(f"Token refresh failed: {response.status_code} - {response.text}")
                raise Exception(f"Token refresh failed: {response.status_code}")
                
            token_data = response.json()
            return TokenResponse(**token_data)
    
    async def revoke_token(self, token: str, token_type: str = "refresh_token"):
        """
        Revoke token (logout)
        """
        revoke_url = f"{self.base_url}/protocol/openid-connect/revoke"
        
        data = {
            "client_id": self.client_id,
            "token": token,
            "token_type_hint": token_type,
        }
        
        if self.client_secret:
            data["client_secret"] = self.client_secret
            
        async with httpx.AsyncClient() as client:
            response = await client.post(
                revoke_url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code not in [200, 204]:
                logger.warning(f"Token revocation failed: {response.status_code}")
    
    def decode_token(self, token: str, verify: bool = False) -> dict:
        """
        Decode JWT token without verification (for getting user info)
        In production, you should verify the token signature
        """
        try:
            # For demo purposes, we decode without verification
            # In production, you should verify with Keycloak's public key
            return jwt.get_unverified_claims(token)
        except JWTError as e:
            logger.error(f"Token decode failed: {e}")
            raise Exception("Invalid token")
    
    def extract_user_info(self, id_token: str, access_token: str) -> UserInfo:
        """
        Extract user information from tokens
        """
        try:
            # Decode ID token for user info
            id_claims = self.decode_token(id_token)
            
            # Decode access token for roles
            access_claims = self.decode_token(access_token)
            
            # Extract roles from access token
            roles = []
            if "realm_access" in access_claims and "roles" in access_claims["realm_access"]:
                roles = access_claims["realm_access"]["roles"]
            
            return UserInfo(
                sub=id_claims.get("sub", ""),
                username=id_claims.get("preferred_username", ""),
                email=id_claims.get("email", ""),
                given_name=id_claims.get("given_name"),
                family_name=id_claims.get("family_name"),
                roles=roles
            )
        except Exception as e:
            logger.error(f"Failed to extract user info: {e}")
            raise Exception("Failed to extract user information")
    
    def is_token_expired(self, token: str) -> bool:
        """
        Check if token is expired
        """
        try:
            claims = self.decode_token(token)
            exp = claims.get("exp", 0)
            return datetime.utcnow().timestamp() > exp
        except:
            return True

    async def generate_code_challenge(self, code_verifier: str) -> str:
        """
        Generate PKCE code challenge from code verifier
        """
        challenge = hashlib.sha256(code_verifier.encode('utf-8')).digest()
        return base64.urlsafe_b64encode(challenge).decode('utf-8').rstrip('=')

    async def initiate_login(self, code_challenge: str, state: str) -> str:
        """
        Build Keycloak authorization URL with PKCE parameters
        """
        # Use public URL for browser redirects
        public_base_url = f"{settings.keycloak_public_url}/realms/{settings.keycloak_realm}"
        auth_url = f"{public_base_url}/protocol/openid-connect/auth"
        redirect_uri = f"{settings.cors_origins[0]}/auth/callback"
        
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid profile email",
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "state": state,
            "prompt": "login",
            "max_age": "0",
        }
        
        from urllib.parse import urlencode
        return f"{auth_url}?{urlencode(params)}"
