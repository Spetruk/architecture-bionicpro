# 🦾 BionicPRO - Архитектура безопасности с PKCE

## 🚀 Быстрый старт для ревьювера

### 1️⃣ Запуск системы:
```bash
# Клонируйте репозиторий и перейдите в директорию
cd architecture-bionicpro

# Запустите всю систему (первый запуск может занять 1-2 минуты)
docker-compose up -d

# Проверьте готовность Keycloak
curl -s http://localhost:8080/health/ready

# Проверьте статус всех сервисов
docker-compose ps
```

### 2️⃣ Тестирование PKCE:

**Откройте браузер:** http://localhost:3000

**Тестовые пользователи (создаются автоматически):**
- **Пилот протеза**: `testuser` / `password123`
- **Покупатель**: `buyer` / `buyer123`

### 3️⃣ Проверка PKCE:
1. F12 → Network tab
2. Нажмите кнопку входа
3. Введите учетные данные
4. Найдите запрос к `/auth` - проверьте параметры `code_challenge` и `code_challenge_method=S256`

---

## 📁 Структура проекта

```
├── diagrams/                          # C4 архитектурные диаграммы
│   └── BionicPRO_Security_Enhanced.drawio.xml
├── frontend/                          # React приложение с PKCE
│   ├── src/auth/AuthService.ts        # OAuth 2.0 + PKCE реализация
│   ├── src/utils/pkce.ts              # PKCE утилиты
│   └── src/components/                # React компоненты
├── keycloak/                          # Keycloak конфигурация
│   └── realm-export-auto.json         # Realm с пользователями и PKCE
├── postgres/                          # PostgreSQL инициализация
│   └── init.sql                       # Схемы для аудита и Keycloak
├── docker-compose.yaml                # Полная автоматизация
└── Project_Template.md                # Подробная документация
```

---

## ✅ Что реализовано

### 🛡️ **Задание 1.1 - Архитектура безопасности:**
- ✅ Backend for Frontend (BFF) паттерн
- ✅ Централизованный IAM сервис (Keycloak)
- ✅ Региональные хранилища данных
- ✅ Безопасная работа с токенами
- ✅ C4 диаграмма с 4 пользовательскими сценариями

### 🔐 **Задание 2 - PKCE реализация:**
- ✅ OAuth 2.0 Code Grant + PKCE в frontend
- ✅ Keycloak настроен с S256 challenge method
- ✅ Автоматическая генерация code_verifier/code_challenge
- ✅ Безопасный обмен токенами
- ✅ Тестовые пользователи создаются автоматически

---

## 🎯 **Ключевые особенности для ревьювера:**

### ⚡ **Полная автоматизация:**
- **НЕ ТРЕБУЕТСЯ** ручная настройка
- **НЕ ТРЕБУЕТСЯ** создание пользователей
- **НЕ ТРЕБУЕТСЯ** установка зависимостей
- Все работает из коробки через `docker-compose up -d`

### 🔍 **Проверка PKCE:**
- Откройте Network tab в браузере
- Найдите запрос к Keycloak `/auth`
- Проверьте параметры: `code_challenge`, `code_challenge_method=S256`
- При обмене кода на токен используется `code_verifier`

### 📊 **Мониторинг:**
- **Frontend**: http://localhost:3000
- **Keycloak Admin**: http://localhost:8080 (admin/admin123)
- **PKCE Test Page**: http://localhost:3000/test
- **Logs**: `docker-compose logs -f keycloak`

---

## 🆘 **Устранение неполадок:**

```bash
# Если что-то не работает, перезапустите систему:
docker-compose down -v
docker-compose up -d --build

# Проверьте логи:
docker-compose logs keycloak
docker-compose logs frontend
```

---

**Система готова к тестированию! 🚀**
