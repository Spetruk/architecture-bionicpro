/**
 * OAuth 2.0 Authorization Code Callback Handler with PKCE
 * Handles the redirect from Keycloak after user authentication
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBionicProAuthService } from '../auth/AuthService';

interface AuthCallbackProps {
  onSuccess?: (tokens: any) => void;
  onError?: (error: Error) => void;
}

export const AuthCallback: React.FC<AuthCallbackProps> = ({ onSuccess, onError }) => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Parse URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const errorParam = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        // Check for OAuth errors
        if (errorParam) {
          const errorMsg = errorDescription || errorParam;
          throw new Error(`OAuth error: ${errorMsg}`);
        }

        // Validate required parameters
        if (!code) {
          throw new Error('Authorization code not received');
        }

        if (!state) {
          throw new Error('State parameter not received');
        }

        // Initialize auth service and handle callback
        const authService = createBionicProAuthService();
        const tokens = await authService.handleCallback(code, state);

        // Store tokens securely (you might want to use a more secure method)
        localStorage.setItem('access_token', tokens.access_token);
        localStorage.setItem('refresh_token', tokens.refresh_token);
        localStorage.setItem('id_token', tokens.id_token);

        setStatus('success');
        onSuccess?.(tokens);

        // Redirect to main app after short delay using React Router
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1500);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown authentication error';
        setError(errorMessage);
        setStatus('error');
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      }
    };

    handleCallback();
  }, [onSuccess, onError]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Завершение входа...
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Обработка данных аутентификации
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Вход выполнен успешно
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Перенаправление в приложение...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Ошибка входа
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {error}
            </p>
            <div className="mt-6">
              <button
                onClick={() => navigate('/', { replace: true })}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Вернуться на главную
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
