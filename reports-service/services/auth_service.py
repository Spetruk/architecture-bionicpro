"""
Сервис аутентификации для Reports Service
Проверяет токены через BFF Auth Service
"""

import httpx
import logging
from typing import Optional, Dict, Any
import os

logger = logging.getLogger(__name__)

class AuthService:
    """Сервис для проверки аутентификации через BFF"""
    
    def __init__(self):
        self.bff_url = os.getenv("BFF_AUTH_URL", "http://bionicpro-auth:8000")
        self.timeout = 10.0
        
    async def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Проверка токена через BFF Auth Service (упрощенная версия для демо)
        
        Args:
            token: JWT токен или session token
            
        Returns:
            Dict с информацией о пользователе или None если токен невалиден
        """
        # Для демо: принимаем любой токен как валидный
        if token and len(token) > 10:
            return {
                "user_id": "demo-user",
                "username": "demo",
                "email": "demo@example.com",
                "roles": ["prothetic_user"]
            }
        
        # Оригинальная логика закомментирована для демо
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # Делаем запрос к BFF для проверки токена
                response = await client.get(
                    f"{self.bff_url}/auth/user",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    user_info = response.json()
                    logger.info(f"Token validated for user: {user_info.get('username', 'unknown')}")
                    return user_info
                elif response.status_code == 401:
                    logger.warning("Invalid or expired token")
                    return None
                else:
                    logger.error(f"BFF auth service error: {response.status_code} - {response.text}")
                    return None
                    
        except httpx.TimeoutException:
            logger.error("Timeout while validating token with BFF service")
            return None
        except httpx.RequestError as e:
            logger.error(f"Request error while validating token: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error while validating token: {e}")
            return None
        """
        
        return None
    
    async def validate_session(self, session_cookie: str) -> Optional[Dict[str, Any]]:
        """
        Проверка сессии через BFF Auth Service
        
        Args:
            session_cookie: Значение session cookie
            
        Returns:
            Dict с информацией о пользователе или None если сессия невалидна
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # Делаем запрос к BFF с session cookie
                response = await client.get(
                    f"{self.bff_url}/auth/user",
                    cookies={"session": session_cookie},
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    user_info = response.json()
                    logger.info(f"Session validated for user: {user_info.get('username', 'unknown')}")
                    return user_info
                elif response.status_code == 401:
                    logger.warning("Invalid or expired session")
                    return None
                else:
                    logger.error(f"BFF auth service error: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error while validating session: {e}")
            return None
    
    async def get_user_permissions(self, user_info: Dict[str, Any]) -> Dict[str, bool]:
        """
        Получение разрешений пользователя
        
        Args:
            user_info: Информация о пользователе
            
        Returns:
            Dict с разрешениями пользователя
        """
        # Базовые разрешения для всех аутентифицированных пользователей
        permissions = {
            "can_view_own_reports": True,
            "can_download_own_reports": True,
            "can_view_other_reports": False,
            "can_download_other_reports": False,
            "is_admin": False
        }
        
        # Проверяем роли пользователя
        user_roles = user_info.get("roles", [])
        
        if "admin" in user_roles or "operator" in user_roles:
            permissions.update({
                "can_view_other_reports": True,
                "can_download_other_reports": True,
                "is_admin": True
            })
        
        return permissions
    
    async def check_user_access(
        self, 
        current_user: Dict[str, Any], 
        requested_user_id: int
    ) -> bool:
        """
        Проверка прав доступа пользователя к данным
        
        Args:
            current_user: Информация о текущем пользователе
            requested_user_id: ID пользователя, к данным которого запрашивается доступ
            
        Returns:
            True если доступ разрешён, False иначе
        """
        try:
            # Получаем ID текущего пользователя
            current_user_id = current_user.get("user_id")
            current_user_sub = current_user.get("sub")
            
            # Проверяем, что пользователь запрашивает свои данные
            if current_user_id == requested_user_id:
                return True
            
            # Дополнительная проверка через sub (subject) из JWT
            if current_user_sub and str(current_user_sub) == str(requested_user_id):
                return True
            
            # Проверяем права администратора
            permissions = await self.get_user_permissions(current_user)
            if permissions.get("is_admin", False):
                logger.info(f"Admin user {current_user_id} accessing data for user {requested_user_id}")
                return True
            
            # Доступ запрещён
            logger.warning(f"User {current_user_id} denied access to data for user {requested_user_id}")
            return False
            
        except Exception as e:
            logger.error(f"Error checking user access: {e}")
            return False
