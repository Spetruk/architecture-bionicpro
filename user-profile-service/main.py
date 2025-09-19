from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
import httpx
import os
import logging
from typing import Optional

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="User Profile Service", version="1.0.0")

# CORS настройки
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Конфигурация базы данных
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/bionicpro")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Модель пользователя в БД
class UserProfile(Base):
    __tablename__ = "user_profiles"
    
    keycloak_id = Column(String, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, nullable=False)
    first_name = Column(String)
    last_name = Column(String)
    yandex_id = Column(String, unique=True, nullable=True)
    profile_data = Column(Text)  # JSON данные профиля из Яндекса
    consent_given = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Создание таблиц
Base.metadata.create_all(bind=engine)

# Pydantic модели
class UserProfileCreate(BaseModel):
    keycloak_id: str
    username: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    yandex_id: Optional[str] = None
    profile_data: Optional[str] = None
    consent_given: bool = False

class UserProfileResponse(BaseModel):
    keycloak_id: str
    username: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    yandex_id: Optional[str] = None
    consent_given: bool
    created_at: datetime
    updated_at: datetime

class ConsentRequest(BaseModel):
    keycloak_id: str
    consent_given: bool

# Dependency для получения сессии БД
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/users/sync-profile", response_model=UserProfileResponse)
async def sync_user_profile(
    user_data: UserProfileCreate,
    db: Session = Depends(get_db)
):
    """Синхронизация профиля пользователя из Keycloak/Яндекса"""
    try:
        # Проверяем, существует ли пользователь
        user = db.query(UserProfile).filter(UserProfile.keycloak_id == user_data.keycloak_id).first()
        
        if user:
            # Обновляем существующего пользователя
            user.username = user_data.username
            user.email = user_data.email
            user.first_name = user_data.first_name
            user.last_name = user_data.last_name
            if user_data.yandex_id:
                user.yandex_id = user_data.yandex_id
            if user_data.profile_data:
                user.profile_data = user_data.profile_data
            user.updated_at = datetime.utcnow()
        else:
            # Создаем нового пользователя
            user = UserProfile(**user_data.dict())
            db.add(user)
        
        db.commit()
        db.refresh(user)
        
        logger.info(f"Профиль пользователя синхронизирован: {user.username}")
        
        return UserProfileResponse(
            keycloak_id=user.keycloak_id,
            username=user.username,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            yandex_id=user.yandex_id,
            consent_given=user.consent_given,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
        
    except Exception as e:
        logger.error(f"Ошибка синхронизации профиля: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка синхронизации профиля: {str(e)}")

@app.get("/users/{keycloak_id}", response_model=UserProfileResponse)
async def get_user_profile(keycloak_id: str, db: Session = Depends(get_db)):
    """Получение профиля пользователя"""
    user = db.query(UserProfile).filter(UserProfile.keycloak_id == keycloak_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    return UserProfileResponse(
        keycloak_id=user.keycloak_id,
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        yandex_id=user.yandex_id,
        consent_given=user.consent_given,
        created_at=user.created_at,
        updated_at=user.updated_at
    )

@app.post("/users/consent")
async def update_consent(consent_data: ConsentRequest, db: Session = Depends(get_db)):
    """Обновление согласия пользователя на использование данных"""
    user = db.query(UserProfile).filter(UserProfile.keycloak_id == consent_data.keycloak_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    user.consent_given = consent_data.consent_given
    user.updated_at = datetime.utcnow()
    db.commit()
    
    logger.info(f"Согласие пользователя обновлено: {user.username} -> {consent_data.consent_given}")
    
    return {"message": "Согласие обновлено", "consent_given": consent_data.consent_given}

@app.post("/webhook/keycloak-user-sync")
async def keycloak_user_sync_webhook(request: Request, db: Session = Depends(get_db)):
    """Webhook для синхронизации пользователей из Keycloak после аутентификации через Яндекс"""
    try:
        data = await request.json()
        logger.info(f"Получен webhook от Keycloak: {data}")
        
        # Обработка данных пользователя из Keycloak
        if data.get("type") == "USER_LOGIN" and data.get("details", {}).get("identity_provider") == "yandex":
            user_id = data.get("userId")
            user_details = data.get("details", {})
            
            # Получаем дополнительную информацию о пользователе из Keycloak
            # Здесь можно добавить запрос к Keycloak Admin API для получения полной информации
            
            # Создаем или обновляем профиль пользователя
            user_data = UserProfileCreate(
                keycloak_id=user_id,
                username=user_details.get("username", ""),
                email=user_details.get("email", ""),
                first_name=user_details.get("first_name", ""),
                last_name=user_details.get("last_name", ""),
                yandex_id=user_details.get("yandex_id", ""),
                profile_data=str(data),  # Сохраняем полные данные webhook
                consent_given=False  # По умолчанию согласие не дано
            )
            
            await sync_user_profile(user_data, db)
            
        return {"status": "processed"}
        
    except Exception as e:
        logger.error(f"Ошибка обработки webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка обработки webhook: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

