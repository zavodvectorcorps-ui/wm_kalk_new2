import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { 
  Download, 
  Upload, 
  RefreshCw, 
  Trash2, 
  Clock, 
  Database,
  FileArchive,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const BackupPage = () => {
  const [settings, setSettings] = useState({
    enabled: false,
    intervalHours: 24,
    lastBackup: null,
    retainCount: 5
  });
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/backup/settings`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching backup settings:', error);
    }
  }, []);

  const fetchBackups = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/backup/list`);
      if (response.ok) {
        const data = await response.json();
        setBackups(data);
      }
    } catch (error) {
      console.error('Error fetching backups:', error);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchBackups();
  }, [fetchSettings, fetchBackups]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch(`${API_URL}/api/backup/export`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Бэкап успешно создан и скачан');
      } else {
        toast.error('Ошибка при создании бэкапа');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Ошибка при экспорте данных');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      toast.error('Файл должен быть в формате ZIP');
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/backup/import`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        toast.success('Данные успешно импортированы');
        // Show detailed import stats
        const stats = Object.entries(result.imported)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        if (stats) {
          toast.info(`Импортировано: ${stats}`);
        }
      } else {
        toast.error(`Ошибка импорта: ${result.errors?.join(', ') || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Ошибка при импорте данных');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const handleCreateAutoBackup = async () => {
    setCreatingBackup(true);
    try {
      const response = await fetch(`${API_URL}/api/backup/auto`, {
        method: 'POST'
      });

      if (response.ok) {
        toast.success('Автоматический бэкап создан');
        fetchBackups();
        fetchSettings();
      } else {
        toast.error('Ошибка при создании бэкапа');
      }
    } catch (error) {
      console.error('Auto backup error:', error);
      toast.error('Ошибка при создании автоматического бэкапа');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownloadBackup = async (backupId) => {
    try {
      const response = await fetch(`${API_URL}/api/backup/download/${backupId}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${backupId}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Бэкап скачан');
      } else {
        toast.error('Ошибка при скачивании бэкапа');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Ошибка при скачивании');
    }
  };

  const handleDeleteBackup = async (backupId) => {
    if (!window.confirm('Удалить этот бэкап?')) return;

    try {
      const response = await fetch(`${API_URL}/api/backup/${backupId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Бэкап удален');
        fetchBackups();
      } else {
        toast.error('Ошибка при удалении бэкапа');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Ошибка при удалении');
    }
  };

  const handleUpdateSettings = async (newSettings) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/backup/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });

      if (response.ok) {
        setSettings(newSettings);
        toast.success('Настройки сохранены');
      } else {
        toast.error('Ошибка при сохранении настроек');
      }
    } catch (error) {
      console.error('Settings error:', error);
      toast.error('Ошибка при сохранении настроек');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Никогда';
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Database className="h-6 w-6" />
        Резервное копирование
      </h1>

      {/* Quick Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Быстрые действия</CardTitle>
          <CardDescription>
            Экспорт и импорт данных вручную
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button 
            onClick={handleExport} 
            disabled={exporting}
            className="flex items-center gap-2"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? 'Экспорт...' : 'Скачать бэкап'}
          </Button>
          
          <div className="relative">
            <Input
              type="file"
              accept=".zip"
              onChange={handleImport}
              disabled={importing}
              className="absolute inset-0 opacity-0 cursor-pointer"
              id="import-file"
            />
            <Button 
              variant="outline"
              disabled={importing}
              className="flex items-center gap-2"
              asChild
            >
              <label htmlFor="import-file" className="cursor-pointer">
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {importing ? 'Импорт...' : 'Загрузить бэкап'}
              </label>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Auto Backup Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Автоматическое резервное копирование
          </CardTitle>
          <CardDescription>
            Настройка автоматического создания бэкапов
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Включить автобэкап</Label>
              <p className="text-sm text-muted-foreground">
                Автоматически создавать бэкапы по расписанию
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => 
                handleUpdateSettings({ ...settings, enabled: checked })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Интервал (часы)</Label>
              <Select
                value={String(settings.intervalHours)}
                onValueChange={(value) => 
                  handleUpdateSettings({ ...settings, intervalHours: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">Каждые 6 часов</SelectItem>
                  <SelectItem value="12">Каждые 12 часов</SelectItem>
                  <SelectItem value="24">Каждые 24 часа</SelectItem>
                  <SelectItem value="48">Каждые 48 часов</SelectItem>
                  <SelectItem value="168">Каждую неделю</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Хранить бэкапов</Label>
              <Select
                value={String(settings.retainCount)}
                onValueChange={(value) => 
                  handleUpdateSettings({ ...settings, retainCount: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 последних</SelectItem>
                  <SelectItem value="5">5 последних</SelectItem>
                  <SelectItem value="10">10 последних</SelectItem>
                  <SelectItem value="20">20 последних</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Последний бэкап: {formatDate(settings.lastBackup)}
            </div>
            <Button 
              variant="secondary" 
              size="sm"
              onClick={handleCreateAutoBackup}
              disabled={creatingBackup}
              className="flex items-center gap-2"
            >
              {creatingBackup ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Создать сейчас
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backup List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            Сохраненные бэкапы
          </CardTitle>
          <CardDescription>
            Список автоматических бэкапов в базе данных
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Нет сохраненных бэкапов</p>
              <p className="text-sm">Создайте первый бэкап вручную или включите автобэкап</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <div 
                  key={backup.id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileArchive className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">
                        {formatDate(backup.createdAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Размер: {formatSize(backup.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadBackup(backup.id)}
                      title="Скачать"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteBackup(backup.id)}
                      title="Удалить"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="mt-6 border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Что включает бэкап:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Заказы (Balia, Sauna, Web-заказы)</li>
                <li>Пользователи и сотрудники</li>
                <li>Настройки цен и изображения</li>
                <li>Технические характеристики</li>
                <li>Пользовательские поля</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
