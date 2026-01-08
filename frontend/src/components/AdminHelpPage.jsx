import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  HelpCircle, Settings, Link2, AlertTriangle, Book, ChevronRight,
  ExternalLink, Bell, Camera, Database, Key, Map, MessageSquare,
  Shield, Zap, CheckCircle, Copy, Bug, FileText, Server, RefreshCw,
  Smartphone, Globe, Mail, Trash2, Wrench
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const AdminHelpPage = () => {
  const [copiedText, setCopiedText] = useState('');
  const [deletingLegacy, setDeletingLegacy] = useState(false);
  const [legacyResult, setLegacyResult] = useState(null);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success('Скопировано в буфер обмена');
    setTimeout(() => setCopiedText(''), 2000);
  };

  const deleteLegacyTrips = async () => {
    if (!window.confirm('Удалить все рейсы с устаревшими статусами (active, pending, cancelled)? Это действие необратимо.')) {
      return;
    }
    
    setDeletingLegacy(true);
    setLegacyResult(null);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/trips/cleanup/legacy-status`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      setLegacyResult(data);
      
      if (data.deleted > 0) {
        toast.success(`Удалено ${data.deleted} рейсов`);
      } else {
        toast.info('Нет рейсов с устаревшими статусами');
      }
    } catch (error) {
      toast.error('Ошибка при удалении');
      setLegacyResult({ error: error.message });
    } finally {
      setDeletingLegacy(false);
    }
  };

  const debugPages = [
    {
      name: 'Photo Debug',
      url: '/photo-debug.html',
      description: 'Проверка загрузки фото доставки и синхронизации с amoCRM',
      icon: Camera,
      color: 'text-green-600 bg-green-50'
    },
    {
      name: 'Push Debug',
      url: '/push-debug.html',
      description: 'Диагностика push-уведомлений и VAPID ключей',
      icon: Bell,
      color: 'text-blue-600 bg-blue-50'
    }
  ];

  const apiEndpoints = [
    {
      name: 'Проверка здоровья сервера',
      method: 'GET',
      url: '/api/health',
      description: 'Проверка работоспособности backend',
      auth: false
    },
    {
      name: 'Логи синхронизации',
      method: 'GET',
      url: '/api/driver-panel/debug/logs',
      description: 'Последние логи синхронизации с amoCRM',
      auth: true
    },
    {
      name: 'Статус уведомлений водителя',
      method: 'GET',
      url: '/api/notifications/debug/driver/{driver_id}',
      description: 'Статус push и Telegram уведомлений для водителя',
      auth: true
    },
    {
      name: 'Проверка VAPID ключей',
      method: 'GET',
      url: '/api/notifications/vapid-check',
      description: 'Валидация формата VAPID ключей для push',
      auth: true
    },
    {
      name: 'Список фото доставки',
      method: 'GET',
      url: '/api/driver-panel/photos/list',
      description: 'Список всех загруженных фото актов доставки',
      auth: false
    },
    {
      name: 'Информация о заказе',
      method: 'GET',
      url: '/api/driver-panel/debug/order/{order_id}',
      description: 'Детальная информация о заказе и статусе синхронизации',
      auth: true
    }
  ];

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
          <HelpCircle className="h-8 w-8 text-blue-600" />
          Справка и диагностика
        </h1>
        <p className="text-muted-foreground">
          Рекомендации по настройкам, ссылки на диагностические страницы и API для проверки работы системы
        </p>
      </div>

      <Tabs defaultValue="debug" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="debug" className="gap-2">
            <Bug className="h-4 w-4" />
            Диагностика
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-2">
            <Wrench className="h-4 w-4" />
            Инструменты
          </TabsTrigger>
          <TabsTrigger value="amocrm-api" className="gap-2">
            <Database className="h-4 w-4" />
            amoCRM API
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Settings className="h-4 w-4" />
            Интеграции
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-2">
            <Server className="h-4 w-4" />
            API эндпоинты
          </TabsTrigger>
          <TabsTrigger value="faq" className="gap-2">
            <Book className="h-4 w-4" />
            FAQ
          </TabsTrigger>
        </TabsList>

        {/* Debug Pages Tab */}
        <TabsContent value="debug" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-purple-600" />
                Диагностические страницы
              </CardTitle>
              <CardDescription>
                Специальные страницы для проверки работы различных компонентов системы
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {debugPages.map((page, idx) => {
                const Icon = page.icon;
                return (
                  <div key={idx} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${page.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-medium">{page.name}</h3>
                        <p className="text-sm text-muted-foreground">{page.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded">{page.url}</code>
                      <Button variant="outline" size="sm" onClick={() => window.open(page.url, '_blank')}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Открыть
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Что проверить при проблемах
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Camera className="h-4 w-4 text-green-600" />
                    Фото не загружается
                  </h4>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Откройте /photo-debug.html</li>
                    <li>Проверьте список загруженных фото</li>
                    <li>Попробуйте тестовую загрузку</li>
                    <li>Проверьте логи в разделе "Логи"</li>
                  </ol>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Bell className="h-4 w-4 text-blue-600" />
                    Уведомления не приходят
                  </h4>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Откройте /push-debug.html</li>
                    <li>Проверьте формат VAPID ключей</li>
                    <li>Убедитесь что водитель подписан</li>
                    <li>Проверьте связь водителя с учёткой</li>
                  </ol>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Database className="h-4 w-4 text-purple-600" />
                    Данные не синхронизируются с amoCRM
                  </h4>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Проверьте токен amoCRM (срок действия)</li>
                    <li>Откройте /photo-debug.html → "Проверка amoCRM"</li>
                    <li>Проверьте логи синхронизации</li>
                    <li>Убедитесь что поля в amoCRM настроены</li>
                  </ol>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Map className="h-4 w-4 text-red-600" />
                    Карта не загружается
                  </h4>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Проверьте API ключ Google Maps</li>
                    <li>Убедитесь что включены нужные API</li>
                    <li>Проверьте лимиты API</li>
                    <li>Проверьте консоль браузера (F12)</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-600" />
                Очистка данных
              </CardTitle>
              <CardDescription>
                Инструменты для удаления устаревших или тестовых данных
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium mb-1">Удалить рейсы с устаревшими статусами</h4>
                    <p className="text-sm text-muted-foreground">
                      Удаляет рейсы со статусами: active, pending, cancelled, unknown.
                      Эти статусы больше не используются в системе.
                    </p>
                  </div>
                  <Button 
                    variant="destructive" 
                    onClick={deleteLegacyTrips}
                    disabled={deletingLegacy}
                  >
                    {deletingLegacy ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Удалить
                  </Button>
                </div>
                
                {legacyResult && (
                  <div className={`mt-4 p-3 rounded-lg ${legacyResult.error ? 'bg-red-50' : 'bg-green-50'}`}>
                    {legacyResult.error ? (
                      <p className="text-red-700">Ошибка: {legacyResult.error}</p>
                    ) : (
                      <>
                        <p className={legacyResult.deleted > 0 ? 'text-green-700 font-medium' : 'text-gray-600'}>
                          {legacyResult.message}
                        </p>
                        {legacyResult.trips && legacyResult.trips.length > 0 && (
                          <div className="mt-2 text-sm">
                            <p className="text-muted-foreground">Удалённые рейсы:</p>
                            <ul className="list-disc list-inside mt-1">
                              {legacyResult.trips.map((t, i) => (
                                <li key={i} className="text-gray-600">
                                  {t.name || t.id} (статус: {t.status})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800">Внимание</h4>
                  <p className="text-sm text-amber-700">
                    Удаление данных необратимо. Убедитесь, что у вас есть резервная копия перед использованием инструментов очистки.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* amoCRM API Documentation Tab */}
        <TabsContent value="amocrm-api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-green-600" />
                Загрузка файлов в amoCRM (API v4)
              </CardTitle>
              <CardDescription>
                Рабочий алгоритм загрузки фото доставки с прикреплением к заметке сделки
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-2">✅ Проверенный рабочий процесс</h4>
                <ol className="text-sm text-green-700 space-y-2 list-decimal list-inside">
                  <li><strong>Получить drive_url</strong> — GET /api/v4/account?with=drive_url</li>
                  <li><strong>Создать сессию загрузки</strong> — POST {'{drive_url}'}/v1.0/sessions</li>
                  <li><strong>Загрузить файл по частям</strong> — POST на upload_url (chunked upload)</li>
                  <li><strong>Получить UUID</strong> — из ответа последнего chunk'а (uuid + version_uuid)</li>
                  <li><strong>Создать заметку с файлом</strong> — POST /api/v4/leads/{'{id}'}/notes с note_type: "attachment"</li>
                </ol>
              </div>

              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h5 className="font-medium mb-2 flex items-center gap-2">
                    <Badge variant="secondary">Шаг 1</Badge>
                    Получение drive_url
                  </h5>
                  <div className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">
                    <pre>{`GET https://{domain}/api/v4/account?with=drive_url
Authorization: Bearer {token}

Response:
{
  "id": 12345,
  "name": "Account Name",
  "drive_url": "https://drive-b.amocrm.ru"  // ← Нужен этот URL
}`}</pre>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h5 className="font-medium mb-2 flex items-center gap-2">
                    <Badge variant="secondary">Шаг 2</Badge>
                    Создание сессии загрузки
                  </h5>
                  <div className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">
                    <pre>{`POST https://drive-b.amocrm.ru/v1.0/sessions
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "file_name": "delivery_photo_AMO-GH-12345.jpg",
  "file_size": 2309276,
  "content_type": "image/jpeg"
}

Response:
{
  "max_file_size": 314572800,
  "max_part_size": 524288,      // ← Размер chunk'а (512KB)
  "session_id": 388222867,
  "upload_url": "https://drive-b.amocrm.ru/upload/..." // ← URL для загрузки
}`}</pre>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h5 className="font-medium mb-2 flex items-center gap-2">
                    <Badge variant="secondary">Шаг 3</Badge>
                    Загрузка файла по частям (Chunked Upload)
                  </h5>
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm mb-3">
                    <strong>⚠️ Важно:</strong> Файлы загружаются частями по max_part_size (обычно 512KB). 
                    HTTP 202 = chunk принят, продолжайте загрузку. HTTP 200 = загрузка завершена.
                  </div>
                  <div className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">
                    <pre>{`POST {upload_url}
Authorization: Bearer {token}
Content-Type: application/octet-stream
Body: [binary data - chunk 1]

Response (HTTP 202 - ещё не всё):
{
  "next_url": "https://drive-b.amocrm.ru/upload/..."  // ← URL для следующего chunk'а
}

...продолжаем загрузку chunk'ов...

Response (HTTP 200 - последний chunk):
{
  "uuid": "edd31437-42fd-4cb3-981a-7c408c688e1e",           // ← Нужен!
  "version_uuid": "9aaec7ab-2328-4686-917f-76773fa9bad7",  // ← Нужен!
  "_links": {
    "download": {"href": "https://drive-b.amocrm.ru/download/..."}
  }
}`}</pre>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h5 className="font-medium mb-2 flex items-center gap-2">
                    <Badge variant="secondary">Шаг 4</Badge>
                    Создание заметки с прикреплённым файлом
                  </h5>
                  <div className="bg-green-50 border border-green-200 p-3 rounded text-sm mb-3">
                    <strong>✅ Ключевой момент:</strong> Используем note_type: "attachment" и передаём 
                    file_uuid + version_uuid + file_name в params.
                  </div>
                  <div className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">
                    <pre>{`POST https://{domain}/api/v4/leads/{lead_id}/notes
Authorization: Bearer {token}
Content-Type: application/json

Request:
[
  {
    "note_type": "attachment",
    "params": {
      "file_uuid": "edd31437-42fd-4cb3-981a-7c408c688e1e",
      "version_uuid": "9aaec7ab-2328-4686-917f-76773fa9bad7",
      "file_name": "delivery_photo_AMO-GH-12345.jpg"
    }
  }
]

Response (HTTP 200):
{
  "_embedded": {
    "notes": [{"id": 57748909, "entity_id": 22413565}]
  }
}`}</pre>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Ошибки и их решения
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="destructive">404</Badge>
                    <span className="font-medium">Cannot POST /api/v4/files</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>Причина:</strong> Прямой endpoint /api/v4/files не работает для создания сессии.
                    <br/>
                    <strong>Решение:</strong> Сначала получите drive_url через /api/v4/account?with=drive_url, 
                    затем создавайте сессию на {'{drive_url}'}/v1.0/sessions
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="destructive">400</Badge>
                    <span className="font-medium">FieldMissing: params.version_uuid</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>Причина:</strong> Для note_type: "attachment" требуется version_uuid.
                    <br/>
                    <strong>Решение:</strong> Сохраняйте version_uuid из ответа загрузки файла и передавайте его в params.
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">202</Badge>
                    <span className="font-medium">HTTP 202 при загрузке</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>Это НЕ ошибка!</strong> 202 Accepted означает что chunk принят.
                    <br/>
                    <strong>Решение:</strong> Продолжайте загрузку на next_url пока не получите HTTP 200 с uuid.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Пример кода (Python)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                <pre>{`import httpx
import base64

async def upload_photo_to_amocrm(domain: str, token: str, lead_id: str, photo_base64: str, filename: str):
    """Upload photo to amoCRM and attach to lead note."""
    
    # Parse base64
    header, data = photo_base64.split(",", 1)
    content_type = header.replace("data:", "").replace(";base64", "")
    photo_bytes = base64.b64decode(data)
    
    headers_auth = {"Authorization": f"Bearer {token}"}
    headers_json = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        # Step 1: Get drive_url
        account_resp = await client.get(
            f"https://{domain}/api/v4/account?with=drive_url",
            headers=headers_auth
        )
        drive_url = account_resp.json().get("drive_url")
        
        # Step 2: Create upload session
        session_resp = await client.post(
            f"{drive_url}/v1.0/sessions",
            headers=headers_json,
            json={"file_name": filename, "file_size": len(photo_bytes), "content_type": content_type}
        )
        session_data = session_resp.json()
        upload_url = session_data["upload_url"]
        max_part_size = session_data["max_part_size"]
        
        # Step 3: Upload chunks
        file_uuid, version_uuid = None, None
        offset = 0
        
        while offset < len(photo_bytes):
            chunk = photo_bytes[offset:offset + max_part_size]
            resp = await client.post(upload_url, headers=headers_auth, content=chunk)
            data = resp.json()
            
            if data.get("uuid"):
                file_uuid = data["uuid"]
                version_uuid = data["version_uuid"]
                break
            
            upload_url = data["next_url"]
            offset += max_part_size
        
        # Step 4: Create attachment note
        note_resp = await client.post(
            f"https://{domain}/api/v4/leads/{lead_id}/notes",
            headers=headers_json,
            json=[{
                "note_type": "attachment",
                "params": {
                    "file_uuid": file_uuid,
                    "version_uuid": version_uuid,
                    "file_name": filename
                }
            }]
        )
        
        return note_resp.status_code in [200, 201]`}</pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          {/* amoCRM */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                amoCRM
              </CardTitle>
              <CardDescription>Интеграция с CRM системой для синхронизации заказов и статусов</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Необходимые настройки:</h4>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <span><strong>Домен amoCRM</strong> — ваш поддомен (example.amocrm.ru)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <span><strong>Токен доступа</strong> — долгосрочный токен из настроек интеграции</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <span><strong>ID воронки</strong> — для автоматического перемещения сделок</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="h-4 w-4" />
                    Важно
                  </h4>
                  <ul className="text-sm text-amber-700 space-y-1">
                    <li>• Токен имеет срок действия — обновляйте вовремя</li>
                    <li>• Настройте webhook для получения обновлений</li>
                    <li>• Создайте пользовательские поля для синхронизации</li>
                  </ul>
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">Путь к настройкам:</p>
                <code className="text-sm">Панель администрирования → Настройки → Интеграции → amoCRM</code>
              </div>
            </CardContent>
          </Card>

          {/* Google Maps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5 text-green-600" />
                Google Maps
              </CardTitle>
              <CardDescription>API для отображения карт, построения маршрутов и геокодирования</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Необходимые API:</h4>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-center gap-2">
                      <Badge variant="secondary">Maps JavaScript API</Badge>
                      <span className="text-muted-foreground">— отображение карты</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge variant="secondary">Geocoding API</Badge>
                      <span className="text-muted-foreground">— адрес → координаты</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge variant="secondary">Directions API</Badge>
                      <span className="text-muted-foreground">— построение маршрутов</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge variant="secondary">Places API</Badge>
                      <span className="text-muted-foreground">— автодополнение адресов</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Настройка:</h4>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Создайте проект в Google Cloud Console</li>
                    <li>Включите необходимые API</li>
                    <li>Создайте API ключ с ограничениями</li>
                    <li>Добавьте ключ в настройки приложения</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Push Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-purple-600" />
                Push-уведомления (VAPID)
              </CardTitle>
              <CardDescription>Web Push уведомления для водителей о новых рейсах</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Необходимые ключи:</h4>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-start gap-2">
                      <Key className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span><strong>VAPID_PUBLIC_KEY</strong> — публичный ключ (для frontend)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Key className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span><strong>VAPID_PRIVATE_KEY</strong> — приватный ключ (только backend)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span><strong>VAPID_EMAIL</strong> — email для идентификации</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 text-blue-700">Генерация ключей:</h4>
                  <code className="text-xs block bg-blue-100 p-2 rounded mb-2">
                    npx web-push generate-vapid-keys
                  </code>
                  <p className="text-xs text-blue-600">
                    Система автоматически конвертирует PEM формат в base64url
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Telegram */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-sky-600" />
                Telegram Bot
              </CardTitle>
              <CardDescription>Альтернативный канал уведомлений через Telegram</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Настройка:</h4>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Создайте бота через @BotFather</li>
                    <li>Получите токен бота</li>
                    <li>Добавьте токен в настройки</li>
                    <li>Водители подключаются командой /start</li>
                  </ol>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Команды бота:</h4>
                  <ul className="text-sm space-y-1">
                    <li><code>/start</code> — начать работу с ботом</li>
                    <li><code>/link [код]</code> — привязать аккаунт</li>
                    <li><code>/trips</code> — мои рейсы</li>
                    <li><code>/help</code> — справка</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Endpoints Tab */}
        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-orange-600" />
                API для диагностики
              </CardTitle>
              <CardDescription>
                Эндпоинты для проверки работы системы. Используйте их для отладки проблем.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {apiEndpoints.map((endpoint, idx) => (
                  <div key={idx} className="p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={endpoint.method === 'GET' ? 'secondary' : 'default'} className="text-xs">
                            {endpoint.method}
                          </Badge>
                          <span className="font-medium">{endpoint.name}</span>
                          {endpoint.auth && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Shield className="h-3 w-3" />
                              Auth
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{endpoint.description}</p>
                        <code className="text-xs bg-muted px-2 py-1 rounded block">{endpoint.url}</code>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => copyToClipboard(endpoint.url)}
                      >
                        {copiedText === endpoint.url ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Пример использования cURL</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm">
{`# Получить токен
TOKEN=$(curl -s -X POST "https://your-domain.com/api/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{"username":"admin","password":"your_password"}' | jq -r '.token')

# Проверить здоровье сервера
curl -s "https://your-domain.com/api/health"

# Получить логи (с авторизацией)
curl -s "https://your-domain.com/api/driver-panel/debug/logs" \\
  -H "Authorization: Bearer $TOKEN"

# Проверить статус водителя
curl -s "https://your-domain.com/api/notifications/debug/driver/driver-id" \\
  -H "Authorization: Bearer $TOKEN"`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQ Tab */}
        <TabsContent value="faq" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Book className="h-5 w-5 text-indigo-600" />
                Часто задаваемые вопросы
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  q: 'Водитель не получает push-уведомления',
                  a: '1) Убедитесь что водитель подписался на уведомления (кнопка 🔔 в Панели водителя). 2) Проверьте что водитель связан с учётной записью в разделе "Водители". 3) Откройте /push-debug.html и проверьте статус VAPID ключей.'
                },
                {
                  q: 'Фото доставки не отображается в amoCRM',
                  a: '1) Проверьте что токен amoCRM актуален. 2) Убедитесь что заказ имеет привязку к сделке amoCRM (поле amocrm_id). 3) Откройте /photo-debug.html и проверьте статус синхронизации.'
                },
                {
                  q: 'Координаты заказов не определяются',
                  a: '1) Проверьте API ключ Google Maps. 2) Убедитесь что включён Geocoding API. 3) Проверьте формат адреса — он должен быть достаточно полным для геокодирования.'
                },
                {
                  q: 'Рейсы не отображаются в панели водителя',
                  a: '1) Убедитесь что водителю назначен рейс. 2) Проверьте что водитель связан с учётной записью. 3) Рейс должен иметь статус "Готов к отправке" или "В пути".'
                },
                {
                  q: 'Ошибка 401 Unauthorized',
                  a: '1) Токен авторизации истёк — перелогиньтесь. 2) Проверьте что используете правильный ключ в localStorage (authToken). 3) Очистите кэш браузера и войдите заново.'
                },
                {
                  q: 'Как обновить токен amoCRM?',
                  a: 'Зайдите в amoCRM → Настройки → Интеграции → Ваша интеграция → Скопируйте новый долгосрочный токен → Вставьте в Панель администрирования → Настройки → Интеграции.'
                }
              ].map((item, idx) => (
                <div key={idx} className="border rounded-lg">
                  <button 
                    className="w-full p-4 text-left flex items-center justify-between hover:bg-muted/50 transition-colors"
                    onClick={(e) => {
                      const content = e.currentTarget.nextElementSibling;
                      content.classList.toggle('hidden');
                    }}
                  >
                    <span className="font-medium">{item.q}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <div className="hidden px-4 pb-4">
                    <p className="text-sm text-muted-foreground">{item.a}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Zap className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">Нужна дополнительная помощь?</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Если вы не нашли ответ на свой вопрос, свяжитесь с технической поддержкой или разработчиками.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-1" />
                      Документация
                    </Button>
                    <Button variant="outline" size="sm">
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Написать в поддержку
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminHelpPage;
