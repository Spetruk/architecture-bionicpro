### Как запустить
- Требования: Docker + Docker Compose
- Команда: `docker-compose up -d --build`
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
- Для входа через Яндекс MFA не нужен



