import React, { useEffect, useState } from 'react';

type ReportData = any;

const ReportPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  // Убрали генерацию; отчёт берём только из витрины

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        console.log('[ReportPage] check auth /api/auth/status ...');
        // Проверяем аутентификацию
        const statusRes = await fetch('http://localhost:5001/api/auth/status', {
          credentials: 'include'
        });
        console.log('[ReportPage] /api/auth/status code =', statusRes.status);
        const status = await statusRes.json().catch(() => ({} as any));
        console.log('[ReportPage] /api/auth/status payload =', status);
        if (!status?.isAuthenticated) {
          setError('Не авторизован');
          return;
        }

        // Забираем отчет через BFF (/reports проксирует на reports-api)
        console.log('[ReportPage] fetch /reports ...');
        const res = await fetch('http://localhost:5001/reports', {
          credentials: 'include'
        });
        console.log('[ReportPage] /reports code =', res.status);
        if (res.status === 401) {
          setError('Не авторизован');
          return;
        }
        if (!res.ok) {
          if (res.status === 404) {
            setError('Отчет пока не готов');
            return;
          }
          setError(`Ошибка загрузки отчета: ${res.status}`);
          return;
        }

        // Ожидаем JSON
        const data = await res.json().catch(() => null);
        console.log('[ReportPage] /reports json =', data);
        setReport(data);
      } catch (e) {
        console.error('[ReportPage] error =', e);
        setError('Ошибка при получении отчета');
      } finally {
        setLoading(false);
      }
    };
    load();
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-1">{error === 'Не авторизован' ? 'Ошибка аутентификации' : 'Отчёт недоступен'}</p>
          {/* Ссылка на генерацию удалена */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                console.log('[ReportPage] click login -> /login');
                window.location.href = 'http://localhost:5001/login';
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              🔐 Войти
            </button>
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
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-6 px-4">
        <h1 className="text-2xl font-bold mb-4">📊 Ваш отчет</h1>
        {report ? (
          <pre className="bg-white p-4 rounded border overflow-auto text-sm">
{JSON.stringify(report, null, 2)}
          </pre>
        ) : (
          <p className="text-gray-600">Отчет сформирован и отдан как файл.</p>
        )}
        <div className="mt-4">
          <a
            href="http://localhost:5001/reports"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            ⬇ Скачать отчет JSON
          </a>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;
