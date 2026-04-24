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
  Users, List, FileText, Zap, Filter, Trash2, Plus, Save, CheckCircle, XCircle,
  BarChart3
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const fmtDur = (s) => { if (!s) return '—'; const m = Math.floor(s/60); return `${m}:${String(s%60).padStart(2,'0')}`; };

// ── PROCESSING STATS with live polling ──
const ProcessingStats = ({ refreshKey }) => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const tick = async () => {
      try {
        const r = await axios.get(`${API}/api/call-analytics/stats`);
        if (cancelled) return;
        setStats(r.data);
        const s = r.data.byStatus || {};
        const active = (s.transcribing || 0) + (s.analyzing || 0) + (s.new || 0) + (s.transcribed || 0);
        // Poll faster while there's in-flight work
        const delay = active > 0 ? 3000 : 15000;
        timer = setTimeout(tick, delay);
      } catch {
        timer = setTimeout(tick, 10000);
      }
    };
    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [refreshKey]);

  if (!stats) return <div className="text-xs text-muted-foreground">Загрузка статуса...</div>;
  const s = stats.byStatus || {};
  const inFlight = (s.transcribing || 0) + (s.analyzing || 0);
  const pending = (s.new || 0) + (s.transcribed || 0);
  const done = (s.analyzed || 0);
  const errors = (s.error || 0);
  const skipped = (s.skipped || 0);
  const totalRelevant = inFlight + pending + done + errors;
  const pct = totalRelevant > 0 ? Math.round((done / totalRelevant) * 100) : 0;

  return (
    <div className="space-y-2">
      {(inFlight > 0 || pending > 0) && (
        <div className="space-y-1" data-testid="processing-progress">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-blue-700 font-medium">
              <Loader2 className="h-3.5 w-3.5 animate-spin"/>
              Обработка: {done}/{totalRelevant} готово
              {inFlight > 0 && <span className="text-violet-600">· сейчас {inFlight}</span>}
            </span>
            <span className="text-muted-foreground">{pct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline" data-testid="stat-total">Всего: {stats.total}</Badge>
        {s.new > 0 && <Badge className="bg-gray-100 text-gray-700">В очереди: {s.new}</Badge>}
        {s.transcribing > 0 && <Badge className="bg-blue-100 text-blue-700"><Loader2 className="h-3 w-3 animate-spin inline mr-1"/>Транскрибируется: {s.transcribing}</Badge>}
        {s.transcribed > 0 && <Badge className="bg-indigo-100 text-indigo-700">Ждут анализа: {s.transcribed}</Badge>}
        {s.analyzing > 0 && <Badge className="bg-violet-100 text-violet-700"><Loader2 className="h-3 w-3 animate-spin inline mr-1"/>Анализ: {s.analyzing}</Badge>}
        {s.analyzed > 0 && <Badge className="bg-emerald-100 text-emerald-700" data-testid="stat-analyzed">Готово: {s.analyzed}</Badge>}
        {skipped > 0 && <Badge className="bg-slate-100 text-slate-500">Пропущено: {skipped}</Badge>}
        {errors > 0 && <Badge className="bg-red-100 text-red-700" data-testid="stat-errors">Ошибки: {errors}</Badge>}
        {stats.totalCost > 0 && <Badge className="bg-purple-100 text-purple-700">${stats.totalCost}</Badge>}
      </div>
    </div>
  );
};
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
  const [amoStatus, setAmoStatus] = useState(null); // 'ok' | 'error' | null
  const [processRefresh, setProcessRefresh] = useState(0);

  useEffect(() => {
    axios.get(`${API}/api/call-analytics/settings`).then(r => setSettings(r.data));
    axios.get(`${API}/api/call-analytics/sync-status`).then(r => setSyncStatus(r.data));
    axios.get(`${API}/api/integrations/amocrm/pipelines`).then(r => {
      const p = r.data?.pipelines || [];
      setPipelines(p);
      setAmoStatus(p.length > 0 ? 'ok' : 'empty');
    }).catch(() => setAmoStatus('error'));
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
          <div className="flex items-center gap-2 text-xs mb-2">
            {amoStatus === 'ok' && <><CheckCircle className="h-3.5 w-3.5 text-emerald-500"/><span className="text-emerald-700">amoCRM подключён ({pipelines.length} воронок)</span></>}
            {amoStatus === 'empty' && <><AlertTriangle className="h-3.5 w-3.5 text-amber-500"/><span className="text-amber-700">amoCRM подключён, но воронки не найдены</span></>}
            {amoStatus === 'error' && <><XCircle className="h-3.5 w-3.5 text-red-500"/><span className="text-red-700">amoCRM не подключён — проверьте настройки интеграции</span></>}
            {amoStatus === null && <><Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400"/><span className="text-gray-500">Проверка подключения...</span></>}
          </div>
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
          <div className="pt-2 border-t">
            <label className="text-xs text-muted-foreground">Мин. длительность звонка (сек)</label>
            <div className="flex items-center gap-2 mt-1">
              <Input type="number" min={0} max={300} value={settings.minDurationSeconds ?? 30}
                onChange={e => setSettings(p => ({...p, minDurationSeconds: parseInt(e.target.value) || 0}))}
                className="w-24" />
              <span className="text-xs text-muted-foreground">Звонки короче — пропускаются (экономия ~30-50%)</span>
            </div>
          </div>
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
        <CardContent className="space-y-3">
          <ProcessingStats refreshKey={processRefresh} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={async () => {
              try {
                const r = await axios.post(`${API}/api/call-analytics/process-all`);
                toast.success(`Запущено: ${r.data.queued_transcribe} на транскрибацию, ${r.data.queued_analyze} на анализ${r.data.errors_reset ? `, ${r.data.errors_reset} ошибок сброшено` : ''}`);
                setProcessRefresh(x => x + 1);
              } catch(e) { toast.error('Ошибка'); }
            }} data-testid="process-all-btn">
              <Zap className="h-4 w-4 mr-1"/> Обработать все
            </Button>
            <Button size="sm" variant="outline" onClick={async () => {
              try {
                const r = await axios.post(`${API}/api/call-analytics/process-pending`, null, { params: { limit: 5 } });
                toast.success(`В очереди: ${r.data.queued_transcribe} на транскрибацию, ${r.data.queued_analyze} на анализ`);
                setProcessRefresh(x => x + 1);
              } catch(e) { toast.error('Ошибка'); }
            }}>
              <Zap className="h-4 w-4 mr-1"/> Обработать 5
            </Button>
            <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={async () => {
              if (!window.confirm('Удалить все сохранённые звонки, у которых нет аудио и длительность = 0? Обработанные записи не затронутся.')) return;
              try {
                const r = await axios.post(`${API}/api/call-analytics/calls/purge-empty`);
                toast.success(`Удалено пустых записей: ${r.data.deleted}`);
                setProcessRefresh(x => x + 1);
              } catch(e) { toast.error('Ошибка'); }
            }} data-testid="purge-empty-btn">
              <Trash2 className="h-4 w-4 mr-1"/> Очистить пустые
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Прогресс обновляется автоматически каждые 3 сек. пока идёт обработка. «Очистить пустые» убирает импортированные записи без аудио и длительности (обычно это системные заметки amoCRM, а не реальные звонки).
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

// ── HEATMAP TAB ──
const HeatmapTab = ({ onSelectManager }) => {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(monthAgo);
  const [dateTo, setDateTo] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/call-analytics/heatmap`, {
        params: { date_from: dateFrom, date_to: dateTo }
      });
      setData(r.data);
    } catch (e) { toast.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  // Color cell by score (0-2 scale)
  const cellColor = (val) => {
    if (val == null) return 'bg-slate-100 dark:bg-slate-800 text-slate-400';
    if (val >= 1.6) return 'bg-emerald-500/80 text-white';
    if (val >= 1.2) return 'bg-emerald-300/70 text-emerald-900';
    if (val >= 0.8) return 'bg-amber-300/70 text-amber-900';
    if (val >= 0.4) return 'bg-orange-400/80 text-white';
    return 'bg-red-500/80 text-white';
  };

  return (
    <div className="space-y-4" data-testid="heatmap-tab">
      <div className="flex items-end gap-2 flex-wrap">
        <div><label className="text-xs text-muted-foreground">С</label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 mt-1"/></div>
        <div><label className="text-xs text-muted-foreground">По</label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 mt-1"/></div>
        <Button size="sm" onClick={load}><Filter className="h-4 w-4 mr-1"/>Применить</Button>
        <div className="flex-1"/>
        {data && <Badge variant="outline">{data.totalCalls} звонков · {data.managers?.length || 0} менеджеров</Badge>}
      </div>

      {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto"/> : !data?.managers?.length ? (
        <div className="text-center py-12 text-muted-foreground">Нет данных за период</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left py-2 px-3 sticky left-0 bg-muted/40 z-10 min-w-[160px]">Менеджер</th>
                <th className="text-center py-2 px-2">Звонков</th>
                <th className="text-center py-2 px-2">Ср.</th>
                {data.columns.map(c => (
                  <th key={c.key} className="text-center py-2 px-2 min-w-[80px]">
                    <div className="font-medium leading-tight">{c.label}</div>
                    {c.avg != null && <div className="text-[10px] text-muted-foreground font-normal mt-0.5">всего: {c.avg}</div>}
                  </th>
                ))}
                <th className="text-center py-2 px-2">Негатив</th>
              </tr>
            </thead>
            <tbody>
              {data.managers.map(m => (
                <tr key={m.managerId} className="border-t hover:bg-muted/20 cursor-pointer"
                    onClick={() => onSelectManager?.(m.managerId, m.managerName)}
                    data-testid={`heatmap-row-${m.managerId}`}>
                  <td className="py-2 px-3 font-medium sticky left-0 bg-white dark:bg-slate-900 z-10">{m.managerName}</td>
                  <td className="text-center py-2 px-2 text-muted-foreground">{m.totalCalls}</td>
                  <td className={`text-center py-2 px-2 font-bold ${scoreColor(m.avgScore)}`}>{m.avgScore ?? '—'}</td>
                  {data.columns.map(c => {
                    const v = m.cells[c.key];
                    const delta = v != null && c.avg != null ? (v - c.avg).toFixed(2) : null;
                    return (
                      <td key={c.key} className="py-1 px-1">
                        <div className={`rounded text-center py-2 font-bold tabular-nums ${cellColor(v)}`} title={delta != null ? `Δ от среднего: ${delta > 0 ? '+' : ''}${delta}` : ''}>
                          {v != null ? v.toFixed(1) : '—'}
                        </div>
                      </td>
                    );
                  })}
                  <td className="text-center py-2 px-2">
                    {m.negativeCount > 0 ? <Badge variant="destructive" className="text-[10px]">{m.negativeCount}</Badge> : '0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 text-[11px] text-muted-foreground border-t flex items-center gap-3 flex-wrap">
            <span>Цветовая шкала:</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/80"/> &lt;0.4</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-400/80"/> 0.4–0.8</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-300/70"/> 0.8–1.2</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-300/70"/> 1.2–1.6</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/80"/> ≥1.6</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ── MANAGER DASHBOARD ──
const ManagerDashboard = ({ managerId, managerName, onBack, onViewCalls, onSelectCall }) => {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(monthAgo);
  const [dateTo, setDateTo] = useState(today);
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [genLoading, setGenLoading] = useState(false);

  const loadDash = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/call-analytics/managers/${managerId}/dashboard`, {
        params: { date_from: dateFrom, date_to: dateTo }
      });
      setData(r.data);
    } catch (e) { toast.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  }, [managerId, dateFrom, dateTo]);

  useEffect(() => { loadDash(); setSummary(null); }, [loadDash]);

  const genSummary = async () => {
    setGenLoading(true);
    try {
      const r = await axios.post(`${API}/api/call-analytics/managers/${managerId}/summary`, null, {
        params: { date_from: dateFrom, date_to: dateTo }
      });
      setSummary(r.data);
      if (r.data.cached) toast.info('Отчёт из кэша (актуален 10 мин)');
      else toast.success(`Отчёт готов · $${r.data.cost || 0}`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
    finally { setGenLoading(false); }
  };

  if (loading) return (
    <div className="space-y-3" data-testid="manager-dashboard-loading">
      <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1"/>Назад</Button>
      <Loader2 className="h-6 w-6 animate-spin mx-auto mt-8"/>
    </div>
  );

  const d = data || {};
  const checks = d.checks || [];
  const dist = d.distribution || { high: 0, mid: 0, low: 0 };

  return (
    <div className="space-y-4" data-testid="manager-dashboard">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1"/>Назад</Button>
        <h2 className="text-lg font-bold">{d.managerName || managerName}</h2>
        <Badge variant="outline">{d.total || 0} проанализировано</Badge>
        <div className="flex-1"/>
        <Button variant="outline" size="sm" onClick={() => onViewCalls(managerId, d.managerName || managerName)}>
          <List className="h-4 w-4 mr-1"/>Все звонки
        </Button>
      </div>

      <Card className="border">
        <CardContent className="p-3 flex flex-wrap items-end gap-2">
          <div><label className="text-xs text-muted-foreground">С</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 mt-1"/></div>
          <div><label className="text-xs text-muted-foreground">По</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 mt-1"/></div>
          <Button size="sm" onClick={loadDash}><Filter className="h-4 w-4 mr-1"/>Применить</Button>
          <div className="flex-1"/>
          <Button size="sm" onClick={genSummary} disabled={genLoading || !d.total} data-testid="gen-summary-btn">
            {genLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin"/> : <Zap className="h-4 w-4 mr-1"/>}
            AI-отчёт по периоду
          </Button>
        </CardContent>
      </Card>

      {!d.total ? (
        <Card className="border"><CardContent className="p-6 text-center text-muted-foreground">
          Нет проанализированных звонков за период. Измените диапазон дат или запустите обработку во вкладке «Синхронизация».
        </CardContent></Card>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border"><CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Средняя оценка</div>
              <div className={`text-3xl font-bold ${scoreColor(d.avgScore)}`}>{d.avgScore ?? '—'}<span className="text-sm text-muted-foreground">/10</span></div>
            </CardContent></Card>
            <Card className="border"><CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Всего звонков</div>
              <div className="text-3xl font-bold">{d.total}</div>
              <div className="text-xs text-muted-foreground mt-1">вх: {d.inbound} · исх: {d.outbound}</div>
            </CardContent></Card>
            <Card className="border"><CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Средняя длительность</div>
              <div className="text-3xl font-bold">{fmtDur(d.durationAvg)}</div>
              <div className="text-xs text-muted-foreground mt-1">всего: {fmtDur(d.durationTotal)}</div>
            </CardContent></Card>
            <Card className={`border ${d.negativeCount > 0 ? 'border-red-200 bg-red-50/30' : ''}`}><CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Серьёзный негатив</div>
              <div className={`text-3xl font-bold ${d.negativeCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{d.negativeCount}</div>
              <div className="text-xs text-muted-foreground mt-1">{d.total ? Math.round(d.negativeCount / d.total * 100) : 0}% от звонков</div>
            </CardContent></Card>
          </div>

          {/* Score distribution */}
          <Card className="border">
            <CardHeader className="pb-1"><CardTitle className="text-sm">Распределение оценок</CardTitle></CardHeader>
            <CardContent className="p-3 space-y-2">
              {[
                { key: 'high', label: 'Высокие (≥8)', color: 'bg-emerald-500', count: dist.high },
                { key: 'mid', label: 'Средние (5-7)', color: 'bg-amber-500', count: dist.mid },
                { key: 'low', label: 'Низкие (<5)', color: 'bg-red-500', count: dist.low },
              ].map(r => {
                const pct = d.total ? Math.round(r.count / d.total * 100) : 0;
                return (
                  <div key={r.key} className="flex items-center gap-2 text-xs">
                    <div className="w-28">{r.label}</div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${r.color}`} style={{ width: `${pct}%` }}/>
                    </div>
                    <div className="w-16 text-right tabular-nums">{r.count} · {pct}%</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Check list averages */}
          <Card className="border">
            <CardHeader className="pb-1"><CardTitle className="text-sm">Средние баллы по чек-листу</CardTitle></CardHeader>
            <CardContent className="p-3 space-y-1.5">
              {checks.length ? checks.map(c => {
                const pct = Math.round((c.avgScore / c.maxScore) * 100);
                const color = c.avgScore >= 1.5 ? 'bg-emerald-500' : c.avgScore >= 1 ? 'bg-amber-500' : 'bg-red-500';
                return (
                  <div key={c.key} className="flex items-center gap-2 text-xs">
                    <div className="w-44">{c.label}</div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${color}`} style={{ width: `${pct}%` }}/>
                    </div>
                    <div className="w-24 text-right tabular-nums">{c.avgScore.toFixed(2)}/{c.maxScore}</div>
                  </div>
                );
              }) : <div className="text-xs text-muted-foreground">Нет данных</div>}
            </CardContent>
          </Card>

          {/* Top issues & rule breakdown */}
          <div className="grid md:grid-cols-2 gap-3">
            {d.topIssues?.length > 0 && (
              <Card className="border"><CardHeader className="pb-1"><CardTitle className="text-sm">Часто повторяющиеся проблемы</CardTitle></CardHeader>
                <CardContent className="p-3">
                  <ul className="text-xs space-y-1">
                    {d.topIssues.slice(0, 8).map((i, idx) => (
                      <li key={idx} className="flex justify-between gap-2">
                        <span className="truncate">{i.issue}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{i.count}×</Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent></Card>
            )}
            {d.byRule?.length > 0 && (
              <Card className="border"><CardHeader className="pb-1"><CardTitle className="text-sm">Применённые правила</CardTitle></CardHeader>
                <CardContent className="p-3">
                  <ul className="text-xs space-y-1">
                    {d.byRule.map((r, idx) => (
                      <li key={idx} className="flex justify-between gap-2">
                        <span>{r.rule}</span>
                        <Badge variant="outline" className="text-[10px]">{r.count}</Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent></Card>
            )}
          </div>

          {/* AI Summary */}
          {summary?.analysis && (
            <Card className="border border-indigo-200 bg-gradient-to-br from-indigo-50/40 to-white" data-testid="ai-summary">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-indigo-600"/>AI-отчёт за период
                  <Badge variant="outline" className="text-[10px] ml-auto">на основе {summary.basedOnCalls} звонков</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-sm">
                {summary.analysis.verdict && (
                  <div className="p-2.5 rounded bg-indigo-100/60 text-indigo-900 font-medium">{summary.analysis.verdict}</div>
                )}
                <div className="grid md:grid-cols-2 gap-3">
                  {summary.analysis.strengths?.length > 0 && (
                    <div>
                      <div className="font-semibold text-emerald-700 mb-1 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5"/>Сильные стороны</div>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        {summary.analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {summary.analysis.weaknesses?.length > 0 && (
                    <div>
                      <div className="font-semibold text-amber-700 mb-1 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5"/>Слабые места</div>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        {summary.analysis.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
                {summary.analysis.recommendations?.length > 0 && (
                  <div>
                    <div className="font-semibold text-blue-700 mb-1">Рекомендации</div>
                    <div className="space-y-1.5">
                      {summary.analysis.recommendations.map((r, i) => {
                        const col = r.priority === 'high' ? 'border-red-300 bg-red-50/40' :
                                    r.priority === 'medium' ? 'border-amber-300 bg-amber-50/40' :
                                    'border-slate-200';
                        const badge = r.priority === 'high' ? 'bg-red-500' :
                                      r.priority === 'medium' ? 'bg-amber-500' : 'bg-slate-400';
                        return (
                          <div key={i} className={`border rounded p-2 ${col}`}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <Badge className={`${badge} text-white text-[10px]`}>{r.priority || 'med'}</Badge>
                              <span className="font-medium text-xs">{r.title}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">{r.action}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {summary.analysis.trainingFocus && (
                  <div className="p-2 rounded bg-blue-50 border border-blue-200 text-xs">
                    <span className="font-semibold">Фокус обучения:</span> {summary.analysis.trainingFocus}
                  </div>
                )}
                {summary.analysis.riskFlags?.length > 0 && (
                  <div className="p-2 rounded bg-red-50 border border-red-200 text-xs">
                    <div className="font-semibold text-red-700 mb-1">Риски:</div>
                    <ul className="list-disc list-inside space-y-0.5">
                      {summary.analysis.riskFlags.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recent call samples */}
          {d.callSamples?.length > 0 && (
            <Card className="border">
              <CardHeader className="pb-1"><CardTitle className="text-sm">Последние оценённые звонки</CardTitle></CardHeader>
              <CardContent className="p-2 space-y-1">
                {d.callSamples.slice(0, 10).map(s => (
                  <div key={s.id} className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer hover:bg-muted/30 ${scoreBg(s.score)}`} onClick={() => onSelectCall(s.id)}>
                    <div className={`text-lg font-bold ${scoreColor(s.score)} w-8 text-center`}>{s.score ?? '—'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{s.clientName || '—'}</span>
                        {s.hasNegative && <AlertTriangle className="h-3 w-3 text-red-500"/>}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">{s.summary}</div>
                    </div>
                    <div className="text-[10px] text-muted-foreground shrink-0">{fmtDate(s.datetime)} · {fmtDur(s.duration)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

// ── MANAGERS TAB ──
const ManagersTab = ({ onSelectManager, onViewCalls }) => {
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
      <div className="flex gap-2 items-end flex-wrap">
        <div><label className="text-xs text-muted-foreground">С</label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 mt-1"/></div>
        <div><label className="text-xs text-muted-foreground">По</label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 mt-1"/></div>
        <Button size="sm" onClick={fetch}><Filter className="h-4 w-4 mr-1"/>Применить</Button>
        <div className="flex-1"/>
        <span className="text-[11px] text-muted-foreground">Клик по строке → дашборд · «Звонки» → список</span>
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
              <th className="text-center py-2 px-3"></th>
            </tr></thead>
            <tbody>
              {managers.map(m => (
                <tr key={m.managerId} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => onSelectManager(m.managerId, m.managerName)} data-testid={`manager-row-${m.managerId}`}>
                  <td className="py-2 px-3 font-medium">{m.managerName}</td>
                  <td className="text-center py-2 px-3">{m.totalCalls}</td>
                  <td className="text-center py-2 px-3">{m.analyzedCalls}</td>
                  <td className={`text-center py-2 px-3 font-bold ${scoreColor(m.avgScore)}`}>{m.avgScore ?? '—'}</td>
                  <td className="text-center py-2 px-3">{m.negativeCount > 0 ? <Badge variant="destructive">{m.negativeCount}</Badge> : '0'}</td>
                  <td className="text-center py-2 px-3">{m.lowScoreCount > 0 ? <Badge variant="outline" className="text-red-600">{m.lowScoreCount}</Badge> : '0'}</td>
                  <td className="text-center py-2 px-3 text-xs text-muted-foreground">{fmtDur(m.totalDuration)}</td>
                  <td className="text-center py-2 px-3">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onViewCalls(m.managerId, m.managerName); }}>
                      <List className="h-3 w-3 mr-1"/>Звонки
                    </Button>
                  </td>
                </tr>
              ))}
              {!managers.length && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Нет данных</td></tr>}
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
  const [category, setCategory] = useState('all'); // all | good | problem | critical

  const load = useCallback(async () => {
    setLoading(true);
    const params = { limit: 100 };
    if (managerId) params.manager_id = managerId;
    if (category !== 'all') params.category = category;
    const r = await axios.get(`${API}/api/call-analytics/calls`, { params });
    setCalls(r.data.calls || []);
    setTotal(r.data.total || 0);
    setLoading(false);
  }, [managerId, category]);

  useEffect(() => { load(); }, [load]);

  const cats = [
    { id: 'all', label: 'Все', cls: '' },
    { id: 'good', label: 'Хорошие (≥8)', cls: 'data-[active=true]:bg-emerald-500 data-[active=true]:text-white' },
    { id: 'problem', label: 'Проблемные (5–7)', cls: 'data-[active=true]:bg-amber-500 data-[active=true]:text-white' },
    { id: 'critical', label: 'Критичные (<5 / негатив)', cls: 'data-[active=true]:bg-red-500 data-[active=true]:text-white' },
  ];

  return (
    <div className="space-y-3" data-testid="calls-list">
      <div className="flex items-center gap-2 flex-wrap">
        {managerName && (
          <>
            <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1"/>Назад</Button>
            <span className="font-medium">{managerName}</span>
          </>
        )}
        <Badge variant="outline" data-testid="calls-total-badge">{total} звонков</Badge>
        <div className="flex-1"/>
        <Button variant="ghost" size="sm" className="text-amber-700 hover:bg-amber-50" onClick={async () => {
          try {
            const r = await axios.post(`${API}/api/call-analytics/reset-stale`);
            if (r.data.reset > 0) toast.success(`Сброшено зависших: ${r.data.reset}`);
            else toast.info('Зависших не найдено');
            load();
          } catch(e) { toast.error('Ошибка'); }
        }} data-testid="reset-stale-btn">
          <RefreshCw className="h-3.5 w-3.5 mr-1"/>Сбросить зависшие
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5" data-testid="category-filter">
        {cats.map(c => (
          <button
            key={c.id}
            data-active={category === c.id}
            onClick={() => setCategory(c.id)}
            className={`px-3 py-1 rounded-full text-xs border transition ${category === c.id ? 'border-transparent shadow-sm' : 'bg-white hover:bg-muted/30'} ${c.cls}`}
            data-testid={`category-${c.id}`}
          >
            {c.label}
          </button>
        ))}
      </div>

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
              {c.cost_total > 0 && <span className="text-[10px] text-purple-500">${c.cost_total}</span>}
              <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
            </div>
          ))}
          {!calls.length && <div className="text-center py-8 text-muted-foreground">Нет звонков в этой категории</div>}
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
            {call.cost_total > 0 && (
              <div><span className="text-muted-foreground text-xs">Стоимость</span><div className="text-purple-600 font-medium">${call.cost_total}</div></div>
            )}
            {call.error && (
              <div className="col-span-2"><span className="text-muted-foreground text-xs">Ошибка</span><div className="text-xs text-red-600 bg-red-50 p-1.5 rounded mt-0.5">{call.error}</div></div>
            )}
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
        <div className="space-y-3">
          {/* Browser-side audio download + upload */}
          {call.audio_url && (
            <Card className="border border-blue-200">
              <CardContent className="p-3 space-y-2">
                <p className="text-xs text-muted-foreground">Binotel не даёт скачивать аудио серверу. Нажмите кнопку — браузер скачает файл и отправит на обработку:</p>
                <Button size="sm" onClick={async () => {
                  toast.info('Скачиваю аудио через браузер...');
                  try {
                    const resp = await fetch(call.audio_url);
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    const blob = await resp.blob();
                    if (blob.size < 100) throw new Error('Файл слишком маленький');
                    const fd = new FormData();
                    fd.append('file', blob, 'call.mp3');
                    await axios.post(`${API}/api/call-analytics/calls/${call.id}/upload-audio`, fd);
                    toast.success('Аудио загружено и отправлено на транскрибацию!');
                  } catch (e) { toast.error('Не удалось: ' + e.message); }
                }}>
                  <Play className="h-4 w-4 mr-1"/> Загрузить аудио через браузер
                </Button>
              </CardContent>
            </Card>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={async () => {
              try { await axios.post(`${API}/api/call-analytics/calls/${call.id}/transcribe`); toast.success('Транскрибация запущена'); } catch(e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
            }}><FileText className="h-4 w-4 mr-1"/>Транскрибировать</Button>
            <Button size="sm" variant="outline" onClick={async () => {
              try { await axios.post(`${API}/api/call-analytics/calls/${call.id}/analyze`); toast.success('Анализ запущен'); } catch(e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
            }}><Zap className="h-4 w-4 mr-1"/>Анализировать</Button>
          </div>
          {/* Manual file upload */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Или загрузите файл вручную:</p>
            <input type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const fd = new FormData();
              fd.append('file', f);
              try {
                await axios.post(`${API}/api/call-analytics/calls/${call.id}/upload-audio`, fd);
                toast.success('Файл загружен и отправлен на транскрибацию');
              } catch (err) { toast.error(err.response?.data?.detail || 'Ошибка'); }
              e.target.value = '';
            }} className="text-xs" />
          </div>
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
  const [managerDashboard, setManagerDashboard] = useState(null); // { id, name }
  const [managerCalls, setManagerCalls] = useState(null); // { id, name }
  const [selectedCall, setSelectedCall] = useState(null);

  const tabs = [
    { id: 'sync', label: 'Синхронизация', icon: RefreshCw },
    { id: 'heatmap', label: 'Сравнение', icon: BarChart3 },
    { id: 'managers', label: 'Менеджеры', icon: Users },
    { id: 'calls', label: 'Все звонки', icon: Phone },
    { id: 'rules', label: 'Правила оценки', icon: Settings },
  ];

  // Call detail view
  if (selectedCall) {
    return <CallDetail callId={selectedCall} onBack={() => setSelectedCall(null)} />;
  }

  // Manager's call list
  if (managerCalls) {
    return <CallsList
      managerId={managerCalls.id} managerName={managerCalls.name}
      onBack={() => setManagerCalls(null)} onSelectCall={setSelectedCall}
    />;
  }

  // Manager dashboard
  if (managerDashboard) {
    return <ManagerDashboard
      managerId={managerDashboard.id} managerName={managerDashboard.name}
      onBack={() => setManagerDashboard(null)}
      onViewCalls={(id, name) => { setManagerDashboard(null); setManagerCalls({ id, name }); }}
      onSelectCall={setSelectedCall}
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
      {tab === 'heatmap' && <HeatmapTab onSelectManager={(id, name) => setManagerDashboard({ id, name })} />}
      {tab === 'managers' && <ManagersTab
        onSelectManager={(id, name) => setManagerDashboard({ id, name })}
        onViewCalls={(id, name) => setManagerCalls({ id, name })}
      />}
      {tab === 'calls' && <CallsList onSelectCall={setSelectedCall} />}
      {tab === 'rules' && <RulesTab />}
    </div>
  );
};

export default CallAnalyticsPage;
