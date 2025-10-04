/**
 * BFF Dashboard Component
 * Works with session-based authentication via BFF service
 */

import React, { useState, useEffect } from 'react';
import { ReportsComponent } from './ReportsComponent';

interface UserInfo {
  sub: string;
  crm_user_id: number | null;
  username: string;
  email: string;
  given_name?: string;
  family_name?: string;
  roles: string[];
  crm_info?: {
    id: number;
    name: string;
    email: string;
    age: number;
    gender: string;
    country: string;
  } | null;
}

export const BFFDashboard: React.FC = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports'>('dashboard');

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setLoading(true);
        const res = await fetch('http://localhost:5001/api/auth/status', { credentials: 'include' });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        if (data?.isAuthenticated) {
          const mapped: UserInfo = {
            sub: '',
            crm_user_id: null,
            username: data.name ?? 'Пользователь',
            email: '',
            roles: [],
            crm_info: null
          };
          setUserInfo(mapped);
        } else {
          setError('User not authenticated');
        }
      } catch (err) {
        console.error('Failed to fetch user info:', err);
        setError('Failed to load user information');
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  const handleLogout = async () => {
    window.location.href = '/';
  };

  // тестовые кнопки BFF отключены в этой конфигурации

  const getUserRoleBadges = (roles: string[]) => {
    const roleColors: { [key: string]: string } = {
      'prosthetic-pilot': 'bg-blue-100 text-blue-800',
      'prothetic_user': 'bg-blue-100 text-blue-800',
      'prosthetic-buyer': 'bg-green-100 text-green-800',
      'default-roles-bionicpro': 'bg-gray-100 text-gray-800',
      'offline_access': 'bg-purple-100 text-purple-800',
      'uma_authorization': 'bg-orange-100 text-orange-800'
    };

    const mainRoles = roles.filter(role => 
      ['prosthetic-pilot', 'prothetic_user', 'prosthetic-buyer'].includes(role)
    );

    return mainRoles.map(role => {
      const colorClass = roleColors[role] || 'bg-gray-100 text-gray-800';
      const roleDisplay = (role === 'prosthetic-pilot' || role === 'prothetic_user') ? 'Пилот протеза' : 'Покупатель протеза';
      
      return (
        <span key={role} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
          {(role === 'prosthetic-pilot' || role === 'prothetic_user') ? '👤' : '🛒'} {roleDisplay}
        </span>
      );
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  if (error || !userInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Ошибка загрузки</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Обновить страницу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                🦾 BionicPRO Dashboard (BFF Mode)
              </h1>
              <p className="text-gray-600">
                Безопасная аутентификация через Backend for Frontend
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              🚪 Выйти
            </button>
          </div>
          
          {/* Navigation Tabs */}
          <div className="mt-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'dashboard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🏠 Главная
              </button>
              {userInfo?.crm_user_id && (
                <button
                  onClick={() => setActiveTab('reports')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'reports'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  📊 Отчёты
                </button>
              )}
            </nav>
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'dashboard' && (
          <>
            {/* User Info */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                👤 Информация о пользователе
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-500">Имя пользователя:</span>
                      <p className="text-lg font-semibold text-gray-900">{userInfo.username}</p>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium text-gray-500">Email:</span>
                      <p className="text-lg text-gray-900">{userInfo.email}</p>
                    </div>
                    
                    {(userInfo.given_name || userInfo.family_name) && (
                      <div>
                        <span className="text-sm font-medium text-gray-500">Полное имя:</span>
                        <p className="text-lg text-gray-900">
                          {userInfo.given_name} {userInfo.family_name}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <span className="text-sm font-medium text-gray-500">Роли:</span>
                  <div className="mt-2 space-y-2">
                    {getUserRoleBadges(userInfo.roles)}
                  </div>
                  
                  <div className="mt-4 p-3 bg-gray-50 rounded-md">
                    <span className="text-xs font-medium text-gray-500">Все роли:</span>
                    <p className="text-sm text-gray-700 mt-1">
                      {userInfo.roles.join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* BFF Features */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                🛡️ BFF Security Features
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-green-50 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-2">✅ HTTP-Only Cookies</h3>
                  <p className="text-sm text-green-700">
                    Токены хранятся в защищенных HTTP-only cookies, недоступных JavaScript
                  </p>
                </div>
                
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-2">🔄 Session Rotation</h3>
                  <p className="text-sm text-blue-700">
                    Автоматическая ротация session ID при каждом запросе к защищенным ресурсам
                  </p>
                </div>
                
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-purple-800 mb-2">⚡ Token Refresh</h3>
                  <p className="text-sm text-purple-700">
                    Автоматическое обновление access_token через refresh_token (срок жизни: 2 мин)
                  </p>
                </div>
                
                <div className="p-4 bg-orange-50 rounded-lg">
                  <h3 className="font-semibold text-orange-800 mb-2">🔐 Encrypted Storage</h3>
                  <p className="text-sm text-orange-700">
                    Токены зашифрованы и хранятся в Redis на backend
                  </p>
                </div>
              </div>
              
              {/* Тестовые кнопки отключены в этой конфигурации */}
            </div>

            {/* Role-based Content */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                🎯 Контент по ролям
              </h2>
              
              {(userInfo.roles.includes('prosthetic-pilot') || userInfo.roles.includes('prothetic_user')) && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-2">👤 Для пилота протеза</h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Данные телеметрии протеза</li>
                    <li>• Миосигналы и движения</li>
                    <li>• Статистика использования</li>
                    <li>• Настройки протеза</li>
                  </ul>
                  <button
                    onClick={() => setActiveTab('reports')}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                  >
                    📊 Перейти к отчётам
                  </button>
                </div>
              )}
              
              {userInfo.roles.includes('prosthetic-buyer') && (
                <div className="mb-6 p-4 bg-green-50 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-2">🛒 Для покупателя</h3>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• История заказов</li>
                    <li>• Статусы доставки</li>
                    <li>• Гарантийные отчеты</li>
                    <li>• Каталог продуктов</li>
                  </ul>
                  <button
                    onClick={() => setActiveTab('reports')}
                    className="mt-3 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                  >
                    📊 Перейти к отчётам
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && userInfo?.crm_user_id && (
          <ReportsComponent 
            userId={userInfo.crm_user_id} // Используем реальный CRM user_id
            className="mb-8"
          />
        )}
      </div>
    </div>
  );
};
