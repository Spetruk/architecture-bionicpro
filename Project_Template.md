# BionicPRO - Архитектура безопасности

## 🚀 Запуск проекта

```bash
# Запуск всех сервисов
docker-compose up -d

# Проверка статуса
docker-compose ps

# Логи
docker-compose logs -f
```

**Сервисы:**
- Frontend: http://localhost:3000
- Keycloak: http://localhost:8080 (admin/admin123)
- LDAP: localhost:389

## 👥 Тестовые пользователи

### Keycloak пользователи:
- `buyer` / `buyer123` (покупатель)
- `testuser` / `password123` (пилот протеза)

### LDAP пользователи:
- `john.doe` / `password` (роль: prothetic_user)
- `jane.smith` / `password` (роль: user)
- `alex.johnson` / `password` (роль: prothetic_user)

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

## 📊 Архитектура

**Схема:** [`diagrams/BionicPRO_Security_Enhanced.drawio.xml`](diagrams/BionicPRO_Security_Enhanced.drawio.xml)

**BFF паттерн:**
- Frontend → BFF Service → Keycloak
- Токены не передаются на фронтенд
- Session cookies для аутентификации
- Redis для хранения сессий

