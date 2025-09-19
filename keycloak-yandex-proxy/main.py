from fastapi import FastAPI, Request, Response
from fastapi.responses import RedirectResponse
import httpx
import re
import logging
import json
import base64
from urllib.parse import unquote_plus

app = FastAPI(title="Keycloak Yandex Proxy")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Глобальная переменная для сохранения nonce
saved_nonce = None

# Yandex settings
YANDEX_AUTH_URL = "https://oauth.yandex.ru/authorize"
YANDEX_TOKEN_URL = "https://oauth.yandex.ru/token"
YANDEX_USER_INFO_URL = "https://login.yandex.ru/info"

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.get("/authorize")
async def proxy_authorize(request: Request):
    """Прокси для Yandex authorize endpoint - убирает openid scope"""
    
    # Получаем все query параметры от Keycloak
    params = dict(request.query_params)
    
    # Логируем оригинальный запрос
    logger.info(f"Original authorize request: {params}")
    
    # Сохраняем nonce для последующего использования в JWT
    global saved_nonce
    saved_nonce = params.get('nonce')
    
    # Убираем openid из scope если он есть
    if 'scope' in params:
        original_scope = params['scope']
        # Убираем openid, оставляем только Yandex scopes
        new_scope = re.sub(r'\bopenid\b\s*', '', original_scope).strip()
        new_scope = re.sub(r'\s+', ' ', new_scope)  # Убираем лишние пробелы
        params['scope'] = new_scope
        logger.info(f"Modified scope: {original_scope} -> {new_scope}")
    
    # Перенаправляем на настоящий Yandex
    yandex_url = f"{YANDEX_AUTH_URL}?" + "&".join([f"{k}={v}" for k, v in params.items()])
    logger.info(f"Redirecting to: {yandex_url}")
    
    return RedirectResponse(url=yandex_url)

@app.post("/token")
async def proxy_token(request: Request):
    """Прокси для Yandex token endpoint"""
    
    # Получаем тело запроса от Keycloak
    body = await request.body()
    form_data = {}
    
    # Парсим form data
    if body:
        for param in body.decode().split('&'):
            if '=' in param:
                key, value = param.split('=', 1)
                form_data[unquote_plus(key)] = unquote_plus(value)
    
    logger.info(f"Token request: {form_data}")
    
    # Проксируем запрос к Yandex
    async with httpx.AsyncClient() as client:
        response = await client.post(
            YANDEX_TOKEN_URL,
            data=form_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        logger.info(f"Yandex token response: {response.status_code} - {response.text}")
        
        if response.status_code == 200:
            token_data = response.json()
            logger.info(f"Token data: {token_data}")
            
            # Добавляем id_token для OIDC совместимости
            if 'id_token' not in token_data:
                
                # Получаем userinfo для правильного sub
                try:
                    user_response = await client.get(
                        YANDEX_USER_INFO_URL,
                        headers={'Authorization': f"OAuth {token_data.get('access_token')}"}
                    )
                    user_info = user_response.json() if user_response.status_code == 200 else {}
                    user_sub = user_info.get('id', 'yandex_user')
                except:
                    user_sub = 'yandex_user'
                
                # Простой JWT header и payload
                header = {"alg": "none", "typ": "JWT"}
                payload = {
                    "iss": "https://oauth.yandex.ru",
                    "sub": user_sub,
                    "aud": token_data.get('client_id', '341017d99ff34dc0bfbe71718bbc81d7'),
                    "exp": 9999999999,  # Далекое будущее
                    "iat": 1726517000   # Текущее время
                }
                
                # Добавляем nonce если он был в запросе
                if saved_nonce:
                    payload['nonce'] = saved_nonce
                    logger.info(f"Added nonce to JWT: {saved_nonce}")
                
                # Кодируем в base64
                header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip('=')
                payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=')
                
                # Создаем "JWT" без подписи
                fake_jwt = f"{header_b64}.{payload_b64}."
                token_data['id_token'] = fake_jwt
                logger.info(f"Added fake id_token: {fake_jwt}")
            
            # Возвращаем токен в формате, понятном Keycloak
            return Response(
                content=json.dumps(token_data),
                status_code=response.status_code,
                headers={
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store',
                    'Pragma': 'no-cache'
                }
            )
        else:
            logger.error(f"Yandex token error: {response.text}")
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=dict(response.headers)
            )

@app.get("/info")
async def proxy_userinfo(request: Request):
    """Прокси для Yandex userinfo endpoint"""
    
    headers = dict(request.headers)
    headers.pop('host', None)
    
    # Проксируем запрос к Yandex
    async with httpx.AsyncClient() as client:
        response = await client.get(
            YANDEX_USER_INFO_URL,
            headers=headers
        )
        
        logger.info(f"Yandex userinfo response: {response.status_code}")
        
        if response.status_code == 200:
            user_data = response.json()
            logger.info(f"Original userinfo: {user_data}")
            
            # Добавляем поле 'sub' для OIDC совместимости
            if 'id' in user_data and 'sub' not in user_data:
                user_data['sub'] = user_data['id']
                logger.info(f"Added sub field: {user_data['sub']}")
            
            # Убеждаемся что есть email
            if 'default_email' in user_data and 'email' not in user_data:
                user_data['email'] = user_data['default_email']
                
            return Response(
                content=json.dumps(user_data),
                status_code=response.status_code,
                headers={
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store'
                }
            )
        else:
            logger.error(f"Yandex userinfo error: {response.text}")
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=dict(response.headers)
            )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
