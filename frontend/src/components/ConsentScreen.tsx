/**
 * Consent Screen Component
 * Экран согласия на обработку данных для Яндекс ID
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const ConsentScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  // Получаем параметры из URL
  const state = searchParams.get('state');
  const scope = searchParams.get('scope');
  const clientId = searchParams.get('client_id');

  useEffect(() => {
    // Если нет обязательных параметров, перенаправляем на главную
    if (!state || !clientId) {
      navigate('/');
    }
  }, [state, clientId, navigate]);

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      // Перенаправляем пользователя обратно к процессу аутентификации
      // с подтверждением согласия
      const consentUrl = new URL('/auth/login', process.env.REACT_APP_BFF_URL || 'http://localhost:8001');
      consentUrl.searchParams.set('consent', 'granted');
      if (state) consentUrl.searchParams.set('state', state);
      
      window.location.href = consentUrl.toString();
    } catch (error) {
      console.error('Ошибка при обработке согласия:', error);
      setIsLoading(false);
    }
  };

  const handleReject = () => {
    // Перенаправляем на главную страницу при отказе
    navigate('/?consent=rejected');
  };

  const requestedPermissions = [
    '📧 Адрес электронной почты',
    '👤 Имя и фамилия',
    '📱 Основная информация профиля',
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            🔐 Согласие на доступ к данным
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            BionicPRO запрашивает доступ к вашим данным
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Приложение запрашивает доступ к:
            </h3>
            <ul className="space-y-2">
              {requestedPermissions.map((permission, index) => (
                <li key={index} className="flex items-center text-sm text-gray-700">
                  <svg 
                    className="h-4 w-4 text-green-500 mr-2" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path 
                      fillRule="evenodd" 
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                      clipRule="evenodd" 
                    />
                  </svg>
                  {permission}
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-6 p-4 bg-blue-50 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Информация о безопасности
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    Ваши данные будут использованы только для аутентификации и персонализации 
                    сервиса BionicPRO. Мы не передаем ваши данные третьим лицам.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={handleAccept}
              disabled={isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Обработка...
                </div>
              ) : (
                '✓ Разрешить доступ'
              )}
            </button>
            
            <button
              onClick={handleReject}
              disabled={isLoading}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
            >
              ✗ Отказаться
            </button>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Нажимая "Разрешить доступ", вы соглашаетесь с{' '}
              <a href="#" className="text-blue-600 hover:text-blue-500">
                политикой конфиденциальности
              </a>{' '}
              BionicPRO
            </p>
          </div>
        </div>

        {/* Debug info for development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-gray-100 p-4 rounded-md text-xs text-gray-600">
            <h4 className="font-medium mb-2">Debug Info:</h4>
            <p>State: {state}</p>
            <p>Scope: {scope}</p>
            <p>Client ID: {clientId}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsentScreen;

