# BionicPRO - Архитектура безопасности

## 🚀 Запуск проекта

```bash
# Запуск всех сервисов
docker-compose up -d

# Проверка статуса
docker-compose ps

# Логи
docker-compose logs -f

# LDAP мапперы настраиваются автоматически
```

**Сервисы:**
- Frontend: http://localhost:3000
- Keycloak: http://localhost:8080 (admin/admin123)
- LDAP: localhost:389
- BFF Auth Service: http://localhost:8001
- Yandex Proxy: http://localhost:8004

## 👥 Тестовые пользователи

### Keycloak пользователи:
- `buyer` / `buyer123` (покупатель) + **MFA обязателен**
- `testuser` / `password123` (пилот протеза) + **MFA обязателен**

### LDAP пользователи:
- `john.doe` / `password` + **MFA обязателен**
- `jane.smith` / `password` + **MFA обязателен**  
- `alex.johnson` / `password` + **MFA обязателен**

### 🆕 Яндекс ID:
- Войдите через **Яндекс ID** на странице входа в Keycloak
- После успешной аутентификации система запросит **согласие на использование данных**
- Профиль пользователя будет сохранен в БД с данными из Яндекса
- **MFA обязателен** для всех пользователей (включая Яндекс ID)

## 🔐 PKCE тестирование

1. Откройте http://localhost:3000
2. Нажмите "Войти"
3. В DevTools → Network проверьте:
   - `code_challenge` в auth запросе
   - `code_verifier` в token запросе
   - Отсутствие `client_secret`

## 🏢 LDAP интеграция

LDAP настроен с пользователями из `ldap/config.ldif`:
- Домен: `dc=example,dc=com`
- Пользователи: `ou=People,dc=example,dc=com`
- Роли: `ou=Groups,dc=example,dc=com`

## 🛡️ MFA (Multi-Factor Authentication)

**Настройка OTP:**
- Все пользователи обязаны настроить TOTP при первом входе
- Поддерживаемые приложения: Google Authenticator, Microsoft Authenticator
- Алгоритм: HMAC-SHA1, 6 цифр, период 30 секунд

**Тестирование MFA:**
1. Войти как `testuser` / `password123`
2. Система потребует настроить OTP
3. Отсканировать QR-код в Google Authenticator
4. Ввести код из приложения
5. При следующих входах потребуется OTP

## 📊 Архитектура

**Схема:** [`diagrams/BionicPRO_Security_Enhanced.drawio.xml`](diagrams/BionicPRO_Security_Enhanced.drawio.xml)

**BFF паттерн:**
- Frontend → BFF Service → Keycloak
- Токены не передаются на фронтенд
- Session cookies для аутентификации
- Redis для хранения сессий

---

## 🎯 Задание 1 - Результаты выполнения

### 1. Диаграмма архитектуры системы
[`diagrams/BionicPRO_Security_Enhanced.drawio.xml`](diagrams/BionicPRO_Security_Enhanced.drawio.xml)

### 2. PKCE flow реализация
- [`bionicpro-auth/services/keycloak_service.py`](bionicpro-auth/services/keycloak_service.py) - генерация code_challenge, обмен токенов
- [`bionicpro-auth/main.py`](bionicpro-auth/main.py) - endpoints для OAuth flow с PKCE

### 3. BFF сервис для токенов и сессий
- [`bionicpro-auth/main.py`](bionicpro-auth/main.py) - основной FastAPI сервис
- [`bionicpro-auth/services/session_service.py`](bionicpro-auth/services/session_service.py) - управление сессиями
- [`bionicpro-auth/services/keycloak_service.py`](bionicpro-auth/services/keycloak_service.py) - интеграция с Keycloak

### 4. Фронтенд для работы с сессиями
- [`frontend/src/auth/BFFAuthService.ts`](frontend/src/auth/BFFAuthService.ts) - сервис аутентификации через BFF
- [`frontend/src/components/LoginButton.tsx`](frontend/src/components/LoginButton.tsx) - компонент входа

### 5. Настроенный Keycloak realm
[`keycloak/realm-export-auto.json`](keycloak/realm-export-auto.json) - realm с PKCE, MFA, LDAP и Яндекс ID

### 6. OAuth 2.0 от Яндекс ID
[`keycloak-yandex-proxy/main.py`](keycloak-yandex-proxy/main.py) - прокси-сервис для интеграции с Яндекс ID

---

