"""
BionicPRO Auth Service - Backend for Frontend (BFF)
Secure token management with session-based authentication
"""
import logging
import os
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request, Response, Depends, Cookie, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from typing import Optional
import secrets
import httpx

from config import settings
from models import AuthResponse, UserInfo
from services.keycloak_service import KeycloakService
from services.session_service import SessionService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="BionicPRO Auth Service",
    description="Backend for Frontend (BFF) service for secure authentication",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Initialize services
keycloak_service = KeycloakService()
session_service = SessionService()


async def get_current_session(
    request: Request,
    bionicpro_session: Optional[str] = Cookie(None)
) -> Optional[str]:
    """
    Get current session ID from cookie
    """
    if not bionicpro_session:
        return None
    
    # Validate session
    if not await session_service.is_session_valid(bionicpro_session):
        return None
        
    return bionicpro_session


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.get("/auth/login")
async def login(response: Response):
    """
    Initiate OAuth 2.0 login flow with PKCE
    """
    try:
        # Generate PKCE parameters
        code_verifier = secrets.token_urlsafe(64)
        code_challenge = await keycloak_service.generate_code_challenge(code_verifier)
        state = secrets.token_urlsafe(32)

        # Store PKCE verifier and state in Redis with short expiry
        await session_service.redis_client.setex(f"pkce_verifier:{state}", 300, code_verifier)
        await session_service.redis_client.setex(f"oauth_state:{state}", 300, "true")

        # Build Keycloak authorization URL
        auth_url = await keycloak_service.initiate_login(code_challenge, state)
        
        # Redirect to Keycloak
        return RedirectResponse(auth_url, status_code=status.HTTP_302_FOUND)
        
    except Exception as e:
        logger.error(f"Login initiation failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Login initiation failed")


@app.get("/auth/callback")
async def auth_callback(code: str, state: str, response: Response):
    """
    Handle OAuth callback and create session
    """
    try:
        # Check if this request is already being processed (prevent double execution)
        request_key = f"processing:{code}:{state}"
        is_processing = await session_service.redis_client.get(request_key)
        if is_processing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request already being processed")
        
        # Mark request as being processed
        await session_service.redis_client.setex(request_key, 30, "processing")
        
        try:
            # Validate state parameter
            stored_state = await session_service.redis_client.get(f"oauth_state:{state}")
            if not stored_state:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired state parameter")
            
            # Delete state immediately to prevent reuse
            await session_service.redis_client.delete(f"oauth_state:{state}")

            # Retrieve code verifier
            code_verifier = await session_service.redis_client.get(f"pkce_verifier:{state}")
            if not code_verifier:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code verifier not found or expired")
            
            # Delete code verifier immediately to prevent reuse
            await session_service.redis_client.delete(f"pkce_verifier:{state}")

            # Exchange code for tokens using PKCE
            redirect_uri = f"{settings.cors_origins[0]}/auth/callback"
            tokens = await keycloak_service.exchange_code_for_tokens(
                code=code,
                redirect_uri=redirect_uri,
                code_verifier=code_verifier.decode('utf-8')
            )

            # Debug: decode token claims to see available fields
            try:
                id_claims = keycloak_service.decode_token(tokens.id_token)
                access_claims = keycloak_service.decode_token(tokens.access_token)
                logger.info(
                    "Auth callback tokens decoded: id_claims(keys)=%s, access_claims(keys)=%s",
                    list(id_claims.keys()), list(access_claims.keys())
                )
                logger.info(
                    "Auth callback id_claims preview: sub=%s, preferred_username=%s, given_name=%s, family_name=%s, email=%s",
                    id_claims.get("sub"), id_claims.get("preferred_username"), id_claims.get("given_name"), id_claims.get("family_name"), id_claims.get("email")
                )
            except Exception as debug_e:
                logger.warning(f"Failed to decode tokens for debug: {debug_e}")
            
            # Extract user information
            user_info = keycloak_service.extract_user_info(
                id_token=tokens.id_token,
                access_token=tokens.access_token
            )

            # Debug: log extracted user_info
            try:
                logger.info(
                    "Extracted user_info: sub=%s, username=%s, email=%s, given_name=%s, family_name=%s, roles=%s",
                    user_info.sub, user_info.username, user_info.email, user_info.given_name, user_info.family_name, user_info.roles
                )
            except Exception:
                pass
            
            # Create session
            session_id = await session_service.create_session(
                user_info=user_info,
                access_token=tokens.access_token,
                refresh_token=tokens.refresh_token,
                id_token=tokens.id_token,
                expires_in=tokens.expires_in
            )
            
            # Set HTTP-only secure cookie
            response.set_cookie(
                key=settings.session_cookie_name,
                value=session_id,
                max_age=settings.session_max_age,
                httponly=True,
                secure=not settings.debug,  # Only secure in production
                samesite="lax"
            )
            
            return AuthResponse(
                success=True,
                user_info=user_info,
                session_id=session_id,
                message="Authentication successful"
            )
        finally:
            # Clean up processing lock
            await session_service.redis_client.delete(request_key)
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Auth callback failed: {e}")
        raise HTTPException(status_code=400, detail=f"Authentication failed: {str(e)}")


@app.get("/auth/user")
async def get_user_info(session_id: Optional[str] = Depends(get_current_session)):
    """
    Get current user information
    """
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_data = await session_service.get_session(session_id)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check if access token is expired and refresh if needed
    if keycloak_service.is_token_expired(session_data.access_token):
        try:
            # Refresh tokens
            new_tokens = await keycloak_service.refresh_access_token(session_data.refresh_token)
            
            # Update session with new tokens
            await session_service.update_session_tokens(
                session_id=session_id,
                access_token=new_tokens.access_token,
                refresh_token=new_tokens.refresh_token,
                id_token=new_tokens.id_token,
                expires_in=new_tokens.expires_in
            )
            
            
        except Exception as e:
            logger.error(f"Token refresh failed: {e}")
            await session_service.delete_session(session_id)
            raise HTTPException(status_code=401, detail="Session expired")
    
    # Update last used timestamp
    await session_service.update_last_used(session_id)
    
    return UserInfo(
        sub=session_data.user_id,
        username=session_data.username,
        email=session_data.email,
        given_name=session_data.given_name,
        family_name=session_data.family_name,
        roles=session_data.roles
    )


@app.post("/auth/logout")
async def logout(
    response: Response,
    session_id: Optional[str] = Depends(get_current_session)
):
    """
    Logout user and destroy session
    """
    if session_id:
        session_data = await session_service.get_session(session_id)
        if session_data:
            # Revoke refresh token in Keycloak
            try:
                await keycloak_service.revoke_token(session_data.refresh_token)
            except Exception as e:
                logger.warning(f"Failed to revoke token: {e}")
            
            # Delete session
            await session_service.delete_session(session_id)
        
        # Clear cookie
        response.delete_cookie(
            key=settings.session_cookie_name,
            httponly=True,
            secure=not settings.debug,  # Only secure in production
            samesite="lax"
        )
    
    return {"success": True, "message": "Logged out successfully"}


@app.get("/api/protected")
async def protected_endpoint(
    response: Response,
    session_id: Optional[str] = Depends(get_current_session)
):
    """
    Protected endpoint that demonstrates session rotation
    """
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_data = await session_service.get_session(session_id)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check if access token is expired and refresh if needed
    if keycloak_service.is_token_expired(session_data.access_token):
        try:
            new_tokens = await keycloak_service.refresh_access_token(session_data.refresh_token)
            await session_service.update_session_tokens(
                session_id=session_id,
                access_token=new_tokens.access_token,
                refresh_token=new_tokens.refresh_token,
                id_token=new_tokens.id_token,
                expires_in=new_tokens.expires_in
            )
        except Exception as e:
            logger.error(f"Token refresh failed: {e}")
            await session_service.delete_session(session_id)
            raise HTTPException(status_code=401, detail="Session expired")
    
    # Rotate session ID for security (prevent session fixation)
    new_session_id = await session_service.rotate_session(session_id)
    if new_session_id:
        # Update cookie with new session ID
        response.set_cookie(
            key=settings.session_cookie_name,
            value=new_session_id,
            max_age=settings.session_max_age,
            httponly=True,
            secure=not settings.debug,  # Only secure in production
            samesite="lax"
        )
        session_id = new_session_id
    
    return {
        "message": "Access granted to protected resource",
        "user": session_data.username,
        "roles": session_data.roles,
        "session_id": session_id,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/auth/debug-claims")
async def debug_claims(request: Request):
    """
    Debug endpoint - shows current user's claims from tokens
    """
    session_id = request.cookies.get(settings.session_cookie_name)
    
    if not session_id:
        raise HTTPException(status_code=401, detail="No session cookie")
    
    session_data = await session_service.get_session(session_id)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Decode current tokens to see what claims are available
    try:
        if hasattr(session_data, 'id_token') and session_data.id_token:
            id_claims = keycloak_service.decode_token(session_data.id_token)
        else:
            id_claims = {"error": "No id_token in session"}
            
        if hasattr(session_data, 'access_token') and session_data.access_token:
            access_claims = keycloak_service.decode_token(session_data.access_token)
        else:
            access_claims = {"error": "No access_token in session"}
    except Exception as e:
        return {"error": f"Failed to decode tokens: {str(e)}"}
    
    return {
        "username": session_data.username,
        "id_token_claims": id_claims,
        "access_token_claims": access_claims,
        "user_info_from_session": {
            "given_name": getattr(session_data, 'given_name', None),
            "family_name": getattr(session_data, 'family_name', None),
            "email": getattr(session_data, 'email', None)
        }
    }


@app.get("/api/reports")
async def get_reports(session_id: Optional[str] = Depends(get_current_session)):
    """
    Get user reports (role-based access)
    """
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_data = await session_service.get_session(session_id)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check user roles - поддерживаем как старые, так и новые роли
    if "prosthetic-pilot" in session_data.roles or "prothetic_user" in session_data.roles:
        return {
            "reports": [
                {"id": 1, "type": "telemetry", "title": "Данные телеметрии протеза"},
                {"id": 2, "type": "biosignals", "title": "Миосигналы и движения"},
                {"id": 3, "type": "usage", "title": "Статистика использования"}
            ],
            "user_type": "pilot"
        }
    elif "prosthetic-buyer" in session_data.roles:
        return {
            "reports": [
                {"id": 1, "type": "orders", "title": "История заказов"},
                {"id": 2, "type": "delivery", "title": "Статусы доставки"},
                {"id": 3, "type": "warranty", "title": "Гарантийные отчеты"}
            ],
            "user_type": "buyer"
        }
    else:
        raise HTTPException(status_code=403, detail="Access denied")


# Проксирование запросов к Reports Service
@app.get("/api/reports/user/{user_id}")
async def proxy_get_user_report(
    user_id: int,
    request: Request,
    session_id: Optional[str] = Depends(get_current_session)
):
    """Проксирование запроса отчёта пользователя"""
    if not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    
    try:
        # Получаем данные сессии
        session_data = await session_service.get_session(session_id)
        if not session_data:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
        
        # Проверяем права доступа - пользователь может получать только свои данные
        # Простой маппинг для тестирования: любой аутентифицированный пользователь может получить данные пользователя 1
        session_user_uuid = session_data.user_id  # UUID пользователя
        logger.info(f"Session user UUID: {session_user_uuid}, requested user_id: {user_id}")
        
        # Для демо: разрешаем доступ к данным пользователей 1, 2, 3
        if user_id not in [1, 2, 3]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You can only access your own reports."
            )

        # Проксируем запрос к Reports Service
        reports_service_url = os.getenv("REPORTS_SERVICE_URL", "http://reports-service:8002")
        
        # Передаём query параметры
        query_params = str(request.url.query)
        url = f"{reports_service_url}/reports/user/{user_id}"
        if query_params:
            url += f"?{query_params}"

        async with httpx.AsyncClient() as client:
            # Получаем токен из сессии для авторизации в Reports Service
            access_token = session_data.access_token
            
            response = await client.get(
                url,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=30.0
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Reports service error: {response.text}"
                )
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error proxying reports request: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error accessing reports service"
        )

@app.get("/api/reports/user/{user_id}/summary")
async def proxy_get_user_summary(
    user_id: int,
    session_id: Optional[str] = Depends(get_current_session)
):
    """Проксирование запроса сводки пользователя"""
    if not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        
    try:
        # Получаем данные сессии
        session_data = await session_service.get_session(session_id)
        if not session_data:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
            
        # Проверяем права доступа
        # Для демо: разрешаем доступ к данным пользователей 1, 2, 3
        if user_id not in [1, 2, 3]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You can only access your own data."
            )

        reports_service_url = os.getenv("REPORTS_SERVICE_URL", "http://reports-service:8002")
        
        async with httpx.AsyncClient() as client:
            access_token = session_data.access_token
            
            response = await client.get(
                f"{reports_service_url}/reports/user/{user_id}/summary",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=30.0
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Reports service error: {response.text}"
                )
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error proxying summary request: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error accessing reports service"
        )

@app.get("/api/reports/data-availability")
async def proxy_get_data_availability(
    session_id: Optional[str] = Depends(get_current_session)
):
    """Проксирование запроса информации о доступности данных"""
    if not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        
    try:
        # Получаем данные сессии
        session_data = await session_service.get_session(session_id)
        if not session_data:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
            
        reports_service_url = os.getenv("REPORTS_SERVICE_URL", "http://reports-service:8002")
        
        async with httpx.AsyncClient() as client:
            access_token = session_data.access_token
            
            response = await client.get(
                f"{reports_service_url}/reports/data-availability",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=30.0
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Reports service error: {response.text}"
                )
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error proxying data availability request: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error accessing reports service"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.debug
    )
