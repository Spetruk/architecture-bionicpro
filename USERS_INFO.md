# 👥 Информация о тестовых пользователях BionicPRO

## 🔐 Доступные пользователи в Keycloak

### Пользователь 1: John Doe
- **Email:** john@example.com
- **Username:** john.doe
- **Password:** password123
- **Роли:** prothetic_user
- **Данные в витрине:** user_id = 1 (Alexis Moore, arm_prosthesis)

### Пользователь 2: Jane Smith  
- **Email:** jane@example.com
- **Username:** jane.smith
- **Password:** password123
- **Роли:** prothetic_user
- **Данные в витрине:** user_id = 2 (Paige Gonzales, leg_prosthesis)

### Пользователь 3: Bob Wilson
- **Email:** bob@example.com
- **Username:** bob.wilson
- **Password:** password123
- **Роли:** prothetic_user
- **Данные в витрине:** user_id = 3 (Theresa Kelly, arm_prosthesis)

## 📊 Данные в витрине отчётов

```sql
SELECT user_id, customer_name, prosthesis_type, total_movements 
FROM reports_data_mart ORDER BY user_id;

-- Результат:
-- 1 | Alexis Moore   | arm_prosthesis | 3
-- 2 | Paige Gonzales | leg_prosthesis | 3  
-- 3 | Theresa Kelly  | arm_prosthesis | 2
```

## 🧪 Как протестировать

### 1. Через браузер:
1. Открыть http://localhost:3000
2. Войти через любого пользователя (john@example.com, jane@example.com, bob@example.com)
3. Перейти на вкладку "Отчёты"
4. Нажать кнопки "Загрузить отчёт" или "Показать сводку"

### 2. Через API (после аутентификации):
- `/api/reports/user/1` - данные Alexis Moore
- `/api/reports/user/2` - данные Paige Gonzales  
- `/api/reports/user/3` - данные Theresa Kelly
- `/api/reports/data-availability` - информация о доступности данных

## ⚠️ Примечания

- **Для демо:** Любой аутентифицированный пользователь может получить данные пользователей 1, 2, 3
- **В продакшене:** Нужно настроить правильный маппинг Keycloak UUID → user_id
- **Фронтенд:** Сейчас всегда запрашивает данные user_id=1 для простоты тестирования

## 🔧 Если нужно создать новых пользователей

Зайти в Keycloak Admin Console:
- URL: http://localhost:8080
- Логин: admin / admin
- Realm: bionicpro
- Users → Add User → заполнить данные → Set Password

