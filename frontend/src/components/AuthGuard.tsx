/**
 * Authentication Guard Component
 * Checks if user is authenticated and redirects accordingly
 */

import React, { useState, useEffect } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback }) => {
  // Проверяем токены каждый раз без кэширования
  const checkAuth = () => {
    const accessToken = localStorage.getItem('access_token');
    const idToken = localStorage.getItem('id_token');
    return !!(accessToken && idToken);
  };

  // Живая проверка без кэширования
  if (checkAuth()) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

export default AuthGuard;
