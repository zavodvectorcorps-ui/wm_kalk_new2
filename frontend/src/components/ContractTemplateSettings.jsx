import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import {
  Upload, FileText, Trash2, Plus, Loader2, Save, RefreshCw, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { getApiUrl } from '../utils/api';

const API_URL = getApiUrl();

const SOURCE_CATEGORIES = {
  client: { label: 'Клиент', color: 'bg-blue-100 text-blue-700' },
  payment: { label: 'Оплата', color: 'bg-green-100 text-green-700' },
  production: { label: 'Производство', color: 'bg-orange-100 text-orange-700' },
  crm_fields: { label: 'Поля CRM', color: 'bg-purple-100 text-purple-700' },
  computed: { label: 'Вычисляемые', color: 'bg-cyan-100 text-cyan-700' },
  calculator: { label: 'Калькулятор', color: 'bg-amber-100 text-amber-700' },
  other: { label: 'Другое', color: 'bg-gray-100 text-gray-700' },
};

export const ContractTemplateSettings = ({ authHeaders }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [availableSources, setAvailableSources] = useState([]);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/sauna-crm/contract-template/settings`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setAvailableSources(data.availableSources || []);
      }
    } catch (e) {
      toast.error('Ошибка загрузки настроек шаблона');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.docx')) {
      toast.error('Только .docx файлы');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_URL}/api/sauna-crm/contract-template/upload`, {
        method: 'POST',
        headers: { 'Authorization': authHeaders['Authorization'] },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Шаблон загружен. Найдено переменных: ${data.placeholders?.length || 0}`);
        await fetchSettings();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Ошибка загрузки');
      }
    } catch (e) {
      toast.error('Ошибка загрузки шаблона');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/contract-template/settings`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mappings: settings.mappings,
          attachKp: settings.attachKp,
        }),
      });
      if (res.ok) {
        toast.success('Настройки шаблона сохранены');
      } else {
        toast.error('Ошибка сохранения');
      }
    } catch (e) {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const updateMapping = (idx, field, value) => {
    setSettings(prev => {
      const mappings = [...prev.mappings];
      mappings[idx] = { ...mappings[idx], [field]: value };
      return { ...prev, mappings };
    });
  };

  const removeMapping = (idx) => {
    setSettings(prev => ({
      ...prev,
      mappings: prev.mappings.filter((_, i) => i !== idx),
    }));
  };

  const addCustomVariable = () => {
    const name = `CUSTOM_${Date.now().toString(36).toUpperCase()}`;
    setSettings(prev => ({
      ...prev,
      mappings: [
        ...prev.mappings,
        {
          placeholder: `{{${name}}}`,
          source: '_static',
          defaultValue: '',
          label: 'Новая переменная',
        },
      ],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm text-muted-foreground">Загрузка...</span>
      </div>
    );
  }

  if (!settings) return null;

  // Group sources by category
  const groupedSources = {};
  for (const s of availableSources) {
    const cat = s.category || 'other';
    if (!groupedSources[cat]) groupedSources[cat] = [];
    groupedSources[cat].push(s);
  }

  return (
    <div className="space-y-5" data-testid="contract-template-settings">
      {/* Template upload */}
      <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Текущий шаблон</p>
            <p className="text-xs text-muted-foreground mt-1">
              {settings.templateName || 'contract_template.docx'}
              {settings.uploadedAt && (
                <span className="ml-2">
                  (загружен {new Date(settings.uploadedAt).toLocaleDateString('ru-RU')})
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.open(`${API_URL}/api/static/templates/contract_template.docx`, '_blank');
              }}
              data-testid="download-template-btn"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Скачать
            </Button>
            <label>
              <Button variant="outline" size="sm" asChild disabled={uploading}>
                <span className="cursor-pointer">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                  Загрузить новый
                </span>
              </Button>
              <input
                type="file"
                accept=".docx"
                className="hidden"
                onChange={handleUpload}
                data-testid="upload-template-input"
              />
            </label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Используйте двойные фигурные скобки для переменных: {'{{VARIABLE_NAME}}'}.
          После загрузки шаблона переменные определяются автоматически.
        </p>
      </div>

      {/* Attach KP toggle */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <p className="text-sm font-medium">Прикреплять КП к договору</p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF коммерческого предложения будет добавлен как изображения в конец договора (Załącznik nr 1)
          </p>
        </div>
        <Switch
          checked={settings.attachKp}
          onCheckedChange={(v) => setSettings(prev => ({ ...prev, attachKp: v }))}
          data-testid="attach-kp-switch"
        />
      </div>

      {/* Mappings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            Маппинг переменных
            <span className="text-muted-foreground font-normal ml-1">({settings.mappings?.length || 0})</span>
          </p>
          <Button variant="outline" size="sm" onClick={addCustomVariable} data-testid="add-custom-variable-btn">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Добавить переменную
          </Button>
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {(settings.mappings || []).map((mapping, idx) => {
            const isBuiltIn = (settings.placeholders || []).includes(mapping.placeholder);
            return (
              <div
                key={idx}
                className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center p-3 border rounded-lg bg-white hover:bg-muted/20 transition-colors"
                data-testid={`mapping-row-${idx}`}
              >
                {/* Placeholder name */}
                <div className="space-y-1">
                  <Input
                    value={mapping.label || ''}
                    onChange={(e) => updateMapping(idx, 'label', e.target.value)}
                    placeholder="Название"
                    className="h-8 text-xs"
                    data-testid={`mapping-label-${idx}`}
                  />
                  {isBuiltIn ? (
                    <code className="text-[10px] text-muted-foreground font-mono">{mapping.placeholder}</code>
                  ) : (
                    <Input
                      value={mapping.placeholder || ''}
                      onChange={(e) => updateMapping(idx, 'placeholder', e.target.value)}
                      placeholder="{{VARIABLE}}"
                      className="h-7 text-[10px] font-mono"
                      data-testid={`mapping-placeholder-${idx}`}
                    />
                  )}
                </div>

                {/* Source select */}
                <Select
                  value={mapping.source || '_static'}
                  onValueChange={(v) => updateMapping(idx, 'source', v)}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid={`mapping-source-${idx}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_static">
                      <span className="text-xs">Статическое значение</span>
                    </SelectItem>
                    {Object.entries(groupedSources).map(([cat, sources]) => (
                      <React.Fragment key={cat}>
                        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {SOURCE_CATEGORIES[cat]?.label || cat}
                        </div>
                        {sources.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="text-xs">{s.label}</span>
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>

                {/* Default value */}
                <Input
                  value={mapping.defaultValue || ''}
                  onChange={(e) => updateMapping(idx, 'defaultValue', e.target.value)}
                  placeholder="Значение по умолчанию"
                  className="h-8 text-xs"
                  data-testid={`mapping-default-${idx}`}
                />

                {/* Delete */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                  onClick={() => removeMapping(idx)}
                  data-testid={`mapping-delete-${idx}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-2 border-t">
        <Button onClick={handleSave} disabled={saving} data-testid="save-template-settings-btn">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Сохранить настройки шаблона
        </Button>
      </div>
    </div>
  );
};
