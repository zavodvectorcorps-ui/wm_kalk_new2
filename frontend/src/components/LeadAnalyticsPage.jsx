import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import {
  BarChart3, Users, AlertTriangle, Settings, RefreshCw, Loader2, Clock,
  CheckCircle, XCircle, AlertCircle, TrendingUp, ExternalLink, ChevronDown, ChevronUp,
  Activity, Timer, Target, Zap, ArrowUpDown, Filter, Ban, Trash2
} from 'lucide-react';
import ManagerEventsAnalytics from './ManagerEventsAnalytics';
import AdvancedManagerDashboard from './AdvancedManagerDashboard';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Status config
const STATUS_CONFIG = {
  processed_fast: { label: 'Быстро', labelPl: 'Szybko', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle, dot: 'bg-emerald-500' },
  processed_late: { label: 'С задержкой', labelPl: 'Z opóźnieniem', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: Clock, dot: 'bg-amber-500' },
  not_processed: { label: 'Не обработано', labelPl: 'Nieobsłużone', color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle, dot: 'bg-red-500' },
  weak_processing: { label: 'Слабая обработка', labelPl: 'Słabe', color: 'bg-orange-100 text-orange-800 border-orange-300', icon: AlertCircle, dot: 'bg-orange-500' },
};

const formatHours = (h) => {
  if (h == null) return '—';
  if (h < 1) return `${Math.round(h * 60)} мин`;
  if (h < 24) return `${h.toFixed(1)} ч`;
  return `${Math.floor(h / 24)} д ${Math.round(h % 24)} ч`;
};

// ==================== SUMMARY TAB ====================
const SummaryTab = ({ summary, loading }) => {
  const kpis = [
    { label: 'Всего лидов', value: summary.totalLeads || 0, icon: Target, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
    { label: 'Быстро обработано', value: summary.processedFast || 0, icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
    { label: 'С задержкой', value: summary.processedLate || 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
    { label: 'Не обработано', value: summary.notProcessed || 0, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
    { label: 'Слабая обработка', value: summary.weakProcessing || 0, icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
    { label: 'Зависших', value: summary.stalledCount || 0, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
    { label: 'Закрыто/не реал.', value: summary.closedLost || 0, icon: Ban, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
  ];

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;

  const total = summary.totalLeads || 1;
  const processedPct = Math.round(((summary.processedFast || 0) + (summary.processedLate || 0)) / total * 100);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3" data-testid="summary-kpis">
        {kpis.map((kpi, i) => (
          <Card key={i} className={`${kpi.bg} border`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Timer className="h-5 w-5 text-blue-600" />
              <span className="font-medium">Среднее время реакции</span>
            </div>
            <div className="text-3xl font-bold text-blue-700">
              {summary.avgReactionHours != null ? formatHours(summary.avgReactionHours) : '—'}
            </div>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <span className="font-medium">Процент обработки</span>
            </div>
            <div className="text-3xl font-bold text-emerald-700">{processedPct}%</div>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${processedPct}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status distribution bar */}
      {summary.totalLeads > 0 && (
        <Card className="border">
          <CardContent className="p-5">
            <div className="font-medium mb-3">Распределение по статусам</div>
            <div className="flex h-6 rounded-full overflow-hidden">
              {['processed_fast', 'processed_late', 'weak_processing', 'not_processed'].map(s => {
                const count = summary[s === 'processed_fast' ? 'processedFast' : s === 'processed_late' ? 'processedLate' : s === 'not_processed' ? 'notProcessed' : 'weakProcessing'] || 0;
                const pct = (count / total * 100);
                if (pct === 0) return null;
                return <div key={s} className={`${STATUS_CONFIG[s].dot} transition-all`} style={{ width: `${pct}%` }} title={`${STATUS_CONFIG[s].label}: ${count}`} />;
              })}
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-xs">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                  <span>{cfg.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ==================== MANAGERS TAB ====================
const ManagersTab = ({ managers, loading }) => {
  const [sortBy, setSortBy] = useState('rank');

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  if (!managers.length) return <div className="text-center py-12 text-muted-foreground">Нет данных о менеджерах. Запустите синхронизацию.</div>;

  const sorted = [...managers].sort((a, b) => {
    if (sortBy === 'rank') return a.rank - b.rank;
    if (sortBy === 'leads') return b.totalLeads - a.totalLeads;
    if (sortBy === 'reaction') return (a.avgReactionHours || 999) - (b.avgReactionHours || 999);
    if (sortBy === 'percent') return b.processedPercent - a.processedPercent;
    return 0;
  });

  return (
    <div className="space-y-4" data-testid="managers-tab">
      <div className="flex items-center gap-2 mb-2">
        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rank">По рейтингу</SelectItem>
            <SelectItem value="leads">По кол-ву лидов</SelectItem>
            <SelectItem value="reaction">По времени реакции</SelectItem>
            <SelectItem value="percent">По % обработки</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left py-3 px-3">#</th>
              <th className="text-left py-3 px-3">Менеджер</th>
              <th className="text-center py-3 px-3">Лидов</th>
              <th className="text-center py-3 px-3">Быстро</th>
              <th className="text-center py-3 px-3">С задержкой</th>
              <th className="text-center py-3 px-3">Не обработано</th>
              <th className="text-center py-3 px-3">Слабые</th>
              <th className="text-center py-3 px-3">% обработки</th>
              <th className="text-center py-3 px-3">Ср. реакция</th>
              <th className="text-center py-3 px-3">Зависших</th>
              <th className="text-center py-3 px-3">Закрытых</th>
              <th className="text-center py-3 px-3">С прогрессом</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.userId} className="border-b hover:bg-muted/30 transition-colors">
                <td className="py-3 px-3">
                  <Badge variant={m.rank <= 3 ? 'default' : 'secondary'} className={m.rank === 1 ? 'bg-amber-500' : m.rank === 2 ? 'bg-gray-400' : m.rank === 3 ? 'bg-amber-700' : ''}>
                    {m.rank}
                  </Badge>
                </td>
                <td className="py-3 px-3 font-medium">{m.userName}</td>
                <td className="text-center py-3 px-3">{m.totalLeads}</td>
                <td className="text-center py-3 px-3 text-emerald-700 font-medium">{m.processedFast}</td>
                <td className="text-center py-3 px-3 text-amber-700">{m.processedLate}</td>
                <td className="text-center py-3 px-3 text-red-700 font-medium">{m.notProcessed}</td>
                <td className="text-center py-3 px-3 text-orange-600">{m.weakProcessing}</td>
                <td className="text-center py-3 px-3">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${m.processedPercent >= 80 ? 'bg-emerald-500' : m.processedPercent >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${m.processedPercent}%` }} />
                    </div>
                    <span className="font-medium">{m.processedPercent}%</span>
                  </div>
                </td>
                <td className="text-center py-3 px-3">{m.avgReactionHours != null ? formatHours(m.avgReactionHours) : '—'}</td>
                <td className="text-center py-3 px-3 text-rose-600">{m.stalledCount}</td>
                <td className="text-center py-3 px-3 text-gray-500">{m.closedLost || 0}</td>
                <td className="text-center py-3 px-3 text-blue-600">{m.withProgress}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ==================== PROBLEM LEADS TAB ====================
const ProblemLeadsTab = ({ leads, loading }) => {
  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  if (!leads.length) return <div className="text-center py-12 text-muted-foreground">Нет проблемных сделок. Отличная работа!</div>;

  return (
    <div className="space-y-2" data-testid="problem-leads-tab">
      <div className="text-sm text-muted-foreground mb-2">Найдено: {leads.length} проблемных сделок</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left py-3 px-3">Сделка</th>
              <th className="text-left py-3 px-3">Клиент</th>
              <th className="text-left py-3 px-3">Менеджер</th>
              <th className="text-center py-3 px-3">Статус</th>
              <th className="text-left py-3 px-3">Создана</th>
              <th className="text-center py-3 px-3">Бездействие</th>
              <th className="text-center py-3 px-3">Действий</th>
              <th className="text-center py-3 px-3">Прогресс</th>
              <th className="text-center py-3 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const cfg = STATUS_CONFIG[l.processingStatus] || STATUS_CONFIG.not_processed;
              const Icon = cfg.icon;
              return (
                <tr key={l.amocrm_lead_id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-3 font-medium max-w-[200px] truncate">{l.leadName || '—'}</td>
                  <td className="py-3 px-3">{l.contactName || '—'}</td>
                  <td className="py-3 px-3">{l.responsibleUserName || '—'}</td>
                  <td className="text-center py-3 px-3">
                    <Badge className={`${cfg.color} text-xs border`}><Icon className="h-3 w-3 mr-1" />{cfg.label}</Badge>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap text-xs">{l.createdAt ? new Date(l.createdAt).toLocaleDateString('ru-RU') : '—'}</td>
                  <td className="text-center py-3 px-3">
                    <span className={l.idleHours > 48 ? 'text-red-600 font-bold' : l.idleHours > 24 ? 'text-amber-600 font-medium' : ''}>
                      {formatHours(l.idleHours)}
                    </span>
                  </td>
                  <td className="text-center py-3 px-3">{l.totalActions || 0}</td>
                  <td className="text-center py-3 px-3">
                    {l.hasProgress ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> : <XCircle className="h-4 w-4 text-red-400 mx-auto" />}
                  </td>
                  <td className="text-center py-3 px-3">
                    {l.amocrm_link && (
                      <a href={l.amocrm_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ==================== CLOSED/LOST TAB ====================
const ClosedLostTab = ({ dateFrom, dateTo }) => {
  const [data, setData] = useState({ leads: [], total: 0, byManager: [] });
  const [loading, setLoading] = useState(true);
  const [filterManager, setFilterManager] = useState('all');
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const fetchClosedLost = async () => {
      setLoading(true);
      try {
        const params = {};
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
        if (filterManager && filterManager !== 'all') params.manager_id = filterManager;
        const res = await axios.get(`${API_URL}/api/lead-analytics/closed-lost`, { params });
        setData(res.data);
      } catch (e) {
        console.error('Error fetching closed lost:', e);
      } finally { setLoading(false); }
    };
    fetchClosedLost();
  }, [dateFrom, dateTo, filterManager]);

  const generateAI = async () => {
    setAiLoading(true);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await axios.post(`${API_URL}/api/lead-analytics/ai/closed-lost-analysis`, null, { params });
      setAiText(res.data.text);
    } catch (e) {
      toast.error('Ошибка AI-анализа: ' + (e.response?.data?.detail || e.message));
    } finally { setAiLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="space-y-4" data-testid="closed-lost-tab">
      {/* AI analysis */}
      <Card className="border border-violet-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-violet-700">
            <Zap className="h-5 w-5" />
            AI-анализ причин закрытия
          </CardTitle>
          <Button size="sm" onClick={generateAI} disabled={aiLoading} variant="outline"
            className="border-violet-300 text-violet-700 hover:bg-violet-50" data-testid="closed-lost-ai-btn">
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
            {aiText ? 'Обновить анализ' : 'Анализировать паттерны'}
          </Button>
        </CardHeader>
        {aiText && (
          <CardContent>
            <div className="text-sm leading-relaxed whitespace-pre-line bg-violet-50/50 rounded-lg p-4 border border-violet-100" data-testid="closed-lost-ai-text">
              {aiText}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Manager breakdown */}
      {data.byManager.length > 0 && (
        <Card className="border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Ban className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-sm">Закрытые сделки по менеджерам</span>
              <span className="text-xs text-muted-foreground ml-auto">Всего: {data.total}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={filterManager === 'all' ? 'default' : 'outline'}
                className="cursor-pointer" onClick={() => setFilterManager('all')}>
                Все ({data.total})
              </Badge>
              {data.byManager.map(m => (
                <Badge key={m.userId} variant={filterManager === m.userId ? 'default' : 'outline'}
                  className="cursor-pointer" onClick={() => setFilterManager(m.userId)}>
                  {m.userName}: {m.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!data.leads.length ? (
        <div className="text-center py-12 text-muted-foreground">Нет закрытых сделок в выбранном периоде.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-3">Сделка</th>
                <th className="text-left py-3 px-3">Клиент</th>
                <th className="text-left py-3 px-3">Менеджер</th>
                <th className="text-left py-3 px-3">Создана</th>
                <th className="text-center py-3 px-3">Действий</th>
                <th className="text-center py-3 px-3">Примечаний</th>
                <th className="text-center py-3 px-3">Коммуникация</th>
                <th className="text-center py-3 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.leads.map((l) => (
                <tr key={l.amocrm_lead_id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-3 font-medium max-w-[200px] truncate">{l.leadName || '—'}</td>
                  <td className="py-3 px-3">{l.contactName || '—'}</td>
                  <td className="py-3 px-3">{l.responsibleUserName || '—'}</td>
                  <td className="py-3 px-3 whitespace-nowrap text-xs">{l.createdAt ? new Date(l.createdAt).toLocaleDateString('ru-RU') : '—'}</td>
                  <td className="text-center py-3 px-3">{l.totalActions || 0}</td>
                  <td className="text-center py-3 px-3">{l.noteCount || 0}</td>
                  <td className="text-center py-3 px-3">
                    {l.hasCommunication ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> : <XCircle className="h-4 w-4 text-red-400 mx-auto" />}
                  </td>
                  <td className="text-center py-3 px-3">
                    {l.amocrm_link && (
                      <a href={l.amocrm_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ==================== SETTINGS TAB ====================
const SettingsTab = ({ settings, setSettings, onSave, savingSettings }) => {
  const [amoData, setAmoData] = useState({ pipelines: [], users: [] });
  const [loadingAmo, setLoadingAmo] = useState(false);

  useEffect(() => {
    setLoadingAmo(true);
    axios.get(`${API_URL}/api/lead-analytics/pipelines-and-users`)
      .then(r => setAmoData(r.data))
      .catch(() => {})
      .finally(() => setLoadingAmo(false));
  }, []);

  const selectedPipeline = amoData.pipelines.find(p => p.id === settings.pipelineId);
  const statuses = selectedPipeline?.statuses || [];

  const toggleArrayField = (field, id) => {
    setSettings(prev => {
      const arr = prev[field] || [];
      return { ...prev, [field]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
    });
  };

  if (loadingAmo) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-tab">
      {/* Pipeline */}
      <Card className="border">
        <CardHeader><CardTitle className="text-base">Воронка amoCRM</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={settings.pipelineId || ''} onValueChange={v => setSettings(prev => ({ ...prev, pipelineId: v }))}>
            <SelectTrigger><SelectValue placeholder="Выберите воронку" /></SelectTrigger>
            <SelectContent>
              {amoData.pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Stages */}
      {statuses.length > 0 && (
        <>
          <Card className="border">
            <CardHeader><CardTitle className="text-base">Этапы "новый лид"</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">Этапы, на которые попадает лид при создании</p>
              <div className="flex flex-wrap gap-2">
                {statuses.map(s => (
                  <Badge key={s.id} variant={(settings.newLeadStageIds || []).includes(s.id) ? 'default' : 'outline'}
                    className="cursor-pointer" onClick={() => toggleArrayField('newLeadStageIds', s.id)}>
                    {s.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border">
            <CardHeader><CardTitle className="text-base">Этапы начала работы менеджера</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">После перемещения бота — на каком этапе менеджер начинает работу</p>
              <div className="flex flex-wrap gap-2">
                {statuses.map(s => (
                  <Badge key={s.id} variant={(settings.managerWorkStageIds || []).includes(s.id) ? 'default' : 'outline'}
                    className="cursor-pointer" onClick={() => toggleArrayField('managerWorkStageIds', s.id)}>
                    {s.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border">
            <CardHeader><CardTitle className="text-base">Этапы успешной обработки</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">Этапы, означающие что лид успешно обработан</p>
              <div className="flex flex-wrap gap-2">
                {statuses.map(s => (
                  <Badge key={s.id} variant={(settings.successStageIds || []).includes(s.id) ? 'default' : 'outline'}
                    className="cursor-pointer" onClick={() => toggleArrayField('successStageIds', s.id)}>
                    {s.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-300">
            <CardHeader><CardTitle className="text-base">Этапы "Закрыто и не реализовано"</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">Сделки на этих этапах исключаются из основной статистики и не считаются зависшими. Отслеживаются отдельно во вкладке "Закрытые".</p>
              <div className="flex flex-wrap gap-2">
                {statuses.map(s => (
                  <Badge key={s.id} variant={(settings.closedLostStageIds || []).includes(s.id) ? 'destructive' : 'outline'}
                    className="cursor-pointer" onClick={() => toggleArrayField('closedLostStageIds', s.id)}>
                    {s.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* SLA */}
      <Card className="border">
        <CardHeader><CardTitle className="text-base">Пороги времени</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>SLA первого действия (часы)</Label>
            <Input type="number" min="1" value={settings.slaFirstActionHours || 5}
              onChange={e => setSettings(prev => ({ ...prev, slaFirstActionHours: parseInt(e.target.value) || 5 }))}
              className="w-32 mt-1" />
            <p className="text-xs text-muted-foreground mt-1">Максимум часов до первого действия менеджера</p>
          </div>
          <div>
            <Label>Порог зависания (часы)</Label>
            <Input type="number" min="1" value={settings.stalledThresholdHours || 24}
              onChange={e => setSettings(prev => ({ ...prev, stalledThresholdHours: parseInt(e.target.value) || 24 }))}
              className="w-32 mt-1" />
            <p className="text-xs text-muted-foreground mt-1">После скольких часов без действий сделка считается зависшей</p>
          </div>
        </CardContent>
      </Card>

      {/* Bot users */}
      <Card className="border">
        <CardHeader><CardTitle className="text-base">Боты (исключить из анализа)</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Действия этих пользователей не учитываются как "первое действие менеджера"</p>
          <div className="flex flex-wrap gap-2">
            {amoData.users.map(u => (
              <Badge key={u.id} variant={(settings.botUserIds || []).includes(u.id) ? 'destructive' : 'outline'}
                className="cursor-pointer" onClick={() => toggleArrayField('botUserIds', u.id)}>
                {u.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Manager users */}
      <Card className="border">
        <CardHeader><CardTitle className="text-base">Менеджеры</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Пользователи, которые считаются менеджерами отдела продаж</p>
          <div className="flex flex-wrap gap-2">
            {amoData.users.map(u => (
              <Badge key={u.id} variant={(settings.managerUserIds || []).includes(u.id) ? 'default' : 'outline'}
                className="cursor-pointer" onClick={() => toggleArrayField('managerUserIds', u.id)}>
                {u.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions config */}
      <Card className="border">
        <CardHeader><CardTitle className="text-base">Признаки обработки</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            ['countStageChangeAsAction', 'Изменение этапа'],
            ['countNoteAsAction', 'Добавление примечания'],
            ['countTaskAsAction', 'Создание задачи'],
            ['countCommunicationAsAction', 'Коммуникация (звонки, сообщения)'],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <Checkbox checked={settings[key] !== false} onCheckedChange={v => setSettings(prev => ({ ...prev, [key]: v }))} />
              <Label className="cursor-pointer">{label}</Label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={onSave} disabled={savingSettings} className="w-full">
        {savingSettings ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Сохранить настройки
      </Button>
    </div>
  );
};

// ==================== AI RECOMMENDATIONS TAB ====================
const AIRecommendationsTab = ({ dateFrom, dateTo, problemLeads }) => {
  const [departmentText, setDepartmentText] = useState('');
  const [managerText, setManagerText] = useState('');
  const [errorsText, setErrorsText] = useState('');
  const [leadAdvice, setLeadAdvice] = useState({});
  const [loadingDept, setLoadingDept] = useState(false);
  const [loadingMgr, setLoadingMgr] = useState(false);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [loadingLead, setLoadingLead] = useState(null);

  const generateDepartment = async () => {
    setLoadingDept(true);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await axios.post(`${API_URL}/api/lead-analytics/ai/department-summary`, null, { params });
      setDepartmentText(res.data.text);
    } catch (e) {
      toast.error('Ошибка генерации: ' + (e.response?.data?.detail || e.message));
    } finally { setLoadingDept(false); }
  };

  const generateManagers = async () => {
    setLoadingMgr(true);
    try {
      const res = await axios.post(`${API_URL}/api/lead-analytics/ai/manager-analysis`);
      setManagerText(res.data.text);
    } catch (e) {
      toast.error('Ошибка генерации: ' + (e.response?.data?.detail || e.message));
    } finally { setLoadingMgr(false); }
  };

  const generateErrors = async () => {
    setLoadingErrors(true);
    try {
      const res = await axios.post(`${API_URL}/api/lead-analytics/ai/common-errors`);
      setErrorsText(res.data.text);
    } catch (e) {
      toast.error('Ошибка генерации: ' + (e.response?.data?.detail || e.message));
    } finally { setLoadingErrors(false); }
  };

  const generateLeadAdvice = async (leadId) => {
    setLoadingLead(leadId);
    try {
      const res = await axios.post(`${API_URL}/api/lead-analytics/ai/problem-lead-advice?lead_id=${leadId}`);
      setLeadAdvice(prev => ({ ...prev, [leadId]: res.data.text }));
    } catch (e) {
      toast.error('Ошибка: ' + (e.response?.data?.detail || e.message));
    } finally { setLoadingLead(null); }
  };

  const AIBlock = ({ title, text, loading: isLoading, onGenerate, icon: Icon }) => (
    <Card className="border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-5 w-5 text-violet-600" />
          {title}
        </CardTitle>
        <Button size="sm" onClick={onGenerate} disabled={isLoading} variant="outline" className="border-violet-300 text-violet-700 hover:bg-violet-50">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
          {text ? 'Обновить' : 'Сгенерировать'}
        </Button>
      </CardHeader>
      {text && (
        <CardContent>
          <div className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-line bg-violet-50/50 rounded-lg p-4 border border-violet-100">
            {text}
          </div>
        </CardContent>
      )}
    </Card>
  );

  return (
    <div className="space-y-4" data-testid="ai-tab">
      <AIBlock title="Общий вывод по отделу" text={departmentText} loading={loadingDept} onGenerate={generateDepartment} icon={BarChart3} />
      <AIBlock title="Анализ по менеджерам" text={managerText} loading={loadingMgr} onGenerate={generateManagers} icon={Users} />
      <AIBlock title="Типовые ошибки и рекомендации" text={errorsText} loading={loadingErrors} onGenerate={generateErrors} icon={AlertTriangle} />

      {/* Per-lead advice for problem leads */}
      {problemLeads.length > 0 && (
        <Card className="border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5 text-violet-600" />
              Советы по проблемным сделкам
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {problemLeads.slice(0, 10).map((lead) => (
              <div key={lead.amocrm_lead_id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium text-sm">{lead.leadName || '—'}</span>
                    <span className="text-xs text-muted-foreground ml-2">({lead.responsibleUserName})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {lead.amocrm_link && (
                      <a href={lead.amocrm_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => generateLeadAdvice(lead.amocrm_lead_id)}
                      disabled={loadingLead === lead.amocrm_lead_id} className="text-violet-700 h-7 px-2">
                      {loadingLead === lead.amocrm_lead_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                {leadAdvice[lead.amocrm_lead_id] && (
                  <div className="text-sm bg-violet-50/50 rounded p-3 border border-violet-100 whitespace-pre-line">
                    {leadAdvice[lead.amocrm_lead_id]}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ==================== MAIN PAGE ====================
const LeadAnalyticsPage = () => {
  const [activeTab, setActiveTab] = useState('summary');
  const [summary, setSummary] = useState({});
  const [managers, setManagers] = useState([]);
  const [problemLeads, setProblemLeads] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const [sumRes, mgrRes, probRes, statusRes] = await Promise.all([
        axios.get(`${API_URL}/api/lead-analytics/summary`, { params }),
        axios.get(`${API_URL}/api/lead-analytics/managers`, { params }),
        axios.get(`${API_URL}/api/lead-analytics/problem-leads`, { params }),
        axios.get(`${API_URL}/api/lead-analytics/sync-status`),
      ]);
      setSummary(sumRes.data);
      setManagers(mgrRes.data.managers || []);
      setProblemLeads(probRes.data.leads || []);
      setSyncStatus(statusRes.data);
    } catch (e) {
      console.error('Error fetching analytics:', e);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/lead-analytics/settings`);
      setSettings(res.data);
    } catch (e) {
      console.error('Error fetching settings:', e);
    }
  }, []);

  useEffect(() => { fetchSummary(); fetchSettings(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      await axios.post(`${API_URL}/api/lead-analytics/sync`, null, { params });
      toast.success('Синхронизация запущена');
      // Poll status
      const poll = setInterval(async () => {
        const res = await axios.get(`${API_URL}/api/lead-analytics/sync-status`);
        setSyncStatus(res.data);
        if (res.data.status !== 'running') {
          clearInterval(poll);
          setSyncing(false);
          if (res.data.status === 'completed') {
            toast.success(`Синхронизировано: ${res.data.leadsProcessed} лидов`);
            fetchSummary();
          } else {
            toast.error('Ошибка синхронизации');
          }
        }
      }, 3000);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
      setSyncing(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await axios.put(`${API_URL}/api/lead-analytics/settings`, settings);
      toast.success('Настройки сохранены');
    } catch (e) {
      toast.error('Ошибка сохранения');
    } finally {
      setSavingSettings(false);
    }
  };

  const tabs = [
    { id: 'summary', label: 'Сводка', icon: BarChart3 },
    { id: 'managers', label: 'По менеджерам', icon: Users },
    { id: 'advanced', label: 'Расш. аналитика', icon: Target },
    { id: 'problems', label: 'Проблемные', icon: AlertTriangle, count: problemLeads.length },
    { id: 'closed', label: 'Закрытые', icon: Ban, count: summary.closedLost || 0 },
    { id: 'events', label: 'По событиям', icon: Activity },
    { id: 'ai', label: 'AI-рекомендации', icon: Zap },
    { id: 'settings', label: 'Настройки', icon: Settings },
  ];

  return (
    <div className="space-y-4" data-testid="lead-analytics-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            Контроль лидов
          </h1>
          {syncStatus && syncStatus.status !== 'never' && (
            <p className="text-xs text-muted-foreground mt-1">
              Последняя синхронизация: {syncStatus.completedAt ? new Date(syncStatus.completedAt).toLocaleString('ru-RU') : 'в процессе'}
              {syncStatus.leadsProcessed != null && ` (${syncStatus.leadsProcessed} лидов)`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-9" placeholder="От" />
          <span className="text-muted-foreground">—</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-9" placeholder="До" />
          <Button variant="outline" size="sm" onClick={fetchSummary} disabled={loading}>
            <Filter className="h-4 w-4 mr-1" />
            Применить
          </Button>
          <Button variant="outline" size="sm" onClick={async () => {
            if (!window.confirm('Очистить ВСЕ данные аналитики? Потребуется повторная синхронизация.')) return;
            try {
              await axios.post(`${API_URL}/api/lead-analytics/clear-all`);
              setSummary({}); setManagers([]); setProblemLeads([]); setSyncStatus(null);
              toast.success('Все данные очищены');
            } catch (e) { toast.error('Ошибка очистки'); }
          }} data-testid="clear-all-btn">
            <Trash2 className="h-4 w-4 mr-1" />
            Очистить всё
          </Button>
          <Button onClick={handleSync} disabled={syncing} size="sm">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Синхронизировать
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.count > 0 && <Badge variant={tab.id === 'closed' ? 'secondary' : 'destructive'} className="text-xs px-1.5 py-0">{tab.count}</Badge>}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === 'summary' && <SummaryTab summary={summary} loading={loading} />}
      {activeTab === 'managers' && <ManagersTab managers={managers} loading={loading} />}
      {activeTab === 'advanced' && <AdvancedManagerDashboard />}
      {activeTab === 'problems' && <ProblemLeadsTab leads={problemLeads} loading={loading} />}
      {activeTab === 'closed' && <ClosedLostTab dateFrom={dateFrom} dateTo={dateTo} />}
      {activeTab === 'events' && <ManagerEventsAnalytics />}
      {activeTab === 'ai' && <AIRecommendationsTab dateFrom={dateFrom} dateTo={dateTo} problemLeads={problemLeads} />}
      {activeTab === 'settings' && <SettingsTab settings={settings} setSettings={setSettings} onSave={handleSaveSettings} savingSettings={savingSettings} />}
    </div>
  );
};

export default LeadAnalyticsPage;
