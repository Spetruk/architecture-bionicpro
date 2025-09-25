# 📊 Настройка системы отчётов BionicPRO

## 🚀 Быстрый старт

### 1. Запуск всех сервисов
```bash
# Запуск основных сервисов + система отчётов
docker-compose up -d

# Проверка статуса
docker-compose ps
```

### 2. Доступ к сервисам
- **Frontend:** http://localhost:3000 (кнопка "Отчёты" в Dashboard)
- **BFF Auth Service:** http://localhost:8001 (проксирует /api/reports/*)
- **Reports Service:** http://localhost:8002 (прямой доступ)
- **Apache Airflow:** http://localhost:8090 (airflow/airflow123)
- **ClickHouse:** http://localhost:8123
- **MinIO Console:** http://localhost:9001 (minio_user/minio_password)

### 3. Тестирование отчётов
1. Войдите в систему через http://localhost:3000
2. Перейдите на вкладку "📊 Отчёты"
3. Выберите период и нажмите "Сгенерировать"
4. Скачайте отчёт в нужном формате

## 🏗️ Архитектура системы отчётов

### ETL Pipeline
```
CRM DB (PostgreSQL) ──┐
                      ├─→ Apache Airflow ──→ OLAP DB (ClickHouse)
OLTP DB (PostgreSQL) ─┘                      │
                                             ├─→ Reports Data Mart
                                             │
Reports Service ←────────────────────────────┘
     │
     ├─→ BFF Auth Service ──→ Frontend
     └─→ MinIO (file storage)
```

### Компоненты

#### 1. **Apache Airflow** (порт 8090)
- **DAG:** `bionicpro_etl_dag.py`
- **Расписание:** @daily (каждый день в полночь)
- **Процесс:**
  1. Extract: CRM данные + телеметрия OLTP
  2. Transform: агрегация по пользователям
  3. Load: витрина в ClickHouse
  4. Quality Check: проверка качества данных

#### 2. **Reports Service** (порт 8002)
- **API endpoints:**
  - `GET /reports/user/{user_id}` - полный отчёт
  - `GET /reports/user/{user_id}/summary` - краткая сводка  
  - `GET /reports/user/{user_id}/download` - скачивание файла
  - `GET /reports/data-availability` - информация о данных

#### 3. **ClickHouse OLAP** (порт 8123/9000)
- **Таблица:** `reports_data_mart`
- **Структура:** объединённые данные CRM + телеметрия
- **Оптимизация:** ReplacingMergeTree по (user_id, report_date)

#### 4. **MinIO Storage** (порт 9000/9001)
- Хранение сгенерированных файлов отчётов
- Поддержка форматов: PDF, Excel, CSV

## 🔐 Безопасность

### Модель доступа
1. **Аутентификация:** через BFF Auth Service
2. **Авторизация:** пользователь может получать только свои отчёты
3. **Проксирование:** все запросы идут через BFF (токены не раскрываются)
4. **Валидация:** проверка временных рамок (только обработанные данные)

### Проверки безопасности
```typescript
// Фронтенд → BFF → Reports Service
GET /api/reports/user/123  // ✅ Только свои данные
GET /api/reports/user/456  // ❌ 403 Forbidden
```

## 📈 Мониторинг и отладка

### Логи сервисов
```bash
# Airflow
docker-compose logs -f airflow-webserver
docker-compose logs -f airflow-scheduler

# Reports Service
docker-compose logs -f reports-service

# ClickHouse
docker-compose logs -f olap_db
```

### Проверка ETL процесса
1. **Airflow UI:** http://localhost:8090
   - Статус DAG `bionicpro_etl_reports`
   - Логи выполнения задач
   
2. **ClickHouse:** проверка данных
```sql
-- Подключение к ClickHouse
docker exec -it bionicpro-olap-db clickhouse-client

-- Проверка витрины
SELECT COUNT(*) FROM bionicpro_analytics.reports_data_mart;
SELECT MAX(report_date) FROM bionicpro_analytics.reports_data_mart;
```

### Тестирование API
```bash
# Через BFF (требует аутентификации)
curl -X GET "http://localhost:8001/api/reports/data-availability" \
  --cookie "bionicpro_session=your_session_id"

# Прямо к Reports Service (требует Bearer token)
curl -X GET "http://localhost:8002/reports/data-availability" \
  -H "Authorization: Bearer your_token"
```

## 🛠️ Разработка

### Структура проекта
```
├── airflow/
│   ├── dags/bionicpro_etl_dag.py     # ETL процесс
│   └── requirements.txt              # Зависимости Airflow
├── reports-service/
│   ├── app/main.py                   # FastAPI приложение
│   ├── services/clickhouse_service.py # Работа с OLAP
│   ├── services/auth_service.py      # Авторизация
│   └── models/report_models.py       # Модели данных
├── frontend/src/
│   ├── components/ReportsComponent.tsx # UI компонент
│   └── services/ReportsService.ts    # API клиент
└── diagrams/
    └── BionicPRO_Reports_Architecture.drawio.xml # Архитектура
```

### Добавление новых метрик
1. Обновите ETL DAG в `airflow/dags/bionicpro_etl_dag.py`
2. Измените схему витрины в ClickHouse
3. Обновите модели в `reports-service/models/`
4. Добавьте логику в `clickhouse_service.py`

### Тестирование изменений
```bash
# Пересборка сервисов
docker-compose build reports-service
docker-compose up -d reports-service

# Перезапуск Airflow DAG
# Через UI: http://localhost:8090
```

## ⚡ Производительность

### Оптимизация ClickHouse
- Партиционирование по дате
- Индексы по user_id
- Сжатие данных
- TTL для старых данных

### Масштабирование
- Горизонтальное масштабирование Reports Service
- Кластер ClickHouse для больших данных
- Redis Cluster для сессий
- Load Balancer для высокой доступности

## 🐛 Устранение неполадок

### Частые проблемы

1. **Нет данных в отчётах**
   - Проверьте статус ETL в Airflow
   - Убедитесь что данные есть в CRM и OLTP
   - Проверьте доступность ClickHouse

2. **Ошибки авторизации**
   - Проверьте сессию в BFF
   - Убедитесь что user_id совпадает
   - Проверьте токены в Redis

3. **Медленные запросы**
   - Оптимизируйте запросы в ClickHouse
   - Добавьте индексы
   - Уменьшите период отчёта

### Полезные команды
```bash
# Полная перезагрузка
docker-compose down -v
docker-compose up -d

# Проверка подключений
docker-compose exec reports-service curl http://olap_db:8123
docker-compose exec bionicpro-auth curl http://reports-service:8002/health

# Очистка данных
docker volume prune
```

