"""
BionicPRO Reports Service
FastAPI сервис для генерации отчётов из OLAP базы данных
"""

from datetime import datetime, date, timedelta
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Depends, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
# import clickhouse_driver  # Removed for HTTP API usage
import httpx
import logging
from pydantic import BaseModel
import os

from models.report_models import (
    ReportRequest, 
    ReportResponse, 
    UserReport,
    TelemetryMetrics,
    UsageStatistics
)
from services.clickhouse_service import ClickHouseService
from services.auth_service import AuthService

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Создание FastAPI приложения
app = FastAPI(
    title="BionicPRO Reports Service",
    description="Сервис генерации отчётов о работе бионических протезов",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Зависимости
clickhouse_service = ClickHouseService()
auth_service = AuthService()
security = HTTPBearer()

@app.on_event("startup")
async def startup_event():
    """Инициализация при запуске приложения"""
    logger.info("Запуск Reports Service")
    await clickhouse_service.init_connection()

@app.on_event("shutdown") 
async def shutdown_event():
    """Очистка ресурсов при остановке"""
    logger.info("Остановка Reports Service")
    await clickhouse_service.close_connection()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> dict:
    """
    Получение текущего пользователя из токена
    Проверяет токен через BFF Auth Service
    """
    try:
        # Проверяем токен через BFF сервис
        user_info = await auth_service.validate_token(credentials.credentials)
        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user_info
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

@app.get("/health")
async def health_check():
    """Проверка состояния сервиса"""
    try:
        # Проверяем подключение к ClickHouse
        await clickhouse_service.ping()
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "reports-service",
            "version": "1.0.0"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service unhealthy"
        )

@app.get("/reports/user/{user_id}", response_model=UserReport)
async def get_user_report(
    user_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Получение отчёта пользователя за указанный период
    
    Ограничения безопасности:
    - Пользователь может получать только свои отчёты
    - Данные доступны только за обработанные Airflow периоды
    """
    
    # Проверяем права доступа - пользователь может получать только свои данные (закомментировано для демо)
    # if current_user.get("user_id") != user_id and current_user.get("sub") != str(user_id):
    #     logger.warning(f"User {current_user.get('user_id')} tried to access data for user {user_id}")
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Access denied. You can only access your own reports."
    #     )
    
    # Устанавливаем период по умолчанию (последние 30 дней)
    if not start_date:
        start_date = date.today() - timedelta(days=30)
    if not end_date:
        end_date = date.today()
    
    # Проверяем, что запрашиваемый период не в будущем
    if start_date > date.today() or end_date > date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot request reports for future dates"
        )
    
    # Проверяем доступность данных (обработанные Airflow)
    latest_processed_date = await clickhouse_service.get_latest_processed_date()
    if end_date > latest_processed_date:
        logger.warning(f"Requested end_date {end_date} is beyond latest processed date {latest_processed_date}")
        end_date = latest_processed_date
    
    try:
        # Получаем данные отчёта из ClickHouse
        report_data = await clickhouse_service.get_user_report(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date
        )
        
        if not report_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No report data found for user {user_id} in the specified period"
            )
        
        return report_data
        
    except Exception as e:
        logger.error(f"Error generating report for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generating report"
        )

@app.get("/reports/user/{user_id}/summary", response_model=dict)
async def get_user_summary(
    user_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Получение краткой сводки по пользователю
    """
    
    # Проверяем права доступа (закомментировано для демо)
    # if current_user.get("user_id") != user_id and current_user.get("sub") != str(user_id):
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Access denied. You can only access your own data."
    #     )
    
    try:
        summary = await clickhouse_service.get_user_summary(user_id)
        return summary
        
    except Exception as e:
        logger.error(f"Error generating summary for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generating summary"
        )

@app.get("/reports/user/{user_id}/download")
async def download_user_report(
    user_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    format: str = "pdf",
    current_user: dict = Depends(get_current_user)
):
    """
    Скачивание отчёта в указанном формате (PDF, Excel, CSV)
    """
    
    # Проверяем права доступа (закомментировано для демо)
    # if current_user.get("user_id") != user_id and current_user.get("sub") != str(user_id):
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Access denied. You can only download your own reports."
    #     )
    
    if format not in ["pdf", "excel", "csv"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supported formats: pdf, excel, csv"
        )
    
    try:
        # Получаем данные отчёта
        report_data = await clickhouse_service.get_user_report(
            user_id=user_id,
            start_date=start_date or date.today() - timedelta(days=30),
            end_date=end_date or date.today()
        )
        
        # Генерируем файл отчёта
        file_content = await clickhouse_service.generate_report_file(
            report_data=report_data,
            format=format,
            user_id=user_id
        )
        
        # Возвращаем файл
        from fastapi.responses import Response
        
        content_types = {
            "pdf": "application/pdf",
            "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "csv": "text/csv"
        }
        
        filename = f"bionicpro_report_user_{user_id}_{start_date}_{end_date}.{format}"
        
        return Response(
            content=file_content,
            media_type=content_types[format],
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.error(f"Error generating downloadable report for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generating downloadable report"
        )

@app.get("/reports/data-availability")
async def get_data_availability(
    current_user: dict = Depends(get_current_user)
):
    """
    Получение информации о доступности данных
    (какие даты обработаны Airflow)
    """
    try:
        availability_info = await clickhouse_service.get_data_availability()
        return availability_info
        
    except Exception as e:
        logger.error(f"Error getting data availability: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error getting data availability"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8002,
        reload=True,
        log_level="info"
    )
