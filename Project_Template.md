### Что это
Короткая памятка для проверки проекта: как запустить, кем войти, где смотреть отчёты и Airflow.

### Как запустить
- Требования: Docker + Docker Compose
- Команда: `docker compose up -d --build`
- Основные сервисы после старта:
  - Frontend: http://localhost:3000
  - BFF (Auth): http://localhost:5001
  - Keycloak: http://localhost:8080 (realm: reports-realm)
  - Airflow UI: http://localhost:8083
  - ClickHouse HTTP: http://localhost:8123

### Пользователи (логин/пароль)
- CRM пользователи (MFA обязательно, видят ТОЛЬКО свои отчёты по CRM ID):
  - alexis.moore / bionicpro123
  - paige.gonzales / bionicpro123
  - theresa.kelly / bionicpro123
- LDAP пользователи (MFA обязательно):
  - john.doe / password
  - jane.smith / password
  - alex.johnson / password
- Test пользователи (MFA обязательно):
  - testuser / password123
  - buyer / buyer123

### Аутентификация и логаут
- Войти: на главной странице фронта кнопка «Войти» ведёт на BFF (`/login`) → Keycloak → возврат на фронт
- MFA (TOTP): при первом входе настроить Google Authenticator (6 цифр, 30 сек)
- Выйти: на странице профиля «⎋ Выйти» (BFF `/auth/logout`) — чистит локальную сессию, Keycloak‑сессию и возвращает на фронт

### Отчёты
- После входа откроется дашборд. Для пользователей с CRM ID показывается:
  - Краткая сводка, кнопка «Показать подробный» (данные из ClickHouse витрины)
- Если сводка пустая, значит витрина ещё не построена — см. Airflow ниже

### Airflow (витрина отчётов)
- UI: http://localhost:8083 (Admin/Admin при первом входе; см. логи init)
- Основной DAG: `crm_to_clickhouse_mart_dag` (файл: `airflow/dags/crm_telemetry_dag.py`)
- При первом старте compose:
  - Выполняется миграция БД Airflow
  - После старта webserver/scheduler сервис `airflow-bootstrap` делает unpause + trigger DAG
- Проверка статуса:
  - Откройте DAG в UI → Graph/Logs → дождитесь `success`
- Проверка витрины в ClickHouse:
  - Таблица `default.report_patient_activity_mart` (создаётся DAG‑ом)
  - Пример проверки: `curl "http://localhost:8123/?query=SELECT%20count()%20FROM%20default.report_patient_activity_mart"`

### Архитектура потока отчёта (кратко)
- CRM (PostgreSQL) + телеметрия (ClickHouse `emg_sensor_data`) → Airflow DAG объединяет и агрегирует → пишет витрину `report_patient_activity_mart`
- Backend (reports-api) читает витрину и отдаёт JSON фронту через BFF
- Кеширование файловых отчётов: MinIO + Nginx CDN (dev)

### Порты и быстрые ссылки
- Frontend: http://localhost:3000
- BFF API: http://localhost:5001 (login `/login`, logout `/auth/logout`)
- Reports API (внутренний): http://localhost:5003
- Keycloak: http://localhost:8080/realms/reports-realm
- Airflow: http://localhost:8083
- ClickHouse HTTP: http://localhost:8123

### Наблюдения / Частые причины пустой витрины
- `crm_to_clickhouse_mart_dag` ещё не отработал — проверьте статус в Airflow
- В таблице `emg_sensor_data` нет данных по нужному `user_id`


