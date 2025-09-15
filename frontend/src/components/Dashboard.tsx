/**
 * Protected Dashboard for authenticated users
 * Shows user info, PKCE status, and available actions
 */

import React, { useState, useEffect } from 'react';

interface UserInfo {
  username: string;
  email: string;
  roles: string[];
  firstName?: string;
  lastName?: string;
}

export const Dashboard: React.FC = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastTokens, setLastTokens] = useState<string>('');

  useEffect(() => {
    // Parse user info from stored tokens
    const parseUserInfo = () => {
      try {
        const idToken = localStorage.getItem('id_token');
        const accessToken = localStorage.getItem('access_token');
        
        if (!idToken || !accessToken) {
          throw new Error('No tokens found');
        }

        // Parse Access Token for roles (роли обычно в access token)
        const parseToken = (token: string) => {
          const tokenParts = token.split('.');
          if (tokenParts.length !== 3) {
            throw new Error(`Invalid JWT format: expected 3 parts, got ${tokenParts.length}`);
          }
          
          let base64Payload = tokenParts[1]
            .replace(/-/g, '+')
            .replace(/_/g, '/');
          
          while (base64Payload.length % 4) {
            base64Payload += '=';
          }
          
          return JSON.parse(atob(base64Payload));
        };
        
        const accessPayload = parseToken(accessToken);
        const idPayload = parseToken(idToken);
        
        // Get roles from access token (приоритет access token для ролей)
        const roles = accessPayload.realm_access?.roles || idPayload.realm_access?.roles || accessPayload.roles || idPayload.roles || ['user'];
        
        setUserInfo({
          username: idPayload.preferred_username || idPayload.sub || idPayload.username || 'unknown',
          email: idPayload.email || idPayload.email_verified || 'no-email@bionicpro.ru',
          roles: roles,
          firstName: idPayload.given_name || idPayload.firstName || idPayload.name?.split(' ')[0],
          lastName: idPayload.family_name || idPayload.lastName || idPayload.name?.split(' ')[1]
        });
      } catch (error) {
        console.error('Failed to parse user info:', error);
        // Clear invalid tokens and set userInfo to null
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('id_token');
        setUserInfo(null);
      } finally {
        setLoading(false);
      }
    };

    parseUserInfo();
  }, []);

  const handleLogout = () => {
    // Get the id_token for logout
    const idToken = localStorage.getItem('id_token');
    
    // Clear all stored tokens
    localStorage.clear();
    sessionStorage.clear();
    
    // Правильный logout через Keycloak для завершения SSO сессии
    const keycloakUrl = process.env.REACT_APP_KEYCLOAK_URL || 'http://localhost:8080';
    const realm = 'bionicpro';
    const redirectUri = encodeURIComponent('http://localhost:3000');
    
    // Redirect to Keycloak logout endpoint with id_token_hint
    let logoutUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/logout?post_logout_redirect_uri=${redirectUri}`;
    if (idToken) {
      logoutUrl += `&id_token_hint=${idToken}`;
    }
    
    window.location.href = logoutUrl;
  };

  const getUserRoleBadges = (roles: string[]) => {
    const roleColors: { [key: string]: string } = {
      'prosthetic-pilot': 'bg-blue-100 text-blue-800',
      'prosthetic-buyer': 'bg-green-100 text-green-800',
      'default-roles-bionicpro': 'bg-gray-100 text-gray-800'
    };

    return roles
      .filter(role => !role.startsWith('default-roles') && !role.includes('offline'))
      .map(role => (
        <span 
          key={role}
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            roleColors[role] || 'bg-purple-100 text-purple-800'
          }`}
        >
          {role === 'prosthetic-pilot' ? '🔧 Пилот протеза' : 
           role === 'prosthetic-buyer' ? '🛒 Покупатель' : 
           role}
        </span>
      ));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!userInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Ошибка получения данных пользователя</h2>
          <p className="text-gray-600 mb-6">Токены найдены, но не удалось извлечь информацию о пользователе</p>
          <div className="space-y-4">
            <button
              onClick={() => {
                // Clear tokens and reload
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                localStorage.removeItem('id_token');
                window.location.reload();
              }}
              className="block w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Очистить токены и попробовать снова
            </button>
            <button
              onClick={() => {
                // Just reload to trigger AuthGuard recheck
                window.location.reload();
              }}
              className="block w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Обновить страницу
            </button>
            <button
              onClick={() => {
                // Show debug info
                const accessToken = localStorage.getItem('access_token');
                const idToken = localStorage.getItem('id_token');
                const refreshToken = localStorage.getItem('refresh_token');
                
                let debugInfo = `=== DEBUG INFO ===\n`;
                debugInfo += `Access Token: ${accessToken ? 'EXISTS (' + accessToken.length + ' chars)' : 'MISSING'}\n`;
                debugInfo += `ID Token: ${idToken ? 'EXISTS (' + idToken.length + ' chars)' : 'MISSING'}\n`;
                debugInfo += `Refresh Token: ${refreshToken ? 'EXISTS (' + refreshToken.length + ' chars)' : 'MISSING'}\n\n`;
                
                if (idToken) {
                  debugInfo += `ID Token preview: ${idToken.substring(0, 50)}...\n`;
                  debugInfo += `ID Token parts: ${idToken.split('.').length}\n\n`;
                  
                  try {
                    const payload = JSON.parse(atob(idToken.split('.')[1]));
                    debugInfo += `JWT Payload:\n${JSON.stringify(payload, null, 2)}\n`;
                  } catch (e) {
                    debugInfo += `JWT Parse Error: ${e instanceof Error ? e.message : String(e)}\n`;
                  }
                }
                
                alert(debugInfo);
              }}
              className="block w-full px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              🔍 Показать debug информацию
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                🦾 Добро пожаловать в BionicPRO
              </h1>
              <p className="text-gray-600">
                Вы успешно вошли в систему с PKCE аутентификацией
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              🚪 Выйти
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            👤 Информация о пользователе
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <dt className="text-sm font-medium text-gray-500">Имя пользователя</dt>
              <dd className="mt-1 text-sm text-gray-900">{userInfo.username}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-sm text-gray-900">{userInfo.email}</dd>
            </div>
            
            {userInfo.firstName && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Имя</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {userInfo.firstName} {userInfo.lastName}
                </dd>
              </div>
            )}
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Роли</dt>
              <dd className="mt-1 space-x-2">
                {getUserRoleBadges(userInfo.roles)}
              </dd>
            </div>
          </div>
        </div>

        {/* PKCE Success Info */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                ✅ PKCE аутентификация прошла успешно!
              </h3>
              <div className="mt-2 text-sm text-green-700">
                <p>
                  Ваш вход был защищен с помощью Proof Key for Code Exchange (PKCE). 
                  Это обеспечивает дополнительную безопасность против атак перехвата authorization code.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <a 
            href="/test" 
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
          >
            <div className="text-center">
              <div className="text-3xl mb-3">🧪</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">PKCE Test</h3>
              <p className="text-gray-600 text-sm">
                Проверить параметры PKCE и посмотреть техническую информацию
              </p>
            </div>
          </a>

          <a 
            href="/reports" 
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
          >
            <div className="text-center">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Отчеты</h3>
              <p className="text-gray-600 text-sm">
                Просмотр отчетов о работе протезов (требует авторизации)
              </p>
            </div>
          </a>

          <div className="p-6 bg-white rounded-lg shadow">
            <div className="text-center">
              <div className="text-3xl mb-3">🛡️</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Безопасность</h3>
              <p className="text-gray-600 text-sm">
                Токены хранятся безопасно, сессия защищена PKCE
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
