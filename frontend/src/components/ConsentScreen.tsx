import React, { useState } from 'react';

const ConsentScreen: React.FC = () => {
  const [consents, setConsents] = useState({
    dataProcessing: false,
    analytics: false,
    marketing: false
  });

  const handleConsentChange = (type: keyof typeof consents) => {
    setConsents(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const handleSubmit = () => {
    // В реальном приложении здесь была бы отправка согласий на сервер
    console.log('Consent submitted:', consents);
    
    // Перенаправляем пользователя обратно
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              🛡️ Согласие на обработку данных
            </h1>
            <p className="text-gray-600">
              Для продолжения работы с системой BionicPRO необходимо дать согласие на обработку персональных данных
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start">
              <input
                id="dataProcessing"
                type="checkbox"
                checked={consents.dataProcessing}
                onChange={() => handleConsentChange('dataProcessing')}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="dataProcessing" className="ml-3 text-sm text-gray-700">
                <span className="font-medium">Обработка персональных данных</span>
                <p className="text-gray-500 mt-1">
                  Согласие на обработку персональных данных для работы с системой управления протезами, 
                  включая данные телеметрии и медицинские показатели.
                </p>
              </label>
            </div>

            <div className="flex items-start">
              <input
                id="analytics"
                type="checkbox"
                checked={consents.analytics}
                onChange={() => handleConsentChange('analytics')}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="analytics" className="ml-3 text-sm text-gray-700">
                <span className="font-medium">Аналитика и улучшение продукта</span>
                <p className="text-gray-500 mt-1">
                  Использование анонимизированных данных для улучшения алгоритмов работы протезов 
                  и развития новых функций.
                </p>
              </label>
            </div>

            <div className="flex items-start">
              <input
                id="marketing"
                type="checkbox"
                checked={consents.marketing}
                onChange={() => handleConsentChange('marketing')}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="marketing" className="ml-3 text-sm text-gray-700">
                <span className="font-medium">Маркетинговые коммуникации</span>
                <p className="text-gray-500 mt-1">
                  Получение информации о новых продуктах, обновлениях и специальных предложениях BionicPRO.
                </p>
              </label>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleSubmit}
                disabled={!consents.dataProcessing}
                className={`flex-1 py-3 px-6 rounded-md font-medium ${
                  consents.dataProcessing
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                ✅ Принять и продолжить
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 py-3 px-6 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50"
              >
                ❌ Отклонить
              </button>
            </div>
            
            <p className="text-xs text-gray-500 text-center mt-4">
              * Согласие на обработку персональных данных обязательно для использования системы
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsentScreen;
