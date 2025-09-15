import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PKCETest } from './components/PKCETest';
import { AuthCallback } from './components/AuthCallback';
import { Dashboard } from './components/Dashboard';
import { AuthGuard } from './components/AuthGuard';
import { LoginButton } from './components/LoginButton';
import ReportPage from './components/ReportPage';

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
            <LoginButton className="w-full">
              🔐 Войти в BionicPRO
            </LoginButton>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-center text-sm text-gray-500">
              <p className="mb-2"><strong>Тестовые учетные данные:</strong></p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="bg-gray-50 p-3 rounded">
                  <p><strong>Пилот протеза:</strong></p>
                  <p>testuser / password123</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p><strong>Покупатель:</strong></p>
                  <p>buyer / buyer123</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
              <div className="text-3xl mb-3">🌍</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Multi-Region IdP</h3>
              <p className="text-gray-600 text-sm">
                Поддержка региональных провайдеров идентификации (RU, EU, US)
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <div className="text-3xl mb-3">🛡️</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">BFF Pattern</h3>
              <p className="text-gray-600 text-sm">
                Backend for Frontend обеспечивает безопасный обмен токенами
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a 
            href="/test" 
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            🧪 PKCE Test Dashboard
          </a>
          
          <a 
            href="/reports" 
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            📊 Отчеты протезов
          </a>
        </div>
      </div>
    </div>
  );
}

const App: React.FC = () => {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={
            <AuthGuard fallback={<HomePage />}>
              <Dashboard />
            </AuthGuard>
          } />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/test" element={
            <AuthGuard fallback={<HomePage />}>
              <PKCETest />
            </AuthGuard>
          } />
          <Route path="/reports" element={
            <AuthGuard fallback={<HomePage />}>
              <ReportPage />
            </AuthGuard>
          } />
        </Routes>
      </div>
    </Router>
  );
};

export default App;