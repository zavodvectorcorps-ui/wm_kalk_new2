import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function PdfUploadDebugPage() {
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const fetchDebugInfo = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/integrations/amocrm/debug-info`);
      const data = await response.json();
      setDebugInfo(data);
    } catch (error) {
      console.error('Failed to fetch debug info:', error);
      setDebugInfo({ error: error.message });
    }
    setLoading(false);
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(
        `${API_URL}/api/integrations/amocrm/upload-calculator-pdf?amocrm_id=DEBUG_TEST&order_id=DEBUG-${Date.now()}&calculator_type=debug&client_name=DebugTest`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/pdf' },
          body: 'DEBUG TEST PDF CONTENT - This is a test'
        }
      );
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({ error: error.message });
    }
    setTesting(false);
  };

  useEffect(() => {
    fetchDebugInfo();
  }, []);

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleString('ru-RU');
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">🔧 PDF Upload Debug</h1>
          <Button onClick={fetchDebugInfo} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>

        {/* Version Info */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">Версия кода</CardTitle>
          </CardHeader>
          <CardContent>
            {debugInfo?.code_version ? (
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="font-mono text-xl">{debugInfo.code_version}</span>
                <span className="text-gray-400 text-sm ml-4">
                  (endpoint: {debugInfo.debug_endpoint_version})
                </span>
              </div>
            ) : debugInfo?.error ? (
              <div className="flex items-center gap-2 text-red-400">
                <XCircle className="w-5 h-5" />
                <span>Ошибка: {debugInfo.error}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-yellow-400">
                <AlertCircle className="w-5 h-5" />
                <span>Нет версии - возможно старый код!</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* amoCRM Config */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">Конфигурация amoCRM</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              {debugInfo?.amocrm_configured ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <span>Настроен: {debugInfo?.amocrm_configured ? 'Да' : 'Нет'}</span>
            </div>
            <div className="text-gray-400">
              Домен: <span className="font-mono">{debugInfo?.amocrm_domain || '-'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Test Button */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">Тест загрузки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={runTest} disabled={testing} className="bg-blue-600 hover:bg-blue-700">
              {testing ? 'Тестирование...' : 'Запустить тест'}
            </Button>
            
            {testResult && (
              <div className="mt-4 p-4 bg-gray-900 rounded-lg">
                <h4 className="font-bold mb-2">Результат теста:</h4>
                <pre className="text-sm overflow-x-auto whitespace-pre-wrap text-green-300">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Logs */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">
              Последние попытки загрузки PDF 
              <span className="text-gray-400 text-sm font-normal ml-2">
                (всего: {debugInfo?.total_pdf_logs || 0})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {debugInfo?.recent_pdf_uploads?.length > 0 ? (
              <div className="space-y-3">
                {debugInfo.recent_pdf_uploads.map((log, index) => (
                  <div 
                    key={index} 
                    className={`p-3 rounded-lg border ${
                      log.pdf_uploaded 
                        ? 'bg-green-900/20 border-green-700' 
                        : 'bg-red-900/20 border-red-700'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {log.pdf_uploaded ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        <span className="font-mono text-sm">{log.order_id}</span>
                      </div>
                      <span className="text-gray-400 text-xs">
                        {formatDate(log.timestamp)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400">amoCRM ID:</span>{' '}
                        <span className="font-mono">{log.amocrm_id}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Тип:</span>{' '}
                        {log.calculator_type}
                      </div>
                      <div>
                        <span className="text-gray-400">PDF сохранён:</span>{' '}
                        {log.pdf_saved ? '✅' : '❌'}
                      </div>
                      <div>
                        <span className="text-gray-400">PDF загружен в amoCRM:</span>{' '}
                        {log.pdf_uploaded ? '✅' : '❌'}
                      </div>
                      <div>
                        <span className="text-gray-400">Заметка добавлена:</span>{' '}
                        {log.note_added ? '✅' : '❌'}
                      </div>
                      <div>
                        <span className="text-gray-400">Результат:</span>{' '}
                        <span className={log.result === 'success' ? 'text-green-400' : 'text-yellow-400'}>
                          {log.result}
                        </span>
                      </div>
                    </div>
                    
                    {log.upload_error && (
                      <div className="mt-2 p-2 bg-red-900/30 rounded text-red-300 text-xs font-mono overflow-x-auto">
                        {log.upload_error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-400 text-center py-8">
                Нет записей о загрузке PDF
              </div>
            )}
          </CardContent>
        </Card>

        {/* Raw Debug Info */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">Raw Debug Data</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-900 p-4 rounded-lg overflow-x-auto text-gray-300">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
