import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import {
  Bell, Send, MessageCircle, Link2, Copy, Check, RefreshCw,
  Smartphone, AlertCircle, ExternalLink, QrCode
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const NotificationSettings = ({ drivers = [], onUpdate }) => {
  const [telegramSettings, setTelegramSettings] = useState({
    enabled: false,
    botToken: '',
    botUsername: '',
    linkedDrivers: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newBotToken, setNewBotToken] = useState('');
  const [linkCodes, setLinkCodes] = useState({});
  const [generatingCode, setGeneratingCode] = useState(null);
  const [testingDriver, setTestingDriver] = useState(null);

  // Fetch current settings
  const fetchSettings = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/notifications/telegram/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTelegramSettings(data);
      }
    } catch (e) {
      console.error('Failed to fetch notification settings:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Save Telegram settings
  const saveTelegramSettings = async () => {
    if (!newBotToken && telegramSettings.enabled) {
      toast.error('Введите токен бота');
      return;
    }
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/notifications/telegram/settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          botToken: newBotToken || telegramSettings.botToken,
          enabled: telegramSettings.enabled
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setTelegramSettings(prev => ({
          ...prev,
          botUsername: data.botUsername
        }));
        setNewBotToken('');
        toast.success('Настройки сохранены');
        fetchSettings();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Ошибка сохранения');
      }
    } catch (e) {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  // Generate link code for driver
  const generateLinkCode = async (driverId) => {
    setGeneratingCode(driverId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/notifications/telegram/link-code/${driverId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setLinkCodes(prev => ({ ...prev, [driverId]: data }));
      }
    } catch (e) {
      toast.error('Ошибка генерации кода');
    } finally {
      setGeneratingCode(null);
    }
  };

  // Copy link to clipboard
  const copyLink = (link) => {
    navigator.clipboard.writeText(link);
    toast.success('Ссылка скопирована');
  };

  // Send test notification
  const sendTestNotification = async (driverId) => {
    setTestingDriver(driverId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/notifications/test/${driverId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.telegram === 'sent') {
          toast.success('Уведомление отправлено в Telegram');
        } else if (data.telegram === 'not_linked') {
          toast.warning('Telegram не привязан к водителю');
        }
      }
    } catch (e) {
      toast.error('Ошибка отправки');
    } finally {
      setTestingDriver(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Telegram Bot Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-blue-500" />
            Telegram-бот
          </CardTitle>
          <CardDescription>
            Настройте Telegram-бота для уведомлений водителям о новых рейсах
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Включить уведомления</Label>
            <Switch
              checked={telegramSettings.enabled}
              onCheckedChange={(checked) => setTelegramSettings(prev => ({ ...prev, enabled: checked }))}
            />
          </div>
          
          {telegramSettings.enabled && (
            <>
              <div className="space-y-2">
                <Label>Токен бота</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder={telegramSettings.botToken || "Введите токен от @BotFather"}
                    value={newBotToken}
                    onChange={(e) => setNewBotToken(e.target.value)}
                  />
                  <Button onClick={saveTelegramSettings} disabled={saving}>
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Создайте бота через @BotFather в Telegram и вставьте полученный токен
                </p>
              </div>
              
              {telegramSettings.botUsername && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Бот подключён: @{telegramSettings.botUsername}</span>
                  <a 
                    href={`https://t.me/${telegramSettings.botUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-blue-600 hover:underline text-sm flex items-center gap-1"
                  >
                    Открыть <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              
              <div className="text-sm text-muted-foreground">
                Привязанных водителей: <Badge variant="secondary">{telegramSettings.linkedDrivers}</Badge>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Push Notifications Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-purple-500" />
            Push-уведомления
          </CardTitle>
          <CardDescription>
            Уведомления в браузере для водителей с открытым приложением
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-3 bg-blue-50 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 text-blue-600 inline mr-2" />
            Push-уведомления активируются автоматически когда водитель открывает кабинет и разрешает уведомления.
          </div>
        </CardContent>
      </Card>

      {/* Driver Links */}
      {telegramSettings.enabled && telegramSettings.botUsername && drivers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Привязка водителей
            </CardTitle>
            <CardDescription>
              Сгенерируйте ссылку для каждого водителя чтобы привязать их Telegram
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {drivers.map(driver => {
                const linkCode = linkCodes[driver.id];
                const hasLinkedTelegram = !!driver.telegramChatId;
                
                return (
                  <div key={driver.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${hasLinkedTelegram ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <div>
                        <div className="font-medium">{driver.name}</div>
                        {hasLinkedTelegram && (
                          <div className="text-xs text-green-600">Telegram привязан</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {hasLinkedTelegram ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendTestNotification(driver.id)}
                          disabled={testingDriver === driver.id}
                        >
                          {testingDriver === driver.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          <span className="ml-1 hidden sm:inline">Тест</span>
                        </Button>
                      ) : linkCode ? (
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {linkCode.code}
                          </code>
                          {linkCode.deepLink && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyLink(linkCode.deepLink)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generateLinkCode(driver.id)}
                          disabled={generatingCode === driver.id}
                        >
                          {generatingCode === driver.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <QrCode className="h-4 w-4" />
                          )}
                          <span className="ml-1">Код</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NotificationSettings;
