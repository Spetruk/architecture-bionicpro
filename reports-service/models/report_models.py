"""
Модели данных для сервиса отчётов BionicPRO
"""

from datetime import date, datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum

class UsageIntensityEnum(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    VERY_HIGH = "Very High"

class BatteryHealthEnum(str, Enum):
    CRITICAL = "Critical"
    LOW = "Low"
    GOOD = "Good"
    EXCELLENT = "Excellent"

class ReportRequest(BaseModel):
    """Модель запроса отчёта"""
    user_id: int = Field(..., description="ID пользователя")
    start_date: Optional[date] = Field(None, description="Начальная дата периода")
    end_date: Optional[date] = Field(None, description="Конечная дата периода")
    include_details: bool = Field(True, description="Включать детализированные данные")

class TelemetryMetrics(BaseModel):
    """Метрики телеметрии протеза"""
    avg_signal_frequency: float = Field(..., description="Средняя частота сигнала")
    max_signal_frequency: float = Field(..., description="Максимальная частота сигнала")
    min_signal_frequency: float = Field(..., description="Минимальная частота сигнала")
    total_signal_duration: float = Field(..., description="Общая продолжительность сигналов")
    avg_signal_duration: float = Field(..., description="Средняя продолжительность сигнала")
    avg_signal_amplitude: float = Field(..., description="Средняя амплитуда сигнала")
    max_signal_amplitude: float = Field(..., description="Максимальная амплитуда сигнала")
    avg_battery_level: float = Field(..., description="Средний уровень батареи")
    min_battery_level: float = Field(..., description="Минимальный уровень батареи")
    avg_movement_accuracy: float = Field(..., description="Средняя точность движений")
    total_movements: int = Field(..., description="Общее количество движений")

class UsageStatistics(BaseModel):
    """Статистика использования протеза"""
    usage_intensity: UsageIntensityEnum = Field(..., description="Интенсивность использования")
    battery_health: BatteryHealthEnum = Field(..., description="Состояние батареи")
    data_quality_score: float = Field(..., description="Оценка качества данных")
    primary_muscle_group: str = Field(..., description="Основная группа мышц")
    prosthesis_type: str = Field(..., description="Тип протеза")
    
class DailyMetrics(BaseModel):
    """Метрики за день"""
    report_date: date = Field(..., description="Дата отчёта")
    telemetry: TelemetryMetrics
    usage: UsageStatistics
    
class UserInfo(BaseModel):
    """Информация о пользователе"""
    user_id: int = Field(..., description="ID пользователя")
    customer_name: str = Field(..., description="Имя клиента")
    email: str = Field(..., description="Email")
    age: int = Field(..., description="Возраст")
    gender: str = Field(..., description="Пол")
    country: str = Field(..., description="Страна")

class UserReport(BaseModel):
    """Полный отчёт пользователя"""
    user_info: UserInfo
    report_period: Dict[str, date] = Field(..., description="Период отчёта")
    summary_metrics: TelemetryMetrics
    summary_usage: UsageStatistics
    daily_metrics: List[DailyMetrics] = Field(..., description="Метрики по дням")
    insights: List[str] = Field(..., description="Аналитические выводы")
    recommendations: List[str] = Field(..., description="Рекомендации")
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Время генерации")

class ReportResponse(BaseModel):
    """Ответ с отчётом"""
    success: bool = Field(..., description="Успешность операции")
    report: Optional[UserReport] = Field(None, description="Данные отчёта")
    message: str = Field(..., description="Сообщение")
    
class DataAvailability(BaseModel):
    """Информация о доступности данных"""
    earliest_date: date = Field(..., description="Самая ранняя доступная дата")
    latest_date: date = Field(..., description="Последняя обработанная дата")
    total_processed_days: int = Field(..., description="Общее количество обработанных дней")
    last_etl_run: datetime = Field(..., description="Время последнего запуска ETL")
    data_quality_status: str = Field(..., description="Статус качества данных")

class UserSummary(BaseModel):
    """Краткая сводка по пользователю"""
    user_id: int
    total_days_with_data: int = Field(..., description="Дней с данными")
    avg_daily_movements: float = Field(..., description="Среднее количество движений в день")
    avg_battery_health: float = Field(..., description="Средний уровень батареи")
    most_active_muscle_group: str = Field(..., description="Наиболее активная группа мышц")
    usage_trend: str = Field(..., description="Тренд использования")
    last_activity_date: date = Field(..., description="Дата последней активности")
    overall_performance_score: float = Field(..., description="Общая оценка производительности")

class ErrorResponse(BaseModel):
    """Модель ответа с ошибкой"""
    success: bool = Field(False, description="Успешность операции")
    error_code: str = Field(..., description="Код ошибки")
    message: str = Field(..., description="Сообщение об ошибке")
    details: Optional[Dict[str, Any]] = Field(None, description="Дополнительные детали")

