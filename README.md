# 🦾 BionicPRO Reports System

Полнофункциональная система отчётности для бионических протезов с ETL-процессом, аналитикой и безопасностью.

## 🚀 Быстрый запуск

### Первый запуск:
```bash
docker-compose up -d
```

### Полный перезапуск (после изменений):
```bash
./restart-system.sh
```

**Система полностью автоматическая!** Все базы данных, пользователи и ETL процессы настраиваются автоматически.

## ⏱️ Время инициализации: 3-5 минут

## 🌐 Доступные сервисы

| Сервис | URL | Логин/Пароль |
|--------|-----|--------------|
| **Frontend** | http://localhost:3000 | Через Keycloak |
| **Airflow** | http://localhost:8090 | admin/admin123 |
| **Reports API** | http://localhost:8002 | Через BFF |
| **Keycloak** | http://localhost:8080 | admin/admin |

## 📊 Проверка работы системы

### Витрина данных:
```bash
docker exec bionicpro-olap-db clickhouse-client --database bionicpro_analytics --query "
SELECT user_id, customer_name, prosthesis_type, total_movements 
FROM reports_data_mart 
ORDER BY user_id"
```

### Статус ETL:
```bash
# Зайти в Airflow UI: http://localhost:8090
# Найти DAG: bionicpro_etl_reports
# Проверить статус: должен быть Success
```

### Тест API:
```bash
curl http://localhost:8002/health
# Ответ: {"status": "healthy"}
```

## 🏗️ Архитектура

- **ETL:** Apache Airflow извлекает данные из CRM и OLTP, создает витрину в OLAP
- **Security:** BFF паттерн с Keycloak, пользователи видят только свои данные  
- **Frontend:** React с интеграцией отчётов через защищенные endpoints
- **Storage:** PostgreSQL (OLTP/CRM), ClickHouse (OLAP), Redis (сессии)

## 📋 Что включено

✅ **Задача 1:** Архитектура решения (draw.io диаграмма)  
✅ **Задача 2:** Airflow DAG с расписанием (@daily)  
✅ **Задача 3:** Backend API (/reports endpoints)  
✅ **Задача 4:** Ограничения доступа (только свои данные)  
✅ **Задача 5:** UI кнопки генерации отчётов  

## 🔧 Отладка

### Логи сервисов:
```bash
docker-compose logs airflow-scheduler
docker-compose logs reports-service  
docker-compose logs bionicpro-auth
```

### Статус контейнеров:
```bash
docker-compose ps
```

### Очистка и перезапуск:
```bash
docker-compose down -v
docker system prune -f
docker-compose up -d
```

## 📁 Структура проекта

```
├── airflow/                # ETL DAGs и конфигурация
├── bionicpro-auth/         # BFF сервис аутентификации  
├── crm-db/                 # CRM база данных
├── diagrams/               # Архитектурные диаграммы
├── frontend/               # React приложение
├── keycloak/               # Конфигурация Keycloak
├── olap-db/                # ClickHouse OLAP база
├── postgres/               # PostgreSQL OLTP база
├── reports-service/        # API сервис отчётов
└── docker-compose.yaml     # Конфигурация всех сервисов
```

---

**Система готова к продакшену!** 🎉

