"""
CRM integration service for user mapping
"""
import asyncio
import asyncpg
import logging
from typing import Optional
from config import settings

logger = logging.getLogger(__name__)


class CRMService:
    """Service for CRM database integration"""
    
    def __init__(self):
        self.db_host = "crm_db"  # Docker service name для CRM базы
        self.db_port = 5432
        self.db_name = "crm_db"  # Имя базы из docker-compose
        self.db_user = "crm_user"  # Пользователь из docker-compose
        self.db_password = "crm_password"  # Пароль из docker-compose
        
    async def get_user_id_by_email(self, email: str) -> Optional[int]:
        """
        Получить user_id из CRM базы по email
        """
        try:
            conn = await asyncpg.connect(
                host=self.db_host,
                port=self.db_port,
                database=self.db_name,
                user=self.db_user,
                password=self.db_password
            )
            
            query = "SELECT id FROM customers WHERE email = $1 LIMIT 1"
            result = await conn.fetchval(query, email)
            
            await conn.close()
            
            if result:
                logger.info(f"Found user_id {result} for email {email}")
                return int(result)
            else:
                logger.warning(f"No user found for email {email}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting user_id for email {email}: {e}")
            return None
    
    async def get_user_info_by_id(self, user_id: int) -> Optional[dict]:
        """
        Получить информацию о пользователе по ID
        """
        try:
            conn = await asyncpg.connect(
                host=self.db_host,
                port=self.db_port,
                database=self.db_name,
                user=self.db_user,
                password=self.db_password
            )
            
            query = "SELECT id, name, email, age, gender, country FROM customers WHERE id = $1"
            result = await conn.fetchrow(query, user_id)
            
            await conn.close()
            
            if result:
                return {
                    "id": result["id"],
                    "name": result["name"],
                    "email": result["email"],
                    "age": result["age"],
                    "gender": result["gender"],
                    "country": result["country"]
                }
            else:
                logger.warning(f"No user found for user_id {user_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting user info for user_id {user_id}: {e}")
            return None

    async def validate_user_access(self, keycloak_email: str, requested_user_id: int) -> bool:
        """
        Проверить, имеет ли пользователь доступ к запрашиваемым данным
        """
        try:
            # Получаем user_id из CRM по email из Keycloak
            actual_user_id = await self.get_user_id_by_email(keycloak_email)
            
            if actual_user_id is None:
                logger.warning(f"User with email {keycloak_email} not found in CRM")
                return False
            
            # Проверяем, совпадает ли user_id
            if actual_user_id == requested_user_id:
                logger.info(f"Access granted: {keycloak_email} can access data for user_id {requested_user_id}")
                return True
            else:
                logger.warning(f"Access denied: {keycloak_email} (user_id={actual_user_id}) cannot access data for user_id {requested_user_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error validating user access: {e}")
            return False
