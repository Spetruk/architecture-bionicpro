import React, { useState, useEffect } from 'react';
import { ReportsComponent } from './ReportsComponent';
import { createBFFAuthService } from '../auth/BFFAuthService';

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

const ReportPage: React.FC = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authService = createBFFAuthService();

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setLoading(true);
        const user = await authService.getCurrentUser();
        
        if (user) {
          setUserInfo(user);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error || !userInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Ошибка аутентификации</p>
          <a 
            href="/" 
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            ← Вернуться на главную
          </a>
        </div>
      </div>
    );
  }

  // Проверяем, найден ли пользователь в CRM
  if (!userInfo.crm_user_id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">
            Пользователь не найден в системе CRM
          </p>
          <p className="text-gray-600 mb-4">
            Email: {userInfo.email}
          </p>
          <a 
            href="/" 
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            ← Вернуться на главную
          </a>
        </div>
      </div>
    );
  }

  // Используем реальный CRM user_id
  const userId = userInfo.crm_user_id;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📊 Отчеты по протезам
          </h1>
          <p className="text-gray-600">
            Просмотр аналитических данных и отчетов о работе бионических протезов
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Пользователь: {userInfo.crm_info?.name || userInfo.username} ({userInfo.email})
          </p>
          <p className="text-xs text-gray-400 mt-1">
            CRM ID: {userInfo.crm_user_id} | Keycloak ID: {userInfo.sub}
          </p>
        </div>
        
        <ReportsComponent userId={userId} />
        
        <div className="mt-8 text-center">
          <a 
            href="/" 
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            ← Вернуться на главную
          </a>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;
