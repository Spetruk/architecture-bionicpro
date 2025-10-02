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

# Проверка готовности ClickHouse через HTTP
until curl -s "http://olap_db:8123/?query=SELECT%201" > /dev/null; do
    echo "Ожидание готовности ClickHouse..."
    sleep 10
done

echo "✅ Все сервисы готовы!"

# Снятие DAG с паузы
echo "Снятие DAG с паузы..."
curl -X PATCH "http://airflow-webserver:8080/api/v1/dags/bionicpro_etl_reports" \
  -H "Content-Type: application/json" \
  -u "admin:admin123" \
  -d '{"is_paused": false}'

echo ""

# Запуск ETL DAG
echo "Запуск ETL DAG..."
curl -X POST "http://airflow-webserver:8080/api/v1/dags/bionicpro_etl_reports/dagRuns" \
  -H "Content-Type: application/json" \
  -u "admin:admin123" \
  -d '{
    "dag_run_id": "auto_init_'$(date +%s)'",
    "conf": {}
  }'

echo ""
echo "✅ ETL процесс запущен автоматически!"

