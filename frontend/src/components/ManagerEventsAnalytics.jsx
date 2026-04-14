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
  Users, RefreshCw, Loader2, Clock, ChevronLeft, CheckCircle, XCircle,
  AlertTriangle, TrendingUp, ExternalLink, Activity, Timer, Target, Zap,
  ArrowUpDown, Filter, BarChart3, MessageSquare, ListChecks, ArrowRight,
  Settings, Star, Award, ChevronDown, ChevronUp
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const formatHours = (h) => {
  if (h == null) return '—';
  if (h < 1) return `${Math.round(h * 60)} мин`;
  if (h < 24) return `${h.toFixed(1)} ч`;
  return `${Math.floor(h / 24)} д ${Math.round(h % 24)} ч`;
};

const ScoreBar = ({ score, label, color = 'bg-blue-500' }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="w-24 text-muted-foreground truncate">{label}</span>
    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
        style={{ width: `${score}%` }} />
    </div>
    <span className="w-8 text-right font-medium">{score}</span>
  </div>
);

const EVENT_TYPE_LABELS = {
  lead_added: 'Лид создан',
  lead_status_changed: 'Смена этапа',
  entity_linked: 'Связь',
  note_added: 'Примечание',
  task_added: 'Задача создана',
  task_completed: 'Задача закрыта',
  incoming_call: 'Входящий звонок',
  outgoing_call: 'Исходящий звонок',
  incoming_chat_message: 'Вход. сообщение',
  outgoing_chat_message: 'Исход. сообщение',
};

// ==================== MANAGER TABLE ====================
const ManagerTable = ({ managers, loading, onSelectManager }) => {
  const [sortBy, setSortBy] = useState('rank');

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  if (!managers.length) return <div className="text-center py-12 text-muted-foreground">Нет данных. Запустите синхронизацию событий.</div>;

  const sorted = [...managers].sort((a, b) => {
    if (sortBy === 'rank') return a.rank - b.rank;
    if (sortBy === 'events') return b.totalEvents - a.totalEvents;
    if (sortBy === 'score') return b.performanceScore - a.performanceScore;
    if (sortBy === 'reaction') return (a.avgReactionHours || 999) - (b.avgReactionHours || 999);
    return 0;
  });

  return (
    <div className="space-y-3" data-testid="event-managers-table">
      <div className="flex items-center gap-2">
        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rank">По рейтингу</SelectItem>
            <SelectItem value="score">По баллу</SelectItem>
            <SelectItem value="events">По событиям</SelectItem>
            <SelectItem value="reaction">По реакции</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left py-3 px-2">#</th>
              <th className="text-left py-3 px-2">Менеджер</th>
              <th className="text-center py-3 px-2">Балл</th>
              <th className="text-center py-3 px-2">Лидов</th>
              <th className="text-center py-3 px-2">Обработано</th>
              <th className="text-center py-3 px-2">% обр.</th>
              <th className="text-center py-3 px-2">Ср. реакция</th>
              <th className="text-center py-3 px-2">Событий</th>
              <th className="text-center py-3 px-2">Смен этапов</th>
              <th className="text-center py-3 px-2">Примечаний</th>
              <th className="text-center py-3 px-2">Проблемных</th>
              <th className="text-center py-3 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.userId} className="border-b hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => onSelectManager(m)}>
                <td className="py-3 px-2">
                  <Badge variant={m.rank <= 3 ? 'default' : 'secondary'}
                    className={m.rank === 1 ? 'bg-amber-500' : m.rank === 2 ? 'bg-gray-400' : m.rank === 3 ? 'bg-amber-700' : ''}>
                    {m.rank}
                  </Badge>
                </td>
                <td className="py-3 px-2 font-medium">{m.userName}</td>
                <td className="text-center py-3 px-2">
                  <span className={`text-base font-bold ${m.performanceScore >= 70 ? 'text-emerald-600' : m.performanceScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                    {m.performanceScore}
                  </span>
                </td>
                <td className="text-center py-3 px-2">{m.totalLeads}</td>
                <td className="text-center py-3 px-2 text-emerald-700 font-medium">{m.processedLeads}</td>
                <td className="text-center py-3 px-2">
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${m.processedPercent >= 80 ? 'bg-emerald-500' : m.processedPercent >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${m.processedPercent}%` }} />
                    </div>
                    <span className="text-xs">{m.processedPercent}%</span>
                  </div>
                </td>
                <td className="text-center py-3 px-2">{formatHours(m.avgReactionHours)}</td>
                <td className="text-center py-3 px-2 font-medium">{m.totalEvents}</td>
                <td className="text-center py-3 px-2">{m.stageChanges}</td>
                <td className="text-center py-3 px-2">{m.noteEvents}</td>
                <td className="text-center py-3 px-2 text-red-600">{m.stalledLeads + m.notProcessedLeads}</td>
                <td className="text-center py-3 px-2"><ArrowRight className="h-4 w-4 text-muted-foreground" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ==================== MANAGER DETAIL ====================
const ManagerDetail = ({ manager, onBack, dateFrom, dateTo }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('events');

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const params = {};
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
        const res = await axios.get(`${API_URL}/api/lead-analytics/events/manager-detail/${manager.userId}`, { params });
        setDetail(res.data);
      } catch (e) {
        toast.error('Ошибка загрузки данных менеджера');
      } finally { setLoading(false); }
    };
    fetchDetail();
  }, [manager.userId, dateFrom, dateTo]);

  const generateAI = async () => {
    setAiLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/lead-analytics/events/ai/manager-deep-analysis?user_id=${manager.userId}`);
      setAiText(res.data.text);
    } catch (e) {
      toast.error('Ошибка AI-анализа: ' + (e.response?.data?.detail || e.message));
    } finally { setAiLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;

  const stats = detail?.stats || manager;
  const sections = [
    { id: 'events', label: 'Лента событий', count: detail?.totalEvents },
    { id: 'problems', label: 'Проблемные', count: detail?.problemLeads?.length },
    { id: 'no_action', label: 'Без действий', count: detail?.noFirstAction?.length },
    { id: 'no_progress', label: 'Без прогресса', count: detail?.noProgress?.length },
    { id: 'idle', label: 'Зависшие', count: detail?.longIdle?.length },
  ];

  return (
    <div className="space-y-4" data-testid="manager-detail">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 transition-colors" data-testid="back-to-list-btn">
        <ChevronLeft className="h-4 w-4" />
        Назад к списку
      </button>

      {/* Header with scores */}
      <div className="flex flex-col md:flex-row gap-4">
        <Card className="flex-1 border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${stats.performanceScore >= 70 ? 'bg-emerald-500' : stats.performanceScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}>
                {stats.performanceScore}
              </div>
              <div>
                <h2 className="text-lg font-bold">{stats.userName}</h2>
                <span className="text-sm text-muted-foreground">Ранг #{stats.rank}</span>
              </div>
            </div>
            <div className="space-y-2">
              <ScoreBar score={stats.reactionScore || 0} label="Реакция" />
              <ScoreBar score={stats.processingScore || 0} label="Обработка" />
              <ScoreBar score={stats.activityScore || 0} label="Активность" />
              <ScoreBar score={stats.progressScore || 0} label="Прогресс" />
              <ScoreBar score={stats.problemScore || 0} label="Проблемы" />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1">
          {[
            { label: 'Лидов', value: stats.totalLeads, icon: Target },
            { label: 'Обработано', value: stats.processedLeads, icon: CheckCircle },
            { label: 'Событий', value: stats.totalEvents, icon: Activity },
            { label: 'Смен этапов', value: stats.stageChanges, icon: TrendingUp },
            { label: 'Примечаний', value: stats.noteEvents, icon: MessageSquare },
            { label: 'Задач', value: stats.taskEvents, icon: ListChecks },
          ].map((kpi, i) => (
            <Card key={i} className="border">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1"><kpi.icon className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">{kpi.label}</span></div>
                <div className="text-xl font-bold">{kpi.value || 0}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* AI analysis */}
      <Card className="border border-violet-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-violet-700"><Zap className="h-5 w-5" />AI-разбор менеджера</CardTitle>
          <Button size="sm" onClick={generateAI} disabled={aiLoading} variant="outline" className="border-violet-300 text-violet-700 hover:bg-violet-50">
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
            {aiText ? 'Обновить' : 'Сгенерировать'}
          </Button>
        </CardHeader>
        {aiText && <CardContent><div className="text-sm leading-relaxed whitespace-pre-line bg-violet-50/50 rounded-lg p-4 border border-violet-100">{aiText}</div></CardContent>}
      </Card>

      {/* Section tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeSection === s.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {s.label}
            {s.count > 0 && <Badge variant="secondary" className="text-[10px] px-1 py-0">{s.count}</Badge>}
          </button>
        ))}
      </div>

      {/* Events feed */}
      {activeSection === 'events' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left py-2 px-2">Дата</th>
              <th className="text-left py-2 px-2">Тип</th>
              <th className="text-left py-2 px-2">Сущность</th>
              <th className="text-left py-2 px-2">До</th>
              <th className="text-left py-2 px-2">После</th>
            </tr></thead>
            <tbody>
              {(detail?.events || []).map((ev, i) => (
                <tr key={i} className="border-b hover:bg-muted/30">
                  <td className="py-2 px-2 whitespace-nowrap">{ev.created_at ? new Date(ev.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="py-2 px-2"><Badge variant="outline" className="text-[10px]">{EVENT_TYPE_LABELS[ev.type] || ev.type}</Badge></td>
                  <td className="py-2 px-2">{ev.entity_type} {ev.entity_id && `#${ev.entity_id}`}</td>
                  <td className="py-2 px-2 max-w-[150px] truncate text-muted-foreground">{ev.value_before_raw || '—'}</td>
                  <td className="py-2 px-2 max-w-[150px] truncate">{ev.value_after_raw || '—'}</td>
                </tr>
              ))}
              {(!detail?.events || detail.events.length === 0) && <tr><td colSpan="5" className="text-center py-8 text-muted-foreground">Нет событий</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Lead lists */}
      {['problems', 'no_action', 'no_progress', 'idle'].includes(activeSection) && (
        <LeadList leads={
          activeSection === 'problems' ? detail?.problemLeads :
          activeSection === 'no_action' ? detail?.noFirstAction :
          activeSection === 'no_progress' ? detail?.noProgress :
          detail?.longIdle
        } />
      )}
    </div>
  );
};

const LeadList = ({ leads }) => {
  if (!leads || leads.length === 0) return <div className="text-center py-8 text-muted-foreground">Нет сделок в этой категории</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="border-b bg-muted/50">
          <th className="text-left py-2 px-2">Сделка</th>
          <th className="text-left py-2 px-2">Клиент</th>
          <th className="text-left py-2 px-2">Создана</th>
          <th className="text-center py-2 px-2">Бездействие</th>
          <th className="text-center py-2 px-2">Действий</th>
          <th className="text-center py-2 px-2">Прогресс</th>
          <th className="text-center py-2 px-2"></th>
        </tr></thead>
        <tbody>
          {leads.map((l, i) => (
            <tr key={i} className="border-b hover:bg-muted/30">
              <td className="py-2 px-2 font-medium max-w-[180px] truncate">{l.leadName || '—'}</td>
              <td className="py-2 px-2">{l.contactName || '—'}</td>
              <td className="py-2 px-2 whitespace-nowrap">{l.createdAt ? new Date(l.createdAt).toLocaleDateString('ru-RU') : '—'}</td>
              <td className="text-center py-2 px-2"><span className={l.idleHours > 48 ? 'text-red-600 font-bold' : ''}>{formatHours(l.idleHours)}</span></td>
              <td className="text-center py-2 px-2">{l.totalActions || 0}</td>
              <td className="text-center py-2 px-2">{l.hasProgress ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mx-auto" /> : <XCircle className="h-3.5 w-3.5 text-red-400 mx-auto" />}</td>
              <td className="text-center py-2 px-2">{l.amocrm_link && <a href={l.amocrm_link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5 text-blue-600" /></a>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ==================== EVENT SETTINGS ====================
const EventSettings = ({ settings, setSettings, onSave, saving }) => (
  <div className="space-y-6 max-w-3xl" data-testid="event-settings">
    <Card className="border">
      <CardHeader><CardTitle className="text-base">Типы полезных событий</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <Checkbox checked={(settings.usefulEventTypes || []).includes(key)}
              onCheckedChange={v => setSettings(prev => ({
                ...prev,
                usefulEventTypes: v ? [...(prev.usefulEventTypes || []), key] : (prev.usefulEventTypes || []).filter(t => t !== key)
              }))} />
            <Label className="cursor-pointer text-sm">{label} <span className="text-xs text-muted-foreground">({key})</span></Label>
          </div>
        ))}
      </CardContent>
    </Card>

    <Card className="border">
      <CardHeader><CardTitle className="text-base">Пороги времени</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>SLA первого действия (часы)</Label>
          <Input type="number" min="1" value={settings.slaFirstActionHours || 5}
            onChange={e => setSettings(prev => ({ ...prev, slaFirstActionHours: parseInt(e.target.value) || 5 }))} className="w-32 mt-1" />
        </div>
        <div>
          <Label>Порог зависания (часы)</Label>
          <Input type="number" min="1" value={settings.stalledThresholdHours || 24}
            onChange={e => setSettings(prev => ({ ...prev, stalledThresholdHours: parseInt(e.target.value) || 24 }))} className="w-32 mt-1" />
        </div>
      </CardContent>
    </Card>

    <Card className="border">
      <CardHeader><CardTitle className="text-base">Веса рейтинга (итого 100)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {[
          ['weightReactionSpeed', 'Скорость реакции'],
          ['weightProcessingPercent', 'Процент обработки'],
          ['weightEventActivity', 'Активность по событиям'],
          ['weightDealProgress', 'Прогресс по сделкам'],
          ['weightProblemLeads', 'Проблемные лиды (инверсия)'],
        ].map(([key, label]) => (
          <div key={key} className="flex items-center gap-3">
            <Label className="w-48 text-sm">{label}</Label>
            <Input type="number" min="0" max="100" value={settings[key] || 0}
              onChange={e => setSettings(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))} className="w-20 h-8" />
          </div>
        ))}
      </CardContent>
    </Card>

    <Button onClick={onSave} disabled={saving} className="w-full">
      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
      Сохранить настройки
    </Button>
  </div>
);

// ==================== MAIN COMPONENT ====================
const ManagerEventsAnalytics = () => {
  const [activeTab, setActiveTab] = useState('managers');
  const [managers, setManagers] = useState([]);
  const [selectedManager, setSelectedManager] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mgrRes, statusRes, settingsRes] = await Promise.all([
        axios.get(`${API_URL}/api/lead-analytics/events/manager-stats`),
        axios.get(`${API_URL}/api/lead-analytics/events/sync-status`),
        axios.get(`${API_URL}/api/lead-analytics/events/settings`),
      ]);
      setManagers(mgrRes.data.managers || []);
      setSyncStatus(statusRes.data);
      setSettings(settingsRes.data);
    } catch (e) {
      console.error('Error fetching event analytics:', e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      await axios.post(`${API_URL}/api/lead-analytics/events/sync`, null, { params });
      toast.success('Синхронизация событий запущена');
      const poll = setInterval(async () => {
        const res = await axios.get(`${API_URL}/api/lead-analytics/events/sync-status`);
        setSyncStatus(res.data);
        if (res.data.status !== 'running') {
          clearInterval(poll);
          setSyncing(false);
          if (res.data.status === 'completed') {
            toast.success(`Синхронизировано: ${res.data.eventsProcessed} событий`);
            fetchData();
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
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/lead-analytics/events/settings`, settings);
      toast.success('Настройки сохранены');
    } catch (e) { toast.error('Ошибка'); }
    finally { setSaving(false); }
  };

  if (selectedManager) {
    return <ManagerDetail manager={selectedManager} onBack={() => setSelectedManager(null)} dateFrom={dateFrom} dateTo={dateTo} />;
  }

  const tabs = [
    { id: 'managers', label: 'Менеджеры', icon: Users },
    { id: 'settings', label: 'Настройки', icon: Settings },
  ];

  return (
    <div className="space-y-4" data-testid="event-analytics">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-600" />
            Статистика менеджеров (по событиям)
          </h2>
          {syncStatus && syncStatus.status !== 'never' && (
            <p className="text-xs text-muted-foreground mt-1">
              Последняя синхронизация: {syncStatus.completedAt ? new Date(syncStatus.completedAt).toLocaleString('ru-RU') : 'в процессе'}
              {syncStatus.eventsProcessed != null && ` (${syncStatus.eventsProcessed} событий)`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-9" />
          <span className="text-muted-foreground">—</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-9" />
          <Button onClick={handleSync} disabled={syncing} size="sm">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Синхронизировать
          </Button>
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`} data-testid={`event-tab-${tab.id}`}>
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'managers' && <ManagerTable managers={managers} loading={loading} onSelectManager={setSelectedManager} />}
      {activeTab === 'settings' && <EventSettings settings={settings} setSettings={setSettings} onSave={handleSaveSettings} saving={saving} />}
    </div>
  );
};

export default ManagerEventsAnalytics;
