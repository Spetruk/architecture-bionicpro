#!/bin/bash

# Автоматический запуск ETL после готовности системы
echo "🚀 Автоматический запуск ETL процесса..."

# Ожидание готовности всех сервисов
sleep 120

# Проверка готовности Airflow
until curl -s http://airflow-webserver:8080/health > /dev/null; do
    echo "Ожидание готовности Airflow..."
    sleep 10
done

# Проверка готовности ClickHouse
until clickhouse-client --host olap_db --query "SELECT 1" > /dev/null 2>&1; do
    echo "Ожидание готовности ClickHouse..."
    sleep 10
done

# Запуск ETL DAG
echo "Запуск ETL DAG..."
curl -X POST "http://airflow-webserver:8080/api/v1/dags/bionicpro_etl_reports/dagRuns" \
  -H "Content-Type: application/json" \
  -u "admin:admin123" \
  -d '{
    "dag_run_id": "auto_init_'$(date +%s)'",
    "conf": {}
  }'

echo "✅ ETL процесс запущен автоматически!"

