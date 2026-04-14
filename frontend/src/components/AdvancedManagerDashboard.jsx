import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import {
  RefreshCw, Loader2, AlertTriangle, Phone, PhoneIncoming, PhoneOutgoing,
  Clock, CheckCircle, XCircle, ExternalLink, Zap, Users, Target,
  MessageSquare, TrendingUp, ChevronDown, ChevronUp, Flame, CircleDot, Trash2
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const fmtH = (h) => {
  if (h == null) return '—';
  if (h < 1) return `${Math.round(h * 60)} мин`;
  if (h < 24) return `${h.toFixed(1)} ч`;
  return `${Math.floor(h / 24)}д ${Math.round(h % 24)}ч`;
};
const fmtSec = (s) => {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}м ${sec}с` : `${sec}с`;
};

const SEVERITY_STYLE = {
  red: 'border-red-400 bg-red-50',
  orange: 'border-orange-400 bg-orange-50',
  yellow: 'border-yellow-400 bg-yellow-50',
};
const SEVERITY_BADGE = {
  red: 'bg-red-500 text-white',
  orange: 'bg-orange-500 text-white',
  yellow: 'bg-yellow-500 text-white',
};

// ── Urgent Actions ──────────────────────────
const UrgentActions = ({ items }) => {
  if (!items || !items.length) return null;
  return (
    <Card className="border-2 border-red-200" data-testid="urgent-actions">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-red-700">
          <Flame className="h-5 w-5" /> Срочные действия
          <Badge className="bg-red-500 text-white ml-2">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((a, i) => (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${SEVERITY_STYLE[a.severity] || ''}`}>
            <Badge className={`text-[10px] shrink-0 ${SEVERITY_BADGE[a.severity] || ''}`}>
              {a.severity === 'red' ? 'СРОЧНО' : a.severity === 'orange' ? 'ВАЖНО' : 'ВНИМАНИЕ'}
            </Badge>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium truncate">{a.dealName || a.manager}</span>
                {a.contactName && <span className="text-muted-foreground text-xs">({a.contactName})</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {a.manager}{a.stageName ? ` / ${a.stageName}` : ''}
                {a.idleHours != null ? ` / без действий ${fmtH(a.idleHours)}` : ''}
              </div>
              <div className="text-xs font-medium mt-1">{a.recommendation}</div>
            </div>
            {a.link && (
              <a href={a.link} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <ExternalLink className="h-4 w-4 text-blue-600" />
              </a>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// ── Manager Card ─────────────────────────────
const ManagerCard = ({ mgr, onExpand, expanded }) => {
  const ca = mgr.calls || {};
  const ea = mgr.emptyAmount || {};
  const jnw = mgr.jeszcze_nie_wiem || {};
  const nd = mgr.nie_dodzwonilismy || {};

  return (
    <Card className={`border ${mgr.specificAlerts?.some(a => a.severity === 'critical') ? 'border-red-300' : ''}`} data-testid={`manager-card-${mgr.userId}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold ${mgr.loadAlert ? 'bg-red-500' : 'bg-blue-600'}`}>
              {mgr.loadPercent?.toFixed(0)}%
            </div>
            <div>
              <div className="font-bold">{mgr.userName}</div>
              <div className="text-xs text-muted-foreground">{mgr.activeDeals} активных из {mgr.totalDeals}</div>
            </div>
          </div>
          <button onClick={() => onExpand(mgr.userId)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className={`p-2 rounded ${jnw.noActiveTask > 5 ? 'bg-red-50 border border-red-200' : 'bg-muted/50'}`}>
            <div className="text-muted-foreground">Jeszcze nie wiem</div>
            <div className="font-bold text-lg">{jnw.total || 0}</div>
            <div>без задачи: <span className="font-medium text-red-600">{jnw.noActiveTask || 0}</span></div>
          </div>
          <div className={`p-2 rounded ${nd.noFollowUp > 3 ? 'bg-red-50 border border-red-200' : 'bg-muted/50'}`}>
            <div className="text-muted-foreground">Не дозвонились</div>
            <div className="font-bold text-lg">{nd.total || 0}</div>
            <div>без повтора: <span className="font-medium text-red-600">{nd.noFollowUp || 0}</span></div>
          </div>
          <div className={`p-2 rounded ${ea.alert ? 'bg-orange-50 border border-orange-200' : 'bg-muted/50'}`}>
            <div className="text-muted-foreground">Пустая сумма</div>
            <div className="font-bold text-lg">{ea.percent || 0}%</div>
            <div>{ea.emptyCount || 0} из {ea.total || 0}</div>
          </div>
          <div className={`p-2 rounded ${ca.shortCallAlert ? 'bg-orange-50 border border-orange-200' : 'bg-muted/50'}`}>
            <div className="text-muted-foreground">Звонки</div>
            <div className="font-bold text-lg">{ca.totalCount || 0}</div>
            <div>ср. {fmtSec(ca.avgDuration)}</div>
          </div>
        </div>

        {/* Alerts */}
        {mgr.specificAlerts?.length > 0 && (
          <div className="space-y-1">
            {mgr.specificAlerts.map((a, i) => (
              <div key={i} className={`text-xs px-2 py-1 rounded flex items-center gap-1.5 ${
                a.severity === 'critical' ? 'bg-red-100 text-red-800' :
                a.severity === 'warning' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
              }`}>
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {a.message}
              </div>
            ))}
          </div>
        )}

        {mgr.stageAlert && (
          <div className="text-xs px-2 py-1.5 rounded bg-red-100 text-red-800 font-medium flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5" />
            АЛЕРТ: {mgr.stageAlertCount} сделок без действий на ключевых этапах
          </div>
        )}

        {/* Expanded detail */}
        {expanded && (
          <div className="space-y-4 pt-3 border-t">
            {/* Calls detail */}
            <div>
              <div className="text-sm font-medium mb-2 flex items-center gap-1.5"><Phone className="h-4 w-4" /> Звонки</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 p-2 bg-muted/50 rounded">
                  <PhoneIncoming className="h-3.5 w-3.5 text-green-600" />
                  <span>Входящие: {ca.incomingCount || 0}</span>
                  <span className="text-muted-foreground ml-auto">ср. {fmtSec(ca.incomingAvgDuration)}</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 bg-muted/50 rounded">
                  <PhoneOutgoing className="h-3.5 w-3.5 text-blue-600" />
                  <span>Исходящие: {ca.outgoingCount || 0}</span>
                  <span className="text-muted-foreground ml-auto">ср. {fmtSec(ca.outgoingAvgDuration)}</span>
                </div>
              </div>
            </div>

            {/* Activity */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-muted-foreground">Примечаний/нед</div>
                <div className="font-bold text-lg">{mgr.notesThisWeek || 0}</div>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-muted-foreground">Смен вперёд</div>
                <div className="font-bold text-lg">{mgr.forwardStageChanges || 0}</div>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-muted-foreground">Касаний/сделку</div>
                <div className="font-bold text-lg">{mgr.avgTouchesPerDeal || 0}</div>
              </div>
            </div>

            {/* Stage time */}
            {mgr.avgTimePerStage && Object.keys(mgr.avgTimePerStage).length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2 flex items-center gap-1.5"><Clock className="h-4 w-4" /> Среднее время на этапе</div>
                <div className="space-y-1">
                  {Object.values(mgr.avgTimePerStage).map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-40 truncate text-muted-foreground">{s.name}</span>
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${s.avgHours > 72 ? 'bg-red-500' : s.avgHours > 24 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, s.avgHours / 2)}%` }} />
                      </div>
                      <span className="w-16 text-right">{fmtH(s.avgHours)}</span>
                      <span className="w-8 text-right text-muted-foreground">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deal lists */}
            {mgr.emptyAmount?.deals?.length > 0 && (
              <DealList title="Сделки с пустой суммой" deals={mgr.emptyAmount.deals} />
            )}
            {mgr.postKPNoFollowUp?.length > 0 && (
              <DealList title="Без follow-up после КП" deals={mgr.postKPNoFollowUp} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const DealList = ({ title, deals }) => (
  <div>
    <div className="text-xs font-medium mb-1 text-muted-foreground">{title} ({deals.length})</div>
    <div className="max-h-40 overflow-y-auto space-y-0.5">
      {deals.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-xs py-1 hover:bg-muted/30 rounded px-1">
          <span className="truncate flex-1 font-medium">{d.leadName || '—'}</span>
          {d.statusName && <span className="text-muted-foreground">{d.statusName}</span>}
          {d.idleHours != null && <span className="text-red-600">{fmtH(d.idleHours)}</span>}
          {d.link && <a href={d.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3 text-blue-600" /></a>}
        </div>
      ))}
    </div>
  </div>
);

// ── Main Component ───────────────────────────
const AdvancedManagerDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedMgr, setExpandedMgr] = useState(null);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/lead-analytics/advanced/dashboard`);
      setData(res.data);
    } catch (e) {
      console.error('Advanced dashboard error:', e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await axios.post(`${API_URL}/api/lead-analytics/advanced/sync`);
      toast.success('Синхронизация запущена');
      const poll = setInterval(async () => {
        const res = await axios.get(`${API_URL}/api/lead-analytics/advanced/sync-status`);
        if (res.data.status !== 'running') {
          clearInterval(poll);
          setSyncing(false);
          if (res.data.status === 'completed') {
            toast.success('Данные обновлены');
            fetchData();
          } else {
            toast.error('Ошибка: ' + (res.data.error || ''));
          }
        }
      }, 3000);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
      setSyncing(false);
    }
  };

  const generateAI = async () => {
    setAiLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/lead-analytics/advanced/ai/comparison`);
      setAiText(res.data.text);
    } catch (e) {
      toast.error('Ошибка AI: ' + (e.response?.data?.detail || e.message));
    } finally { setAiLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;

  const managers = data?.managers || [];
  const urgent = data?.urgentActions || [];
  const noData = !managers.length;

  return (
    <div className="space-y-4" data-testid="advanced-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-indigo-600" />
            Расширенная аналитика менеджеров
          </h2>
          {data?.syncCompletedAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Обновлено: {new Date(data.syncCompletedAt).toLocaleString('ru-RU')}
              {data.totalActiveDeals != null && ` / ${data.totalActiveDeals} активных сделок`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={async () => {
            try {
              await axios.post(`${API_URL}/api/lead-analytics/advanced/clear`);
              setData(null);
              setAiText('');
              toast.success('Данные очищены');
            } catch (e) { toast.error('Ошибка очистки'); }
          }} data-testid="advanced-clear-btn">
            <Trash2 className="h-4 w-4 mr-1" />
            Очистить
          </Button>
          <Button onClick={handleSync} disabled={syncing} size="sm" data-testid="advanced-sync-btn">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Обновить данные
          </Button>
        </div>
      </div>

      {noData ? (
        <div className="text-center py-16 text-muted-foreground">
          Нет данных. Нажмите "Обновить данные" для синхронизации из amoCRM.
        </div>
      ) : (
        <>
          <UrgentActions items={urgent} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {managers.map(m => (
              <ManagerCard key={m.userId} mgr={m}
                expanded={expandedMgr === m.userId}
                onExpand={(id) => setExpandedMgr(prev => prev === id ? null : id)} />
            ))}
          </div>

          {/* AI Comparison */}
          <Card className="border border-violet-200" data-testid="ai-comparison">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-violet-700">
                <Zap className="h-5 w-5" /> Сравнительный AI-анализ менеджеров
              </CardTitle>
              <Button size="sm" onClick={generateAI} disabled={aiLoading} variant="outline"
                className="border-violet-300 text-violet-700 hover:bg-violet-50" data-testid="ai-comparison-btn">
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                {aiText ? 'Обновить' : 'Сгенерировать'}
              </Button>
            </CardHeader>
            {aiText && (
              <CardContent>
                <div className="text-sm leading-relaxed whitespace-pre-line bg-violet-50/50 rounded-lg p-4 border border-violet-100">
                  {aiText}
                </div>
              </CardContent>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default AdvancedManagerDashboard;
