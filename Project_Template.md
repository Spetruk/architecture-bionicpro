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

## 👥 Тестовые пользователи

### Keycloak пользователи:
- `buyer` / `buyer123` (покупатель) + **MFA обязателен**
- `testuser` / `password123` (пилот протеза) + **MFA обязателен**

### LDAP пользователи:
- `john.doe` / `password` + **MFA обязателен**
- `jane.smith` / `password` + **MFA обязателен**  
- `alex.johnson` / `password` + **MFA обязателен**

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

