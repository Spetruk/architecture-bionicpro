# 🦾 BionicPRO Reports System - Project Template

## 🔐 Задание 1: Повышение безопасности системы

### ✅ Реализовано:

#### **Диаграмма архитектуры системы**
- 📁 `diagrams/BionicPRO_Security_Enhanced.drawio.xml` - архитектура безопасности
- 🏗️ **Паттерн BFF** (Backend for Frontend) с централизованным IAM
- 🌐 **Региональные хранилища** данных (Russian, EU, US)
- 🔒 **Безопасная схема токенов** - токены IdP не попадают на фронтенд

#### **PKCE Flow реализация**
- 📁 `bionicpro-auth/services/keycloak_service.py` - PKCE интеграция
- 🔑 **Proof Key for Code Exchange** для защиты от атак перехвата
- 🛡️ **Динамическая генерация** code_verifier и code_challenge
- ✅ **Безопасность для SPA** приложений

#### **Backend сервис (BFF)**
- 📁 `bionicpro-auth/` - Backend for Frontend сервис
- 🎫 **Получение токенов** от Keycloak через PKCE
- 🍪 **Генерация пользовательских сессий** (Redis)
- 🔄 **Обновление токенов** автоматически
- 🚪 **Безопасный logout** с отзывом токенов

#### **Frontend изменения**
- 📁 `frontend/src/auth/BFFAuthService.ts` - работа с сессиями
- 🚫 **Убрана прямая интеграция** с Keycloak
- 🍪 **Сессионная аутентификация** вместо токенов
- 🔐 **Защищённые API вызовы** через BFF

#### **Keycloak конфигурация**
- 📁 `keycloak/realm-export-auto.json` - экспорт realm после настройки
- 🏢 **LDAP интеграция** для корпоративных пользователей
- 🎯 **Яндекс ID OAuth 2.0** через прокси-сервис
- 👥 **CRM пользователи** с маппингом email → user_id

#### **Яндекс ID интеграция**
- 📁 `keycloak-yandex-proxy/` - прокси для модификации OAuth scopes
- 🌐 **OAuth 2.0 провайдер** Яндекс ID в Keycloak
- 🔧 **Убран openid scope** для совместимости
- ✅ **Identity Provider** настроен и работает

---

## 📊 Задание 2: Разработка сервиса отчётов

### ✅ Реализовано:

#### **Диаграмма архитектуры системы**
- 📁 `diagrams/BionicPRO_Reports_Architecture.drawio.xml` - архитектура отчётов
- 🔄 **ETL процесс** Airflow → CRM + Telemetry → OLAP
- 📈 **Витрина данных** для быстрого доступа к отчётам

#### **Airflow ETL система**
- 📁 `airflow/` - отдельная папка со всем кодом Airflow
- 📁 `airflow/dags/bionicpro_etl_dag.py` - DAG для ETL процесса
- ⏰ **Расписание**: `@daily` автоматический запуск
- 🔄 **Источники данных**: CRM (PostgreSQL) + Телеметрия (ClickHouse)
- 📊 **Витрина**: `reports_data_mart` с агрегированными данными

#### **Reports API (ClickHouse)**
- 📁 `reports-service/` - FastAPI сервис отчётов
- 📁 `reports-service/services/clickhouse_service.py` - подключение к ClickHouse
- 🎯 **Фактический сбор данных** из OLAP без вычислений в реальном времени
- 📈 **Endpoints**:
  - `/reports/user/{user_id}` - детальный отчёт
  - `/reports/user/{user_id}/summary` - краткая сводка
  - `/reports/data-availability` - доступность данных

---

## 🚀 Быстрый запуск

```bash
# Запуск системы
docker-compose up -d

# Проверка ETL
curl http://localhost:8090  # Airflow UI

# Проверка API
curl http://localhost:8002/health

# Проверка витрины
docker exec bionicpro-olap-db clickhouse-client --query "SELECT COUNT(*) FROM bionicpro_analytics.reports_data_mart"
```

## 👥 Тестовые пользователи

| Username | Password | CRM ID | Данные |
|----------|----------|---------|---------|
| `alexis.moore` | `bionicpro123` | 1 | Alexis Moore |
| `paige.gonzales` | `bionicpro123` | 2 | Paige Gonzales |
| `theresa.kelly` | `bionicpro123` | 3 | Theresa Kelly |

## 🌐 Сервисы

| Сервис | URL | Логин/Пароль |
|--------|-----|--------------|
| **Frontend** | http://localhost:3000 | Через Keycloak |
| **Airflow** | http://localhost:8090 | admin/admin123 |
| **Reports API** | http://localhost:8002 | Через BFF |
| **Keycloak** | http://localhost:8080 | admin/admin123 |
