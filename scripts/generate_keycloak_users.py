#!/usr/bin/env python3
"""
Генерация JSON для добавления пользователей в Keycloak realm-export
"""
import csv
import json
import uuid
from typing import List, Dict

# Путь к CRM данным
CRM_CSV_PATH = "crm-db/crm.csv"

def generate_user_json(user_data: Dict) -> Dict:
    """Генерация JSON объекта пользователя для Keycloak"""
    user_id = str(uuid.uuid4())
    username = user_data['email'].split('@')[0]
    first_name = user_data['name'].split(' ')[0] if ' ' in user_data['name'] else user_data['name']
    last_name = ' '.join(user_data['name'].split(' ')[1:]) if ' ' in user_data['name'] else ''
    
    return {
        "id": user_id,
        "createdTimestamp": 1672531200000,  # 2023-01-01
        "username": username,
        "enabled": True,
        "totp": False,
        "emailVerified": True,
        "firstName": first_name,
        "lastName": last_name,
        "email": user_data['email'],
        "attributes": {
            "crm_user_id": [str(user_data['id'])],
            "age": [str(user_data['age'])],
            "gender": [user_data['gender']],
            "country": [user_data['country']]
        },
        "credentials": [{
            "id": str(uuid.uuid4()),
            "type": "password",
            "userLabel": "My password",
            "createdDate": 1672531200000,
            "secretData": '{"value":"$2a$10$example.hash.for.bionicpro123","salt":"example.salt"}',
            "credentialData": '{"hashIterations":27500,"algorithm":"pbkdf2-sha256"}'
        }],
        "disableableCredentialTypes": [],
        "requiredActions": [],
        "realmRoles": ["default-roles-bionicpro"],
        "notBefore": 0,
        "groups": []
    }

def read_crm_users(limit: int = 10) -> List[Dict]:
    """Прочитать пользователей из CRM CSV"""
    users = []
    
    try:
        with open(CRM_CSV_PATH, 'r', encoding='utf-8') as file:
            csv_reader = csv.DictReader(file)
            for i, row in enumerate(csv_reader):
                if limit and i >= limit:
                    break
                    
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

def main():
    print("=" * 60)
    print("🔑 ГЕНЕРАЦИЯ ПОЛЬЗОВАТЕЛЕЙ ДЛЯ KEYCLOAK")
    print("=" * 60)
    
    # Читаем первых 10 пользователей из CRM
    crm_users = read_crm_users(limit=10)
    
    if not crm_users:
        print("❌ Не удалось прочитать пользователей из CRM")
        return
    
    # Генерируем JSON для пользователей
    keycloak_users = []
    for user in crm_users:
        keycloak_user = generate_user_json(user)
        keycloak_users.append(keycloak_user)
        print(f"✅ Сгенерирован: {user['name']} ({user['email']}) -> {keycloak_user['username']}")
    
    # Сохраняем в файл
    output_file = "keycloak_users.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(keycloak_users, f, indent=2, ensure_ascii=False)
    
    print(f"\n📁 Сохранено в файл: {output_file}")
    print("\n🔧 ИНСТРУКЦИЯ ПО ДОБАВЛЕНИЮ ПОЛЬЗОВАТЕЛЕЙ:")
    print("1. Откройте Keycloak Admin Console: http://localhost:8080")
    print("2. Войдите как admin / admin123")
    print("3. Выберите realm: bionicpro")
    print("4. Users → Add user (создайте пользователей вручную)")
    print("\n📋 ДАННЫЕ ПЕРВЫХ 5 ПОЛЬЗОВАТЕЛЕЙ:")
    
    for i, user in enumerate(crm_users[:5]):
        username = user['email'].split('@')[0]
        print(f"   {i+1}. Username: {username}")
        print(f"      Email: {user['email']}")
        print(f"      Name: {user['name']}")
        print(f"      CRM ID: {user['id']}")
        print()
    
    print("🔐 ПАРОЛЬ ДЛЯ ВСЕХ: bionicpro123")

if __name__ == "__main__":
    main()
