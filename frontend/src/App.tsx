import React, { useState, useEffect } from 'react';
import ReportPage from './components/ReportPage';
import FinalDashboard from './components/FinalDashboard';

function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🦾 BionicPRO Security Demo
          </h1>
          <p className="text-xl text-gray-600">
            Демонстрация OAuth 2.0 с PKCE аутентификацией
          </p>
        </div>

        {/* Login */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
            Вход в систему BionicPRO
          </h2>
          
          <div className="text-center mb-6">
            <p className="text-gray-600">
              Войдите с вашими учетными данными. Роль будет определена автоматически.
            </p>
          </div>

          <div className="max-w-sm mx-auto">
            <button
              onClick={() => window.location.href = 'http://localhost:5001/auth'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              🔐 Войти в BionicPRO
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-center text-sm text-gray-500">
              <p className="mb-2"><strong>Тестовые учетные данные:</strong></p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                <div className="bg-blue-50 p-3 rounded">
                  <p><strong>🔐 CRM Пользователи:</strong></p>
                  <p>alexis.moore / bionicpro123</p>
                  <p>paige.gonzales / bionicpro123</p>
                  <p>theresa.kelly / bionicpro123</p>
                  <p className="text-xs text-blue-600 mt-1">Видят только свои отчеты по CRM ID</p>
                </div>
                <div className="bg-green-50 p-3 rounded">
                  <p><strong>🏢 LDAP пользователи:</strong></p>
                  <p>john.doe / password</p>
                  <p>jane.smith / password</p>
                  <p>alex.johnson / password</p>
                </div>
                <div className="bg-purple-50 p-3 rounded">
                  <p><strong>👤 Другие:</strong></p>
                  <p>testuser / password123</p>
                  <p>buyer / buyer123</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="bg-yellow-50 p-3 rounded">
                  <p><strong>🆕 Яндекс ID:</strong></p>
                  <p>Войдите через Яндекс ID на странице входа в Keycloak</p>
                  <p className="text-xs text-gray-600 mt-1">Через прокси-сервис, который убирает openid scope</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-orange-600">
                🛡️ MFA обязателен для всех пользователей
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <div className="text-3xl mb-3">🔐</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">PKCE Security</h3>
              <p className="text-gray-600 text-sm">
                Proof Key for Code Exchange защищает от атак перехвата authorization code
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <div className="text-3xl mb-3">🏢</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">LDAP Integration</h3>
              <p className="text-gray-600 text-sm">
                Интеграция с OpenLDAP для международных представительств
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <div className="text-3xl mb-3">🔒</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">MFA (TOTP)</h3>
              <p className="text-gray-600 text-sm">
                Двухфакторная аутентификация с Google Authenticator
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Яндекс ID</h3>
              <p className="text-gray-600 text-sm">
                OAuth 2.0 аутентификация через Яндекс с согласием на данные
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const App: React.FC = () => { 
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('http://localhost:5001/api/auth/status', {
          method: 'GET',
          credentials: 'include',
        });

        const data = await response.json();
        setIsAuthenticated(data.isAuthenticated);
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-700">Проверка авторизации...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-xl text-gray-700">Загрузка...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <HomePage />;
  }

  return (
    <div className="App">
      <FinalDashboard />
    </div>
  );
};

export default App;