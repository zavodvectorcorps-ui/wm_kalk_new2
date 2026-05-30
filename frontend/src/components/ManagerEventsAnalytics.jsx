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
  Settings, Star, Award, ChevronDown, ChevronUp, Phone
} from 'lucide-react';

import { getApiUrl } from '../utils/api';
import BinotelMappingDialog from './BinotelMappingDialog';
import UnifiedSyncButton from './UnifiedSyncButton';
const API_URL = getApiUrl();

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
              <th className="text-center py-3 px-2" title="Скорректированный балл (учитывает follow-up + штраф за single-touch)">Балл</th>
              <th className="text-center py-3 px-2">Лидов</th>
              <th className="text-center py-3 px-2">% обр.</th>
              <th className="text-center py-3 px-2" title="Доля лидов, где было ≥2 ручных касаний в первые 72 ч">Follow-up</th>
              <th className="text-center py-3 px-2" title="Доля лидов, где менеджер сделал ровно ОДНО действие — «отправил и забыл»">Single-touch</th>
              <th className="text-center py-3 px-2" title="Доля лидов, где менеджер вообще ничего не делал (бот сам двигал)">Auto-only</th>
              <th className="text-center py-3 px-2" title="Среднее количество ручных действий на лид">Дейст./лид</th>
              <th className="text-center py-3 px-2" title="Исходящих звонков на лид">Звон./лид</th>
              <th className="text-center py-3 px-2" title="Доля отвеченных звонков из Binotel">% дозв.</th>
              <th className="text-center py-3 px-2" title="Средняя длительность разговора (сек)">Ср. длит.</th>
              <th className="text-center py-3 px-2">Ср. реакция</th>
              <th className="text-center py-3 px-2">Проблемных</th>
              <th className="text-center py-3 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              // Suspicious badge: high score but weak fundamentals.
              const followUp = m.followUpRate || 0;
              const singleTouch = m.singleTouchPercent || 0;
              const isSuspicious = m.performanceScore >= 70 && (followUp < 40 || singleTouch > 40);
              return (
              <tr
                key={m.userId}
                className={`border-b hover:bg-muted/30 cursor-pointer transition-colors ${isSuspicious ? 'bg-orange-50/40' : ''}`}
                onClick={() => onSelectManager(m)}
                data-testid={`mgr-row-${m.userId}`}
              >
                <td className="py-3 px-2">
                  <Badge variant={m.rank <= 3 ? 'default' : 'secondary'}
                    className={m.rank === 1 ? 'bg-amber-500' : m.rank === 2 ? 'bg-gray-400' : m.rank === 3 ? 'bg-amber-700' : ''}>
                    {m.rank}
                  </Badge>
                </td>
                <td className="py-3 px-2 font-medium">
                  <div className="flex items-center gap-1.5">
                    {m.userName}
                    {isSuspicious && (
                      <span
                        className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-200 text-orange-900 font-bold"
                        title="Высокий балл, но низкий follow-up или много single-touch — стоит присмотреться"
                      >
                        ⚠ проверь
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-center py-3 px-2">
                  <span className={`text-base font-bold ${m.performanceScore >= 70 ? 'text-emerald-600' : m.performanceScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                    {m.performanceScore}
                  </span>
                  {m.singleTouchPenalty > 0 && (
                    <div className="text-[9px] text-red-500" title="Штраф за single-touch">−{m.singleTouchPenalty}</div>
                  )}
                </td>
                <td className="text-center py-3 px-2">{m.totalLeads}</td>
                <td className="text-center py-3 px-2">
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-10 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${m.processedPercent >= 80 ? 'bg-emerald-500' : m.processedPercent >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${m.processedPercent}%` }} />
                    </div>
                    <span className="text-xs">{m.processedPercent}%</span>
                  </div>
                </td>
                <td className="text-center py-3 px-2">
                  <span className={`font-medium ${followUp >= 70 ? 'text-emerald-600' : followUp >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                    {followUp}%
                  </span>
                </td>
                <td className="text-center py-3 px-2">
                  <span className={`font-medium ${singleTouch >= 40 ? 'text-red-600' : singleTouch >= 20 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {singleTouch}%
                  </span>
                </td>
                <td className="text-center py-3 px-2">
                  <span className={`text-xs ${(m.autoOnlyPercent || 0) > 20 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                    {m.autoOnlyPercent || 0}%
                  </span>
                </td>
                <td className="text-center py-3 px-2">
                  <span className={`text-xs font-medium ${(m.avgActionsPerLead || 0) < 1.5 ? 'text-red-600' : (m.avgActionsPerLead || 0) < 3 ? 'text-amber-600' : 'text-emerald-700'}`}>
                    {(m.avgActionsPerLead || 0).toFixed(1)}
                  </span>
                </td>
                <td className="text-center py-3 px-2">
                  <span className={`text-xs ${(m.callsPerLead || 0) < 0.3 ? 'text-red-600' : 'text-foreground'}`}>
                    {(m.callsPerLead || 0).toFixed(1)}
                  </span>
                </td>
                <td className="text-center py-3 px-2">
                  {m.binotelTotal != null ? (
                    <span className={`text-xs font-medium ${(m.binotelAnswerRate || 0) >= 70 ? 'text-emerald-600' : (m.binotelAnswerRate || 0) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                      {(m.binotelAnswerRate || 0).toFixed(0)}%
                    </span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="text-center py-3 px-2">
                  <span className="text-xs text-muted-foreground">
                    {m.binotelAvgTalkSec
                      ? `${Math.floor(m.binotelAvgTalkSec / 60)}:${String(m.binotelAvgTalkSec % 60).padStart(2, '0')}`
                      : '—'}
                  </span>
                </td>
                <td className="text-center py-3 px-2">{formatHours(m.avgReactionHours)}</td>
                <td className="text-center py-3 px-2 text-red-600">{m.stalledLeads + m.notProcessedLeads}</td>
                <td className="text-center py-3 px-2"><ArrowRight className="h-4 w-4 text-muted-foreground" /></td>
              </tr>
              );
            })}
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
    { id: 'single_touch', label: '⚠ Single-touch', count: detail?.singleTouchLeads?.length },
    { id: 'auto_only', label: '🤖 Auto-only', count: detail?.autoOnlyLeads?.length },
    { id: 'calls', label: '📞 Звонки', count: detail?.callKpi?.total },
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
              <ScoreBar score={stats.followUpScore || 0} label="Follow-up" />
              <ScoreBar score={stats.problemScore || 0} label="Проблемы" />
              {stats.singleTouchPenalty > 0 && (
                <div className="text-[11px] text-red-600 pt-1 border-t">
                  Штраф single-touch: −{stats.singleTouchPenalty} баллов
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1">
          {[
            { label: 'Лидов', value: stats.totalLeads, icon: Target },
            { label: 'Обработано', value: stats.processedLeads, icon: CheckCircle },
            { label: 'Событий', value: stats.totalEvents, icon: Activity, sub: stats.autoEvents > 0 ? `авто: ${stats.autoEvents}` : null },
            { label: 'Смен этапов', value: stats.stageChanges, icon: TrendingUp },
            { label: 'Примечаний', value: stats.noteEvents, icon: MessageSquare },
            { label: 'Задач', value: stats.taskEvents, icon: ListChecks },
          ].map((kpi, i) => (
            <Card key={i} className="border">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1"><kpi.icon className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">{kpi.label}</span></div>
                <div className="text-xl font-bold">{kpi.value || 0}</div>
                {kpi.sub && <div className="text-[10px] text-amber-600 mt-0.5">{kpi.sub}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quality KPI strip — guardrails against "send and forget" */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <QualityKpi
          label="Follow-up 72ч"
          value={`${stats.followUpRate || 0}%`}
          tone={(stats.followUpRate || 0) >= 70 ? 'pos' : (stats.followUpRate || 0) >= 40 ? 'warn' : 'neg'}
          hint="≥2 ручных касания в 72ч после первого"
          testId="qkpi-followup"
        />
        <QualityKpi
          label="Single-touch"
          value={`${stats.singleTouchPercent || 0}%`}
          tone={(stats.singleTouchPercent || 0) <= 20 ? 'pos' : (stats.singleTouchPercent || 0) <= 40 ? 'warn' : 'neg'}
          hint="Лиды с ровно ОДНИМ ручным действием"
          testId="qkpi-single"
        />
        <QualityKpi
          label="Auto-only"
          value={`${stats.autoOnlyPercent || 0}%`}
          tone={(stats.autoOnlyPercent || 0) <= 10 ? 'pos' : (stats.autoOnlyPercent || 0) <= 25 ? 'warn' : 'neg'}
          hint="Лиды без единого ручного касания (двигал бот)"
          testId="qkpi-autoonly"
        />
        <QualityKpi
          label="Звонки / лид"
          value={(stats.callsPerLead || 0).toFixed(2)}
          tone={(stats.callsPerLead || 0) >= 1 ? 'pos' : (stats.callsPerLead || 0) >= 0.3 ? 'warn' : 'neg'}
          hint={`Всего исх. звонков: ${stats.outgoingCalls || 0}`}
          testId="qkpi-calls"
        />
        <QualityKpi
          label="Действий / лид"
          value={(stats.avgActionsPerLead || 0).toFixed(2)}
          tone={(stats.avgActionsPerLead || 0) >= 3 ? 'pos' : (stats.avgActionsPerLead || 0) >= 1.5 ? 'warn' : 'neg'}
          hint={`Manual: ${stats.manualActions || 0} · email: ${stats.outgoingEmails || 0}`}
          testId="qkpi-actions"
        />
      </div>

      {/* Binotel call KPIs — visible only when overlay returned data */}
      {detail?.binotelStats && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3" data-testid="binotel-kpi-strip">
          <div className="flex items-center gap-2 mb-2">
            <Phone className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
              Binotel · телефония live
            </span>
            <span className="text-[10px] text-muted-foreground">
              (источник: API)
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <QualityKpi
              label="Звонков всего"
              value={detail.binotelStats.total || 0}
              tone="neutral"
              hint={`Исх: ${detail.binotelStats.outgoing} · Вх: ${detail.binotelStats.incoming}`}
              testId="bkpi-total"
            />
            <QualityKpi
              label="Отвечено"
              value={detail.binotelStats.answered || 0}
              tone="pos"
              hint="Звонки с разговором >0 сек"
              testId="bkpi-answered"
            />
            <QualityKpi
              label="Пропущено"
              value={detail.binotelStats.missed || 0}
              tone={(detail.binotelStats.missed || 0) > (detail.binotelStats.answered || 0) ? 'neg' : 'warn'}
              hint="Не дозвонились / занято / отменено"
              testId="bkpi-missed"
            />
            <QualityKpi
              label="% дозвона"
              value={`${detail.binotelStats.answerRate || 0}%`}
              tone={(detail.binotelStats.answerRate || 0) >= 70 ? 'pos' : (detail.binotelStats.answerRate || 0) >= 40 ? 'warn' : 'neg'}
              hint="Доля отвеченных от всех"
              testId="bkpi-rate"
            />
            <QualityKpi
              label="Ср. длительность"
              value={detail.binotelStats.avgTalkSec
                ? `${Math.floor(detail.binotelStats.avgTalkSec / 60)}:${String(detail.binotelStats.avgTalkSec % 60).padStart(2, '0')}`
                : '—'}
              tone="neutral"
              hint="Время разговора по отвеченным"
              testId="bkpi-avg"
            />
          </div>
        </div>
      )}

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
      {['problems', 'no_action', 'no_progress', 'idle', 'single_touch', 'auto_only'].includes(activeSection) && (
        <LeadList leads={
          activeSection === 'problems' ? detail?.problemLeads :
          activeSection === 'no_action' ? detail?.noFirstAction :
          activeSection === 'no_progress' ? detail?.noProgress :
          activeSection === 'single_touch' ? detail?.singleTouchLeads :
          activeSection === 'auto_only' ? detail?.autoOnlyLeads :
          detail?.longIdle
        } />
      )}

      {/* Calls section — linked from call analytics */}
      {activeSection === 'calls' && (
        <CallsSection callKpi={detail?.callKpi} calls={detail?.recentCalls || []} userId={manager.userId} />
      )}
    </div>
  );
};

// QualityKpi — small card used in ManagerDetail header strip
const QualityKpi = ({ label, value, tone = 'neutral', hint, testId }) => {
  const toneCls = tone === 'pos'
    ? 'border-emerald-300 bg-emerald-50/50 text-emerald-800'
    : tone === 'warn'
      ? 'border-amber-300 bg-amber-50/50 text-amber-800'
      : tone === 'neg'
        ? 'border-red-300 bg-red-50/50 text-red-800'
        : 'border-slate-200 bg-card';
  return (
    <Card className={`border-2 ${toneCls}`} data-testid={testId}>
      <CardContent className="p-3">
        <div className="text-[10px] uppercase tracking-wider font-semibold opacity-70">{label}</div>
        <div className="text-xl font-bold font-mono mt-0.5">{value}</div>
        {hint && <div className="text-[10px] opacity-70 mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
};

const CallsSection = ({ callKpi, calls, userId }) => {
  const k = callKpi || {};
  return (
    <div className="space-y-3" data-testid="manager-calls-section">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="border"><CardContent className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Звонков всего</div>
          <div className="text-2xl font-bold">{k.total || 0}</div>
        </CardContent></Card>
        <Card className="border"><CardContent className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">С AI-анализом</div>
          <div className="text-2xl font-bold">{k.withAi || 0}</div>
        </CardContent></Card>
        <Card className="border"><CardContent className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Средняя оценка</div>
          <div className={`text-2xl font-bold ${(k.avgScore ?? 0) >= 8 ? 'text-emerald-600' : (k.avgScore ?? 0) >= 5 ? 'text-amber-600' : 'text-red-600'}`}>
            {k.avgScore != null ? `${k.avgScore} / 10` : '—'}
          </div>
        </CardContent></Card>
        <Card className="border"><CardContent className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Критичных</div>
          <div className={`text-2xl font-bold ${(k.criticalCount || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {k.criticalCount || 0}
          </div>
        </CardContent></Card>
      </div>
      {calls.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          У этого менеджера ещё нет звонков (или они без AI-анализа)
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left py-2 px-2">Дата</th>
              <th className="text-left py-2 px-2">Клиент</th>
              <th className="text-left py-2 px-2">Тип</th>
              <th className="text-center py-2 px-2">Длительность</th>
              <th className="text-center py-2 px-2">Оценка AI</th>
              <th className="text-left py-2 px-2">Краткий итог</th>
            </tr></thead>
            <tbody>
              {calls.map((c, i) => (
                <tr key={c.id || i} className="border-b hover:bg-muted/30">
                  <td className="py-2 px-2 whitespace-nowrap">
                    {c.datetime ? new Date(c.datetime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="py-2 px-2 max-w-[180px] truncate">{c.client_name || c.client_phone || '—'}</td>
                  <td className="py-2 px-2"><Badge variant="outline" className="text-[10px]">{c.direction === 'in' ? 'входящ.' : c.direction === 'out' ? 'исход.' : (c.direction || '—')}</Badge></td>
                  <td className="text-center py-2 px-2">
                    {c.duration_seconds ? `${Math.floor(c.duration_seconds / 60)}:${String(c.duration_seconds % 60).padStart(2, '0')}` : '—'}
                  </td>
                  <td className="text-center py-2 px-2">
                    {typeof c.score === 'number' ? (
                      <span className={`font-bold ${c.score >= 8 ? 'text-emerald-600' : c.score >= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                        {c.score}
                        {c.has_strong_negative && <span className="ml-1 text-red-500" title="Сильный негатив">⚠</span>}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{c.status === 'analyzed' ? '—' : c.status || '—'}</span>
                    )}
                  </td>
                  <td className="py-2 px-2 max-w-[280px] truncate text-muted-foreground" title={c.summary}>{c.summary || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="text-right">
        <a
          href={`/admin/call-analytics?manager_id=${encodeURIComponent(userId || '')}`}
          className="text-xs text-blue-600 hover:underline"
          data-testid="open-call-analytics-link"
        >
          Открыть полную аналитику звонков по этому менеджеру →
        </a>
      </div>
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

/**
 * Returns a human-readable Warsaw-local description of the next scheduled run
 * for a UTC-hour-of-day cron job. Handles CET/CEST automatically by relying
 * on Intl with the Europe/Warsaw timezone.
 *
 * Example output: "завтра в 08:00 по Варшаве (через 14 ч 32 мин)"
 */
const formatNextRun = (utcHour) => {
  const h = Number(utcHour);
  if (!Number.isFinite(h) || h < 0 || h > 23) return null;
  const now = new Date();
  // Build target as today's UTC date at the requested UTC hour.
  const target = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
    h, 0, 0, 0
  ));
  if (target <= now) target.setUTCDate(target.getUTCDate() + 1);
  const fmtWarsaw = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Warsaw',
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  const localStr = fmtWarsaw.format(target);
  const sameDayWarsaw = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const dayLabel = sameDayWarsaw.format(target) === sameDayWarsaw.format(now)
    ? 'сегодня' : 'завтра';
  const diffMin = Math.max(0, Math.round((target - now) / 60000));
  const hh = Math.floor(diffMin / 60);
  const mm = diffMin % 60;
  const inWhen = hh > 0 ? `через ${hh} ч ${mm} мин` : `через ${mm} мин`;
  return `Следующий запуск: ${dayLabel} ${localStr} по Варшаве · ${inWhen}`;
};

const EventSettings = ({ settings, setSettings, onSave, saving }) => (
  <div className="space-y-6 max-w-3xl" data-testid="event-settings">
    {/* Auto-sync daily — fresh data every morning without clicking */}
    <Card className="border-2 border-indigo-400 bg-indigo-50/40 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          ⚡ Автоматическая ежедневная синхронизация <span className="text-[10px] uppercase tracking-wider bg-indigo-600 text-white px-2 py-0.5 rounded">новое</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Checkbox
            id="auto-daily-sync-enabled"
            checked={!!settings.autoDailySyncEnabled}
            onCheckedChange={(v) => setSettings(prev => ({ ...prev, autoDailySyncEnabled: !!v }))}
            data-testid="auto-daily-sync-enabled"
          />
          <Label htmlFor="auto-daily-sync-enabled" className="cursor-pointer text-sm">
            Включить авто-синхронизацию
            <span className="block text-[11px] text-muted-foreground">
              Раз в день автоматически запускается «Полная синхронизация»
              (лиды + события). Когда команда открывает дашборд утром —
              данные уже свежие, без ручного клика.
            </span>
          </Label>
        </div>
        <div>
          <Label className="text-sm">Час запуска (UTC, 0–23)</Label>
          <Input
            type="number" min="0" max="23"
            value={settings.autoDailySyncHour ?? 6}
            onChange={e => setSettings(prev => ({ ...prev, autoDailySyncHour: parseInt(e.target.value) || 0 }))}
            className="w-32 mt-1"
            data-testid="auto-daily-sync-hour"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            По Варшаве (CEST лето = UTC+2 / CET зима = UTC+1):
            6 UTC ≈ 8 утра летом, 7 утра зимой. Поставьте на час раньше
            рабочего дня, чтобы успело пробежать к открытию офиса.
          </p>
          {settings.autoDailySyncEnabled && formatNextRun(settings.autoDailySyncHour ?? 6) && (
            <p className="text-[11px] font-medium text-indigo-700 mt-1.5 bg-indigo-100/60 px-2 py-1 rounded inline-block" data-testid="auto-sync-next-run">
              ⏰ {formatNextRun(settings.autoDailySyncHour ?? 6)}
            </p>
          )}
        </div>
        {settings.lastDailySyncDate && (
          <div className="text-xs text-muted-foreground">
            Последняя авто-синхронизация: <b>{settings.lastDailySyncDate}</b>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Daily Telegram report — moved to TOP so it's the first thing users see */}
    <Card className="border-2 border-blue-400 bg-blue-50/40 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          📱 Ежедневный отчёт в Telegram <span className="text-[10px] uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded">новое</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Checkbox
            id="daily-report-enabled"
            checked={!!settings.dailyReportEnabled}
            onCheckedChange={(v) => setSettings(prev => ({ ...prev, dailyReportEnabled: !!v }))}
            data-testid="daily-report-enabled"
          />
          <Label htmlFor="daily-report-enabled" className="cursor-pointer text-sm">
            Включить ежедневный отчёт
            <span className="block text-[11px] text-muted-foreground">
              Утром скрипт автоматически синхронизируется с amoCRM и отправляет сводку за вчерашний день в Telegram.
            </span>
          </Label>
        </div>
        <div className="flex items-center gap-3 pt-2 border-t border-blue-100">
          <Checkbox
            id="daily-report-ai-advice"
            checked={settings.dailyReportAiAdvice !== false}
            onCheckedChange={(v) => setSettings(prev => ({ ...prev, dailyReportAiAdvice: !!v }))}
            data-testid="daily-report-ai-advice"
          />
          <Label htmlFor="daily-report-ai-advice" className="cursor-pointer text-sm">
            🤖 Добавлять совет AI
            <span className="block text-[11px] text-muted-foreground">
              GPT-5.2 разберёт сводку и подскажет, на каких менеджеров обратить внимание и что им сказать. Стоит немного токенов из Universal Key.
            </span>
          </Label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">Час отправки (UTC, 0–23)</Label>
            <Input
              type="number" min="0" max="23"
              value={settings.dailyReportHour ?? 8}
              onChange={e => setSettings(prev => ({ ...prev, dailyReportHour: parseInt(e.target.value) || 0 }))}
              className="w-32 mt-1"
              data-testid="daily-report-hour"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              По МСК прибавьте +3ч (например 5:00 UTC = 8:00 МСК).
            </p>
            {settings.dailyReportEnabled && formatNextRun(settings.dailyReportHour ?? 8) && (
              <p className="text-[11px] font-medium text-blue-700 mt-1.5 bg-blue-100/60 px-2 py-1 rounded inline-block" data-testid="daily-report-next-run">
                ⏰ {formatNextRun(settings.dailyReportHour ?? 8)}
              </p>
            )}
          </div>
          <div>
            <Label className="text-sm">Telegram chat_id (необязательно)</Label>
            <Input
              type="text"
              value={settings.dailyReportChatId || ''}
              onChange={e => setSettings(prev => ({ ...prev, dailyReportChatId: e.target.value.trim() }))}
              placeholder="оставьте пустым — возьмём из env"
              className="mt-1"
              data-testid="daily-report-chat-id"
            />
          </div>
        </div>
        {settings.lastDailyReportDate && (
          <div className="text-xs text-muted-foreground">
            Последний отчёт: <b>{settings.lastDailyReportDate}</b>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              const res = await axios.post(`${API_URL}/api/lead-analytics/events/send-daily-report`, null, {
                params: { period_label: 'тест (сейчас)' },
              });
              const aiMark = res.data?.aiAdviceIncluded ? ' (с AI-советом)' : ' (без AI)';
              toast.success(`Отправлено: ${res.data.managersInReport} менеджеров${aiMark}`);
            } catch (e) {
              const d = e.response?.data?.detail;
              const reason = d?.reason || (typeof d === 'string' ? d : e.message);
              toast.error(`Не отправлено: ${reason}`);
            }
          }}
          data-testid="daily-report-test-btn"
        >
          Отправить тестовый отчёт сейчас
        </Button>
      </CardContent>
    </Card>

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
          ['weightFollowUp', 'Follow-up в 72ч (≥2 касания)'],
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
const ManagerEventsAnalytics = ({ dateFrom: propDateFrom = null, dateTo: propDateTo = null, attributionMode = 'responsible', dateField = 'created', hideOwnFilters = false } = {}) => {
  const [activeTab, setActiveTab] = useState('managers');
  const [managers, setManagers] = useState([]);
  const [filterInfo, setFilterInfo] = useState(null);
  const [syncDateRange, setSyncDateRange] = useState({ from: null, to: null });
  const [selectedManager, setSelectedManager] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [localDateFrom, setLocalDateFrom] = useState('');
  const [localDateTo, setLocalDateTo] = useState('');
  // When the parent passes a unified filter, always use it. Otherwise fall
  // back to the component's own local date pickers (legacy behaviour).
  const dateFrom = propDateFrom != null ? propDateFrom : localDateFrom;
  const dateTo = propDateTo != null ? propDateTo : localDateTo;
  const setDateFrom = hideOwnFilters ? (() => {}) : setLocalDateFrom;
  const setDateTo = hideOwnFilters ? (() => {}) : setLocalDateTo;
  const [showBinotelMapping, setShowBinotelMapping] = useState(false);
  const [binotelConfigured, setBinotelConfigured] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { attribution_mode: attributionMode, date_field: dateField };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const [mgrRes, statusRes, settingsRes, binotelCfg] = await Promise.all([
        axios.get(`${API_URL}/api/lead-analytics/events/manager-stats`, { params }),
        axios.get(`${API_URL}/api/lead-analytics/events/sync-status`),
        axios.get(`${API_URL}/api/lead-analytics/events/settings`),
        axios.get(`${API_URL}/api/lead-analytics/binotel/config`).catch(() => ({ data: { configured: false } })),
      ]);
      setManagers(mgrRes.data.managers || []);
      setFilterInfo(mgrRes.data.filterInfo || null);
      setSyncDateRange({ from: mgrRes.data.syncDateFrom, to: mgrRes.data.syncDateTo });
      setSyncStatus(statusRes.data);
      setSettings(settingsRes.data);
      setBinotelConfigured(!!binotelCfg.data?.configured);
      // Auto-resume the polling banner if a sync was started elsewhere and is
      // still running on the backend.
      if (statusRes.data?.status === 'running') {
        setSyncing(s => {
          if (s) return s;
          const poll = setInterval(async () => {
            try {
              const r = await axios.get(`${API_URL}/api/lead-analytics/events/sync-status`);
              setSyncStatus(r.data);
              if (r.data.status !== 'running') {
                clearInterval(poll);
                setSyncing(false);
                if (r.data.status === 'completed') {
                  toast.success(`Синхронизировано: ${r.data.eventsProcessed} событий`);
                  const mgr = await axios.get(`${API_URL}/api/lead-analytics/events/manager-stats`);
                  setManagers(mgr.data.managers || []);
                } else if (r.data.status === 'error') {
                  toast.error('Синхронизация остановлена: ' + (r.data.error || 'ошибка'));
                }
              }
            } catch (_) { /* keep polling */ }
          }, 3000);
          return true;
        });
      }
    } catch (e) {
      console.error('Error fetching event analytics:', e);
    } finally { setLoading(false); }
  }, [dateFrom, dateTo, attributionMode, dateField]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-open a manager detail card when navigating from the KPI bar in the parent page.
  useEffect(() => {
    if (!managers.length) return;
    const uid = typeof window !== 'undefined' ? window.__preselectedManagerId : null;
    if (!uid) return;
    const target = managers.find(m => String(m.userId) === String(uid));
    if (target) {
      setSelectedManager(target);
      try { delete window.__preselectedManagerId; } catch { /* ignore */ }
    }
  }, [managers]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      await axios.post(`${API_URL}/api/lead-analytics/events/sync`, null, { params });
      toast.success('Синхронизация событий запущена');
      const poll = setInterval(async () => {
        try {
          const res = await axios.get(`${API_URL}/api/lead-analytics/events/sync-status`);
          setSyncStatus(res.data);
          if (res.data.status !== 'running') {
            clearInterval(poll);
            setSyncing(false);
            if (res.data.status === 'completed') {
              toast.success(`Синхронизировано: ${res.data.eventsProcessed} событий`);
              fetchData();
            } else {
              toast.error('Синхронизация остановлена: ' + (res.data.error || 'ошибка'));
            }
          }
        } catch (e) {
          // network blip — keep polling
        }
      }, 3000);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
      setSyncing(false);
    }
  };

  const handleCancelSync = async () => {
    try {
      await axios.post(`${API_URL}/api/lead-analytics/events/sync/cancel`);
      toast.success('Синхронизация отменена');
      setSyncing(false);
      const res = await axios.get(`${API_URL}/api/lead-analytics/events/sync-status`);
      setSyncStatus(res.data);
    } catch (e) {
      toast.error('Не удалось отменить: ' + (e.response?.data?.detail || e.message));
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
    { id: 'settings', label: 'Настройки + Telegram', icon: Settings },
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
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
              {syncStatus.status === 'running' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                  <span className="text-indigo-700">Синхронизация: {syncStatus.progress || 'в процессе…'}</span>
                  <button
                    onClick={handleCancelSync}
                    className="text-red-600 hover:underline ml-1"
                    data-testid="cancel-sync-btn"
                  >
                    отменить
                  </button>
                </>
              ) : syncStatus.status === 'error' ? (
                <span className="text-red-600">
                  Ошибка синхронизации: {syncStatus.error || 'неизвестно'}
                </span>
              ) : (
                <>
                  Последняя синхронизация: {syncStatus.completedAt ? new Date(syncStatus.completedAt).toLocaleString('ru-RU') : '—'}
                  {syncStatus.eventsProcessed != null && ` (${syncStatus.eventsProcessed} событий)`}
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!hideOwnFilters && (
            <>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-9" />
              <span className="text-muted-foreground">—</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-9" />
            </>
          )}
          <Button
            onClick={fetchData}
            size="sm"
            variant="outline"
            disabled={loading}
            data-testid="refresh-stats-btn"
            title="Перечитать данные без пересинхронизации (применит новый фильтр ботов / менеджеров)"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          {binotelConfigured && (
            <Button
              onClick={() => setShowBinotelMapping(true)}
              size="sm"
              variant="outline"
              className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
              data-testid="binotel-mapping-open"
            >
              <Phone className="h-4 w-4 mr-1" />
              Binotel ↔ amoCRM
            </Button>
          )}
          <UnifiedSyncButton dateFrom={dateFrom} dateTo={dateTo} onComplete={fetchData} />
          <Button onClick={handleSync} disabled={syncing} size="sm" variant="outline" title="Синхронизировать ТОЛЬКО события (без лидов). Для полной картины используйте «Полная синхронизация».">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Только события
          </Button>
        </div>
      </div>

      <BinotelMappingDialog
        open={showBinotelMapping}
        onClose={() => { setShowBinotelMapping(false); fetchData(); }}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />

      {/* Info banner — shows what's filtered and the sync's date range */}
      {activeTab === 'managers' && filterInfo && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1" data-testid="filter-info-banner">
          <span>
            Период данных:{' '}
            <span className="text-foreground font-medium">
              {syncDateRange.from || '—'} → {syncDateRange.to || 'сейчас'}
            </span>
          </span>
          <span>
            Менеджеров в таблице: <span className="text-foreground font-medium">{managers.length}</span>
            {' '}/ всего: {filterInfo.totalBeforeFilter}
          </span>
          {filterInfo.botsExcluded > 0 && (
            <span className="text-rose-600">
              ⛔ Скрыто ботов: {filterInfo.botsExcluded}
            </span>
          )}
          {filterInfo.whitelistActive && filterInfo.outsideWhitelistExcluded > 0 && (
            <span className="text-amber-600">
              🔒 Вне whitelist: {filterInfo.outsideWhitelistExcluded}
            </span>
          )}
          <a
            href="/admin/lead-analytics?tab=settings"
            className="text-indigo-600 hover:underline ml-auto"
            onClick={(e) => {
              // If we're already inside the analytics shell, prefer in-app nav
              const evt = new CustomEvent('open-lead-analytics-settings');
              window.dispatchEvent(evt);
            }}
          >
            Настройки ботов/менеджеров →
          </a>
        </div>
      )}

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
