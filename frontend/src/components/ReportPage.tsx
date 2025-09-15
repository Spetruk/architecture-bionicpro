import React, { useState, useEffect } from 'react';

const ReportPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);

  useEffect(() => {
    // Check if user is authenticated
    const accessToken = localStorage.getItem('access_token');
    const idToken = localStorage.getItem('id_token');
    
    if (accessToken && idToken) {
      setIsAuthenticated(true);
      
      // Parse user info from ID token
      try {
        const jwtParts = idToken.split('.');
        let base64Payload = jwtParts[1]
          .replace(/-/g, '+')
          .replace(/_/g, '/');
        
        while (base64Payload.length % 4) {
          base64Payload += '=';
        }
        
        const payload = JSON.parse(atob(base64Payload));
        setUserInfo(payload);
      } catch (e) {
        console.error('Failed to parse user info:', e);
      }
    }
  }, []);

  const downloadReport = async () => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      setError('Not authenticated');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Mock report generation since we don't have real API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate mock CSV report
      const csvContent = `Date,Action,Device,Duration\n2023-12-01,Movement,Prosthetic Arm,120min\n2023-12-01,Calibration,Prosthetic Arm,15min\n2023-12-02,Movement,Prosthetic Arm,95min`;
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prosthetic-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <div className="p-8 bg-white rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">You need to be authenticated to access reports</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-center">📊 Отчеты о протезах</h1>
        
        {userInfo && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-gray-800">Пользователь:</h3>
            <p className="text-sm text-gray-600">
              {userInfo.preferred_username || userInfo.sub}
            </p>
            <p className="text-sm text-gray-600">
              {userInfo.email}
            </p>
          </div>
        )}
        
        <button
          onClick={downloadReport}
          disabled={loading}
          className={`w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? '📄 Генерация отчета...' : '📥 Скачать отчет CSV'}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-lg">
            ❌ {error}
          </div>
        )}
        
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={() => window.location.href = '/'}
            className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            🏠 Вернуться на главную
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;