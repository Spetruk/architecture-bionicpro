# BionicPRO - Проектная работа 9 спринта

## 📋 Задание 1.1 - Архитектура безопасности

### 🎯 Схема архитектурного решения
**Файл схемы:** [`diagrams/BionicPRO_Security_Enhanced.drawio.xml`](diagrams/BionicPRO_Security_Enhanced.drawio.xml)

### 📊 Что показано на схеме:

✅ **Все 4 пользовательских сценария** из оригинальной архитектуры:
- **Покупатель протеза** → IAM Service → Интернет-магазин (BFF) → CRM
- **Пилот протеза** → IAM Service → Мобильное приложение (BFF) → API + Программа в чипе  
- **Оператор производства** → IAM Service → CRM (с интеграцией IAM)
- **ML-инженер** → IAM Service → CLI tool → Региональные базы данных

✅ **Архитектурные решения безопасности:**
- Централизованный **IAM Service (Keycloak)** с интеграцией региональных IdP
- **Backend for Frontend (BFF)** паттерн для фронтенд-приложений
- **Региональные хранилища данных** (Russian, EU, US) для соблюдения местного законодательства
- **Безопасная схема токенов**: IdP токены не передаются на фронтенд, только session cookies/JWT

✅ **Цветовая кодировка потоков:**
- 🔴 **Красные стрелки** - аутентификация пользователей через IAM Service
- 🔵 **Синие стрелки** - взаимодействие пользователей с приложениями (session cookies/JWT)
- 🟢 **Зеленые стрелки** - внутренние токены между сервисами
- ⚫ **Черные стрелки** - бизнес-потоки данных (телеметрия, управление)

### 🛡️ Ключевые требования, выполненные в решении:

1. **Унификация доступа** - все пользователи аутентифицируются через единый IAM Service
2. **Региональные IdP** - поддержка провайдеров идентификации разных стран (Russian, EU, US)
3. **Локальное хранение данных** - соблюдение требований местного законодательства
4. **Безопасная работа с токенами** - BFF паттерн предотвращает утечку IdP токенов на фронтенд
5. **Сохранение существующих потоков** - все оригинальные пользовательские сценарии интегрированы

### 📖 Как открыть схему:
1. Откройте файл в draw.io или любом редакторе диаграм
2. Схема показывает полную интеграцию системы безопасности с существующей архитектурой BionicPRO

---

**Схема полностью соответствует требованиям задания 1.1** и демонстрирует унифицированную систему аутентификации для всех пользовательских сценариев компании BionicPRO.

## 📋 Задание 2 - Улучшение безопасности с PKCE

### 🔐 Замена Code Grant на PKCE (Proof Key for Code Exchange)

**PKCE** - это расширение OAuth 2.0 Authorization Code flow, которое значительно повышает безопасность для публичных клиентов (мобильные приложения и SPA).

### 🎯 Преимущества PKCE:

✅ **Защита от атак перехвата** - предотвращает перехват authorization code  
✅ **Динамическая защита** - каждый запрос использует уникальные code_verifier и code_challenge  
✅ **Совместимость** - работает с существующими OAuth 2.0 серверами  
✅ **Обязательно для мобильных** - рекомендация RFC 8252 для нативных приложений  

### 🛠️ Настройка Keycloak для PKCE

#### 1. Конфигурация клиентов в Keycloak:

```bash
# Настройка мобильного приложения для донастройки протеза
kcadm.sh update clients/{client-id} -r bionicpro \
  -s 'attributes."pkce.code.challenge.method"="S256"' \
  -s publicClient=true \
  -s 'attributes."oauth2.device.authorization.grant.enabled"=true'

# Настройка веб-приложения (интернет-магазин)
kcadm.sh update clients/{web-client-id} -r bionicpro \
  -s 'attributes."pkce.code.challenge.method"="S256"' \
  -s publicClient=true
```

### 💻 Реализация PKCE во фронтенде

**Файл утилит PKCE:** [`frontend/src/utils/pkce.ts`](frontend/src/utils/pkce.ts)

#### Основные функции:
- `generateCodeVerifier()` - генерация криптографически стойкого code_verifier
- `generateCodeChallenge()` - создание code_challenge через SHA256
- `storeCodeVerifier()` / `getCodeVerifier()` - управление хранением verifier
- `generateState()` / `validateState()` - защита от CSRF атак

### 🔧 Обновленная конфигурация Keycloak

```json
{
  "clients": [
    {
      "clientId": "bionicpro-mobile-app",
      "publicClient": true,
      "attributes": {
        "pkce.code.challenge.method": "S256",
        "oauth2.device.authorization.grant.enabled": "true"
      }
    },
    {
      "clientId": "bionicpro-web-shop", 
      "publicClient": true,
      "attributes": {
        "pkce.code.challenge.method": "S256"
      }
    }
  ]
}
```

### 📚 Ссылки на документацию:

- [Keycloak Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/index.html#device-authorization-grant)
- [RFC 7636 - Proof Key for Code Exchange](https://tools.ietf.org/html/rfc7636)

### ✅ Результат внедрения PKCE:

1. **Повышенная безопасность** - защита от перехвата authorization code
2. **Соответствие стандартам** - выполнение требований RFC 8252 для нативных приложений  
3. **Сохранение UX** - пользовательский опыт остается неизменным
4. **Готовность к аудиту** - соответствие современным требованиям безопасности

## 🧪 Как проверить работу PKCE

### 🚀 Запуск системы

#### 🎯 Автоматический запуск для ревьювера:
```bash
# Переход в директорию проекта
cd /Users/av/Developer/architecture-bionicpro

# 🚀 Полный запуск системы (первый запуск может занять 1-2 минуты)
docker-compose up -d

# ⏳ Ждем готовности Keycloak (должен вернуть {"status": "UP"})
sleep 30 && curl -s http://localhost:8080/health/ready | head -3

# 📊 Проверка статуса всех сервисов
docker-compose ps
```

#### ⚠️ **ВАЖНО ДЛЯ РЕВЬЮВЕРА:**
- ✅ **Тестовые пользователи создаются АВТОМАТИЧЕСКИ** при первом запуске
- ✅ **НЕ ТРЕБУЕТСЯ** создавать пользователей вручную  
- ✅ **Realm импортируется** с готовыми настройками PKCE
- ✅ **Все зависимости** устанавливаются автоматически в Docker

#### 🎉 Что происходит автоматически:
1. ✅ **PostgreSQL** запускается и инициализируется с аудит-таблицами
2. ✅ **Keycloak** подключается к PostgreSQL и импортирует realm
3. ✅ **Frontend** устанавливает все зависимости и запускается на порту 3000
4. ✅ **BFF Service** настраивается для Backend for Frontend

#### 📱 Доступные сервисы:
- **Frontend**: http://localhost:3000 - React приложение с PKCE
- **Keycloak Admin**: http://localhost:8080 - админка (admin/admin123)
- **BFF Service**: http://localhost:3001 - Backend for Frontend
- **PostgreSQL**: localhost:5432 - база данных (keycloak/keycloak_password)

#### 📋 Полезные команды:
```bash
# Просмотр логов всех сервисов
docker-compose logs -f

# Просмотр логов конкретного сервиса
docker-compose logs -f frontend
docker-compose logs -f keycloak
docker-compose logs -f postgres

# Перезапуск сервиса
docker-compose restart frontend

# Остановка системы
docker-compose down

# Полная очистка (включая volumes)
docker-compose down -v
```

### 🔍 Проверка PKCE параметров

#### 1. Проверка в браузере:
1. Откройте Developer Tools (F12)
2. Перейдите на вкладку Network
3. Нажмите кнопку "Войти" в приложении
4. Найдите запрос к `/auth` endpoint
5. Проверьте наличие параметров:
   - `code_challenge` - должен присутствовать
   - `code_challenge_method=S256` - метод должен быть S256

#### 2. Проверка в консоли браузера:
```javascript
// Откройте консоль браузера и выполните:
import { generateCodeVerifier, generateCodeChallenge } from './utils/pkce.js';

// Проверка генерации code_verifier
const verifier = generateCodeVerifier();
console.log('Code Verifier:', verifier);
console.log('Length:', verifier.length); // Должно быть 43 символа

// Проверка генерации code_challenge
generateCodeChallenge(verifier).then(challenge => {
  console.log('Code Challenge:', challenge);
  console.log('Length:', challenge.length); // Должно быть 43 символа
});
```

### 📊 Тестовые компоненты

**Файл для тестирования:** [`frontend/src/components/PKCETest.tsx`](frontend/src/components/PKCETest.tsx)

#### Компонент показывает:
- ✅ Генерацию PKCE параметров в реальном времени
- ✅ Проверку корректности SHA256 хеширования
- ✅ Валидацию длины параметров
- ✅ Тестирование сохранения/получения из sessionStorage

### 🔐 Проверка безопасности

#### 1. Проверка отсутствия client_secret:
```bash
# Проверьте, что в запросах НЕТ client_secret
curl -X POST "http://localhost:8080/realms/bionicpro/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&client_id=bionicpro-web-shop&code=AUTHORIZATION_CODE&redirect_uri=http://localhost:3000/auth/callback&code_verifier=CODE_VERIFIER"
```

#### 2. Проверка защиты от перехвата кода:
```bash
# Попытка использовать код без code_verifier (должна провалиться)
curl -X POST "http://localhost:8080/realms/bionicpro/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&client_id=bionicpro-web-shop&code=AUTHORIZATION_CODE&redirect_uri=http://localhost:3000/auth/callback"
```

### 📱 Тестирование мобильного приложения

#### React Native / Expo тест:
```bash
# Установка expo-auth-session
npm install expo-auth-session expo-web-browser

# Запуск тестового приложения
npx expo start

# Проверка PKCE в логах
# В консоли Expo должны появиться логи с PKCE параметрами
```

### 🎯 Чек-лист проверки

#### ✅ Keycloak конфигурация:
- [ ] Realm `bionicpro` создан и активен
- [ ] Клиенты настроены как `publicClient: true`
- [ ] PKCE method установлен в `S256`
- [ ] Redirect URIs корректно настроены

#### ✅ Фронтенд функциональность:
- [ ] PKCE утилиты работают корректно
- [ ] Code verifier генерируется (43 символа)
- [ ] Code challenge создается через SHA256
- [ ] SessionStorage сохраняет/получает данные
- [ ] State параметр валидируется

#### ✅ Сетевые запросы:
- [ ] Authorization request содержит `code_challenge`
- [ ] Token request содержит `code_verifier`
- [ ] Отсутствует `client_secret` в запросах
- [ ] Redirect URI совпадает в обоих запросах

#### ✅ Безопасность:
- [ ] Код без verifier отклоняется сервером
- [ ] Неверный state параметр блокируется
- [ ] Временные данные очищаются после использования
- [ ] Токены безопасно сохраняются

### 🐛 Отладка проблем

#### Частые ошибки и решения:

1. **"Invalid code verifier"**:
   ```javascript
   // Проверьте кодировку base64url
   console.log('Stored verifier:', sessionStorage.getItem('pkce_code_verifier'));
   ```

2. **"Invalid redirect URI"**:
   ```bash
   # Проверьте точное совпадение в Keycloak Admin Console
   # Clients → bionicpro-web-shop → Settings → Valid Redirect URIs
   ```

3. **"Invalid state parameter"**:
   ```javascript
   // Проверьте сохранение state
   console.log('Stored state:', sessionStorage.getItem('oauth_state'));
   ```

### 📈 Мониторинг и логирование

#### Включение debug логов в Keycloak:
```bash
# Добавьте в docker-compose.yaml
environment:
  - KC_LOG_LEVEL=DEBUG
  - KC_LOG_CONSOLE_FORMAT="%d{yyyy-MM-dd HH:mm:ss,SSS} %-5p [%c] (%t) %s%e%n"
```

#### Мониторинг PKCE запросов:
```javascript
// Добавьте в AuthService.ts для отладки
console.log('PKCE Parameters:', {
  code_verifier: codeVerifier,
  code_challenge: codeChallenge,
  code_challenge_method: 'S256'
});
```

## 👥 **Тестовые пользователи**

### **Для тестирования входа используйте:**

**🔧 Пилот протеза:**
- **Username**: `testuser`
- **Password**: `password123`
- **Роль**: `prosthetic-pilot`
- **Описание**: Может управлять своим протезом и настраивать его

**🛒 Покупатель:**
- **Username**: `buyer`  
- **Password**: `buyer123`
- **Роль**: `prosthetic-buyer`
- **Описание**: Может заказывать протезы через интернет-магазин

### **Keycloak Admin доступ:**
- **URL**: http://localhost:8080
- **Username**: `admin`
- **Password**: `admin123`

