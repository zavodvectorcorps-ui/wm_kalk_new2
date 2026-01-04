import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { 
  Settings, 
  Link, 
  RefreshCw, 
  Copy, 
  CheckCircle, 
  XCircle, 
  Clock,
  Webhook,
  TestTube,
  List,
  Info,
  ExternalLink,
  Warehouse,
  Waves,
  Flame,
  ArrowLeftRight,
  Key
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const IntegrationsPage = () => {
  const [settings, setSettings] = useState({
    enabled: false,
    webhook_urls: {
      greenhouse: '',
      balia: '',
      sauna: ''
    },
    amocrm_domain: '',
    amocrm_token: '',
    status_field_id: '',
    comment_field_id: ''
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(null);
  const [activeTab, setActiveTab] = useState('settings');

  useEffect(() => {
    fetchSettings();
    fetchLogs();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/integrations/amocrm/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Ошибка загрузки настроек');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/integrations/amocrm/logs?limit=30`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/amocrm/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (res.ok) {
        toast.success('Настройки сохранены');
        fetchSettings();
      } else {
        toast.error('Ошибка сохранения');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const testIntegration = async (section) => {
    setTesting(section);
    try {
      const res = await fetch(`${API_URL}/api/integrations/amocrm/test/${section}`, {
        method: 'POST'
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Тестовый заказ создан: ${data.order?.id}`);
        fetchLogs();
      } else {
        toast.error('Ошибка тестирования');
      }
    } catch (error) {
      console.error('Error testing:', error);
      toast.error('Ошибка тестирования');
    } finally {
      setTesting(null);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(settings.webhook_url);
    setCopied(true);
    toast.success('URL скопирован');
    setTimeout(() => setCopied(false), 2000);
  };

  const generateSecretKey = () => {
    const key = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    setSettings(prev => ({ ...prev, secret_key: key }));
  };

  const updatePipelineConfig = (section, field, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Успешно</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Ошибка</Badge>;
      case 'skipped':
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Пропущено</Badge>;
      case 'rejected':
        return <Badge className="bg-gray-100 text-gray-700"><XCircle className="w-3 h-3 mr-1" />Отклонено</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getSectionBadge = (section) => {
    const configs = {
      greenhouse: { icon: Warehouse, color: 'text-green-600', bg: 'bg-green-100', name: 'Теплицы' },
      balia: { icon: Waves, color: 'text-blue-600', bg: 'bg-blue-100', name: 'Купели' },
      sauna: { icon: Flame, color: 'text-orange-600', bg: 'bg-orange-100', name: 'Сауны' }
    };
    const config = configs[section];
    if (!config) return null;
    const Icon = config.icon;
    return (
      <Badge className={`${config.bg} ${config.color} gap-1`}>
        <Icon className="w-3 h-3" />
        {config.name}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const PipelineConfigCard = ({ section, icon: Icon, title, color, bgColor }) => (
    <Card className={`border-2 ${settings[section]?.enabled ? `${bgColor}/20 border-${color}/30` : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className={`h-5 w-5 ${color}`} />
            {title}
          </CardTitle>
          <Switch
            checked={settings[section]?.enabled || false}
            onCheckedChange={(checked) => updatePipelineConfig(section, 'enabled', checked)}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label className="text-sm">ID воронки (Pipeline ID)</Label>
          <Input
            value={settings[section]?.pipeline_id || ''}
            onChange={(e) => updatePipelineConfig(section, 'pipeline_id', e.target.value)}
            placeholder="Например: 1234567"
            disabled={!settings[section]?.enabled}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">ID этапа (Status ID) - опционально</Label>
          <Input
            value={settings[section]?.status_id || ''}
            onChange={(e) => updatePipelineConfig(section, 'status_id', e.target.value)}
            placeholder="Например: 142"
            disabled={!settings[section]?.enabled}
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => testIntegration(section)}
          disabled={testing === section}
          className="w-full mt-2"
        >
          {testing === section ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <TestTube className="h-4 w-4 mr-2" />
          )}
          Создать тестовый заказ
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link className="h-8 w-8 text-[#355c7d]" />
        <h1 className="text-2xl font-bold text-gray-900">Интеграции</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Настройки
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            Синхронизация
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <List className="h-4 w-4" />
            Логи
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          {/* Main Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="h-5 w-5" />
                    amoCRM Webhook
                  </CardTitle>
                  <CardDescription>
                    Автоматическое создание заказов при переходе сделки на определённый этап
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="enabled">Включено</Label>
                  <Switch
                    id="enabled"
                    checked={settings.enabled}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enabled: checked }))}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Webhook URL */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Webhook className="h-4 w-4" />
                  URL для Webhook (единый для всех воронок)
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={settings.webhook_url}
                    readOnly
                    className="font-mono text-sm bg-muted"
                  />
                  <Button variant="outline" onClick={copyWebhookUrl}>
                    {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Secret Key */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Секретный ключ
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={settings.secret_key}
                    onChange={(e) => setSettings(prev => ({ ...prev, secret_key: e.target.value }))}
                    placeholder="Оставьте пустым или сгенерируйте"
                    className="font-mono"
                  />
                  <Button variant="outline" onClick={generateSecretKey}>
                    Сгенерировать
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline Configurations */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PipelineConfigCard
              section="greenhouse"
              icon={Warehouse}
              title="Теплицы"
              color="text-green-600"
              bgColor="bg-green-100"
            />
            <PipelineConfigCard
              section="balia"
              icon={Waves}
              title="Купели"
              color="text-blue-600"
              bgColor="bg-blue-100"
            />
            <PipelineConfigCard
              section="sauna"
              icon={Flame}
              title="Сауны"
              color="text-orange-600"
              bgColor="bg-orange-100"
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={saving} size="lg">
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              Сохранить все настройки
            </Button>
          </div>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Инструкция
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center shrink-0">1</Badge>
                <p>Определите ID воронок в amoCRM (в настройках или через API)</p>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center shrink-0">2</Badge>
                <p>Введите ID воронки для каждого раздела и включите нужные разделы</p>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center shrink-0">3</Badge>
                <p>Скопируйте URL webhook и добавьте его в настройки Digital Pipeline в amoCRM на нужный этап</p>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center shrink-0">4</Badge>
                <p>Переведите тестовую сделку на этап - заказ появится в соответствующем разделе Логистики</p>
              </div>
              <div className="pt-3 border-t">
                <a 
                  href="https://www.amocrm.ru/developers/content/crm_platform/webhooks-format" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  Документация amoCRM
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync Tab */}
        <TabsContent value="sync" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5" />
                Синхронизация статусов в amoCRM
              </CardTitle>
              <CardDescription>
                Отправка статуса доставки и комментариев обратно в amoCRM
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* amoCRM Credentials */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h4 className="font-medium flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Доступ к API amoCRM
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Домен amoCRM</Label>
                    <Input
                      value={settings.amocrm_domain}
                      onChange={(e) => setSettings(prev => ({ ...prev, amocrm_domain: e.target.value }))}
                      placeholder="mycompany.amocrm.ru"
                    />
                    <p className="text-xs text-muted-foreground">Без https://</p>
                  </div>
                  <div className="space-y-2">
                    <Label>API Token (Long-lived)</Label>
                    <Input
                      type="password"
                      value={settings.amocrm_token}
                      onChange={(e) => setSettings(prev => ({ ...prev, amocrm_token: e.target.value }))}
                      placeholder="Вставьте токен из amoCRM"
                    />
                    <p className="text-xs text-muted-foreground">
                      Создайте в amoCRM → Настройки → Интеграции → Собственная интеграция
                    </p>
                  </div>
                </div>
              </div>

              {/* Field IDs */}
              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="font-medium">ID полей для синхронизации</h4>
                <p className="text-sm text-muted-foreground">
                  Создайте в amoCRM кастомные поля (тип: текст) для сделок и укажите их ID
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ID поля для статуса доставки</Label>
                    <Input
                      value={settings.status_field_id}
                      onChange={(e) => setSettings(prev => ({ ...prev, status_field_id: e.target.value }))}
                      placeholder="Например: 123456"
                    />
                    <p className="text-xs text-muted-foreground">
                      Сюда будет записываться статус: Ожидает, В пути, Доставлено
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>ID поля для комментария/даты</Label>
                    <Input
                      value={settings.comment_field_id}
                      onChange={(e) => setSettings(prev => ({ ...prev, comment_field_id: e.target.value }))}
                      placeholder="Например: 123457"
                    />
                    <p className="text-xs text-muted-foreground">
                      Сюда будет записываться дата доставки или комментарий
                    </p>
                  </div>
                </div>
              </div>

              {/* How to get field IDs */}
              <div className="p-4 bg-blue-50 rounded-lg text-sm">
                <h4 className="font-medium text-blue-800 mb-2">Как получить ID полей?</h4>
                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                  <li>В amoCRM откройте сделку</li>
                  <li>Создайте кастомное поле (тип: строка или текст)</li>
                  <li>Откройте браузерные DevTools (F12) → Network</li>
                  <li>Измените значение поля и сохраните</li>
                  <li>Найдите запрос к API и посмотрите field_id в payload</li>
                </ol>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveSettings} disabled={saving}>
                  {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Сохранить настройки синхронизации
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <List className="h-5 w-5" />
                  Логи Webhook
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={fetchLogs}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Нет записей. Логи появятся после первого webhook запроса.
                </p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {logs.map((log, index) => (
                    <div 
                      key={index}
                      className="p-3 border rounded-lg text-sm space-y-2"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString('ru-RU')}
                        </span>
                        <div className="flex items-center gap-2">
                          {log.section && getSectionBadge(log.section)}
                          {getStatusBadge(log.status)}
                        </div>
                      </div>
                      {log.reason && (
                        <p className="text-muted-foreground">{log.reason}</p>
                      )}
                      {log.created_order_id && (
                        <p className="text-green-600 font-medium">Создан заказ: {log.created_order_id}</p>
                      )}
                      {log.parsed_data && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Показать данные
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">
                            {JSON.stringify(log.parsed_data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
