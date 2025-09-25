# 🧪 Ручная проверка системы BionicPRO Reports после перезапуска

## 📋 **Чеклист после `docker-compose down -v && docker-compose up -d`:**

### 1️⃣ **Проверка запуска всех сервисов:**
```bash
docker-compose ps
# Все сервисы должны быть в статусе "running" или "healthy"
```

### 2️⃣ **Создание admin пользователя в Airflow:**
```bash
docker exec bionicpro-airflow-webserver airflow users create \
  --username admin \
  --firstname Admin \
  --lastname User \
  --role Admin \
  --email admin@example.com \
  -p admin123
```

### 3️⃣ **Настройка ClickHouse (OLAP база):**
```bash
# Создать базу данных
docker exec bionicpro-olap-db clickhouse-client --query "CREATE DATABASE IF NOT EXISTS bionicpro_analytics"

# Создать таблицу телеметрии
docker exec bionicpro-olap-db clickhouse-client --database bionicpro_analytics --query "
CREATE TABLE IF NOT EXISTS emg_sensor_data (
    user_id UInt32,
    prosthesis_type String,
    muscle_group String,
    signal_frequency UInt32,
    signal_duration UInt32,
    signal_amplitude Decimal(5,2),
    signal_time DateTime
) ENGINE = MergeTree()
ORDER BY (user_id, prosthesis_type, signal_time)"

# Вставить тестовые данные
docker exec bionicpro-olap-db clickhouse-client --database bionicpro_analytics --query "
INSERT INTO emg_sensor_data VALUES 
(1, 'arm_prosthesis', 'biceps', 120, 500, 75.5, '2024-01-15 10:30:00'),
(1, 'arm_prosthesis', 'triceps', 110, 450, 68.2, '2024-01-15 11:00:00'),
(1, 'arm_prosthesis', 'forearm', 130, 520, 82.1, '2024-01-15 11:30:00'),
(2, 'leg_prosthesis', 'quadriceps', 100, 600, 90.5, '2024-01-15 09:00:00'),
(2, 'leg_prosthesis', 'hamstring', 95, 580, 85.3, '2024-01-15 09:30:00'),
(2, 'leg_prosthesis', 'calf', 105, 520, 78.9, '2024-01-15 10:00:00'),
(3, 'arm_prosthesis', 'forearm', 115, 480, 72.1, '2024-01-15 08:30:00'),
(3, 'arm_prosthesis', 'biceps', 130, 520, 81.4, '2024-01-15 09:00:00')"
```

### 4️⃣ **Настройка PostgreSQL (OLTP база):**
```bash
# Создать таблицу телеметрии в основной БД
docker exec bionicpro-postgres psql -U keycloak -d keycloak -c "
CREATE TABLE IF NOT EXISTS telemetry_data (
    user_id INTEGER,
    prosthesis_type VARCHAR(50),
    muscle_group VARCHAR(50), 
    signal_frequency INTEGER,
    signal_duration INTEGER,
    signal_amplitude DECIMAL(5,2),
    recorded_at TIMESTAMP,
    battery_level INTEGER,
    movement_accuracy DECIMAL(5,2)
);"

# Вставить тестовые данные
docker exec bionicpro-postgres psql -U keycloak -d keycloak -c "
INSERT INTO telemetry_data VALUES 
(1, 'arm_prosthesis', 'biceps', 120, 500, 75.5, '2024-01-15 10:30:00', 85, 92.3),
(1, 'arm_prosthesis', 'triceps', 110, 450, 68.2, '2024-01-15 11:00:00', 83, 89.1),
(1, 'arm_prosthesis', 'forearm', 130, 520, 82.1, '2024-01-15 11:30:00', 84, 95.7),
(2, 'leg_prosthesis', 'quadriceps', 100, 600, 90.5, '2024-01-15 09:00:00', 78, 88.4),
(2, 'leg_prosthesis', 'hamstring', 95, 580, 85.3, '2024-01-15 09:30:00', 76, 91.2),
(2, 'leg_prosthesis', 'calf', 105, 520, 78.9, '2024-01-15 10:00:00', 75, 87.6),
(3, 'arm_prosthesis', 'forearm', 115, 480, 72.1, '2024-01-15 08:30:00', 90, 93.8),
(3, 'arm_prosthesis', 'biceps', 130, 520, 81.4, '2024-01-15 09:00:00', 89, 96.2);"
```

### 5️⃣ **Запуск ETL DAG в Airflow:**
```bash
# Зайти в Airflow Web UI
open http://localhost:8090
# Логин: admin, Пароль: admin123

# В UI найти DAG "bionicpro_etl_reports" и нажать кнопку "Trigger DAG"
# Или через командную строку:
docker exec bionicpro-airflow-webserver airflow dags trigger bionicpro_etl_reports
```

### 6️⃣ **Проверка результата ETL:**
```bash
# Подождать 2-3 минуты, затем проверить витрину
docker exec bionicpro-olap-db clickhouse-client --database bionicpro_analytics --query "
SELECT user_id, customer_name, prosthesis_type, total_movements 
FROM reports_data_mart 
ORDER BY user_id"

# Ожидаемый результат: 3 строки с данными пользователей
```

### 7️⃣ **Проверка Reports Service API:**
```bash
# Проверить здоровье сервиса
curl http://localhost:8002/health

# Проверить API (должен вернуть ошибку аутентификации)
curl -X GET "http://localhost:8002/reports/user/1"
# Ожидаемый результат: {"detail":"Authentication failed"}
```

### 8️⃣ **Проверка Frontend UI:**
```bash
# Открыть фронтенд
open http://localhost:3000

# Войти через Keycloak (любой пользователь)
# Перейти на вкладку "Отчёты"
# Проверить работу кнопок генерации отчётов
```

## ✅ **Критерии успешного восстановления:**

1. ✅ Все сервисы запущены и здоровы
2. ✅ Airflow DAG `bionicpro_etl_reports` выполнился успешно  
3. ✅ Витрина `reports_data_mart` содержит 3 записи
4. ✅ Reports Service API отвечает (с ошибкой аутентификации)
5. ✅ Frontend загружается и показывает вкладку "Отчёты"

## 🌐 **Доступные URL после восстановления:**
- **Frontend:** http://localhost:3000
- **Airflow:** http://localhost:8090 (admin/admin123)  
- **Reports API:** http://localhost:8002
- **Keycloak:** http://localhost:8080

## 📋 **Полезные команды для отладки:**
```bash
# Проверить логи Airflow
docker-compose logs airflow-scheduler --tail 50
docker-compose logs airflow-webserver --tail 50

# Проверить статус DAG
docker exec bionicpro-airflow-webserver airflow dags list-runs -d bionicpro_etl_reports

# Проверить содержимое баз данных
docker exec bionicpro-crm-db psql -U crm_user -d crm_db -c "SELECT COUNT(*) FROM customers"
docker exec bionicpro-olap-db clickhouse-client --database bionicpro_analytics --query "SELECT COUNT(*) FROM emg_sensor_data"
```

