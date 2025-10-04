/**
 * BFF Authentication Guard Component
 * Checks authentication status via BFF service
 */

import React, { useState, useEffect } from 'react';
import { createBFFAuthService } from '../auth/BFFAuthService';

interface BFFAuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const BFFAuthGuard: React.FC<BFFAuthGuardProps> = ({ children, fallback }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const authService = createBFFAuthService();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        setIsAuthenticated(authenticated);
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Проверка аутентификации...</p>
        </div>
      </div>
    );
  }

  // Show authenticated content or fallback
  if (isAuthenticated) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

export default BFFAuthGuard;
