import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import {
  RefreshCw, Loader2, Phone, PhoneIncoming, PhoneOutgoing, Play,
  Clock, Star, AlertTriangle, ExternalLink, ChevronLeft, Settings,
  Users, List, FileText, Zap, Filter, Trash2, Plus, Save, CheckCircle, XCircle
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const fmtDur = (s) => { if (!s) return '—'; const m = Math.floor(s/60); return `${m}:${String(s%60).padStart(2,'0')}`; };
const fmtDate = (d) => d ? new Date(d).toLocaleString('ru-RU', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—';
const scoreColor = (s) => s == null ? 'text-gray-400' : s >= 8 ? 'text-emerald-600' : s >= 5 ? 'text-amber-600' : 'text-red-600';
const scoreBg = (s) => s == null ? 'bg-gray-100' : s >= 8 ? 'bg-emerald-50 border-emerald-200' : s >= 5 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

// ── SYNC TAB ──
const SyncTab = () => {
  const [settings, setSettings] = useState({});
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/api/call-analytics/settings`).then(r => setSettings(r.data));
    axios.get(`${API}/api/call-analytics/sync-status`).then(r => setSyncStatus(r.data));
    axios.get(`${API}/api/amocrm/pipelines`).then(r => setPipelines(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (settings.pipelineId && pipelines.length) {
      const p = pipelines.find(p => String(p.id) === String(settings.pipelineId));
      setStages(p?.statuses || []);
    }
  }, [settings.pipelineId, pipelines]);

  const saveSettings = async () => {
    setSaving(true);
    try { await axios.put(`${API}/api/call-analytics/settings`, settings); toast.success('Настройки сохранены'); }
    catch (e) { toast.error('Ошибка'); }
    finally { setSaving(false); }
  };

  const sync = async (mode) => {
    setSyncing(true);
    try {
      const params = { mode };
      if (mode === 'from_date' && dateFrom) params.date_from = dateFrom;
      await axios.post(`${API}/api/call-analytics/sync`, null, { params });
      toast.success('Синхронизация запущена');
      const poll = setInterval(async () => {
        const r = await axios.get(`${API}/api/call-analytics/sync-status`);
        setSyncStatus(r.data);
        if (r.data.status !== 'running') { clearInterval(poll); setSyncing(false); }
      }, 3000);
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); setSyncing(false); }
  };

  return (
    <div className="space-y-4" data-testid="sync-tab">
      <Card className="border">
        <CardHeader><CardTitle className="text-base">Настройки источника</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Воронка amoCRM</label>
            <select className="w-full border rounded px-3 py-2 text-sm mt-1"
              value={settings.pipelineId || ''} onChange={e => setSettings(p => ({...p, pipelineId: e.target.value, stageIds: []}))}>
              <option value="">Выберите воронку</option>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {stages.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground">Этапы (выберите нужные)</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {stages.map(s => (
                  <Badge key={s.id} variant={(settings.stageIds || []).includes(String(s.id)) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs" onClick={() => {
                      const ids = settings.stageIds || [];
                      const sid = String(s.id);
                      setSettings(p => ({...p, stageIds: ids.includes(sid) ? ids.filter(i => i !== sid) : [...ids, sid]}));
                    }}>{s.name}</Badge>
                ))}
              </div>
            </div>
          )}
          <Button size="sm" onClick={saveSettings} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1"/> : <Save className="h-4 w-4 mr-1"/>}
            Сохранить настройки
          </Button>
        </CardContent>
      </Card>

      <Card className="border">
        <CardHeader><CardTitle className="text-base">Синхронизация звонков</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">С даты</label>
              <Input type="datetime-local" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="mt-1" />
            </div>
            <Button onClick={() => sync('from_date')} disabled={syncing || !dateFrom} size="sm">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1"/> : <RefreshCw className="h-4 w-4 mr-1"/>}
              С указанной даты
            </Button>
          </div>
          <Button onClick={() => sync('from_last_sync')} disabled={syncing} size="sm" variant="outline" className="w-full">
            <RefreshCw className="h-4 w-4 mr-1"/> С последней синхронизации
            {settings.lastSyncAt && <span className="text-xs ml-2 text-muted-foreground">({fmtDate(settings.lastSyncAt)})</span>}
          </Button>
          {syncStatus && syncStatus.status !== 'never' && (
            <div className={`text-sm p-2 rounded ${syncStatus.status === 'running' ? 'bg-blue-50' : syncStatus.status === 'completed' ? 'bg-emerald-50' : 'bg-red-50'}`}>
              {syncStatus.status === 'running' && <Loader2 className="h-3 w-3 animate-spin inline mr-1"/>}
              {syncStatus.progress || syncStatus.status}
              {syncStatus.status === 'completed' && syncStatus.imported != null && (
                <span className="ml-2">+{syncStatus.imported} новых, {syncStatus.updated} обновлено</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border">
        <CardHeader><CardTitle className="text-base">Обработка звонков</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">Запустить транскрибацию и AI-анализ для необработанных звонков</p>
          <Button size="sm" onClick={async () => {
            try {
              const r = await axios.post(`${API}/api/call-analytics/process-pending`, null, { params: { limit: 5 } });
              toast.success(`В очереди: ${r.data.queued_transcribe} на транскрибацию, ${r.data.queued_analyze} на анализ`);
            } catch(e) { toast.error('Ошибка'); }
          }}>
            <Zap className="h-4 w-4 mr-1"/> Обработать (до 5)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// ── MANAGERS TAB ──
const ManagersTab = ({ onSelectManager }) => {
  const [managers, setManagers] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    const r = await axios.get(`${API}/api/call-analytics/managers`, { params });
    setManagers(r.data.managers || []);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <div className="space-y-4" data-testid="managers-tab">
      <div className="flex gap-2 items-end">
        <div><label className="text-xs text-muted-foreground">С</label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 mt-1"/></div>
        <div><label className="text-xs text-muted-foreground">По</label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 mt-1"/></div>
        <Button size="sm" onClick={fetch}><Filter className="h-4 w-4 mr-1"/>Применить</Button>
      </div>
      {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto"/> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left py-2 px-3">Менеджер</th>
              <th className="text-center py-2 px-3">Звонков</th>
              <th className="text-center py-2 px-3">Оценено</th>
              <th className="text-center py-2 px-3">Ср. оценка</th>
              <th className="text-center py-2 px-3">Негатив</th>
              <th className="text-center py-2 px-3">Низкая оценка</th>
              <th className="text-center py-2 px-3">Время</th>
            </tr></thead>
            <tbody>
              {managers.map(m => (
                <tr key={m.managerId} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => onSelectManager(m.managerId, m.managerName)}>
                  <td className="py-2 px-3 font-medium">{m.managerName}</td>
                  <td className="text-center py-2 px-3">{m.totalCalls}</td>
                  <td className="text-center py-2 px-3">{m.analyzedCalls}</td>
                  <td className={`text-center py-2 px-3 font-bold ${scoreColor(m.avgScore)}`}>{m.avgScore ?? '—'}</td>
                  <td className="text-center py-2 px-3">{m.negativeCount > 0 ? <Badge variant="destructive">{m.negativeCount}</Badge> : '0'}</td>
                  <td className="text-center py-2 px-3">{m.lowScoreCount > 0 ? <Badge variant="outline" className="text-red-600">{m.lowScoreCount}</Badge> : '0'}</td>
                  <td className="text-center py-2 px-3 text-xs text-muted-foreground">{fmtDur(m.totalDuration)}</td>
                </tr>
              ))}
              {!managers.length && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Нет данных</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── CALLS LIST ──
const CallsList = ({ managerId, managerName, onBack, onSelectCall }) => {
  const [calls, setCalls] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const params = { limit: 100 };
      if (managerId) params.manager_id = managerId;
      const r = await axios.get(`${API}/api/call-analytics/calls`, { params });
      setCalls(r.data.calls || []);
      setTotal(r.data.total || 0);
      setLoading(false);
    })();
  }, [managerId]);

  return (
    <div className="space-y-3" data-testid="calls-list">
      {managerName && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1"/>Назад</Button>
          <span className="font-medium">{managerName}</span>
          <Badge variant="outline">{total} звонков</Badge>
        </div>
      )}
      {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto"/> : (
        <div className="space-y-1.5">
          {calls.map(c => (
            <div key={c.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer hover:bg-muted/30 transition ${scoreBg(c.score)}`}
              onClick={() => onSelectCall(c.id)}>
              {c.direction === 'inbound' ? <PhoneIncoming className="h-4 w-4 text-green-600 shrink-0"/> : <PhoneOutgoing className="h-4 w-4 text-blue-600 shrink-0"/>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium truncate">{c.client_name || c.deal_name || '—'}</span>
                  {c.has_strong_negative && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0"/>}
                </div>
                <div className="text-xs text-muted-foreground">{fmtDate(c.datetime)} / {fmtDur(c.duration_seconds)} / {c.manager_name}</div>
              </div>
              <div className={`text-lg font-bold ${scoreColor(c.score)}`}>{c.score ?? '—'}</div>
              <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
            </div>
          ))}
          {!calls.length && <div className="text-center py-8 text-muted-foreground">Нет звонков</div>}
        </div>
      )}
    </div>
  );
};

// ── CALL DETAIL ──
const CallDetail = ({ callId, onBack }) => {
  const [call, setCall] = useState(null);
  const [tab, setTab] = useState('score');

  useEffect(() => {
    axios.get(`${API}/api/call-analytics/calls/${callId}`).then(r => setCall(r.data));
  }, [callId]);

  if (!call) return <Loader2 className="h-6 w-6 animate-spin mx-auto mt-8"/>;

  const checks = call.checks_json || {};
  const checkLabels = { greeting:'Приветствие', needs:'Потребности', presentation:'Презентация', objections:'Возражения', next_step:'Следующий шаг', politeness:'Вежливость', compliance:'Скрипт' };

  return (
    <div className="space-y-4" data-testid="call-detail">
      <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1"/>Назад</Button>

      <Card className="border">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><span className="text-muted-foreground text-xs">Менеджер</span><div className="font-medium">{call.manager_name}</div></div>
            <div><span className="text-muted-foreground text-xs">Клиент</span><div className="font-medium">{call.client_name || '—'}</div></div>
            <div><span className="text-muted-foreground text-xs">Дата/время</span><div>{fmtDate(call.datetime)}</div></div>
            <div><span className="text-muted-foreground text-xs">Длительность</span><div>{fmtDur(call.duration_seconds)}</div></div>
            <div><span className="text-muted-foreground text-xs">Направление</span><div>{call.direction === 'inbound' ? 'Входящий' : 'Исходящий'}</div></div>
            <div><span className="text-muted-foreground text-xs">Язык</span><div>{call.language || '—'}</div></div>
            <div><span className="text-muted-foreground text-xs">Статус</span><Badge variant="outline">{call.status}</Badge></div>
            <div>
              {call.amo_link && <a href={call.amo_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs flex items-center gap-1"><ExternalLink className="h-3 w-3"/>amoCRM</a>}
            </div>
          </div>
          {call.audio_url && (
            <div className="mt-3"><audio controls src={call.audio_url} className="w-full h-10" preload="none"/></div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-1">
        {['score','transcript','actions'].map(t => (
          <Button key={t} variant={tab===t ? 'default' : 'ghost'} size="sm" onClick={() => setTab(t)}>
            {t === 'score' ? 'Оценка' : t === 'transcript' ? 'Транскрипт' : 'Действия'}
          </Button>
        ))}
      </div>

      {tab === 'score' && (
        <div className="space-y-3">
          {call.score != null && (
            <div className={`text-center py-4 rounded-lg border ${scoreBg(call.score)}`}>
              <div className={`text-4xl font-bold ${scoreColor(call.score)}`}>{call.score}/10</div>
              {call.has_strong_negative && <Badge variant="destructive" className="mt-1">Серьёзный негатив</Badge>}
            </div>
          )}
          {call.summary_ru && <Card className="border"><CardContent className="p-3 text-sm">{call.summary_ru}</CardContent></Card>}
          {Object.keys(checks).length > 0 && (
            <div className="space-y-1.5">
              {Object.entries(checkLabels).map(([key, label]) => {
                const c = checks[key];
                if (!c) return null;
                return (
                  <div key={key} className="flex items-start gap-2 p-2 rounded border bg-muted/20 text-sm">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${c.score >= 2 ? 'bg-emerald-100 text-emerald-700' : c.score >= 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{c.score}</div>
                    <div><div className="font-medium">{label}</div><div className="text-xs text-muted-foreground">{c.comment}</div></div>
                  </div>
                );
              })}
            </div>
          )}
          {call.recommendations_json?.length > 0 && (
            <Card className="border border-blue-200"><CardHeader className="pb-1"><CardTitle className="text-sm text-blue-700">Рекомендации</CardTitle></CardHeader>
              <CardContent className="p-3 pt-0"><ul className="list-disc list-inside text-sm space-y-0.5">
                {call.recommendations_json.map((r,i) => <li key={i}>{r}</li>)}
              </ul></CardContent></Card>
          )}
        </div>
      )}

      {tab === 'transcript' && (
        <div className="space-y-2">
          {call.transcript_ru && <Card className="border"><CardHeader className="pb-1"><CardTitle className="text-sm">Транскрипт (RU)</CardTitle></CardHeader>
            <CardContent className="p-3 text-sm whitespace-pre-line max-h-[60vh] overflow-y-auto">{call.transcript_ru}</CardContent></Card>}
          {call.transcript_pl && <Card className="border"><CardHeader className="pb-1"><CardTitle className="text-sm">Оригинал (PL)</CardTitle></CardHeader>
            <CardContent className="p-3 text-sm whitespace-pre-line max-h-[60vh] overflow-y-auto">{call.transcript_pl}</CardContent></Card>}
          {!call.transcript_ru && !call.transcript_pl && <div className="text-center py-8 text-muted-foreground">Транскрипт ещё не создан</div>}
        </div>
      )}

      {tab === 'actions' && (
        <div className="flex gap-2">
          <Button size="sm" onClick={async () => {
            try { await axios.post(`${API}/api/call-analytics/calls/${call.id}/transcribe`); toast.success('Транскрибация запущена'); } catch(e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
          }}><FileText className="h-4 w-4 mr-1"/>Транскрибировать</Button>
          <Button size="sm" variant="outline" onClick={async () => {
            try { await axios.post(`${API}/api/call-analytics/calls/${call.id}/analyze`); toast.success('Анализ запущен'); } catch(e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
          }}><Zap className="h-4 w-4 mr-1"/>Анализировать</Button>
        </div>
      )}
    </div>
  );
};

// ── RULES TAB ──
const RulesTab = () => {
  const [rules, setRules] = useState([]);
  const [editing, setEditing] = useState(null);
  const fileRef = React.useRef(null);

  const fetch = async () => { const r = await axios.get(`${API}/api/call-analytics/rules`); setRules(r.data); };
  useEffect(() => { fetch(); }, []);

  // Auto-seed on first load if empty
  useEffect(() => {
    if (rules.length === 0) {
      axios.post(`${API}/api/call-analytics/rules/seed`).then(r => {
        if (r.data.status === 'ok') { toast.success(`Создано ${r.data.created} стартовых правил`); fetch(); }
      }).catch(() => {});
    }
  }, [rules.length]);

  const save = async () => {
    try {
      if (editing._isNew) { await axios.post(`${API}/api/call-analytics/rules`, editing); }
      else { await axios.put(`${API}/api/call-analytics/rules/${editing.id}`, editing); }
      toast.success('Сохранено');
      setEditing(null); fetch();
    } catch(e) { toast.error('Ошибка'); }
  };

  const handleFileUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('file', f);
    try {
      const r = await axios.post(`${API}/api/call-analytics/rules/upload`, fd);
      toast.success(`Импортировано: ${r.data.imported} правил`);
      fetch();
    } catch (err) { toast.error(err.response?.data?.detail || 'Ошибка импорта'); }
    e.target.value = '';
  };

  if (editing) return (
    <div className="space-y-3" data-testid="rule-editor">
      <Button variant="ghost" size="sm" onClick={() => setEditing(null)}><ChevronLeft className="h-4 w-4 mr-1"/>Назад</Button>
      <div><label className="text-xs text-muted-foreground">Название</label><Input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})}/></div>
      <div><label className="text-xs text-muted-foreground">Описание</label><Textarea value={editing.description} onChange={e => setEditing({...editing, description: e.target.value})} rows={2}/></div>
      <div><label className="text-xs text-muted-foreground">Промпт-шаблон (дополнительный контекст для AI)</label><Textarea value={editing.promptTemplate} onChange={e => setEditing({...editing, promptTemplate: e.target.value})} rows={4} className="font-mono text-xs" placeholder="Оставьте пустым для стандартного промпта"/></div>
      <div><label className="text-xs text-muted-foreground">Конфигурация (JSON)</label><Textarea value={JSON.stringify(editing.configJson || {}, null, 2)} onChange={e => { try { setEditing({...editing, configJson: JSON.parse(e.target.value)}); } catch {} }} rows={8} className="font-mono text-xs"/></div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={editing.isDefault} onChange={e => setEditing({...editing, isDefault: e.target.checked})}/>
        <label className="text-sm">По умолчанию</label>
      </div>
      <div className="flex gap-2">
        <Button onClick={save}><Save className="h-4 w-4 mr-1"/>Сохранить</Button>
        {!editing._isNew && (
          <Button variant="destructive" size="sm" onClick={async () => {
            await axios.delete(`${API}/api/call-analytics/rules/${editing.id}`);
            toast.success('Удалено'); setEditing(null); fetch();
          }}><Trash2 className="h-4 w-4 mr-1"/>Удалить</Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-3" data-testid="rules-tab">
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setEditing({ _isNew: true, name:'', description:'', promptTemplate:'', isDefault: false, configJson:{} })}>
          <Plus className="h-4 w-4 mr-1"/>Новое правило
        </Button>
        <input type="file" ref={fileRef} onChange={handleFileUpload} className="hidden" accept=".json"/>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <FileText className="h-4 w-4 mr-1"/>Импорт из JSON
        </Button>
      </div>
      {rules.map(r => (
        <div key={r.id} className={`flex items-center gap-3 p-3 border rounded cursor-pointer hover:bg-muted/30 ${r.isDefault ? 'border-blue-300 bg-blue-50/30' : ''}`} onClick={() => setEditing(r)}>
          <div className="flex-1">
            <div className="font-medium text-sm">{r.name}</div>
            <div className="text-xs text-muted-foreground">{r.description}</div>
            {r.configJson?.critical_checks && (
              <div className="flex gap-1 mt-1">
                {r.configJson.critical_checks.map(c => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
              </div>
            )}
          </div>
          {r.isDefault && <Badge className="bg-blue-500">По умолч.</Badge>}
        </div>
      ))}
      {!rules.length && <div className="text-center py-8 text-muted-foreground">Загрузка правил...</div>}
    </div>
  );
};

// ── MAIN COMPONENT ──
const CallAnalyticsPage = () => {
  const [tab, setTab] = useState('sync');
  const [selectedManager, setSelectedManager] = useState(null);
  const [selectedCall, setSelectedCall] = useState(null);

  const tabs = [
    { id: 'sync', label: 'Синхронизация', icon: RefreshCw },
    { id: 'managers', label: 'Менеджеры', icon: Users },
    { id: 'calls', label: 'Все звонки', icon: Phone },
    { id: 'rules', label: 'Правила оценки', icon: Settings },
  ];

  // Call detail view
  if (selectedCall) {
    return <CallDetail callId={selectedCall} onBack={() => setSelectedCall(null)} />;
  }

  // Manager's calls
  if (selectedManager) {
    return <CallsList
      managerId={selectedManager.id} managerName={selectedManager.name}
      onBack={() => setSelectedManager(null)} onSelectCall={setSelectedCall}
    />;
  }

  return (
    <div className="space-y-4" data-testid="call-analytics-page">
      <h2 className="text-lg font-bold flex items-center gap-2"><Phone className="h-5 w-5 text-indigo-600"/>Анализ звонков</h2>

      <div className="flex gap-1 border-b pb-1">
        {tabs.map(t => (
          <Button key={t.id} variant={tab === t.id ? 'default' : 'ghost'} size="sm" onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5" data-testid={`call-tab-${t.id}`}>
            <t.icon className="h-3.5 w-3.5"/>{t.label}
          </Button>
        ))}
      </div>

      {tab === 'sync' && <SyncTab />}
      {tab === 'managers' && <ManagersTab onSelectManager={(id, name) => setSelectedManager({ id, name })} />}
      {tab === 'calls' && <CallsList onSelectCall={setSelectedCall} />}
      {tab === 'rules' && <RulesTab />}
    </div>
  );
};

export default CallAnalyticsPage;
