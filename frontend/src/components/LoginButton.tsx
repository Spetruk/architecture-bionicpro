/**
 * Login Button with PKCE Authentication
 * Initiates OAuth 2.0 flow with PKCE protection
 */

import React, { useState } from 'react';
import { createBFFAuthService } from '../auth/BFFAuthService';

interface LoginButtonProps {
  className?: string;
  children?: React.ReactNode;
  onLoginStart?: () => void;
  onLoginError?: (error: Error) => void;
}

export const LoginButton: React.FC<LoginButtonProps> = ({ 
  className = '',
  children,
  onLoginStart,
  onLoginError
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    onLoginStart?.();

    try {
      const authService = createBFFAuthService();
      await authService.initiateLogin();
    } catch (error) {
      const authError = error instanceof Error ? error : new Error('Login failed');
      console.error('Login initiation failed:', authError);
      onLoginError?.(authError);
      setIsLoading(false);
    }
  };

  const defaultClassName = `
    inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md
    text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 
    focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200
  `.trim();

  return (
    <button
      onClick={handleLogin}
      disabled={isLoading}
      className={`${defaultClassName} ${className}`}
    >
      {isLoading ? (
        <>
          <svg 
            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Вход в систему...
        </>
      ) : (
        children || '🔐 Войти через BionicPRO'
      )}
    </button>
  );
};

// Предустановленные варианты кнопок для разных ролей
export const PilotLoginButton: React.FC<Omit<LoginButtonProps, 'children'>> = (props) => (
  <LoginButton {...props}>
    👤 Войти как пилот протеза
  </LoginButton>
);

export const BuyerLoginButton: React.FC<Omit<LoginButtonProps, 'children'>> = (props) => (
  <LoginButton {...props}>
    🛒 Войти как покупатель
  </LoginButton>
);

export const OperatorLoginButton: React.FC<Omit<LoginButtonProps, 'children'>> = (props) => (
  <LoginButton {...props}>
    👨‍💼 Войти как оператор
  </LoginButton>
);

export const MLEngineerLoginButton: React.FC<Omit<LoginButtonProps, 'children'>> = (props) => (
  <LoginButton {...props}>
    🤖 Войти как ML-инженер
  </LoginButton>
);
