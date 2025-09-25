"""
BionicPRO ETL DAG
Извлекает данные из CRM PostgreSQL и телеметрию из ClickHouse OLAP, объединяет их и создает витрину отчетов
"""

from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python_operator import PythonOperator
from airflow.providers.postgres.operators.postgres import PostgresOperator
from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow.providers.http.sensors.http import HttpSensor
import pandas as pd
import logging
import requests
import json

# Настройки по умолчанию для DAG
default_args = {
    'owner': 'bionicpro-team',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
    'catchup': False
}

# Определение DAG
dag = DAG(
    'bionicpro_etl_reports',
    default_args=default_args,
    description='ETL процесс для подготовки витрины отчётов BionicPRO',
    schedule_interval='@daily',  # Запуск каждый день в полночь
    max_active_runs=1,
    tags=['bionicpro', 'etl', 'reports']
)

def extract_crm_data(**context):
    """
    Извлечение данных из CRM базы данных
    """
    logging.info("Начинаем извлечение данных из CRM")
    
    # Подключение к CRM PostgreSQL
    crm_hook = PostgresHook(postgres_conn_id='crm_postgres')
    
    # SQL запрос для извлечения данных клиентов
    sql_query = """
    SELECT 
        id as customer_id,
        name as customer_name,
        email,
        age,
        gender,
        country,
        address,
        phone
    FROM customers
    """
    
    # Получаем все данные для тестирования
    df_crm = crm_hook.get_pandas_df(sql_query)
    
    logging.info(f"Извлечено {len(df_crm)} записей из CRM")
    
    # Сохраняем в XCom для следующих задач
    return df_crm.to_json(orient='records')

def extract_telemetry_data(**context):
    """
    Извлечение телеметрии из ClickHouse OLAP базы данных
    """
    logging.info("Начинаем извлечение телеметрии из ClickHouse OLAP")
    
    # URL для ClickHouse HTTP API
    clickhouse_url = "http://olap_db:8123"
    
    # SQL запрос для извлечения телеметрии из ClickHouse
    sql_query = """
    SELECT 
        user_id,
        prosthesis_type,
        muscle_group,
        signal_frequency,
        signal_duration,
        signal_amplitude,
        signal_time as recorded_at,
        80 as battery_level,
        'grip' as movement_type,
        90.0 as movement_accuracy
    FROM emg_sensor_data
    ORDER BY user_id, signal_time
    """
    
    try:
        # Выполняем запрос к ClickHouse через HTTP API
        response = requests.post(
            f"{clickhouse_url}/?database=bionicpro_analytics&default_format=JSONCompact",
            data=sql_query
        )
        
        if response.status_code != 200:
            raise Exception(f"ClickHouse query failed: {response.text}")
        
        # Парсим JSON ответ от ClickHouse
        data = response.json()
        
        # Создаем DataFrame из полученных данных
        columns = ['user_id', 'prosthesis_type', 'muscle_group', 'signal_frequency', 
                  'signal_duration', 'signal_amplitude', 'recorded_at', 'battery_level', 
                  'movement_type', 'movement_accuracy']
        
        df_telemetry = pd.DataFrame(data['data'], columns=columns)
        
        logging.info(f"Извлечено {len(df_telemetry)} записей телеметрии из ClickHouse")
        
        return df_telemetry.to_json(orient='records')
        
    except Exception as e:
        logging.error(f"Ошибка при извлечении данных из ClickHouse: {str(e)}")
        # Возвращаем пустой результат в случае ошибки
        return pd.DataFrame().to_json(orient='records')

def transform_and_aggregate_data(**context):
    """
    Трансформация и агрегация данных для витрины отчётов
    """
    logging.info("Начинаем трансформацию данных")
    
    # Получаем данные из предыдущих задач
    crm_json = context['task_instance'].xcom_pull(task_ids='extract_crm_data')
    telemetry_json = context['task_instance'].xcom_pull(task_ids='extract_telemetry_data')
    
    # Преобразуем обратно в DataFrame
    from io import StringIO
    df_crm = pd.read_json(StringIO(crm_json), orient='records')
    df_telemetry = pd.read_json(StringIO(telemetry_json), orient='records')
    
    # Агрегация телеметрии по пользователям за день
    telemetry_daily = df_telemetry.groupby('user_id').agg({
        'signal_frequency': ['mean', 'max', 'min'],
        'signal_duration': ['sum', 'mean'],
        'signal_amplitude': ['mean', 'max'],
        'battery_level': ['mean', 'min'],
        'movement_accuracy': ['mean', 'count'],
        'prosthesis_type': 'first',
        'muscle_group': lambda x: x.value_counts().index[0]  # самая частая группа мышц
    }).round(2)
    
    # Сглаживание колонок после группировки
    telemetry_daily.columns = [
        'avg_signal_frequency', 'max_signal_frequency', 'min_signal_frequency',
        'total_signal_duration', 'avg_signal_duration',
        'avg_signal_amplitude', 'max_signal_amplitude',
        'avg_battery_level', 'min_battery_level',
        'avg_movement_accuracy', 'total_movements',
        'prosthesis_type', 'primary_muscle_group'
    ]
    
    telemetry_daily.reset_index(inplace=True)
    
    # Объединение с данными CRM
    reports_data = telemetry_daily.merge(
        df_crm, 
        left_on='user_id', 
        right_on='customer_id', 
        how='left'
    )
    
    # Добавляем метаданные
    from datetime import datetime
    reports_data['report_date'] = datetime.now().strftime('%Y-%m-%d')
    reports_data['created_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    reports_data['data_quality_score'] = reports_data['total_movements'] / reports_data['total_movements'].max()
    
    # Вычисляем дополнительные метрики
    reports_data['usage_intensity'] = pd.cut(
        reports_data['total_movements'], 
        bins=[0, 100, 500, 1000, float('inf')], 
        labels=['Low', 'Medium', 'High', 'Very High']
    )
    
    reports_data['battery_health'] = pd.cut(
        reports_data['avg_battery_level'],
        bins=[0, 20, 50, 80, 100],
        labels=['Critical', 'Low', 'Good', 'Excellent']
    )
    
    logging.info(f"Подготовлено {len(reports_data)} записей для витрины")
    
    return reports_data.to_json(orient='records')

def load_to_olap(**context):
    """
    Загрузка данных в ClickHouse OLAP базу данных
    """
    logging.info("Начинаем загрузку в OLAP базу данных")
    
    # Получаем трансформированные данные
    reports_json = context['task_instance'].xcom_pull(task_ids='transform_data')
    
    # Используем StringIO для корректного чтения JSON
    from io import StringIO
    df_reports = pd.read_json(StringIO(reports_json), orient='records')
    
    # URL для ClickHouse HTTP API
    clickhouse_url = "http://olap_db:8123"
    
    # Создание таблицы витрины отчётов если не существует
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS reports_data_mart (
        user_id UInt32,
        customer_name String,
        email String,
        age UInt8,
        gender String,
        country String,
        prosthesis_type String,
        primary_muscle_group String,
        avg_signal_frequency Float32,
        max_signal_frequency Float32,
        min_signal_frequency Float32,
        total_signal_duration Float32,
        avg_signal_duration Float32,
        avg_signal_amplitude Float32,
        max_signal_amplitude Float32,
        total_movements UInt32,
        usage_intensity String,
        data_quality_score Float32,
        report_date Date,
        created_at DateTime
    ) ENGINE = ReplacingMergeTree()
    ORDER BY (user_id, report_date)
    """
    
    # Создаем таблицу через HTTP API
    response = requests.post(
        f"{clickhouse_url}/?database=bionicpro_analytics",
        data=create_table_sql
    )
    
    if response.status_code != 200:
        raise Exception(f"Failed to create table: {response.text}")
    
    # Используем более простой подход - CSV формат
    csv_lines = []
    for _, row in df_reports.iterrows():
        # Упрощенная структура под нашу таблицу (20 полей)
        csv_line = f"{int(row['user_id'])}\t{str(row['customer_name'])}\t{str(row['email'])}\t{int(row['age']) if pd.notna(row['age']) else 25}\t{str(row['gender'])}\t{str(row['country'])}\t{str(row['prosthesis_type'])}\t{str(row['primary_muscle_group'])}\t{float(row['avg_signal_frequency'])}\t{float(row['max_signal_frequency'])}\t{float(row['min_signal_frequency'])}\t{float(row['total_signal_duration'])}\t{float(row['avg_signal_duration'])}\t{float(row['avg_signal_amplitude'])}\t{float(row['max_signal_amplitude'])}\t{int(row['total_movements'])}\t{str(row['usage_intensity'])}\t{float(row['data_quality_score'])}\t{str(row['report_date'])}\t{str(row['created_at'])}"
        csv_lines.append(csv_line)
    
    csv_data = '\n'.join(csv_lines)
    
    # Вставка данных через HTTP API используя CSV формат
    response = requests.post(
        f"{clickhouse_url}/?database=bionicpro_analytics&query=INSERT INTO reports_data_mart FORMAT TabSeparated",
        data=csv_data,
        headers={'Content-Type': 'text/plain'}
    )
    
    if response.status_code != 200:
        raise Exception(f"Failed to insert data: {response.text}")
    
    logging.info(f"Загружено {len(csv_lines)} записей в OLAP базу данных")
    
    return f"Успешно загружено {len(csv_lines)} записей"

def data_quality_check(**context):
    """
    Проверка качества данных в витрине
    """
    logging.info("Проверяем качество данных в витрине")
    
    clickhouse_url = "http://olap_db:8123"
    
    # Проверки качества данных
    checks = [
        "SELECT COUNT(*) as total_records FROM reports_data_mart WHERE report_date = today()",
        "SELECT COUNT(*) as null_users FROM reports_data_mart WHERE user_id = 0 AND report_date = today()",
        "SELECT AVG(data_quality_score) as avg_quality FROM reports_data_mart WHERE report_date = today()"
    ]
    
    results = {}
    for i, check in enumerate(checks):
        response = requests.post(
            f"{clickhouse_url}/?database=bionicpro_analytics&default_format=JSONCompact",
            data=check
        )
        if response.status_code == 200:
            data = response.json()
            if data['data']:
                results[f'check_{i}'] = data['data'][0][0]
            else:
                results[f'check_{i}'] = 0
        else:
            logging.error(f"Failed to execute check: {check}")
            results[f'check_{i}'] = 0
    
    logging.info(f"Результаты проверки качества: {results}")
    
    # Проверяем критические условия
    if results['check_0'] == 0:
        raise ValueError("Нет данных за сегодняшний день в витрине")
    
    if results['check_1'] / results['check_0'] > 0.1:  # Более 10% записей с null user_id
        raise ValueError("Слишком много записей с некорректными user_id")
    
    if results['check_2'] < 0.5:  # Средний показатель качества ниже 50%
        logging.warning("Низкое качество данных, но продолжаем")
    
    return "Проверка качества данных пройдена"

# Определение задач
extract_crm_task = PythonOperator(
    task_id='extract_crm_data',
    python_callable=extract_crm_data,
    dag=dag
)

extract_telemetry_task = PythonOperator(
    task_id='extract_telemetry_data',
    python_callable=extract_telemetry_data,
    dag=dag
)

transform_task = PythonOperator(
    task_id='transform_data',
    python_callable=transform_and_aggregate_data,
    dag=dag
)

load_task = PythonOperator(
    task_id='load_to_olap',
    python_callable=load_to_olap,
    dag=dag
)

quality_check_task = PythonOperator(
    task_id='data_quality_check',
    python_callable=data_quality_check,
    dag=dag
)

# Определение зависимостей задач
[extract_crm_task, extract_telemetry_task] >> transform_task >> load_task >> quality_check_task
