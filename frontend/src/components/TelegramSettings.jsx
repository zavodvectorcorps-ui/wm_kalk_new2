import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Send, Settings, CheckCircle, XCircle, Loader2, Bot, MessageSquare, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const TelegramSettings = () => {
  const [settings, setSettings] = useState({
    bot_token: '',
    chat_id: '',
    enabled: true,
    bot_token_set: false,
    chat_id_set: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  
  // Form state for editing
  const [formData, setFormData] = useState({
    bot_token: '',
    chat_id: '',
    enabled: true
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/telegram/settings`);
      setSettings(response.data);
      setFormData({
        bot_token: '',  // Don't show full token for security
        chat_id: response.data.chat_id || '',
        enabled: response.data.enabled
      });
    } catch (error) {
      console.error('Error fetching Telegram settings:', error);
      toast.error('Nie udało się pobrać ustawień');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!formData.bot_token && !settings.bot_token_set) {
      toast.error('Wprowadź token bota');
      return;
    }
    if (!formData.chat_id) {
      toast.error('Wprowadź Chat ID');
      return;
    }

    setTesting(true);
    setTestResult(null);
    
    try {
      const response = await axios.post(`${API_URL}/api/telegram/test`, {
        bot_token: formData.bot_token || undefined,
        chat_id: formData.chat_id
      });
      
      setTestResult(response.data);
      if (response.data.success) {
        toast.success('Test zakończony pomyślnie! Sprawdź grupę Telegram.');
      } else {
        toast.error(`Test nieudany: ${response.data.error}`);
      }
    } catch (error) {
      setTestResult({ success: false, error: error.message });
      toast.error('Błąd podczas testu');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/telegram/settings`, {
        bot_token: formData.bot_token || undefined,
        chat_id: formData.chat_id,
        enabled: formData.enabled
      });
      
      toast.success('Ustawienia zapisane');
      fetchSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Nie udało się zapisać ustawień');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-500" />
            Status powiadomień Telegram
          </CardTitle>
          <CardDescription>
            Otrzymuj powiadomienia o nowych zamówieniach bezpośrednio na Telegram
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant={settings.bot_token_set && settings.chat_id_set ? "default" : "secondary"}>
              {settings.bot_token_set && settings.chat_id_set ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Skonfigurowany
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3 mr-1" />
                  Wymaga konfiguracji
                </>
              )}
            </Badge>
            
            <Badge variant={settings.enabled ? "default" : "outline"} className={settings.enabled ? "bg-green-600" : ""}>
              {settings.enabled ? "Włączone" : "Wyłączone"}
            </Badge>
          </div>
          
          {settings.bot_token_set && settings.chat_id_set && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
              <p className="text-blue-800">
                <strong>Token bota:</strong> {settings.bot_token}
              </p>
              <p className="text-blue-800">
                <strong>Chat ID:</strong> {settings.chat_id}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Konfiguracja
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Powiadomienia włączone</Label>
              <p className="text-sm text-muted-foreground">
                Włącz lub wyłącz wysyłanie powiadomień
              </p>
            </div>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
          </div>

          {/* Bot Token */}
          <div className="space-y-2">
            <Label htmlFor="bot_token">Token bota Telegram</Label>
            <Input
              id="bot_token"
              type="password"
              placeholder={settings.bot_token_set ? "••••••••••• (zapisany)" : "123456789:ABCdefGHI..."}
              value={formData.bot_token}
              onChange={(e) => setFormData({ ...formData, bot_token: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Uzyskaj token od @BotFather na Telegram
            </p>
          </div>

          {/* Chat ID */}
          <div className="space-y-2">
            <Label htmlFor="chat_id">Chat ID grupy</Label>
            <Input
              id="chat_id"
              placeholder="-1234567890"
              value={formData.chat_id}
              onChange={(e) => setFormData({ ...formData, chat_id: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              ID grupy lub czatu, gdzie mają trafiać powiadomienia
            </p>
          </div>

          {/* Test Result */}
          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              <AlertDescription className="flex items-center gap-2">
                {testResult.success ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>
                      Połączenie udane! Bot: @{testResult.bot_username}
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    <span>Błąd: {testResult.error}</span>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Testuj połączenie
            </Button>
            
            <Button
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Zapisz ustawienia
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            Jak skonfigurować?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-2">
            <h4 className="font-semibold">1. Utwórz bota Telegram</h4>
            <p className="text-muted-foreground">
              Napisz do @BotFather komendę /newbot i postępuj według instrukcji.
              Otrzymasz token bota.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-semibold">2. Utwórz grupę i dodaj bota</h4>
            <p className="text-muted-foreground">
              Utwórz grupę w Telegram, dodaj bota jako administratora
              (aby mógł wysyłać wiadomości).
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-semibold">3. Uzyskaj Chat ID</h4>
            <p className="text-muted-foreground">
              Napisz wiadomość w grupie, następnie otwórz w przeglądarce:
            </p>
            <code className="block p-2 bg-muted rounded text-xs">
              https://api.telegram.org/bot[TOKEN]/getUpdates
            </code>
            <p className="text-muted-foreground">
              Znajdź "chat":{"{"}"id": -XXXXXXXXXX{"}"} - to jest Chat ID grupy.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-semibold">4. Zapisz i przetestuj</h4>
            <p className="text-muted-foreground">
              Wprowadź dane powyżej, kliknij "Testuj połączenie" aby sprawdzić,
              czy wszystko działa poprawnie.
            </p>
          </div>
          
          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2">Powiadomienia są wysyłane przy:</h4>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Nowym zamówieniu z kalkulatora Balia 🛁</li>
              <li>Nowym zamówieniu z kalkulatora Sauna 🧖</li>
              <li>Nowym zamówieniu z internetu (iframe) 🌐</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
