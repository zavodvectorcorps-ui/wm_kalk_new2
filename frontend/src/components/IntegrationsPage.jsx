import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
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
  Key,
  Trash2,
  Route,
  AlertCircle,
  Bell,
  Download,
  Package
} from 'lucide-react';
import NotificationSettings from './NotificationSettings';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Default field mapping template
const DEFAULT_FIELD_MAPPING = {
  fullName: '',           // Имя клиента
  phoneNumber: '',        // Телефон клиента
  orderNumber: '',        // Номер заказа в amoCRM
  addressStreet: '',      // Улица (адрес)
  addressCity: '',        // Город
  addressIndex: '',       // Индекс
  orderContents: '',      // Состав заказа
  orderComment: '',       // Комментарий к заказу
  dealSum: '',            // Сумма сделки
  debtSum: ''             // Сумма задолженности
};

export const IntegrationsPage = () => {
  const [settings, setSettings] = useState({
    enabled: false,
    webhook_urls: {
      greenhouse: '',
      balia: '',
      sauna: ''
    },
    // Field mapping - separate for each section
    field_mapping: {
      greenhouse: { ...DEFAULT_FIELD_MAPPING },
      balia: { ...DEFAULT_FIELD_MAPPING },
      sauna: { ...DEFAULT_FIELD_MAPPING }
    },
    // Two-way sync settings
    amocrm_domain: '',
    amocrm_token: '',
    status_field_id: '',
    comment_field_id: '',
    // Stage sync settings - which stages to pull orders from
    stage_sync: {
      greenhouse: { pipeline_id: '', status_id: '' },
      balia: { pipeline_id: '', status_id: '' },
      sauna: { pipeline_id: '', status_id: '' }
    }
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(null);
  const [activeTab, setActiveTab] = useState('settings');
  const [activeMappingSection, setActiveMappingSection] = useState('greenhouse');
  const [drivers, setDrivers] = useState([]);
  const [widgetInfo, setWidgetInfo] = useState(null);
  const [pipelines, setPipelines] = useState([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchLogs();
    fetchDrivers();
    fetchWidgetInfo();
    fetchPipelines();
  }, []);

  const fetchPipelines = async () => {
    setLoadingPipelines(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/amocrm/pipelines`);
      if (res.ok) {
        const data = await res.json();
        if (data.pipelines) {
          setPipelines(data.pipelines);
        }
      }
    } catch (e) {
      console.error('Failed to load pipelines:', e);
    } finally {
      setLoadingPipelines(false);
    }
  };

  const fetchWidgetInfo = async () => {
    try {
      const res = await fetch(`${API_URL}/api/widget/embed-info`);
      if (res.ok) {
        const data = await res.json();
        setWidgetInfo(data);
      }
    } catch (e) {
      console.error('Failed to load widget info:', e);
    }
  };

  const fetchDrivers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/drivers`);
      if (res.ok) {
        const data = await res.json();
        setDrivers(data);
      }
    } catch (e) {
      console.error('Failed to load drivers:', e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/integrations/amocrm/settings`);
      if (res.ok) {
        const data = await res.json();
        // Ensure field_mapping has proper structure for each section
        const fieldMapping = data.field_mapping || {};
        const normalizedMapping = {
          greenhouse: { ...DEFAULT_FIELD_MAPPING, ...(fieldMapping.greenhouse || fieldMapping) },
          balia: { ...DEFAULT_FIELD_MAPPING, ...(fieldMapping.balia || fieldMapping) },
          sauna: { ...DEFAULT_FIELD_MAPPING, ...(fieldMapping.sauna || fieldMapping) }
        };
        setSettings(prev => ({ 
          ...prev, 
          ...data,
          field_mapping: normalizedMapping
        }));
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
      // Save amoCRM settings
      const res = await fetch(`${API_URL}/api/integrations/amocrm/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      // Also save warehouse settings if provided
      if (settings.warehouse_address) {
        const token = localStorage.getItem('authToken');
        const warehouseRes = await fetch(`${API_URL}/api/driver-panel/warehouse-settings`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            warehouse_address: settings.warehouse_address,
            warehouse_lat: settings.warehouse_lat,
            warehouse_lng: settings.warehouse_lng
          })
        });
        
        if (warehouseRes.ok) {
          const warehouseData = await warehouseRes.json();
          // Update local state with geocoded coordinates
          if (warehouseData.warehouse_lat && warehouseData.warehouse_lng) {
            setSettings(prev => ({
              ...prev,
              warehouse_lat: warehouseData.warehouse_lat,
              warehouse_lng: warehouseData.warehouse_lng
            }));
          }
        }
      }

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

  const deleteAmocrmOrders = async (section) => {
    if (!window.confirm(`Удалить ВСЕ заказы из amoCRM в разделе "${section}"?`)) {
      return;
    }
    
    setDeleting(section);
    try {
      const res = await fetch(`${API_URL}/api/integrations/amocrm/orders/${section}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success(`Удалено заказов: ${data.deleted_count}`);
      } else {
        toast.error('Ошибка удаления');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Ошибка удаления');
    } finally {
      setDeleting(null);
    }
  };

  const copyWebhookUrl = (section) => {
    const url = settings.webhook_urls?.[section] || '';
    navigator.clipboard.writeText(url);
    setCopiedUrl(section);
    toast.success('URL скопирован');
    setTimeout(() => setCopiedUrl(null), 2000);
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

  // Render webhook URL card
  const renderWebhookCard = (section, Icon, title, color, bgColor) => (
    <Card key={section} className={`border-2 ${bgColor}/20`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`h-5 w-5 ${color}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label className="text-sm">URL для Webhook</Label>
          <div className="flex gap-2">
            <Input
              value={settings.webhook_urls?.[section] || ''}
              readOnly
              className="font-mono text-xs bg-muted"
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => copyWebhookUrl(section)}
            >
              {copiedUrl === section ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => testIntegration(section)}
          disabled={testing === section}
          className="w-full"
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
        <TabsList className="flex-wrap">
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Webhook URLs
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            Синхронизация
          </TabsTrigger>
          <TabsTrigger value="widget" className="gap-2">
            <Package className="h-4 w-4" />
            Виджет
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Уведомления
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <List className="h-4 w-4" />
            Логи
          </TabsTrigger>
          <TabsTrigger value="calculator" className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Калькулятор
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
                    Автоматическое создание заказов при переходе сделки на нужный этап
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
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Скопируйте нужный URL и вставьте его в настройки Digital Pipeline в amoCRM на этапе, 
                при достижении которого должен создаваться заказ.
              </p>
            </CardContent>
          </Card>

          {/* Webhook URLs for each section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderWebhookCard("greenhouse", Warehouse, "Теплицы", "text-green-600", "bg-green-100")}
            {renderWebhookCard("balia", Waves, "Купели", "text-blue-600", "bg-blue-100")}
            {renderWebhookCard("sauna", Flame, "Сауны", "text-orange-600", "bg-orange-100")}
          </div>

          {/* Field Mapping - Separate for each section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5" />
                Маппинг полей amoCRM
              </CardTitle>
              <CardDescription>
                Укажите ID полей из amoCRM для каждой категории отдельно. Поля могут отличаться для разных продуктов.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Section tabs */}
              <div className="flex gap-2 border-b pb-2">
                <Button
                  variant={activeMappingSection === 'greenhouse' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveMappingSection('greenhouse')}
                  className={activeMappingSection === 'greenhouse' ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  <Warehouse className="h-4 w-4 mr-1" />
                  Теплицы
                </Button>
                <Button
                  variant={activeMappingSection === 'balia' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveMappingSection('balia')}
                  className={activeMappingSection === 'balia' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                >
                  <Waves className="h-4 w-4 mr-1" />
                  Купели
                </Button>
                <Button
                  variant={activeMappingSection === 'sauna' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveMappingSection('sauna')}
                  className={activeMappingSection === 'sauna' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                >
                  <Flame className="h-4 w-4 mr-1" />
                  Сауны
                </Button>
              </div>

              {/* Field mapping for active section */}
              <div className="space-y-6">
                {/* Basic fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Имя клиента</Label>
                    <Input
                      value={settings.field_mapping?.[activeMappingSection]?.fullName || ''}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        field_mapping: { 
                          ...prev.field_mapping, 
                          [activeMappingSection]: {
                            ...prev.field_mapping[activeMappingSection],
                            fullName: e.target.value 
                          }
                        }
                      }))}
                      placeholder="ID поля"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Телефон клиента</Label>
                    <Input
                      value={settings.field_mapping?.[activeMappingSection]?.phoneNumber || ''}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        field_mapping: { 
                          ...prev.field_mapping, 
                          [activeMappingSection]: {
                            ...prev.field_mapping[activeMappingSection],
                            phoneNumber: e.target.value 
                          }
                        }
                      }))}
                      placeholder="ID поля"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Номер заказа</Label>
                    <Input
                      value={settings.field_mapping?.[activeMappingSection]?.orderNumber || ''}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        field_mapping: { 
                          ...prev.field_mapping, 
                          [activeMappingSection]: {
                            ...prev.field_mapping[activeMappingSection],
                            orderNumber: e.target.value 
                          }
                        }
                      }))}
                      placeholder="ID поля"
                    />
                  </div>
                </div>

                {/* Address fields */}
                <div className="border rounded-lg p-4 space-y-4">
                  <Label className="text-base font-semibold">Адрес клиента</Label>
                  <p className="text-sm text-muted-foreground">
                    Укажите ID полей для сборки полного адреса. Адрес формируется: Улица, Город, Индекс
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Улица / Адрес</Label>
                      <Input
                        value={settings.field_mapping?.[activeMappingSection]?.addressStreet || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          field_mapping: { 
                            ...prev.field_mapping, 
                            [activeMappingSection]: {
                              ...prev.field_mapping[activeMappingSection],
                              addressStreet: e.target.value 
                            }
                          }
                        }))}
                        placeholder="ID поля"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Город</Label>
                      <Input
                        value={settings.field_mapping?.[activeMappingSection]?.addressCity || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          field_mapping: { 
                            ...prev.field_mapping, 
                            [activeMappingSection]: {
                              ...prev.field_mapping[activeMappingSection],
                              addressCity: e.target.value 
                            }
                          }
                        }))}
                        placeholder="ID поля"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Индекс</Label>
                      <Input
                        value={settings.field_mapping?.[activeMappingSection]?.addressIndex || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          field_mapping: { 
                            ...prev.field_mapping, 
                            [activeMappingSection]: {
                              ...prev.field_mapping[activeMappingSection],
                              addressIndex: e.target.value 
                            }
                          }
                        }))}
                        placeholder="ID поля"
                      />
                    </div>
                  </div>
                </div>

                {/* Order details */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Состав заказа</Label>
                    <Input
                      value={settings.field_mapping?.[activeMappingSection]?.orderContents || ''}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        field_mapping: { 
                          ...prev.field_mapping, 
                          [activeMappingSection]: {
                            ...prev.field_mapping[activeMappingSection],
                            orderContents: e.target.value 
                          }
                        }
                      }))}
                      placeholder="ID поля"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Комментарий к заказу</Label>
                    <Input
                      value={settings.field_mapping?.[activeMappingSection]?.orderComment || ''}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        field_mapping: { 
                          ...prev.field_mapping, 
                          [activeMappingSection]: {
                            ...prev.field_mapping[activeMappingSection],
                            orderComment: e.target.value 
                          }
                        }
                      }))}
                      placeholder="ID поля"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Сумма сделки</Label>
                    <Input
                      value={settings.field_mapping?.[activeMappingSection]?.dealSum || ''}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        field_mapping: { 
                          ...prev.field_mapping, 
                          [activeMappingSection]: {
                            ...prev.field_mapping[activeMappingSection],
                            dealSum: e.target.value 
                          }
                        }
                      }))}
                      placeholder="ID поля"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Сумма задолженности</Label>
                    <Input
                      value={settings.field_mapping?.[activeMappingSection]?.debtSum || ''}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        field_mapping: { 
                          ...prev.field_mapping, 
                          [activeMappingSection]: {
                            ...prev.field_mapping[activeMappingSection],
                            debtSum: e.target.value 
                          }
                        }
                      }))}
                      placeholder="ID поля"
                    />
                  </div>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    <strong>Как найти ID поля:</strong> В amoCRM откройте карточку сделки → F12 (DevTools) → 
                    наведите на нужное поле → найдите атрибут <code>data-field-id</code> или посмотрите в URL API запроса.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stage Sync Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5" />
                Этапы для сравнения с логистикой
              </CardTitle>
              <CardDescription>
                Укажите из какого этапа какой воронки брать заказы для сравнения с локальной базой
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPipelines ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Загрузка воронок из amoCRM...
                </div>
              ) : pipelines.length === 0 ? (
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Для загрузки воронок необходимо сначала указать домен и токен amoCRM в настройках синхронизации ниже.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={fetchPipelines}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Обновить воронки
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Greenhouse */}
                  <div className="p-4 bg-green-50 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Warehouse className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">Теплицы</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Воронка</Label>
                        <Select
                          value={settings.stage_sync?.greenhouse?.pipeline_id || ''}
                          onValueChange={(val) => setSettings(prev => ({
                            ...prev,
                            stage_sync: {
                              ...prev.stage_sync,
                              greenhouse: { ...prev.stage_sync?.greenhouse, pipeline_id: val, status_id: '' }
                            }
                          }))}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Выберите воронку" />
                          </SelectTrigger>
                          <SelectContent>
                            {pipelines.map(p => (
                              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Этап</Label>
                        <Select
                          value={settings.stage_sync?.greenhouse?.status_id || ''}
                          onValueChange={(val) => setSettings(prev => ({
                            ...prev,
                            stage_sync: {
                              ...prev.stage_sync,
                              greenhouse: { ...prev.stage_sync?.greenhouse, status_id: val }
                            }
                          }))}
                          disabled={!settings.stage_sync?.greenhouse?.pipeline_id}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Выберите этап" />
                          </SelectTrigger>
                          <SelectContent>
                            {pipelines
                              .find(p => p.id.toString() === settings.stage_sync?.greenhouse?.pipeline_id)
                              ?.statuses?.map(s => (
                                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Balia */}
                  <div className="p-4 bg-blue-50 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Waves className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-blue-800">Купели</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Воронка</Label>
                        <Select
                          value={settings.stage_sync?.balia?.pipeline_id || ''}
                          onValueChange={(val) => setSettings(prev => ({
                            ...prev,
                            stage_sync: {
                              ...prev.stage_sync,
                              balia: { ...prev.stage_sync?.balia, pipeline_id: val, status_id: '' }
                            }
                          }))}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Выберите воронку" />
                          </SelectTrigger>
                          <SelectContent>
                            {pipelines.map(p => (
                              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Этап</Label>
                        <Select
                          value={settings.stage_sync?.balia?.status_id || ''}
                          onValueChange={(val) => setSettings(prev => ({
                            ...prev,
                            stage_sync: {
                              ...prev.stage_sync,
                              balia: { ...prev.stage_sync?.balia, status_id: val }
                            }
                          }))}
                          disabled={!settings.stage_sync?.balia?.pipeline_id}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Выберите этап" />
                          </SelectTrigger>
                          <SelectContent>
                            {pipelines
                              .find(p => p.id.toString() === settings.stage_sync?.balia?.pipeline_id)
                              ?.statuses?.map(s => (
                                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Sauna */}
                  <div className="p-4 bg-orange-50 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Flame className="h-5 w-5 text-orange-600" />
                      <span className="font-medium text-orange-800">Сауны</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Воронка</Label>
                        <Select
                          value={settings.stage_sync?.sauna?.pipeline_id || ''}
                          onValueChange={(val) => setSettings(prev => ({
                            ...prev,
                            stage_sync: {
                              ...prev.stage_sync,
                              sauna: { ...prev.stage_sync?.sauna, pipeline_id: val, status_id: '' }
                            }
                          }))}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Выберите воронку" />
                          </SelectTrigger>
                          <SelectContent>
                            {pipelines.map(p => (
                              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Этап</Label>
                        <Select
                          value={settings.stage_sync?.sauna?.status_id || ''}
                          onValueChange={(val) => setSettings(prev => ({
                            ...prev,
                            stage_sync: {
                              ...prev.stage_sync,
                              sauna: { ...prev.stage_sync?.sauna, status_id: val }
                            }
                          }))}
                          disabled={!settings.stage_sync?.sauna?.pipeline_id}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Выберите этап" />
                          </SelectTrigger>
                          <SelectContent>
                            {pipelines
                              .find(p => p.id.toString() === settings.stage_sync?.sauna?.pipeline_id)
                              ?.statuses?.map(s => (
                                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">
                      После настройки этапов в <strong>Логистике</strong> появится блок сравнения, 
                      показывающий сколько заказов на выбранном этапе в amoCRM и сколько перенесено в систему.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Button and Delete */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => deleteAmocrmOrders('all')}
                disabled={deleting === 'all'}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {deleting === 'all' ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Удалить все заказы amoCRM
              </Button>
            </div>
            <Button onClick={saveSettings} disabled={saving} size="lg">
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              Сохранить настройки
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
                <p>Включите интеграцию и сохраните настройки</p>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center shrink-0">2</Badge>
                <p>Скопируйте URL webhook для нужного раздела (Теплицы, Купели или Сауны)</p>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center shrink-0">3</Badge>
                <p>В amoCRM откройте настройки воронки → Digital Pipeline → выберите этап → добавьте Webhook с скопированным URL</p>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center shrink-0">4</Badge>
                <p>Переведите тестовую сделку на этот этап — заказ появится в соответствующем разделе Логистики</p>
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

              {/* Trip sync fields */}
              <div className="space-y-4 p-4 border rounded-lg bg-purple-50/30">
                <h4 className="font-medium flex items-center gap-2">
                  <Route className="h-4 w-4 text-purple-600" />
                  ID полей для синхронизации рейсов
                </h4>
                <p className="text-sm text-muted-foreground">
                  Эти поля обновляются при изменении рейса — номер рейса, водитель, дата отправки, статус
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ID поля: Номер рейса</Label>
                    <Input
                      value={settings.trip_number_field_id || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, trip_number_field_id: e.target.value }))}
                      placeholder="Например: 123458"
                    />
                    <p className="text-xs text-muted-foreground">
                      Название/ID рейса в системе
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>ID поля: Водитель</Label>
                    <Input
                      value={settings.trip_driver_field_id || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, trip_driver_field_id: e.target.value }))}
                      placeholder="Например: 123459"
                    />
                    <p className="text-xs text-muted-foreground">
                      Имя назначенного водителя
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>ID поля: Дата отправки</Label>
                    <Input
                      value={settings.trip_departure_field_id || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, trip_departure_field_id: e.target.value }))}
                      placeholder="Например: 123460"
                    />
                    <p className="text-xs text-muted-foreground">
                      Дата отправления рейса
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>ID поля: Статус заказа в рейсе</Label>
                    <Input
                      value={settings.trip_order_status_field_id || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, trip_order_status_field_id: e.target.value }))}
                      placeholder="Например: 123461"
                    />
                    <p className="text-xs text-muted-foreground">
                      Статус конкретного заказа: Ожидает, В пути, Доставлен
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Important order flag field */}
              <div className="space-y-4 p-4 border rounded-lg bg-orange-50/30">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  Флаг "Важный заказ"
                </h4>
                <p className="text-sm text-muted-foreground">
                  Если в amoCRM включен этот флаг, заказ автоматически отмечается как важный в логистике
                </p>
                <div className="space-y-2">
                  <Label>ID поля-флага в amoCRM</Label>
                  <Input
                    value={settings.important_order_field_id || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, important_order_field_id: e.target.value }))}
                    placeholder="Например: 123462"
                  />
                  <p className="text-xs text-muted-foreground">
                    Тип поля в amoCRM: Флаг (checkbox). Если включен — заказ будет важным.
                  </p>
                </div>
              </div>

              {/* Field types for clearing */}
              <div className="space-y-4 p-4 border rounded-lg bg-yellow-50/30">
                <h4 className="font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4 text-yellow-600" />
                  Типы полей для очистки
                </h4>
                <p className="text-sm text-muted-foreground">
                  Укажите типы полей amoCRM для корректной очистки данных рейса при удалении заказа
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Тип поля: Номер рейса</Label>
                    <select
                      className="w-full h-10 px-3 rounded-md border bg-background"
                      value={settings.trip_number_field_type || 'text'}
                      onChange={(e) => setSettings(prev => ({ ...prev, trip_number_field_type: e.target.value }))}
                    >
                      <option value="text">Текст</option>
                      <option value="numeric">Число</option>
                      <option value="select">Список</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Тип поля: Водитель</Label>
                    <select
                      className="w-full h-10 px-3 rounded-md border bg-background"
                      value={settings.trip_driver_field_type || 'text'}
                      onChange={(e) => setSettings(prev => ({ ...prev, trip_driver_field_type: e.target.value }))}
                    >
                      <option value="text">Текст</option>
                      <option value="numeric">Число</option>
                      <option value="select">Список</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Тип поля: Статус</Label>
                    <select
                      className="w-full h-10 px-3 rounded-md border bg-background"
                      value={settings.trip_order_status_field_type || 'text'}
                      onChange={(e) => setSettings(prev => ({ ...prev, trip_order_status_field_type: e.target.value }))}
                    >
                      <option value="text">Текст</option>
                      <option value="numeric">Число</option>
                      <option value="select">Список</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Числовые поля очищаются через пустой массив values, текстовые — через пустую строку
                </p>
              </div>

              {/* Warehouse settings for route planning */}
              <div className="space-y-4 p-4 border rounded-lg bg-green-50/30">
                <h4 className="font-medium flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-green-600" />
                  Адрес склада (начальная точка маршрута)
                </h4>
                <p className="text-sm text-muted-foreground">
                  Маршрут в кабинете водителя будет строиться от этого адреса
                </p>
                <div className="space-y-2">
                  <Label>Адрес склада</Label>
                  <Input
                    value={settings.warehouse_address || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, warehouse_address: e.target.value }))}
                    placeholder="ул. Промышленная 15, Варшава"
                  />
                  <p className="text-xs text-muted-foreground">
                    Координаты определятся автоматически при сохранении
                  </p>
                </div>
                {settings.warehouse_lat && settings.warehouse_lng && (
                  <div className="text-xs text-green-600">
                    ✓ Координаты: {settings.warehouse_lat.toFixed(6)}, {settings.warehouse_lng.toFixed(6)}
                  </div>
                )}
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

        {/* Widget Tab */}
        <TabsContent value="widget" className="space-y-6">
          {/* External Integration - Recommended */}
          <Card className="border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5 text-blue-600" />
                    Внешняя интеграция (рекомендуется)
                  </CardTitle>
                  <CardDescription>
                    Без загрузки архива — просто укажите URL в настройках amoCRM
                  </CardDescription>
                </div>
                <Badge className="bg-blue-600">Рекомендуется</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="p-4 bg-blue-50 rounded-lg space-y-3">
                <h3 className="font-semibold">URL для iframe виджета:</h3>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-white rounded border text-sm break-all">
                    {widgetInfo?.base_url || 'https://wm-kalkulator.pl'}/api/widget/embed/&#123;lead.id&#125;
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const url = `${widgetInfo?.base_url || 'https://wm-kalkulator.pl'}/api/widget/embed/{lead.id}`;
                      navigator.clipboard.writeText(url);
                      toast.success('URL скопирован');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Домен: <strong>{widgetInfo?.base_url || 'https://wm-kalkulator.pl'}</strong>
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">📋 Настройка в amoCRM:</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Откройте <strong>amoCRM → Настройки → Интеграции</strong></li>
                  <li>Нажмите <strong>"Создать интеграцию"</strong></li>
                  <li>Выберите тип <strong>"Внешняя интеграция"</strong></li>
                  <li>В настройках виджета для карточки сделки укажите URL выше</li>
                  <li>Используйте переменную <code className="bg-gray-100 px-1 rounded">&#123;lead.id&#125;</code> для передачи ID сделки</li>
                  <li>Сохраните и активируйте</li>
                </ol>
              </div>

              <div className="p-3 bg-green-50 rounded-lg text-sm">
                <strong className="text-green-700">✓ Преимущества:</strong>
                <ul className="mt-2 space-y-1 text-green-700">
                  <li>• Не нужно загружать архив</li>
                  <li>• Обновления применяются мгновенно</li>
                  <li>• Работает во всех аккаунтах amoCRM</li>
                </ul>
              </div>

              {/* Preview link */}
              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => window.open(`${widgetInfo?.base_url || API_URL}/api/widget/embed/12345?theme=light`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Посмотреть пример виджета
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ZIP Widget - Alternative */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-purple-600" />
                ZIP-архив виджета (альтернатива)
              </CardTitle>
              <CardDescription>
                Классический способ — загрузите архив с JS-кодом виджета
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-purple-50 rounded-lg space-y-4">
                <p className="text-sm text-muted-foreground">
                  Скачайте архив виджета и установите его в настройках amoCRM → Свои интеграции
                </p>
                <Button 
                  onClick={() => window.open(`${widgetInfo?.base_url || API_URL}/api/widget/download`, '_blank')}
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Скачать amocrm-widget.zip
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle>✨ Возможности виджета</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 border rounded-lg">
                  <div className="font-medium mb-1">📦 Статус доставки</div>
                  <p className="text-sm text-muted-foreground">
                    Отображается в карточке сделки: статус заказа, номер рейса, водитель, дата
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="font-medium mb-1">🧮 Быстрый калькулятор</div>
                  <p className="text-sm text-muted-foreground">
                    Кнопки для открытия калькуляторов Купель и Сауна с данными клиента
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="font-medium mb-1">📷 Фото доставки</div>
                  <p className="text-sm text-muted-foreground">
                    Индикатор загруженного фото акта доставки
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="font-medium mb-1">🎨 Темы оформления</div>
                  <p className="text-sm text-muted-foreground">
                    Светлая и тёмная тема (добавьте ?theme=dark к URL)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <NotificationSettings drivers={drivers} onUpdate={fetchDrivers} />
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

        {/* Calculator Integration Tab */}
        <TabsContent value="calculator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Открытие калькулятора из amoCRM
              </CardTitle>
              <CardDescription>
                Откройте калькулятор прямо из карточки сделки с автозаполнением данных клиента
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* How it works */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                <h4 className="font-medium text-blue-800 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Как это работает
                </h4>
                <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
                  <li>Добавьте ссылку с ID сделки в amoCRM (через Salesbot или Digital Pipeline)</li>
                  <li>При переходе по ссылке калькулятор откроется с данными клиента</li>
                  <li>После создания заказа в amoCRM добавится примечание "КП создано"</li>
                  <li>Заказ будет связан со сделкой — ссылка на amoCRM сохранится</li>
                </ol>
              </div>

              {/* URLs for each calculator */}
              <div className="space-y-4">
                <h4 className="font-medium">Ссылки для калькуляторов</h4>
                
                {/* Balia */}
                <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Waves className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-800">Калькулятор Balia (Купели)</span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={`${window.location.origin}/?calc=balia&amocrm_id={{lead.id}}`}
                      readOnly
                      className="font-mono text-xs bg-white"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/?calc=balia&amocrm_id={{lead.id}}`);
                        toast.success('Ссылка скопирована');
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Замените <code className="bg-muted px-1 rounded">{`{{lead.id}}`}</code> на переменную ID сделки в amoCRM
                  </p>
                </div>

                {/* Sauna */}
                <div className="p-4 bg-orange-50/50 border border-orange-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Flame className="h-5 w-5 text-orange-600" />
                    <span className="font-medium text-orange-800">Калькулятор Sauna (Сауны)</span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={`${window.location.origin}/?calc=sauna&amocrm_id={{lead.id}}`}
                      readOnly
                      className="font-mono text-xs bg-white"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/?calc=sauna&amocrm_id={{lead.id}}`);
                        toast.success('Ссылка скопирована');
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Замените <code className="bg-muted px-1 rounded">{`{{lead.id}}`}</code> на переменную ID сделки в amoCRM
                  </p>
                </div>
              </div>

              {/* Setup instructions */}
              <div className="space-y-4">
                <h4 className="font-medium">Как настроить в amoCRM</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Option 1: Salesbot */}
                  <div className="p-4 border rounded-lg space-y-2">
                    <h5 className="font-medium flex items-center gap-2">
                      <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                      Через Salesbot
                    </h5>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside ml-6">
                      <li>Откройте Настройки → Salesbot</li>
                      <li>Создайте нового бота</li>
                      <li>Добавьте действие "Отправить сообщение"</li>
                      <li>Вставьте ссылку с переменной ID</li>
                      <li>Привяжите бота к нужному этапу воронки</li>
                    </ol>
                  </div>

                  {/* Option 2: Digital Pipeline */}
                  <div className="p-4 border rounded-lg space-y-2">
                    <h5 className="font-medium flex items-center gap-2">
                      <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                      Через Digital Pipeline
                    </h5>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside ml-6">
                      <li>Откройте настройки воронки</li>
                      <li>Выберите этап для создания КП</li>
                      <li>Добавьте действие "Webhook"</li>
                      <li>Вставьте ссылку с ID сделки</li>
                      <li>Менеджер получит уведомление с кнопкой</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Field Mapping for Calculators */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-lg">Маппинг полей для калькуляторов</h3>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-700">
                    <strong>Где найти ID полей:</strong> В amoCRM откройте карточку сделки → нажмите на поле → 
                    в адресной строке появится ID (например: <code className="bg-purple-100 px-1 rounded">cf_123456</code>)
                  </p>
                </div>
              </div>

              {/* Balia Calculator Mapping */}
              <Card className="border-blue-200">
                <CardHeader className="pb-3 bg-blue-50/50">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Waves className="h-5 w-5 text-blue-600" />
                    Маппинг для Balia (Купели)
                  </CardTitle>
                  <CardDescription>
                    Поля amoCRM для автозаполнения калькулятора купелей
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        Имя клиента
                      </Label>
                      <Input
                        placeholder="ID поля, например: cf_123456"
                        value={settings.field_mapping?.calculatorBalia?.fullName || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          field_mapping: {
                            ...prev.field_mapping,
                            calculatorBalia: {
                              ...(prev.field_mapping?.calculatorBalia || {}),
                              fullName: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        Телефон
                      </Label>
                      <Input
                        placeholder="ID поля, например: cf_234567"
                        value={settings.field_mapping?.calculatorBalia?.phoneNumber || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          field_mapping: {
                            ...prev.field_mapping,
                            calculatorBalia: {
                              ...(prev.field_mapping?.calculatorBalia || {}),
                              phoneNumber: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        placeholder="ID поля"
                        value={settings.field_mapping?.calculatorBalia?.email || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          field_mapping: {
                            ...prev.field_mapping,
                            calculatorBalia: {
                              ...(prev.field_mapping?.calculatorBalia || {}),
                              email: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Адрес (улица)</Label>
                      <Input
                        placeholder="ID поля"
                        value={settings.field_mapping?.calculatorBalia?.addressStreet || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          field_mapping: {
                            ...prev.field_mapping,
                            calculatorBalia: {
                              ...(prev.field_mapping?.calculatorBalia || {}),
                              addressStreet: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Город</Label>
                      <Input
                        placeholder="ID поля"
                        value={settings.field_mapping?.calculatorBalia?.addressCity || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          field_mapping: {
                            ...prev.field_mapping,
                            calculatorBalia: {
                              ...(prev.field_mapping?.calculatorBalia || {}),
                              addressCity: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Индекс</Label>
                      <Input
                        placeholder="ID поля"
                        value={settings.field_mapping?.calculatorBalia?.addressIndex || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          field_mapping: {
                            ...prev.field_mapping,
                            calculatorBalia: {
                              ...(prev.field_mapping?.calculatorBalia || {}),
                              addressIndex: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sauna Calculator Mapping */}
              <Card className="border-orange-200">
                <CardHeader className="pb-3 bg-orange-50/50">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Flame className="h-5 w-5 text-orange-600" />
                    Маппинг для Sauna (Сауны)
                  </CardTitle>
                  <CardDescription>
                    Поля amoCRM для автозаполнения калькулятора саун
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        Имя клиента
                      </Label>
                      <Input
                        placeholder="ID поля, например: cf_123456"
                        value={settings.field_mapping?.calculatorSauna?.fullName || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          field_mapping: {
                            ...prev.field_mapping,
                            calculatorSauna: {
                              ...(prev.field_mapping?.calculatorSauna || {}),
                              fullName: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        Телефон
                      </Label>
                      <Input
                        placeholder="ID поля, например: cf_234567"
                        value={settings.field_mapping?.calculatorSauna?.phoneNumber || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          field_mapping: {
                            ...prev.field_mapping,
                            calculatorSauna: {
                              ...(prev.field_mapping?.calculatorSauna || {}),
                              phoneNumber: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        placeholder="ID поля"
                        value={settings.field_mapping?.calculatorSauna?.email || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          field_mapping: {
                            ...prev.field_mapping,
                            calculatorSauna: {
                              ...(prev.field_mapping?.calculatorSauna || {}),
                              email: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Адрес (улица)</Label>
                      <Input
                        placeholder="ID поля"
                        value={settings.field_mapping?.calculatorSauna?.addressStreet || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          field_mapping: {
                            ...prev.field_mapping,
                            calculatorSauna: {
                              ...(prev.field_mapping?.calculatorSauna || {}),
                              addressStreet: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Город</Label>
                      <Input
                        placeholder="ID поля"
                        value={settings.field_mapping?.calculatorSauna?.addressCity || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          field_mapping: {
                            ...prev.field_mapping,
                            calculatorSauna: {
                              ...(prev.field_mapping?.calculatorSauna || {}),
                              addressCity: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Индекс</Label>
                      <Input
                        placeholder="ID поля"
                        value={settings.field_mapping?.calculatorSauna?.addressIndex || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          field_mapping: {
                            ...prev.field_mapping,
                            calculatorSauna: {
                              ...(prev.field_mapping?.calculatorSauna || {}),
                              addressIndex: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button onClick={saveSettings} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
                  {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Сохранить маппинг
                </Button>
              </div>

              {/* Important notes */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                <h4 className="font-medium text-amber-800 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Важно
                </h4>
                <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                  <li>Для работы интеграции нужно настроить API-токен amoCRM во вкладке "Синхронизация"</li>
                  <li>Настройте маппинг полей выше для корректного переноса данных клиента</li>
                  <li>Пользователь должен быть авторизован в приложении</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
