#!/usr/bin/env python3
"""
Скрипт для импорта пользователей из CRM в Keycloak
"""
import csv
import requests
import json
import time
from typing import List, Dict

# Конфигурация Keycloak
KEYCLOAK_URL = "http://localhost:8080"
KEYCLOAK_ADMIN_USER = "admin"
KEYCLOAK_ADMIN_PASSWORD = "admin123"
REALM_NAME = "bionicpro"

# Путь к CRM данным
CRM_CSV_PATH = "../crm-db/crm.csv"

class KeycloakUserImporter:
    def __init__(self):
        self.base_url = f"{KEYCLOAK_URL}/admin/realms/{REALM_NAME}"
        self.access_token = None
        
    def get_admin_token(self) -> str:
        """Получить токен администратора Keycloak"""
        token_url = f"{KEYCLOAK_URL}/realms/master/protocol/openid-connect/token"
        
        data = {
            'client_id': 'admin-cli',
            'username': KEYCLOAK_ADMIN_USER,
            'password': KEYCLOAK_ADMIN_PASSWORD,
            'grant_type': 'password'
        }
        
        response = requests.post(token_url, data=data)
        
        if response.status_code == 200:
            token_data = response.json()
            self.access_token = token_data['access_token']
            print(f"✅ Получен токен администратора")
            return self.access_token
        else:
            raise Exception(f"❌ Не удалось получить токен: {response.status_code} - {response.text}")
    
    def get_headers(self) -> Dict[str, str]:
        """Получить заголовки для API запросов"""
        if not self.access_token:
            self.get_admin_token()
            
        return {
            'Authorization': f'Bearer {self.access_token}',
            'Content-Type': 'application/json'
        }
    
    def user_exists(self, email: str) -> bool:
        """Проверить, существует ли пользователь с данным email"""
        url = f"{self.base_url}/users"
        params = {'email': email, 'exact': 'true'}
        
        response = requests.get(url, headers=self.get_headers(), params=params)
        
        if response.status_code == 200:
            users = response.json()
            return len(users) > 0
        else:
            print(f"⚠️ Ошибка при проверке пользователя {email}: {response.status_code}")
            return False
    
    def create_user(self, user_data: Dict) -> bool:
        """Создать пользователя в Keycloak"""
        url = f"{self.base_url}/users"
        
        # Формируем данные пользователя для Keycloak
        keycloak_user = {
            "username": user_data['email'].split('@')[0],  # username из email
            "email": user_data['email'],
            "firstName": user_data['name'].split(' ')[0] if ' ' in user_data['name'] else user_data['name'],
            "lastName": ' '.join(user_data['name'].split(' ')[1:]) if ' ' in user_data['name'] else '',
            "enabled": True,
            "emailVerified": True,
            "attributes": {
                "crm_user_id": [str(user_data['id'])],
                "age": [str(user_data['age'])],
                "gender": [user_data['gender']],
                "country": [user_data['country']]
            },
            "credentials": [{
                "type": "password",
                "value": "bionicpro123",  # Временный пароль
                "temporary": False
            }]
        }
        
        response = requests.post(url, headers=self.get_headers(), json=keycloak_user)
        
        if response.status_code == 201:
            print(f"✅ Создан пользователь: {user_data['name']} ({user_data['email']})")
            return True
        else:
            print(f"❌ Ошибка создания пользователя {user_data['email']}: {response.status_code} - {response.text}")
            return False
    
    def read_crm_users(self) -> List[Dict]:
        """Прочитать пользователей из CRM CSV"""
        users = []
        
        try:
            with open(CRM_CSV_PATH, 'r', encoding='utf-8') as file:
                csv_reader = csv.DictReader(file)
                for row in csv_reader:
                    users.append({
                        'id': int(row['id']),
                        'name': row['name'],
                        'email': row['email'],
                        'age': int(row['age']),
                        'gender': row['gender'],
                        'country': row['country']
                    })
            
            print(f"📄 Прочитано {len(users)} пользователей из CRM")
            return users
            
        except Exception as e:
            print(f"❌ Ошибка чтения CRM файла: {e}")
            return []
    
    def import_users(self, limit: int = None) -> Dict[str, int]:
        """Импортировать пользователей из CRM в Keycloak"""
        print("🚀 Начинаем импорт пользователей из CRM в Keycloak...")
        
        # Получаем токен
        self.get_admin_token()
        
        # Читаем пользователей из CRM
        crm_users = self.read_crm_users()
        
        if not crm_users:
            return {"created": 0, "skipped": 0, "errors": 0}
        
        # Ограничиваем количество для тестирования
        if limit:
            crm_users = crm_users[:limit]
            print(f"🔢 Ограничение: импортируем только первых {limit} пользователей")
        
        stats = {"created": 0, "skipped": 0, "errors": 0}
        
        for i, user in enumerate(crm_users, 1):
            print(f"\n[{i}/{len(crm_users)}] Обрабатываем: {user['name']} ({user['email']})")
            
            # Проверяем, существует ли пользователь
            if self.user_exists(user['email']):
                print(f"⏭️ Пользователь уже существует: {user['email']}")
                stats["skipped"] += 1
                continue
            
            # Создаем пользователя
            if self.create_user(user):
                stats["created"] += 1
            else:
                stats["errors"] += 1
            
            # Небольшая задержка, чтобы не перегружать Keycloak
            time.sleep(0.1)
        
        return stats

def main():
    print("=" * 60)
    print("🔑 ИМПОРТ ПОЛЬЗОВАТЕЛЕЙ CRM → KEYCLOAK")
    print("=" * 60)
    
    importer = KeycloakUserImporter()
    
    try:
        # Импортируем первых 10 пользователей для тестирования
        stats = importer.import_users(limit=10)
        
        print("\n" + "=" * 60)
        print("📊 РЕЗУЛЬТАТЫ ИМПОРТА:")
        print(f"✅ Создано пользователей: {stats['created']}")
        print(f"⏭️ Пропущено (уже существуют): {stats['skipped']}")
        print(f"❌ Ошибок: {stats['errors']}")
        print("=" * 60)
        
        if stats['created'] > 0:
            print("\n🔐 ДАННЫЕ ДЛЯ ВХОДА:")
            print("   Username: {email без @domain}")
            print("   Password: bionicpro123")
            print("   Пример: alexis.moore / bionicpro123")
        
    except Exception as e:
        print(f"❌ Критическая ошибка: {e}")

if __name__ == "__main__":
    main()
