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
  ExternalLink
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const IntegrationsPage = () => {
  const [settings, setSettings] = useState({
    enabled: false,
    secret_key: '',
    pipeline_id: '',
    status_id: '',
    webhook_url: ''
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchLogs();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/integrations/amocrm/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
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
      const res = await fetch(`${API_URL}/api/integrations/amocrm/logs?limit=20`);
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
        body: JSON.stringify({
          enabled: settings.enabled,
          secret_key: settings.secret_key,
          pipeline_id: settings.pipeline_id || null,
          status_id: settings.status_id || null,
          field_mapping: {}
        })
      });

      if (res.ok) {
        toast.success('Настройки сохранены');
        fetchSettings(); // Refresh to get updated webhook URL
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

  const testIntegration = async () => {
    setTesting(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/amocrm/test`, {
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
      setTesting(false);
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

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link className="h-8 w-8 text-[#355c7d]" />
        <h1 className="text-2xl font-bold text-gray-900">Интеграции</h1>
      </div>

      <Tabs defaultValue="amocrm" className="w-full">
        <TabsList>
          <TabsTrigger value="amocrm" className="gap-2">
            <Webhook className="h-4 w-4" />
            amoCRM
          </TabsTrigger>
        </TabsList>

        <TabsContent value="amocrm" className="space-y-6">
          {/* Settings Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Настройки amoCRM
                  </CardTitle>
                  <CardDescription>
                    Автоматическое создание заказов теплиц при переходе сделки на определённый этап
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
                  URL для Webhook (скопируйте в amoCRM)
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
                <p className="text-sm text-muted-foreground">
                  Этот URL нужно указать в настройках Digital Pipeline amoCRM
                </p>
              </div>

              {/* Secret Key */}
              <div className="space-y-2">
                <Label>Секретный ключ (опционально)</Label>
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
                <p className="text-sm text-muted-foreground">
                  Добавляется к URL как параметр ?key=... для защиты endpoint
                </p>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ID воронки (Pipeline ID)</Label>
                  <Input
                    value={settings.pipeline_id || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, pipeline_id: e.target.value }))}
                    placeholder="Например: 1234567"
                  />
                  <p className="text-sm text-muted-foreground">
                    Оставьте пустым для приёма из любой воронки
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>ID этапа (Status ID)</Label>
                  <Input
                    value={settings.status_id || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, status_id: e.target.value }))}
                    placeholder="Например: 142"
                  />
                  <p className="text-sm text-muted-foreground">
                    Оставьте пустым для приёма с любого этапа
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={saveSettings} disabled={saving}>
                  {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Сохранить настройки
                </Button>
                <Button variant="outline" onClick={testIntegration} disabled={testing}>
                  {testing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
                  Создать тестовый заказ
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Instructions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Инструкция по настройке
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center shrink-0">1</Badge>
                  <div>
                    <p className="font-medium">Определите ID воронки и этапа</p>
                    <p className="text-muted-foreground">В amoCRM откройте настройки воронки или используйте API метод pipelines</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center shrink-0">2</Badge>
                  <div>
                    <p className="font-medium">Добавьте Webhook в Digital Pipeline</p>
                    <p className="text-muted-foreground">В настройках воронки amoCRM добавьте действие WebHook на нужный этап</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center shrink-0">3</Badge>
                  <div>
                    <p className="font-medium">Укажите URL webhook</p>
                    <p className="text-muted-foreground">Скопируйте URL выше и вставьте в настройки webhook в amoCRM</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center shrink-0">4</Badge>
                  <div>
                    <p className="font-medium">Настройте поля</p>
                    <p className="text-muted-foreground">Убедитесь, что в сделке есть поля: Имя контакта, Телефон, Адрес</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center shrink-0">5</Badge>
                  <div>
                    <p className="font-medium">Протестируйте</p>
                    <p className="text-muted-foreground">Создайте тестовую сделку и переведите на нужный этап</p>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <a 
                  href="https://www.amocrm.ru/developers/content/crm_platform/webhooks-format" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  Документация amoCRM по Webhooks
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Logs Card */}
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
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {logs.map((log, index) => (
                    <div 
                      key={index}
                      className="p-3 border rounded-lg text-sm space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString('ru-RU')}
                        </span>
                        {getStatusBadge(log.status)}
                      </div>
                      {log.reason && (
                        <p className="text-muted-foreground">{log.reason}</p>
                      )}
                      {log.created_order_id && (
                        <p className="text-green-600">Создан заказ: {log.created_order_id}</p>
                      )}
                      {log.parsed_data && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Данные
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
