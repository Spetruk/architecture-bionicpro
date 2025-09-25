/**
 * Компонент для работы с отчётами BionicPRO
 */

import React, { useState, useEffect } from 'react';
import { ReportsService, UserReport, UserSummary, DataAvailability } from '../services/ReportsService';

interface ReportsComponentProps {
  userId: number;
  className?: string;
}

export const ReportsComponent: React.FC<ReportsComponentProps> = ({
  userId,
  className = ''
}) => {
  const [reportsService] = useState(() => new ReportsService());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Состояние данных
  const [report, setReport] = useState<UserReport | null>(null);
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [dataAvailability, setDataAvailability] = useState<DataAvailability | null>(null);
  
  // Состояние формы
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    // Устанавливаем период по умолчанию (последние 30 дней)
    const today = new Date();
    const thirtyDaysAgo = reportsService.getDaysAgo(30);
    
    setEndDate(reportsService.formatDate(today));
    setStartDate(reportsService.formatDate(thirtyDaysAgo));
    
    // Загружаем начальные данные
    loadInitialData();
  }, [userId]);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Загружаем сводку и информацию о доступности данных параллельно
      const [summaryData, availabilityData] = await Promise.all([
        reportsService.getUserSummary(userId),
        reportsService.getDataAvailability()
      ]);

      setSummary(summaryData);
      setDataAvailability(availabilityData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      setError('Выберите период для отчёта');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const reportData = await reportsService.getUserReport(userId, startDate, endDate);
      setReport(reportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка генерации отчёта');
    } finally {
      setLoading(false);
    }
  };


  const getBatteryHealthColor = (health: string) => {
    switch (health) {
      case 'Excellent': return 'text-green-600';
      case 'Good': return 'text-blue-600';
      case 'Low': return 'text-yellow-600';
      case 'Critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getUsageIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'Very High': return 'text-green-600';
      case 'High': return 'text-blue-600';
      case 'Medium': return 'text-yellow-600';
      case 'Low': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Заголовок */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          📊 Отчёты о работе протеза
        </h2>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Информация о доступности данных */}
        {dataAvailability && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Доступность данных</h3>
            <div className="text-sm text-blue-700">
              <p>Отчеты доступны: {dataAvailability.reports_available ? 'Да' : 'Нет'}</p>
              <p>Последняя дата отчета: {dataAvailability.latest_report_date || 'Нет данных'}</p>
              <p>Всего отчетов: {dataAvailability.total_reports}</p>
              <p>Телеметрия доступна: {dataAvailability.telemetry_data_available ? 'Да' : 'Нет'}</p>
            </div>
          </div>
        )}

        {/* Форма выбора периода */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Начальная дата
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={dataAvailability?.latest_report_date || undefined}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Конечная дата
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              max={dataAvailability?.latest_report_date || undefined}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>


          <div className="flex items-end space-x-2">
            <button
              onClick={handleGenerateReport}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
            >
              {loading ? '⏳ Генерация...' : '📈 Сгенерировать'}
            </button>
          </div>
        </div>
      </div>

      {/* Краткая сводка */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">📋 Краткая сводка</h3>
        {loading ? (
          <div className="text-center py-8">
            <div className="text-gray-500">Загрузка данных...</div>
          </div>
        ) : summary && summary.total_movements !== undefined ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{summary.total_movements || 0}</div>
                <div className="text-sm text-gray-600">Общее количество движений</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{summary.usage_intensity || 'Неизвестно'}</div>
                <div className="text-sm text-gray-600">Интенсивность использования</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{summary.data_quality_score ? (summary.data_quality_score * 100).toFixed(1) : '0'}%</div>
                <div className="text-sm text-gray-600">Качество данных</div>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p><strong>Имя пользователя:</strong> {summary.customer_name || 'Неизвестно'}</p>
              <p><strong>Тип протеза:</strong> {summary.prosthesis_type || 'Неизвестно'}</p>
              <p><strong>Последняя активность:</strong> {summary.last_activity_date || 'Неизвестно'}</p>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-500">Данные недоступны</div>
          </div>
        )}
      </div>

      {/* Детальный отчёт */}
      {report && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                📊 Отчёт за период {report.report_period.start_date} — {report.report_period.end_date}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Сгенерирован: {new Date(report.generated_at).toLocaleString('ru-RU')}
              </p>
            </div>
          </div>

          {/* Сводные метрики */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-800 mb-3">Сводные метрики</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-lg font-semibold text-blue-700">
                  {report.summary_metrics?.total_movements?.toLocaleString('ru-RU') || '0'}
                </div>
                <div className="text-xs text-blue-600">Общее количество движений</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-semibold text-green-700">
                  {report.summary_metrics?.avg_movement_accuracy ? (report.summary_metrics.avg_movement_accuracy * 100).toFixed(1) : '0'}%
                </div>
                <div className="text-xs text-green-600">Средняя точность</div>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <div className="text-lg font-semibold text-yellow-700">
                  {report.summary_metrics?.avg_battery_level?.toFixed(1) || '0'}%
                </div>
                <div className="text-xs text-yellow-600">Средний уровень батареи</div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className={`text-lg font-semibold ${getUsageIntensityColor(report.summary_usage?.usage_intensity || 'Low')}`}>
                  {report.summary_usage?.usage_intensity || 'Неизвестно'}
                </div>
                <div className="text-xs text-purple-600">Интенсивность использования</div>
              </div>
            </div>
          </div>

          {/* Состояние устройства */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-800 mb-3">Состояние устройства</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Тип протеза</div>
                <div className="font-medium">{report.summary_usage?.prosthesis_type || 'Неизвестно'}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Основная группа мышц</div>
                <div className="font-medium">{report.summary_usage?.primary_muscle_group || 'Неизвестно'}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Состояние батареи</div>
                <div className={`font-medium ${getBatteryHealthColor(report.summary_usage?.battery_health || 'Good')}`}>
                  {report.summary_usage?.battery_health || 'Неизвестно'}
                </div>
              </div>
            </div>
          </div>

          {/* Аналитические выводы */}
          {report.insights && report.insights.length > 0 && (
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-800 mb-3">💡 Аналитические выводы</h4>
              <div className="space-y-2">
                {(report.insights || []).map((insight, index) => (
                  <div key={index} className="p-3 bg-blue-50 border-l-4 border-blue-400">
                    <p className="text-sm text-blue-800">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Рекомендации */}
          {report.recommendations && report.recommendations.length > 0 && (
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-800 mb-3">🔧 Рекомендации</h4>
              <div className="space-y-2">
                {(report.recommendations || []).map((recommendation, index) => (
                  <div key={index} className="p-3 bg-green-50 border-l-4 border-green-400">
                    <p className="text-sm text-green-800">{recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* График активности по дням (упрощённый) */}
          {report.daily_metrics && report.daily_metrics.length > 0 && (
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">📈 Активность по дням</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Дата
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Движения
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Точность
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Батарея
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Интенсивность
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(report.daily_metrics || []).slice(-10).map((day, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {day.report_date}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {day.telemetry?.total_movements?.toLocaleString('ru-RU') || '0'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {day.telemetry?.avg_movement_accuracy ? (day.telemetry.avg_movement_accuracy * 100).toFixed(1) : '0'}%
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {day.telemetry?.avg_battery_level?.toFixed(1) || '0'}%
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm">
                          <span className={getUsageIntensityColor(day.usage?.usage_intensity || 'Low')}>
                            {day.usage?.usage_intensity || 'Неизвестно'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

