import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { ProductionTelegramPanel } from './ProductionTelegramPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import {
  Hammer, Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  RefreshCw, Settings, FileText, FileDown, Trash2,
  Phone, Clock, User, ExternalLink, Loader2, Plus, X, Search,
  Package, Wrench, Download, Eye, List, MessageSquare, Save, Pencil, ArrowUpDown,
  Calculator, Layers, ShoppingCart, LineChart, Grid3x3, Users, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { getApiUrl } from '../utils/api';
import axios from 'axios';
import TechCardsAdmin from './sauna-production/TechCardsAdmin';
import ComponentsAdmin from './sauna-production/ComponentsAdmin';
import ProcurementForecast from './sauna-production/ProcurementForecast';
import PriceSimulator from './sauna-production/PriceSimulator';
import PriceMatrix from './sauna-production/PriceMatrix';
import DealerMatrix from './sauna-production/DealerMatrix';

const API_URL = getApiUrl();

// ==================== PRODUCTION LIST TAB ====================
const CAL_DATE_FIELDS = [
  { id: 'advancePaymentDate', label: 'Аванс' },
  { id: 'productionDate', label: 'Начало произв.' },
  { id: 'readyDate', label: 'Готовность' },
  { id: 'deliveryDate', label: 'Доставка' },
];

const ProductionListTab = ({ orders, stages, authHeaders, onUpdated, isAdminUser }) => {
  const MARGIN_STYLES = { green: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700' };
  const [editingCell, setEditingCell] = useState(null); // {orderId, field}
  const [editValue, setEditValue] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [commentModal, setCommentModal] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [sendingTgId, setSendingTgId] = useState(null);

  const sendToTelegram = async (order) => {
    setSendingTgId(order.id);
    try {
      const res = await fetch(`${API_URL}/api/integrations/telegram/send-to-production/${order.id}`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        let msg = data.isUpdate ? 'Обновление отправлено в Telegram' : 'Тема создана, заказ отправлен в Telegram';
        if (data.documentsSent) msg += ` · документов: ${data.documentsSent}`;
        toast.success(msg);
        if ((data.documentsFailed || []).length > 0) toast.warning(`Не приложены: ${data.documentsFailed.join(', ')}`);
        onUpdated();
      } else {
        toast.error(data.detail || 'Ошибка отправки в Telegram');
      }
    } catch { toast.error('Ошибка сети'); }
    setSendingTgId(null);
  };

  const saveField = async (orderId, field, value) => {
    setSavingId(orderId);
    try {
      await fetch(`${API_URL}/api/sauna-production/orders/${orderId}`, {
        method: 'PUT', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      onUpdated();
      toast.success('Сохранено');
    } catch { toast.error('Ошибка сохранения'); }
    setSavingId(null);
    setEditingCell(null);
  };

  const startEdit = (orderId, field, currentValue) => {
    setEditingCell({ orderId, field });
    setEditValue(currentValue || '');
  };

  const handleKeyDown = (e, orderId, field) => {
    if (e.key === 'Enter') { saveField(orderId, field, editValue); }
    if (e.key === 'Escape') { setEditingCell(null); }
  };

  const EditableCell = ({ orderId, field, value, type = 'text', className = '' }) => {
    const isEditing = editingCell?.orderId === orderId && editingCell?.field === field;
    if (isEditing) {
      return (
        <Input
          type={type === 'date' ? 'date' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, orderId, field)}
          onBlur={() => saveField(orderId, field, editValue)}
          autoFocus
          className={`h-7 text-xs ${className}`}
          data-testid={`prod-list-edit-${field}-${orderId}`}
        />
      );
    }
    const display = type === 'date' && value ? new Date(value).toLocaleDateString('ru-RU')
      : type === 'number' && value ? Number(value).toLocaleString()
      : (value || '—');
    return (
      <span
        className={`cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded text-xs inline-block min-w-[40px] ${className}`}
        onClick={() => startEdit(orderId, field, value)}
        title="Нажмите для редактирования"
        data-testid={`prod-list-cell-${field}-${orderId}`}
      >
        {display}
      </span>
    );
  };

  const StageSelect = ({ orderId, currentStageId }) => (
    <select
      className="text-[10px] border rounded px-1 py-0.5 bg-background cursor-pointer"
      value={currentStageId || ''}
      onChange={(e) => saveField(orderId, 'productionStageId', e.target.value)}
      data-testid={`prod-list-stage-${orderId}`}
    >
      {stages.map(s => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  );

  const sorted = [...orders].sort((a, b) => {
    const da = a.orderDate || a.createdAt || '';
    const db2 = b.orderDate || b.createdAt || '';
    return db2.localeCompare(da);
  });

  const getStageLabel = (id) => {
    const s = stages.find(st => st.id === id);
    return s ? s.name : id || '—';
  };

  const getStageColor = (id) => {
    const s = stages.find(st => st.id === id);
    return s?.color || '#6b7280';
  };

  const [syncing, setSyncing] = useState(false);

  const syncToSheets = async () => {
    setSyncing(true);
    try {
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      const res = await axios.post(`${API_URL}/api/sauna-production/sync-google-sheets`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Google Sheets: ${res.data.rows_synced} строк синхронизировано`);
    } catch (e) {
      const msg = e.response?.data?.detail || e.message;
      toast.error(msg);
    }
    setSyncing(false);
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <span className="text-sm font-medium text-muted-foreground">{sorted.length} заказов в производстве</span>
          <Button variant="outline" size="sm" onClick={syncToSheets} disabled={syncing} data-testid="prod-sync-sheets-btn">
            {syncing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />}
            Google Sheets
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10 text-xs">№</TableHead>
                <TableHead className="text-xs">Номер заказа</TableHead>
                <TableHead className="text-xs">Наименование</TableHead>
                <TableHead className="text-xs">Клиент</TableHead>
                <TableHead className="text-xs">Этап</TableHead>
                <TableHead className="text-xs text-right">Сумма</TableHead>
                <TableHead className="text-xs text-right">Аванс</TableHead>
                {isAdminUser && <TableHead className="text-xs text-right" data-testid="prod-list-margin-head">Маржа</TableHead>}
                <TableHead className="text-xs">Дата заказа</TableHead>
                <TableHead className="text-xs">Дата предоплаты</TableHead>
                <TableHead className="text-xs">Метод оплаты</TableHead>
                <TableHead className="text-xs">Дата сдачи</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((order, idx) => (
                <TableRow key={order.id} className="hover:bg-muted/30" data-testid={`prod-list-row-${order.id}`}>
                  <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell>
                    <EditableCell orderId={order.id} field="calculatorOrderId" value={order.calculatorOrderId || order.id} className="font-mono" />
                  </TableCell>
                  <TableCell>
                    <EditableCell orderId={order.id} field="modelName" value={order.modelName || order.field_1} className="font-medium" />
                  </TableCell>
                  <TableCell>
                    <EditableCell orderId={order.id} field="clientName" value={order.clientName} />
                  </TableCell>
                  <TableCell>
                    <StageSelect orderId={order.id} currentStageId={order.productionStageId} />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditableCell orderId={order.id} field="totalAmount" value={order.totalAmount} type="number" />
                  </TableCell>
                  <TableCell className="text-right">
                    <EditableCell orderId={order.id} field="advancePayment" value={order.advancePayment} type="number" />
                  </TableCell>
                  {isAdminUser && (
                    <TableCell className="text-right">
                      {order.marginInfo ? (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${MARGIN_STYLES[order.marginInfo.level] || ''}`}
                          title={`Себестоимость ${Number(order.marginInfo.totalCost).toLocaleString()} PLN · Маржа ${Number(order.marginInfo.marginNetto).toLocaleString()} PLN`}
                          data-testid={`prod-list-margin-${order.id}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {order.marginInfo.marginPct}%
                        </span>
                      ) : <span className="text-[10px] text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  <TableCell>
                    <EditableCell orderId={order.id} field="orderDate" value={order.orderDate || (order.createdAt || '').slice(0, 10)} type="date" />
                  </TableCell>
                  <TableCell>
                    <EditableCell orderId={order.id} field="prepaymentDate" value={order.prepaymentDate} type="date" />
                  </TableCell>
                  <TableCell>
                    <EditableCell orderId={order.id} field="paymentMethod" value={order.paymentMethod} />
                  </TableCell>
                  <TableCell>
                    <EditableCell orderId={order.id} field="deliveryDate" value={order.deliveryDate} type="date" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6"
                        onClick={() => { setCommentModal(order); setCommentText(order.productionComment || ''); }}
                        data-testid={`prod-list-comment-${order.id}`}
                      >
                        <MessageSquare className={`w-3.5 h-3.5 ${order.productionComment ? 'text-blue-500' : 'text-muted-foreground'}`} />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6"
                        onClick={() => sendToTelegram(order)}
                        disabled={sendingTgId === order.id}
                        title={order.telegram_topic_id ? 'Обновить в Telegram' : 'Отправить в Telegram'}
                        data-testid={`prod-list-telegram-${order.id}`}
                      >
                        {sendingTgId === order.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                          : <Send className={`w-3.5 h-3.5 ${order.telegram_topic_id ? 'text-sky-600' : 'text-muted-foreground'}`} />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">Нет заказов в производстве</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Comment Modal */}
      <Dialog open={!!commentModal} onOpenChange={(v) => { if (!v) setCommentModal(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MessageSquare className="w-4 h-4" />Комментарий</DialogTitle>
            <DialogDescription>{commentModal?.clientName} — {commentModal?.modelName || commentModal?.field_1 || ''}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Введите комментарий..."
            rows={4}
            data-testid="prod-list-comment-input"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentModal(null)}>Отмена</Button>
            <Button onClick={async () => {
              await saveField(commentModal.id, 'productionComment', commentText);
              setCommentModal(null);
            }} data-testid="prod-list-comment-save">
              <Save className="w-4 h-4 mr-1" />Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};


const ProdTelegramSettings = ({ authHeaders }) => {
  const [cfg, setCfg] = useState({ bot_token_set: false, bot_token_masked: '', chat_id: '', enabled: true, source: 'none' });
  const [newToken, setNewToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [webhookOn, setWebhookOn] = useState(false);
  const [webhookBusy, setWebhookBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`${API_URL}/api/integrations/telegram/settings`, { headers: authHeaders });
      if (res.ok) setCfg(await res.json());
      const wr = await fetch(`${API_URL}/api/integrations/telegram/webhook-status`, { headers: authHeaders });
      if (wr.ok) setWebhookOn((await wr.json()).enabled);
    } catch { /* noop */ }
  };
  useEffect(() => { load(); }, []);

  const toggleWebhook = async () => {
    setWebhookBusy(true);
    try {
      const path = webhookOn ? 'disable-webhook' : 'enable-webhook';
      const res = await fetch(`${API_URL}/api/integrations/telegram/${path}`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(webhookOn ? 'Приём из Telegram выключен' : 'Приём из Telegram включён (кнопки в теме работают)');
        setWebhookOn(!webhookOn);
      } else toast.error(data.detail || 'Ошибка');
    } catch { toast.error('Ошибка сети'); }
    setWebhookBusy(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = { chat_id: cfg.chat_id, enabled: cfg.enabled, ack_reminder_hours: cfg.ack_reminder_hours };
      if (newToken.trim()) body.bot_token = newToken.trim();
      const res = await fetch(`${API_URL}/api/integrations/telegram/settings`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (res.ok) { toast.success('Настройки Telegram сохранены'); setNewToken(''); load(); }
      else toast.error('Ошибка сохранения');
    } catch { toast.error('Ошибка сети'); }
    setSaving(false);
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/telegram/test`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (data.success) toast.success(`Бот @${data.bot_username} на связи${data.warning ? '. ' + data.warning : '. Тест отправлен в группу'}`);
      else toast.error(data.error || 'Ошибка проверки');
    } catch { toast.error('Ошибка сети'); }
    setTesting(false);
  };

  return (
    <div className="pt-4 border-t" data-testid="prod-telegram-settings">
      <Label className="text-sm font-semibold flex items-center gap-2"><Send className="w-4 h-4 text-sky-600" />Telegram производства</Label>
      <p className="text-xs text-muted-foreground mb-2">Отдельный бот и супергруппа (с включёнными Темами) для отправки заказов в производство. Не влияет на бота уведомлений/бэкапов.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Токен бота</Label>
          <Input
            type="password"
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
            placeholder={cfg.bot_token_set ? `Сохранён (${cfg.source}) — оставьте пустым, чтобы не менять` : 'Токен от @BotFather'}
            data-testid="prod-tg-token"
          />
        </div>
        <div>
          <Label className="text-xs">Chat ID супергруппы</Label>
          <Input
            value={cfg.chat_id || ''}
            onChange={(e) => setCfg(p => ({ ...p, chat_id: e.target.value }))}
            placeholder="-100..."
            data-testid="prod-tg-chatid"
          />
        </div>
      </div>
      <div className="mt-3 max-w-[280px]">
        <Label className="text-xs">Напоминать о приёмке через (часов)</Label>
        <Input
          type="number" min="1" step="1"
          value={cfg.ack_reminder_hours ?? 3}
          onChange={(e) => setCfg(p => ({ ...p, ack_reminder_hours: e.target.value }))}
          data-testid="prod-tg-reminder-hours"
        />
        <p className="text-[11px] text-muted-foreground mt-1">Если производство не нажало «Принял в работу» за это время — бот пингует тему.</p>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <Button size="sm" onClick={save} disabled={saving} data-testid="prod-tg-save">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Сохранить Telegram
        </Button>
        <Button size="sm" variant="outline" onClick={test} disabled={testing} data-testid="prod-tg-test">
          {testing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}Проверить связь
        </Button>
        {cfg.bot_token_set && <span className="text-xs text-emerald-600">● настроен ({cfg.source})</span>}
      </div>
      <div className="flex items-center gap-3 mt-3 pt-3 border-t">
        <Button size="sm" variant={webhookOn ? 'outline' : 'default'} onClick={toggleWebhook} disabled={webhookBusy} data-testid="prod-tg-webhook">
          {webhookBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          {webhookOn ? 'Выключить приём из Telegram' : 'Включить приём из Telegram (кнопки)'}
        </Button>
        <span className={`text-xs ${webhookOn ? 'text-emerald-600' : 'text-muted-foreground'}`}>
          {webhookOn ? '● кнопки в теме активны (приёмка, даты, комментарий)' : '○ кнопки в теме не работают'}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">После деплоя на прод нажмите «Включить приём из Telegram» ещё раз, чтобы webhook указывал на боевой адрес.</p>
    </div>
  );
};



const SaunaProductionPage = ({ onBack }) => {
  const isAdminUser = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('authUser') || '{}')?.role === 'admin'; } catch { return false; }
  }, []);
  const [settings, setSettings] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calendar
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState({});
  const [calDateField, setCalDateField] = useState('advancePaymentDate');
  const [selectedDate, setSelectedDate] = useState(null);

  // Order detail
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [prodCalcOrder, setProdCalcOrder] = useState(null);  // linked calculator order (for cost/margin)
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [sendingToTelegram, setSendingToTelegram] = useState(false);

  // Fetch linked calculator order (for admin cost/margin block) when a card opens.
  useEffect(() => {
    if (!selectedOrder?.id || !isAdminUser) { setProdCalcOrder(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/sauna-crm/leads/${selectedOrder.id}/calculator-order`, { headers: authHeaders });
        if (r.ok) {
          const d = await r.json();
          if (!cancelled) setProdCalcOrder(d.order || null);
        } else if (!cancelled) setProdCalcOrder(null);
      } catch { if (!cancelled) setProdCalcOrder(null); }
    })();
    return () => { cancelled = true; };
  }, [selectedOrder?.id, isAdminUser]);

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState(null);

  // Search & Date Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  
  // Sort by readyDate: 'asc', 'desc', or '' (none)
  const [sortDateOrder, setSortDateOrder] = useState('');
  const toggleSort = () => {
    setSortDateOrder(prev => prev === '' ? 'asc' : prev === 'asc' ? 'desc' : '');
  };
  const sortOrders = (arr) => {
    if (!sortDateOrder) return arr;
    return [...arr].sort((a, b) => {
      const da = (a.readyDate || '').slice(0, 10);
      const db2 = (b.readyDate || '').slice(0, 10);
      if (!da && !db2) return 0;
      if (!da) return 1;
      if (!db2) return -1;
      return sortDateOrder === 'asc' ? da.localeCompare(db2) : db2.localeCompare(da);
    });
  };

  // Active view
  const [activeView, setActiveView] = useState('kanban');

  // Drag & drop
  const [draggedOrder, setDraggedOrder] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const token = localStorage.getItem('authToken');
  const authHeaders = { 'Authorization': `Bearer ${token}` };

  // ---- Fetch ----
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/sauna-production/settings`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setSettingsForm(data);
      }
    } catch (e) { console.error(e); }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/sauna-production/orders`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (e) { toast.error('Ошибка загрузки'); }
  }, []);

  const fetchCalendar = useCallback(async () => {
    const m = calendarDate.getMonth() + 1;
    const y = calendarDate.getFullYear();
    try {
      const res = await fetch(`${API_URL}/api/sauna-production/calendar?month=${m}&year=${y}&dateField=${calDateField}`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setCalendarData(data.byDate || {});
      }
    } catch (e) { console.error(e); }
  }, [calendarDate, calDateField]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchSettings();
      await fetchOrders();
      setLoading(false);
    };
    init();
  }, [fetchSettings, fetchOrders]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  // ---- Actions ----
  const openOrder = (order) => {
    setSelectedOrder(order);
    setEditData({
      productionDate: order.productionDate || '',
      readyDate: order.readyDate || '',
      deliveryDate: order.deliveryDate || '',
      productionNotes: order.productionNotes || '',
    });
  };

  const saveOrder = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/sauna-production/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      if (res.ok) {
        const updated = await res.json();
        toast.success('Сохранено');
        setSelectedOrder(updated);
        fetchOrders();
        fetchCalendar();
      }
    } catch (e) { toast.error('Ошибка'); }
    setSaving(false);
  };

  const sendToTelegramProduction = async () => {
    if (!selectedOrder) return;
    setSendingToTelegram(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/telegram/send-to-production/${selectedOrder.id}`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        let msg = data.isUpdate ? 'Обновление отправлено в тему Telegram' : 'Тема создана, заказ отправлен в Telegram';
        if (data.documentsSent) msg += ` · документов: ${data.documentsSent}`;
        toast.success(msg);
        if ((data.documentsFailed || []).length > 0) {
          toast.warning(`Не удалось приложить файлы: ${data.documentsFailed.join(', ')}`);
        }
        if (!data.isUpdate) {
          setSelectedOrder(prev => ({ ...prev, telegram_topic_id: data.topicId }));
        }
      } else {
        toast.error(data.detail || 'Ошибка отправки в Telegram');
      }
    } catch (e) { toast.error('Ошибка сети'); }
    setSendingToTelegram(false);
  };

  const handleDownloadPDF = async (order) => {
    try {
      // Fetch full calculator order first
      const calcRes = await fetch(`${API_URL}/api/sauna-crm/leads/${order.id}/calculator-order`, { headers: authHeaders });
      const calcData = await calcRes.json();
      if (!calcData.linked || !calcData.order) {
        toast.error('Нет привязанного заказа из калькулятора');
        return;
      }
      const calcOrder = calcData.order;
      const endpoint = `${API_URL}/api/sauna/generate-pdf`;
      const pdfPayload = { ...calcOrder, orderId: calcOrder.id, type: 'customer', language: 'pl' };
      const response = await axios.post(endpoint, pdfPayload, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `SAUNA_${order.clientName || 'Order'}_${calcOrder.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('PDF скачан');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка генерации PDF');
    }
  };

  const handleDownloadTechSpec = async (order) => {
    try {
      const calcRes = await fetch(`${API_URL}/api/sauna-crm/leads/${order.id}/calculator-order`, { headers: authHeaders });
      const calcData = await calcRes.json();
      if (!calcData.linked || !calcData.order) {
        toast.error('Нет привязанного заказа из калькулятора');
        return;
      }
      const calcOrder = calcData.order;
      if (!calcOrder.techSpec) {
        toast.error('Тех. задание не заполнено');
        return;
      }
      const response = await axios.post(
        `${API_URL}/api/sauna/generate-tech-spec-pdf`,
        { order: calcOrder, techSpec: calcOrder.techSpec },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TechSpec_${order.clientName || 'Order'}_${calcOrder.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Тех. задание скачано');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка');
    }
  };

  const saveSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sauna-production/settings`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm)
      });
      if (res.ok) {
        toast.success('Настройки сохранены');
        setSettingsOpen(false);
        fetchSettings();
      }
    } catch (e) { toast.error('Ошибка'); }
  };

  // ---- Drag & Drop ----
  const handleDragStart = (e, order) => {
    setDraggedOrder(order);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', order.id);
  };
  const handleDragOver = (e, stageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageId);
  };
  const handleDragLeave = () => setDragOverStage(null);
  const handleDrop = async (e, targetStageId) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!draggedOrder || draggedOrder.productionStageId === targetStageId) {
      setDraggedOrder(null);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/sauna-production/orders/${draggedOrder.id}/stage?stage_id=${targetStageId}`, {
        method: 'PUT', headers: authHeaders
      });
      if (res.ok) {
        toast.success('Этап изменён');
        fetchOrders();
        fetchCalendar();
      } else toast.error('Ошибка смены этапа');
    } catch (e) { toast.error('Ошибка'); }
    setDraggedOrder(null);
  };
  const handleDragEnd = () => { setDraggedOrder(null); setDragOverStage(null); };

  // ---- Calendar Logic ----
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const prevMonth = () => setCalendarDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(year, month + 1, 1));
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const calendarDays = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const getDateKey = (day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const getOrdersForDate = (dateKey) => calendarData[dateKey] || [];
  const selectedDateOrders = selectedDate ? getOrdersForDate(selectedDate) : [];

  // Filter
  const stages = settings?.stages || [];
  const filteredOrders = orders.filter(o => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const match = (o.clientName || '').toLowerCase().includes(s) ||
        (o.phone || '').includes(s) ||
        (o.modelName || o.field_1 || '').toLowerCase().includes(s) ||
        (o.manager || '').toLowerCase().includes(s);
      if (!match) return false;
    }
    // Date range filter on readyDate
    if (filterDateFrom) {
      const rd = (o.readyDate || '').slice(0, 10);
      if (!rd || rd < filterDateFrom) return false;
    }
    if (filterDateTo) {
      const rd = (o.readyDate || '').slice(0, 10);
      if (!rd || rd > filterDateTo) return false;
    }
    return true;
  });

  const hasActiveFilters = !!filterDateFrom || !!filterDateTo || !!searchTerm || !!sortDateOrder;
  const clearFilters = () => { setFilterDateFrom(''); setFilterDateTo(''); setSearchTerm(''); setSortDateOrder(''); };

  const ordersByStage = {};
  stages.forEach(s => { ordersByStage[s.id] = []; });
  filteredOrders.forEach(o => {
    const sid = o.productionStageId || 'accepted';
    if (ordersByStage[sid]) ordersByStage[sid].push(o);
    else if (stages.length > 0) ordersByStage[stages[0].id]?.push(o);
  });

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-[1600px]" data-testid="sauna-production-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Hammer className="w-6 h-6 text-rose-600" />Производство саун
          </h1>
          <p className="text-muted-foreground text-sm">
            {orders.length} {orders.length === 1 ? 'заказ' : 'заказов'} в производстве
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchOrders(); fetchCalendar(); }} data-testid="production-refresh-btn">
            <RefreshCw className="w-4 h-4 mr-2" />Обновить
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} data-testid="production-settings-btn">
            <Settings className="w-4 h-4 mr-2" />Настройки
          </Button>
        </div>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={setActiveView} className="mb-6">
        <TabsList>
          <TabsTrigger value="kanban" className="gap-2" data-testid="prod-view-kanban"><Package className="w-4 h-4" />Канбан</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2" data-testid="prod-view-calendar"><CalendarIcon className="w-4 h-4" />Календарь</TabsTrigger>
          <TabsTrigger value="list" className="gap-2" data-testid="prod-view-list"><List className="w-4 h-4" />Список</TabsTrigger>
          <TabsTrigger value="techcards" className="gap-2" data-testid="prod-view-techcards"><Calculator className="w-4 h-4" />Тех.карты</TabsTrigger>
          <TabsTrigger value="components" className="gap-2" data-testid="prod-view-components"><Layers className="w-4 h-4" />Комплектующие</TabsTrigger>
          <TabsTrigger value="procurement" className="gap-2" data-testid="prod-view-procurement"><ShoppingCart className="w-4 h-4" />Закупка</TabsTrigger>
          <TabsTrigger value="simulator" className="gap-2" data-testid="prod-view-simulator"><LineChart className="w-4 h-4" />Симулятор цен</TabsTrigger>
          <TabsTrigger value="matrix" className="gap-2" data-testid="prod-view-matrix"><Grid3x3 className="w-4 h-4" />Прайс-матрица</TabsTrigger>
          <TabsTrigger value="dealer-matrix" className="gap-2" data-testid="prod-view-dealer-matrix"><Users className="w-4 h-4" />Матрица дилера</TabsTrigger>
        </TabsList>

        {/* Calendar View */}
        <TabsContent value="calendar">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-5 h-5" /></Button>
                    <CardTitle className="text-lg">{monthNames[month]} {year}</CardTitle>
                    <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="w-5 h-5" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2" data-testid="prod-cal-datefield-switcher">
                    {CAL_DATE_FIELDS.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setCalDateField(f.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${calDateField === f.id ? 'bg-rose-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                        data-testid={`prod-cal-datefield-${f.id}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-1">
                    {weekDays.map(d => (
                      <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                    ))}
                    {calendarDays.map((day, i) => {
                      if (!day) return <div key={`empty-${i}`} />;
                      const dateKey = getDateKey(day);
                      const dayOrders = getOrdersForDate(dateKey);
                      const isToday = dateKey === todayKey;
                      const isSelected = dateKey === selectedDate;
                      return (
                        <div
                          key={day}
                          onClick={() => setSelectedDate(dateKey)}
                          className={`relative p-2 min-h-[72px] rounded-lg cursor-pointer transition-all border
                            ${isSelected ? 'ring-2 ring-rose-500 bg-rose-50 border-rose-300' : 'border-transparent hover:bg-muted/50'}
                            ${isToday ? 'bg-amber-50/50' : ''}`}
                          data-testid={`prod-calendar-day-${day}`}
                        >
                          <span className={`text-sm ${isToday ? 'font-bold text-amber-700' : ''} ${isSelected ? 'text-rose-700 font-bold' : ''}`}>{day}</span>
                          {dayOrders.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {dayOrders.slice(0, 2).map((o, idx) => (
                                <div key={idx} className="text-[10px] px-1 py-0.5 bg-rose-100 text-rose-700 rounded truncate">
                                  {o.clientName || o.modelName || '—'}
                                </div>
                              ))}
                              {dayOrders.length > 2 && (
                                <div className="text-[10px] text-muted-foreground text-center">+{dayOrders.length - 2}</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Orders for selected date */}
            <div>
              <Card className="sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : 'Выберите дату'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedDate ? (
                    selectedDateOrders.length > 0 ? (
                      <div className="space-y-3">
                        {selectedDateOrders.map(order => (
                          <Card key={order.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { const full = orders.find(o => o.id === order.id); if (full) openOrder(full); }} data-testid={`prod-cal-order-${order.id}`}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-sm">{order.clientName || 'Без имени'}</span>
                                {order.totalAmount && <Badge variant="outline" className="text-xs">{Number(order.totalAmount).toLocaleString()} zł</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground">{order.modelName || '—'}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : <p className="text-muted-foreground text-sm text-center py-8">Нет заказов на эту дату</p>
                  ) : <p className="text-muted-foreground text-sm text-center py-8">Нажмите на дату в календаре</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Kanban View */}
        <TabsContent value="kanban">
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Поиск..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" data-testid="prod-search" />
            </div>
            <div className="flex items-center gap-2">
              <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-[140px]" data-testid="prod-filter-date-from" placeholder="От" />
              <span className="text-muted-foreground">—</span>
              <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-[140px]" data-testid="prod-filter-date-to" placeholder="До" />
            </div>
            <Button variant={sortDateOrder ? 'secondary' : 'ghost'} size="sm" onClick={toggleSort} data-testid="prod-sort-date-btn">
              <ArrowUpDown className="w-4 h-4 mr-1" />
              {sortDateOrder === 'asc' ? 'Дата ↑' : sortDateOrder === 'desc' ? 'Дата ↓' : 'Дата'}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="prod-clear-filters-btn"><X className="w-4 h-4 mr-1" />Сбросить</Button>
            )}
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(280px, 1fr))` }}>
            {stages.map(stage => {
              const isOver = dragOverStage === stage.id;
              return (
                <div
                  key={stage.id}
                  className={`rounded-lg p-3 transition-all ${isOver ? 'ring-2 ring-offset-1' : ''}`}
                  style={{ backgroundColor: stage.color + (isOver ? '30' : '15') }}
                  onDragOver={(e) => handleDragOver(e, stage.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage.id)}
                  data-testid={`prod-kanban-stage-${stage.id}`}
                >
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: stage.color }}>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                    {stage.name}
                    <Badge variant="secondary" className="ml-auto text-xs">{(ordersByStage[stage.id] || []).length}</Badge>
                  </h3>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto min-h-[80px]">
                    {sortOrders(ordersByStage[stage.id] || []).map(order => {
                      const isDragging = draggedOrder?.id === order.id;
                      return (
                        <Card
                          key={order.id}
                          className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${isDragging ? 'opacity-40 scale-95' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, order)}
                          onDragEnd={handleDragEnd}
                          onClick={() => { if (!draggedOrder) openOrder(order); }}
                          data-testid={`prod-kanban-order-${order.id}`}
                        >
                          <CardContent className="p-3">
                            <span className="font-medium text-sm truncate block">{order.clientName || 'Без имени'}</span>
                            <p className="text-xs text-muted-foreground truncate">{order.modelName || order.field_1 || '—'}</p>
                            {order.manager && <p className="text-xs text-muted-foreground truncate"><User className="w-3 h-3 inline mr-1" />{order.manager}</p>}
                            {(order.totalAmount || order.field_2) && (
                              <Badge variant="outline" className="mt-1 text-xs">{Number(order.totalAmount || order.field_2).toLocaleString()} zł</Badge>
                            )}
                            {order.productionDate && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />{order.productionDate.slice(0, 10)}</p>}
                            {(order.documents || []).length > 0 && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <FileText className="w-3 h-3" />{order.documents.length} док.
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                    {(ordersByStage[stage.id] || []).length === 0 && (
                      <p className="text-center text-muted-foreground text-xs py-6">
                        {isOver ? 'Отпустите для перемещения' : 'Нет заказов'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Production List View */}
        <TabsContent value="list">
          <ProductionListTab orders={orders} stages={stages} authHeaders={authHeaders} onUpdated={fetchOrders} isAdminUser={isAdminUser} />
        </TabsContent>

        {/* Tech Cards (cost-price BOM) */}
        <TabsContent value="techcards">
          <TechCardsAdmin />
        </TabsContent>

        {/* Components catalog */}
        <TabsContent value="components">
          <ComponentsAdmin />
        </TabsContent>

        {/* Procurement forecast */}
        <TabsContent value="procurement">
          <ProcurementForecast />
        </TabsContent>

        <TabsContent value="simulator">
          <PriceSimulator />
        </TabsContent>

        <TabsContent value="matrix">
          <PriceMatrix />
        </TabsContent>

        <TabsContent value="dealer-matrix">
          <DealerMatrix />
        </TabsContent>
      </Tabs>

      {/* Order Detail Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={(v) => { if (!v) setSelectedOrder(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Hammer className="w-5 h-5 text-rose-600" />
              {selectedOrder?.clientName || 'Заказ'}
            </DialogTitle>
            <DialogDescription>ID: {selectedOrder?.id}</DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Production Stage */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Этап производства</Label>
                <div className="flex gap-2 flex-wrap">
                  {stages.map(s => (
                    <Button
                      key={s.id}
                      size="sm"
                      variant={selectedOrder.productionStageId === s.id ? 'default' : 'outline'}
                      style={selectedOrder.productionStageId === s.id ? { backgroundColor: s.color, borderColor: s.color } : {}}
                      onClick={async () => {
                        try {
                          const res = await fetch(`${API_URL}/api/sauna-production/orders/${selectedOrder.id}/stage?stage_id=${s.id}`, {
                            method: 'PUT', headers: authHeaders
                          });
                          if (res.ok) {
                            const updated = await res.json();
                            setSelectedOrder(updated);
                            toast.success('Этап изменён');
                            fetchOrders();
                            fetchCalendar();
                          }
                        } catch (e) { toast.error('Ошибка'); }
                      }}
                      data-testid={`prod-stage-btn-${s.id}`}
                    >
                      {s.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Client Info (read-only) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Клиент</Label>
                  <p className="text-sm font-medium">{selectedOrder.clientName || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Телефон</Label>
                  <p className="text-sm">{selectedOrder.phone || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Менеджер</Label>
                  <p className="text-sm">{selectedOrder.manager || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Модель</Label>
                  <p className="text-sm font-medium">{selectedOrder.modelName || selectedOrder.field_1 || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Сумма</Label>
                  <p className="text-sm">{selectedOrder.totalAmount ? `${Number(selectedOrder.totalAmount).toLocaleString()} zł` : '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Адрес</Label>
                  <p className="text-sm">{selectedOrder.address || '—'}</p>
                </div>
              </div>

              {/* Production Dates (editable) */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Дата производства</Label>
                  <Input type="date" value={(editData.productionDate || '').slice(0, 10)} onChange={(e) => setEditData(p => ({ ...p, productionDate: e.target.value }))} data-testid="prod-date-production" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Дата готовности</Label>
                  <Input type="date" value={(editData.readyDate || '').slice(0, 10)} onChange={(e) => setEditData(p => ({ ...p, readyDate: e.target.value }))} data-testid="prod-date-ready" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Дата доставки</Label>
                  <Input type="date" value={(editData.deliveryDate || '').slice(0, 10)} onChange={(e) => setEditData(p => ({ ...p, deliveryDate: e.target.value }))} data-testid="prod-date-delivery" />
                </div>
              </div>

              {/* Cost / Margin (admin only) */}
              {isAdminUser && prodCalcOrder && prodCalcOrder.totalCost > 0 && (() => {
                const totalRetail = Number(prodCalcOrder.total || selectedOrder.totalAmount || 0);
                const totalNetto = totalRetail / 1.23;
                const extras = Number(prodCalcOrder.retailExtraCost || 0);
                const marginNetto = totalNetto - Number(prodCalcOrder.totalCost || 0) - extras;
                const marginPct = totalNetto > 0 ? (marginNetto / totalNetto) * 100 : 0;
                const isLoss = marginNetto < 0;
                const cls = isLoss ? 'text-red-600' : 'text-emerald-700';
                return (
                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 grid grid-cols-3 gap-2 text-xs" data-testid="prod-cost-block">
                    <div>
                      <div className="text-muted-foreground">Себестоимость</div>
                      <div className="font-semibold text-amber-800">{Number(prodCalcOrder.totalCost).toLocaleString('ru-RU')} PLN</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Маржа (netto)</div>
                      <div className={`font-semibold ${cls}`}>{Math.round(marginNetto).toLocaleString('ru-RU')} PLN</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Маржа %</div>
                      <div className={`font-semibold ${cls}`}>{marginPct.toFixed(0)}%</div>
                    </div>
                    <div className="col-span-3 text-[10px] text-amber-700/70 italic">Видно только администратору</div>
                  </div>
                );
              })()}

              {/* Production stock deduction history */}
              {selectedOrder?.productionStockSummary?.items?.length > 0 && (
                <div data-testid="prod-stock-summary">
                  <Label className="text-sm font-semibold flex items-center gap-2 mb-2"><Package className="w-4 h-4" />Списание материалов в производство</Label>
                  <div className="rounded-lg border bg-muted/30 divide-y">
                    {selectedOrder.productionStockSummary.items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs">
                        <span className="truncate">{it.name}</span>
                        <span className="font-mono text-muted-foreground shrink-0 ml-2">
                          −{Number(it.qty).toLocaleString('ru-RU')} · {Number(it.before).toLocaleString('ru-RU')}→{Number(it.after).toLocaleString('ru-RU')}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex justify-between flex-wrap gap-1">
                    <span>Позиций: {selectedOrder.productionStockSummary.applied}{selectedOrder.productionStockSummary.at ? ` · ${new Date(selectedOrder.productionStockSummary.at).toLocaleString('ru-RU')}` : ''}</span>
                    {isAdminUser && selectedOrder.productionStockSummary.totalValue > 0 && (
                      <span className="text-amber-700 font-semibold">Себестоимость: {Number(selectedOrder.productionStockSummary.totalValue).toLocaleString('ru-RU')} PLN</span>
                    )}
                  </div>
                </div>
              )}

              {/* Custom (free-form) positions from calculator — surfaces
                  off-catalog work for the production team so they know what
                  extra services / materials were promised at the sale. */}
              {(() => {
                const custom = selectedOrder?.calculatorData?.customOptions
                  || selectedOrder?.customOptions
                  || [];
                if (!Array.isArray(custom) || custom.length === 0) return null;
                return (
                  <div className="border border-violet-200 bg-violet-50 dark:bg-violet-900/20 rounded-lg p-3" data-testid="prod-custom-options">
                    <Label className="text-sm font-semibold text-violet-900 dark:text-violet-200 mb-2 block">
                      ✏️ Произвольные позиции (вне каталога)
                    </Label>
                    <table className="w-full text-sm">
                      <thead className="text-xs text-violet-700">
                        <tr>
                          <th className="text-left font-medium">Название</th>
                          <th className="text-right font-medium w-16">Кол-во</th>
                          <th className="text-right font-medium w-24">Цена</th>
                        </tr>
                      </thead>
                      <tbody>
                        {custom.map((it, i) => (
                          <tr key={it.id || i} className="border-t border-violet-200/60" data-testid={`prod-custom-row-${i}`}>
                            <td className="py-1">{it.name || '—'}</td>
                            <td className="py-1 text-right">{it.quantity || 1}</td>
                            <td className="py-1 text-right">{(parseInt(it.price) || 0).toLocaleString()} PLN</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-[10px] text-violet-700/70 mt-2 italic">
                      Эти позиции не в каталоге BOM — учтите при планировании цеха
                    </p>
                  </div>
                );
              })()}

              {/* Production Notes */}
              <div>
                <Label className="text-xs text-muted-foreground">Заметки производства</Label>
                <Textarea value={editData.productionNotes || ''} onChange={(e) => setEditData(p => ({ ...p, productionNotes: e.target.value }))} rows={3} data-testid="prod-notes" />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(selectedOrder)} data-testid="prod-download-pdf-btn">
                  <FileDown className="w-4 h-4 mr-1" />Скачать PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDownloadTechSpec(selectedOrder)} data-testid="prod-download-techspec-btn">
                  <Wrench className="w-4 h-4 mr-1" />Скачать тех. задание
                </Button>
                <Button
                  size="sm"
                  className="bg-sky-600 hover:bg-sky-700 text-white"
                  onClick={sendToTelegramProduction}
                  disabled={sendingToTelegram}
                  data-testid="send-to-telegram-btn"
                >
                  {sendingToTelegram ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                  {selectedOrder.telegram_topic_id ? 'Обновить в Telegram' : 'Отправить в Telegram'}
                </Button>
              </div>
              {selectedOrder.telegram_topic_id && (
                <p className="text-[11px] text-sky-700 -mt-3 flex items-center gap-1" data-testid="telegram-topic-status">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500" />
                  Тема в Telegram создана · спецификация и документы уходят в неё
                </p>
              )}

              <ProductionTelegramPanel
                order={selectedOrder}
                authHeaders={authHeaders}
                onUpdated={(u) => setSelectedOrder(u)}
              />

              {/* Documents */}
              {(selectedOrder.documents || []).length > 0 && (
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-2 mb-3"><FileText className="w-4 h-4" />Документы</Label>
                  <div className="space-y-2">
                    {selectedOrder.documents.map(doc => (
                      <div key={doc.id} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30">
                        <Badge className="text-xs bg-gray-100 text-gray-700">{doc.type || 'файл'}</Badge>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm text-blue-600 hover:underline truncate">{doc.name || doc.filename}</a>
                        <span className="text-xs text-muted-foreground">{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('ru-RU') : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Production History */}
              {(selectedOrder.productionHistory || []).length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block font-semibold">История производства</Label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {[...(selectedOrder.productionHistory || [])].reverse().map((h, i) => {
                      const fromStage = stages.find(s => s.id === h.fromStage);
                      const toStage = stages.find(s => s.id === (h.toStage || h.stageId));
                      return (
                        <div key={i} className="text-xs flex items-center gap-2 text-muted-foreground">
                          <span>{h.timestamp ? new Date(h.timestamp).toLocaleString('ru-RU') : ''}</span>
                          <span>—</span>
                          {h.action === 'pushed_to_production' ? <span>Передан в производство</span> : (
                            <span>{fromStage?.name || h.fromStage} → <strong>{toStage?.name || h.toStage}</strong></span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>Закрыть</Button>
            <Button onClick={saveOrder} disabled={saving} data-testid="prod-save-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />Настройки производства</DialogTitle>
          </DialogHeader>
          {settingsForm && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Этапы производства</Label>
              {(settingsForm.stages || []).map((stage, idx) => (
                <div key={stage.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <input
                    type="color"
                    value={stage.color}
                    onChange={(e) => {
                      const ss = [...settingsForm.stages];
                      ss[idx] = { ...ss[idx], color: e.target.value };
                      setSettingsForm(p => ({ ...p, stages: ss }));
                    }}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                  <Input
                    className="flex-1"
                    value={stage.name}
                    onChange={(e) => {
                      const ss = [...settingsForm.stages];
                      ss[idx] = { ...ss[idx], name: e.target.value };
                      setSettingsForm(p => ({ ...p, stages: ss }));
                    }}
                    placeholder="Название этапа"
                  />
                  <Button size="icon" variant="ghost" className="text-red-500" onClick={() => {
                    setSettingsForm(p => ({ ...p, stages: p.stages.filter((_, i) => i !== idx) }));
                  }}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => {
                setSettingsForm(p => ({
                  ...p,
                  stages: [...p.stages, { id: `prod_${Date.now()}`, name: 'Новый этап', color: '#6b7280', sortOrder: p.stages.length + 1 }]
                }));
              }}><Plus className="w-4 h-4 mr-1" />Добавить этап</Button>

              <div className="pt-4 border-t">
                <Label className="text-sm font-semibold">Google Sheets</Label>
                <p className="text-xs text-muted-foreground mb-2">Настройка синхронизации производственного списка с Google Таблицей</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">ID таблицы</Label>
                    <Input
                      value={settingsForm.googleSheets?.spreadsheetId || ''}
                      onChange={(e) => setSettingsForm(p => ({ ...p, googleSheets: { ...(p.googleSheets || {}), spreadsheetId: e.target.value } }))}
                      placeholder="ID из URL таблицы"
                      data-testid="prod-gsheet-id"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Название листа</Label>
                    <Input
                      value={settingsForm.googleSheets?.sheetName || ''}
                      onChange={(e) => setSettingsForm(p => ({ ...p, googleSheets: { ...(p.googleSheets || {}), sheetName: e.target.value } }))}
                      placeholder="Лист1"
                      data-testid="prod-gsheet-name"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <Label className="text-xs">Service Account JSON</Label>
                  <Textarea
                    value={settingsForm.googleSheets?.serviceAccountJson || ''}
                    onChange={(e) => setSettingsForm(p => ({ ...p, googleSheets: { ...(p.googleSheets || {}), serviceAccountJson: e.target.value } }))}
                    placeholder='{"type":"service_account",...}'
                    rows={3}
                    className="text-xs font-mono"
                    data-testid="prod-gsheet-json"
                  />
                </div>
              </div>

              <ProdTelegramSettings authHeaders={authHeaders} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Отмена</Button>
            <Button onClick={saveSettings} data-testid="prod-save-settings-btn">Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SaunaProductionPage;
