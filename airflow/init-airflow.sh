echo "Инициализация Airflow..."

echo "Выполняем миграции..."
docker-compose run --rm airflow-webserver airflow db migrate

echo "Создаём стандартные подключения..."
docker-compose run --rm airflow-webserver airflow connections create-default-connections

echo "👤 Создаём пользователя admin..."
docker-compose run --rm airflow-webserver airflow users create \
    --username admin \
    --firstname Admin \
    --lastname User \
    --role Admin \
    --email admin@example.com \
    --password admin

echo "Airflow инициализирован!"
echo "Логин: admin"
echo "Пароль: admin"