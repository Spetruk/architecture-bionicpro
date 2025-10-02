from datetime import datetime, timedelta
import pandas as pd
import json
from collections import Counter
from io import StringIO
import logging
import csv
from airflow import DAG
from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow_clickhouse_plugin.hooks.clickhouse import ClickHouseHook
from airflow.operators.python_operator import PythonOperator
from helper import xcom_to_df, df_to_xcom, parse_datetime

# На случай, если придётся понадобится ETL по генирации отчета для одного пользователя
default_args = {
    'owner': 'data_engineer',
    'depends_on_past': False,
    'start_date': datetime(2025, 4, 5),
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    'crm_to_clickhouse_mart_dag_by_userId',
    default_args=default_args,
    description='ETL: CRM + Telemetry → ClickHouse Mart (по одному user_id)',
    schedule_interval=None,  # Запуск вручную или через API
    catchup=False,
    tags=['etl', 'clickhouse', 'crm', 'manual'],
)

# --- TASK Extract Users from PostgreSQL ---
def extract_users(**kwargs):
    ti = kwargs['ti']
    
    # Получаем user_id из conf или переменных Airflow
    user_id = kwargs.get('dag_run').conf.get('user_id') if kwargs.get('dag_run') and kwargs.get('dag_run').conf else None
    if not user_id:
        raise ValueError("Параметр user_id не передан в dag_run.conf")

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise ValueError(f"Некорректный user_id: {user_id}")

    logging.info(f"Извлечение пользователя с user_id={user_id} из PostgreSQL...")
    postgres_hook = PostgresHook(postgres_conn_id='crm_db_conn')
    df = postgres_hook.get_pandas_df("""
        SELECT id AS user_id, name, email, age, gender, country, address, phone 
        FROM customers 
        WHERE id = %(user_id)s;
    """, parameters={'user_id': user_id})

    if df.empty:
        raise ValueError(f"Пользователь с user_id={user_id} не найден в таблице customers.")

    df_to_xcom(df, ti, 'users_data')
    logging.info(f"✅ Извлечён пользователь: user_id={user_id}")
extract_users_task = PythonOperator(
    task_id='extract_users_from_postgres',
    python_callable=extract_users,
    dag=dag,
)

# --- TASK Extract Telemetry from ClickHouse ---
def extract_and_aggregate_telemetry(**kwargs):
    ti = kwargs['ti']
    user_id = kwargs.get('dag_run').conf.get('user_id')
    user_id = int(user_id)

    logging.info(f"Извлечение телеметрии для user_id={user_id} из ClickHouse")

    clickhouse_hook = ClickHouseHook(clickhouse_conn_id='clickhouse_conn')
    columns = ['user_id', 'prosthesis_type', 'muscle_group', 'signal_frequency', 'signal_duration', 'signal_amplitude', 'signal_time']

    query = f"""
        SELECT {", ".join(columns)}
        FROM emg_sensor_data
        WHERE user_id = {user_id}
    """

    try:
        rows = clickhouse_hook.execute(query)
    except Exception as e:
        logging.error(f"Ошибка при выполнении запроса к ClickHouse: {e}")
        raise

    telemetry_df = pd.DataFrame(rows, columns=columns) if rows else pd.DataFrame(columns=columns)

    if telemetry_df.empty:
        agg_df = pd.DataFrame([{
            'user_id': user_id,
            'total_signals': 0,
            'avg_signal_duration_sec': 0.0,
            'avg_signal_amplitude': 0.0,
            'max_frequency': 0.0,
            'last_signal_time': None,
            'muscle_usage_count': '{"unknown": 0}'
        }])
        logging.info(f"⚠️ Нет телеметрии для user_id={user_id}. Созданы нулевые значения.")
    else:
        # Приведение типов
        telemetry_df['user_id'] = pd.to_numeric(telemetry_df['user_id'], errors='coerce').astype('int')
        telemetry_df['signal_time'] = pd.to_datetime(telemetry_df['signal_time'], errors='coerce')

        # Агрегация
        agg = telemetry_df.groupby('user_id').agg({
            'signal_time': ['count', 'max'],
            'signal_duration': 'mean',
            'signal_amplitude': 'mean',
            'signal_frequency': 'max',
            'muscle_group': lambda x: json.dumps(dict(Counter(x.tolist())), ensure_ascii=False)
        }).reset_index()

        agg.columns = ['user_id', 'total_signals', 'last_signal_time', 'avg_signal_duration_sec', 'avg_signal_amplitude', 'max_frequency', 'muscle_usage_count']

        # Замена NaN
        agg['last_signal_time'] = agg['last_signal_time'].where(pd.notna(agg['last_signal_time']), None)
        agg.fillna({
            'avg_signal_duration_sec': 0.0,
            'avg_signal_amplitude': 0.0,
            'max_frequency': 0,
            'muscle_usage_count': '{"unknown": 0}'
        }, inplace=True)

        agg_df = agg

    df_to_xcom(agg_df, ti, 'aggregated_telemetry')
    logging.info(f"✅ Агрегирована телеметрия для user_id={user_id}")
extract_telemetry_task = PythonOperator(
    task_id='extract_telemetry_from_clickhouse',
    python_callable=extract_and_aggregate_telemetry,
    dag=dag,
)

# --- TASK Join CRM and Telemetry ---
def join_crm_telemetry(**kwargs):
    ti = kwargs['ti']
    user_id = int(kwargs.get('dag_run').conf.get('user_id'))

    logging.info(f"🔧 Формирование витрины для user_id={user_id} (ручной сбор)")

    # Получаем данные
    users_df = xcom_to_df(ti, 'extract_users_from_postgres', 'users_data')
    telemetry_df = xcom_to_df(ti, 'extract_telemetry_from_clickhouse', 'aggregated_telemetry')

    if users_df.empty:
        raise ValueError(f"❌ Не удалось загрузить данные CRM для user_id={user_id}")

    # Берём первую (и единственную) строку
    user_row = users_df.iloc[0]

    # Подготовка значений
    row = {
        'user_id': int(user_row['user_id']),
        'name': str(user_row['name']) if pd.notna(user_row['name']) else "",
        'age': int(float(user_row['age'])) if pd.notna(user_row['age']) else 0,
        'gender': str(user_row['gender']) if pd.notna(user_row['gender']) else "",
        'email': str(user_row['email']) if pd.notna(user_row['email']) else "",
        'country': str(user_row['country']) if pd.notna(user_row['country']) else "",

        # Значения по умолчанию
        'total_signals': 0,
        'avg_signal_duration_sec': 0.0,
        'avg_signal_amplitude': 0.0,
        'max_frequency': 0,
        'last_signal_time': None,
        'muscle_usage_count': '{"unknown": 0}'
    }

    # Если есть телеметрия — обновляем
    if not telemetry_df.empty:
        t_row = telemetry_df.iloc[0]
        if pd.notna(t_row['total_signals']):
            row['total_signals'] = int(t_row['total_signals'])
        if pd.notna(t_row['avg_signal_duration_sec']):
            row['avg_signal_duration_sec'] = float(t_row['avg_signal_duration_sec'])
        if pd.notna(t_row['avg_signal_amplitude']):
            row['avg_signal_amplitude'] = float(t_row['avg_signal_amplitude'])
        if pd.notna(t_row['max_frequency']):
            row['max_frequency'] = int(t_row['max_frequency'])
        if 'last_signal_time' in t_row and pd.notna(t_row['last_signal_time']):
            row['last_signal_time'] = t_row['last_signal_time']  # будет datetime или None
        if pd.notna(t_row['muscle_usage_count']) and t_row['muscle_usage_count']:
            row['muscle_usage_count'] = str(t_row['muscle_usage_count'])

    # Создаём DataFrame
    mart_df = pd.DataFrame([row])

    # Явное приведение типов
    mart_df = mart_df.astype({
        'user_id': 'int32',
        'age': 'int32',
        'total_signals': 'int32',
        'avg_signal_duration_sec': 'float32',
        'avg_signal_amplitude': 'float32',
        'max_frequency': 'int32'
    })

    # Логируем результат
    logging.info(f"✅ Сформирована итоговая строка:")
    logging.info(f"\n{mart_df.to_string(index=False)}")

    # Отправляем в XCom
    df_to_xcom(mart_df, ti, 'mart_data')
    logging.info(f"🟢 Витрина успешно создана для user_id={user_id}")
join_task = PythonOperator(
    task_id='join_crm_with_telemetry',
    python_callable=join_crm_telemetry,
    dag=dag,
)

# --- TASK Create Mart Table in ClickHouse ---
def create_mart_table(**kwargs):
    logging.info("Создание таблицы витрины в ClickHouse...")
    clickhouse_hook = ClickHouseHook(clickhouse_conn_id='clickhouse_conn')
    # Удаляем таблицу, если существует
    logging.info("🗑️ Удаление старой таблицы...")
    clickhouse_hook.execute("DROP TABLE IF EXISTS report_patient_activity_mart")
    create_sql = """
    CREATE TABLE IF NOT EXISTS report_patient_activity_mart (
        user_id Int32,
        name String,
        age Int32,
        gender String,
        email String,
        country String,
        total_signals Int32,
        avg_signal_duration_sec Float32,
        avg_signal_amplitude Float32,
        max_frequency Int32,
        last_signal_time DateTime,
        muscle_usage_count String
    ) ENGINE = MergeTree()
    ORDER BY (user_id)
    """
    clickhouse_hook.execute(create_sql)
    logging.info("✅ Таблица витрины создана или уже существует")
create_table_task = PythonOperator(
    task_id='create_mart_table',
    python_callable=create_mart_table,
    dag=dag,
)

# --- TASK Upsert Data to ClickHouse ---
def upsert_mart_data(**kwargs):
    ti = kwargs['ti']
    user_id = int(kwargs.get('dag_run').conf.get('user_id'))

    logging.info(f"Обновление записи в ClickHouse для user_id={user_id}...")

    mart_csv = ti.xcom_pull(task_ids='join_crm_with_telemetry', key='mart_data')
    if not mart_csv:
        raise ValueError("Нет данных для загрузки")

    reader = csv.DictReader(StringIO(mart_csv))
    row = next(reader)  # Только одна строка

    processed_row = (
        int(row['user_id']),
        row['name'],
        int(float(row['age'])) if row['age'] else 0,
        row['gender'],
        row['email'],
        row['country'],
        int(row['total_signals']),
        float(row['avg_signal_duration_sec']),
        float(row['avg_signal_amplitude']),
        int(row['max_frequency']),
        parse_datetime(row['last_signal_time']),
        row['muscle_usage_count']
    )

    clickhouse_hook = ClickHouseHook(clickhouse_conn_id='clickhouse_conn')

    # Удаляем старую запись
    clickhouse_hook.execute("DELETE FROM report_patient_activity_mart WHERE user_id = %(user_id)s", {'user_id': user_id})
    # Вставляем новую
    clickhouse_hook.execute("INSERT INTO report_patient_activity_mart VALUES", [processed_row])

    logging.info(f"✅ Обновлена витрина для user_id={user_id}")
upsert_task = PythonOperator(
    task_id='upsert_mart_to_clickhouse',
    python_callable=upsert_mart_data,
    dag=dag,
)

# === Определение порядка выполнения ===
extract_users_task >> join_task
extract_telemetry_task >> join_task
join_task >> create_table_task >> upsert_task  # Не создаём таблицу каждый раз