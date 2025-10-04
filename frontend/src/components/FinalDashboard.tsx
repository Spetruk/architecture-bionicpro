import React, { useEffect, useState } from 'react';

const BFF_BASE = 'http://localhost:5001';

export const FinalDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [hasReport, setHasReport] = useState<boolean>(false);
  const [userId, setUserId] = useState<number | null>(null);
  // Убрали генерацию отчёта по кнопке — остаётся только показ из витрины
  const [summary, setSummary] = useState<Record<string, any> | null>(null);
  const [fullReport, setFullReport] = useState<Record<string, any> | null>(null);
  const [showFull, setShowFull] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // 1) Статус авторизации
        const st = await fetch(`${BFF_BASE}/api/auth/status`, { credentials: 'include' });
        const stJson = await st.json().catch(() => ({} as any));
        setIsAuthenticated(!!stJson?.isAuthenticated);
        setUserName(stJson?.name || 'Пользователь');
        setUserId(typeof stJson?.userId === 'number' ? stJson.userId : null);
        if (!stJson?.isAuthenticated) {
          setError('Не авторизован');
          return;
        }
        // 2) Проверка наличия отчёта
        const r = await fetch(`${BFF_BASE}/reports`, { credentials: 'include' });
        if (r.status === 200) {
          setHasReport(true);
          const j = await r.json().catch(() => null);
          setFullReport(j);
          // Сформируем краткую версию (только ключевые поля, если есть)
          if (j && typeof j === 'object') {
            const pick = (k: string) => (k in j ? j[k] : undefined);
            const short: Record<string, any> = {};
            const fields = [
              'user_id', 'customer_name', 'prosthesis_type',
              'total_movements', 'usage_intensity', 'data_quality_score',
              'last_activity_date', 'avg_signal_amplitude', 'avg_battery_level'
            ];
            fields.forEach(f => {
              const v = pick(f);
              if (v !== undefined) short[f] = v;
            });
            setSummary(Object.keys(short).length ? short : j);
          }
        } else if (r.status === 404) {
          setHasReport(false);
        } else {
          setError(`Ошибка проверки отчёта: ${r.status}`);
        }
      } catch (e) {
        setError('Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Кнопка генерации и открытие CDN ссылки удалены

  const handleLogin = () => {
    window.location.href = `${BFF_BASE}/login`;
  };

  // Генерация отчёта по кнопке удалена

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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Не авторизован</p>
          <a href={`${BFF_BASE}/login`} className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">🔐 Войти</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">👤 Профиль</h1>
          <div className="flex items-center justify-between">
            <p className="text-gray-700">Пользователь: <span className="font-semibold">{userName}</span></p>
            <a href={`${BFF_BASE}/auth/logout`} className="px-3 py-1.5 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm">⎋ Выйти</a>
          </div>
          <p className="text-gray-500 text-sm">CRM ID: {userId ?? '—'}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">📊 Отчёты</h2>
          {error && (
            <p className="text-red-600 mb-3">{error}</p>
          )}
          {userId && hasReport ? (
            <div className="space-y-3">
              <h3 className="font-semibold">Краткая сводка</h3>
              {/* Если есть плоская сводка — показываем её, иначе делаем предпросмотр JSON */}
              {summary && Object.keys(summary).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {Object.entries(summary).slice(0, 12).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-gray-500">{k}:</span>
                      <span className="text-gray-900 ml-2 truncate max-w-[220px]" title={String(v)}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="bg-gray-50 p-3 rounded border text-xs overflow-auto max-h-80">
{JSON.stringify(fullReport ?? {}, null, 2)}
                </pre>
              )}

              <div className="flex items-center gap-2">
                <button onClick={() => setShowFull(v => !v)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  {showFull ? 'Скрыть подробный' : 'Показать подробный'}
                </button>
              </div>
            </div>
          ) : userId ? (
            <div className="space-y-2">
              <p className="text-gray-600">Подробный отчёт пока недоступен. Он берётся из витрины.</p>
            </div>
          ) : (
            <p className="text-gray-600">Для этого пользователя отчёты недоступны (нет CRM ID).</p>
          )}

          {showFull && fullReport && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Подробный отчёт</h3>
              <pre className="bg-gray-50 p-3 rounded border text-xs overflow-auto max-h-96">{JSON.stringify(fullReport, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinalDashboard;


