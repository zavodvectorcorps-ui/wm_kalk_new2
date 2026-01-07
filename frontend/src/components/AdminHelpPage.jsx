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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="debug" className="gap-2">
            <Bug className="h-4 w-4" />
            Диагностика
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
