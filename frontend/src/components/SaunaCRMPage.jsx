import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Briefcase, Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  RefreshCw, Settings, Upload, FileText, File, Trash2, 
  Phone, Mail, MapPin, DollarSign, Clock, User, 
  ExternalLink, Send, Loader2, Plus, X, Search,
  ChevronDown, ChevronUp, Package, Star, StarOff,
  Wrench, Calculator, Link2, Unlink, Hammer, AlertTriangle, ArrowUpDown
} from 'lucide-react';
import { toast } from 'sonner';
import { getApiUrl } from '../utils/api';
import { TechSpecModal } from './tech-spec';

const API_URL = getApiUrl();

const DOC_TYPES = {
  kp: { label: 'КП', color: 'bg-blue-100 text-blue-700' },
  contract: { label: 'Договор', color: 'bg-purple-100 text-purple-700' },
  invoice: { label: 'Счёт', color: 'bg-green-100 text-green-700' },
  other: { label: 'Другое', color: 'bg-gray-100 text-gray-700' }
};

const SaunaCRMPage = () => {
  const [settings, setSettings] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Calendar
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  
  // Lead detail
  const [selectedLead, setSelectedLead] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  
  // Documents
  const [uploading, setUploading] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('kp');
  
  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState(null);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterManager, setFilterManager] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  
  // Sort: per-stage column sorting by readyDate. Key = stageId, value = 'asc' | 'desc' | ''
  const [columnSort, setColumnSort] = useState({});
  const toggleColumnSort = (stageId) => {
    setColumnSort(prev => {
      const cur = prev[stageId] || '';
      const next = cur === '' ? 'asc' : cur === 'asc' ? 'desc' : '';
      return { ...prev, [stageId]: next };
    });
  };
  // Global sort for list view
  const [sortDateOrder, setSortDateOrder] = useState('');
  const toggleSort = () => setSortDateOrder(prev => prev === '' ? 'asc' : prev === 'asc' ? 'desc' : '');

  const sortLeadsByDate = (arr, order) => {
    if (!order) return arr;
    return [...arr].sort((a, b) => {
      const da = (a.readyDate || a.createdAt || '').slice(0, 10);
      const db2 = (b.readyDate || b.createdAt || '').slice(0, 10);
      if (!da && !db2) return 0;
      if (!da) return 1;
      if (!db2) return -1;
      return order === 'asc' ? da.localeCompare(db2) : db2.localeCompare(da);
    });
  };
  
  // Active view
  const [activeView, setActiveView] = useState('calendar');
  
  // Tech Spec & Calculator
  const [techSpecOpen, setTechSpecOpen] = useState(false);
  const [techSpecOrder, setTechSpecOrder] = useState(null);
  const [calcOrder, setCalcOrder] = useState(null);
  const [loadingCalcOrder, setLoadingCalcOrder] = useState(false);
  const [linkOrderId, setLinkOrderId] = useState('');
  const [linkingOrder, setLinkingOrder] = useState(false);
  const [pushingToProduction, setPushingToProduction] = useState(false);
  
  // Drag & drop
  const [draggedLead, setDraggedLead] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  
  const token = localStorage.getItem('authToken');
  const authHeaders = { 'Authorization': `Bearer ${token}` };

  // ---- Fetch ----
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/settings`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setSettingsForm(data);
      }
    } catch (e) { console.error(e); }
  }, []);

  const fetchLeads = useCallback(async () => {
    try {
      // Get current user info for manager filtering
      const userStr = localStorage.getItem('authUser');
      let currentUser = null;
      try { currentUser = JSON.parse(userStr); } catch {}
      
      let url = `${API_URL}/api/sauna-crm/leads`;
      const params = new URLSearchParams();
      
      // If user is not admin/observer, filter by their username (manager name)
      if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'observer') {
        params.set('manager_username', currentUser.username);
      }
      
      if (params.toString()) url += '?' + params.toString();
      
      const res = await fetch(url, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (e) { toast.error('Ошибка загрузки'); }
  }, []);

  const fetchCalendar = useCallback(async () => {
    const m = calendarDate.getMonth() + 1;
    const y = calendarDate.getFullYear();
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/calendar?month=${m}&year=${y}`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setCalendarData(data.byDate || {});
      }
    } catch (e) { console.error(e); }
  }, [calendarDate]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchSettings();
      await fetchLeads();
      setLoading(false);
    };
    init();
  }, [fetchSettings, fetchLeads]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  // ---- Actions ----
  const syncFromAmoCRM = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/sync-from-amocrm`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchLeads();
        fetchCalendar();
      } else toast.error(data.detail || 'Ошибка');
    } catch (e) { toast.error('Ошибка синхронизации'); }
    setSyncing(false);
  };

  const openLead = (lead) => {
    setSelectedLead(lead);
    setEditData({ ...lead });
    setCalcOrder(null);
    setLinkOrderId('');
    fetchCalculatorOrder(lead);
  };

  const saveLead = async () => {
    if (!selectedLead) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/leads/${selectedLead.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      if (res.ok) {
        const updated = await res.json();
        toast.success('Сохранено');
        setSelectedLead(updated);
        setEditData({ ...updated });
        fetchLeads();
        fetchCalendar();
      }
    } catch (e) { toast.error('Ошибка сохранения'); }
    setSaving(false);
  };

  const syncLeadToAmo = async () => {
    if (!selectedLead) return;
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/leads/${selectedLead.id}/sync-to-amocrm`, {
        method: 'POST', headers: authHeaders
      });
      const data = await res.json();
      if (data.status === 'ok') toast.success(data.message);
      else toast.error(data.message || data.detail);
    } catch (e) { toast.error('Ошибка'); }
  };

  const uploadDocument = async (file) => {
    if (!selectedLead) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', uploadDocType);
    formData.append('doc_name', file.name);
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/leads/${selectedLead.id}/documents`, {
        method: 'POST', headers: authHeaders, body: formData
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Документ загружен');
        const docs = [...(editData.documents || []), data.document];
        setEditData(prev => ({ ...prev, documents: docs }));
        setSelectedLead(prev => ({ ...prev, documents: docs }));
        fetchLeads();
      } else toast.error(data.detail || 'Ошибка');
    } catch (e) { toast.error('Ошибка загрузки'); }
    setUploading(false);
  };

  const deleteDocument = async (docId) => {
    if (!selectedLead) return;
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/leads/${selectedLead.id}/documents/${docId}`, {
        method: 'DELETE', headers: authHeaders
      });
      if (res.ok) {
        const docs = (editData.documents || []).filter(d => d.id !== docId);
        setEditData(prev => ({ ...prev, documents: docs }));
        setSelectedLead(prev => ({ ...prev, documents: docs }));
        toast.success('Удалено');
      }
    } catch (e) { toast.error('Ошибка'); }
  };

  const saveSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/settings`, {
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

  const deleteLead = async (leadId) => {
    if (!window.confirm('Удалить заказ?')) return;
    try {
      await fetch(`${API_URL}/api/sauna-crm/leads/${leadId}`, { method: 'DELETE', headers: authHeaders });
      toast.success('Удалено');
      setSelectedLead(null);
      fetchLeads();
      fetchCalendar();
    } catch (e) { toast.error('Ошибка'); }
  };

  // ---- Drag & Drop ----
  const handleDragStart = (e, lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', lead.id);
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
    if (!draggedLead || draggedLead.stageId === targetStageId) {
      setDraggedLead(null);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/leads/${draggedLead.id}/stage?stage_id=${targetStageId}`, {
        method: 'PUT', headers: authHeaders
      });
      if (res.ok) {
        toast.success('Этап изменён');
        fetchLeads();
        fetchCalendar();
      } else toast.error('Ошибка смены этапа');
    } catch (e) { toast.error('Ошибка'); }
    setDraggedLead(null);
  };
  const handleDragEnd = () => { setDraggedLead(null); setDragOverStage(null); };

  // ---- Calculator & Tech Spec ----
  const fetchCalculatorOrder = async (lead) => {
    if (!lead) return null;
    setLoadingCalcOrder(true);
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/leads/${lead.id}/calculator-order`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        if (data.linked && data.order) {
          setCalcOrder(data.order);
          return data.order;
        }
      }
      setCalcOrder(null);
      return null;
    } catch (e) {
      console.error(e);
      setCalcOrder(null);
      return null;
    } finally {
      setLoadingCalcOrder(false);
    }
  };

  const openTechSpec = async () => {
    if (!selectedLead) return;
    if (calcOrder) {
      setTechSpecOrder(calcOrder);
      setTechSpecOpen(true);
    } else {
      const order = await fetchCalculatorOrder(selectedLead);
      if (order) {
        setTechSpecOrder(order);
        setTechSpecOpen(true);
      } else {
        toast.error('Нет привязанного заказа из калькулятора');
      }
    }
  };

  const openInCalculator = () => {
    if (!selectedLead) return;
    const orderId = calcOrder?.id || selectedLead.calculatorOrderId;
    if (orderId) {
      window.location.href = `/sauna/calculator?edit=${orderId}`;
    } else {
      toast.error('Нет привязанного заказа из калькулятора');
    }
  };

  const handleLinkOrder = async () => {
    if (!selectedLead || !linkOrderId.trim()) return;
    setLinkingOrder(true);
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/leads/${selectedLead.id}/link-calculator-order`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: linkOrderId.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Заказ привязан');
        setCalcOrder(data.order);
        if (data.lead) {
          setSelectedLead(data.lead);
          setEditData({ ...data.lead });
        }
        setLinkOrderId('');
        fetchLeads();
      } else {
        toast.error(data.detail || 'Ошибка привязки');
      }
    } catch (e) { toast.error('Ошибка'); }
    setLinkingOrder(false);
  };

  const handleTechSpecSaved = (techSpecData) => {
    if (calcOrder) {
      setCalcOrder(prev => ({ ...prev, techSpec: techSpecData }));
    }
    toast.success('Тех. задание сохранено');
  };

  const pushToProduction = async () => {
    if (!selectedLead) return;
    if (selectedLead.inProduction) {
      toast.info('Заказ уже в производстве');
      return;
    }
    setPushingToProduction(true);
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/leads/${selectedLead.id}/to-production`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        toast.success('Заказ передан в производство!');
        setSelectedLead(data.lead);
        setEditData({ ...data.lead });
        fetchLeads();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Ошибка');
      }
    } catch (e) { toast.error('Ошибка'); }
    setPushingToProduction(false);
  };

  // ---- Calendar Logic ----
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
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

  // Filter leads
  const enabledFields = (settings?.fields || []).filter(f => f.enabled);
  
  const uniqueManagers = [...new Set(leads.map(l => l.manager).filter(Boolean))].sort();
  
  const filteredLeads = leads.filter(l => {
    // Search
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const match = (l.clientName || '').toLowerCase().includes(s) ||
        (l.phone || '').includes(s) ||
        (l.modelName || l.field_1 || '').toLowerCase().includes(s) ||
        (l.amocrm_id || '').includes(s) ||
        (l.manager || '').toLowerCase().includes(s);
      if (!match) return false;
    }
    // Manager
    if (filterManager && (l.manager || '') !== filterManager) return false;
    // Date range (by readyDate)
    if (filterDateFrom) {
      const rd = (l.readyDate || '').slice(0, 10);
      if (!rd || rd < filterDateFrom) return false;
    }
    if (filterDateTo) {
      const rd = (l.readyDate || '').slice(0, 10);
      if (!rd || rd > filterDateTo) return false;
    }
    return true;
  });

  const hasActiveFilters = !!filterManager || !!filterDateFrom || !!filterDateTo;
  const clearFilters = () => { setFilterManager(''); setFilterDateFrom(''); setFilterDateTo(''); setSearchTerm(''); setColumnSort({}); };

  const stages = settings?.stages || [];
  const leadsByStage = {};
  stages.forEach(s => { leadsByStage[s.id] = []; });
  filteredLeads.forEach(l => { if (leadsByStage[l.stageId]) leadsByStage[l.stageId].push(l); });

  // ---- Render ----
  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-[1600px]" data-testid="sauna-crm-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-blue-600" />Производство
          </h1>
          <p className="text-muted-foreground text-sm">
            {settings?.lastSyncAt ? `Синхронизация: ${new Date(settings.lastSyncAt).toLocaleString('ru-RU')}` : 'Не синхронизировано'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={syncFromAmoCRM} disabled={syncing} data-testid="crm-sync-btn">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Синхронизировать
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} data-testid="crm-settings-btn">
            <Settings className="w-4 h-4 mr-2" />Настройки
          </Button>
        </div>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={setActiveView} className="mb-6">
        <TabsList>
          <TabsTrigger value="calendar" className="gap-2" data-testid="view-calendar"><CalendarIcon className="w-4 h-4" />Календарь</TabsTrigger>
          <TabsTrigger value="kanban" className="gap-2" data-testid="view-kanban"><Package className="w-4 h-4" />Канбан</TabsTrigger>
          <TabsTrigger value="list" className="gap-2" data-testid="view-list"><FileText className="w-4 h-4" />Список</TabsTrigger>
        </TabsList>

        {/* Calendar View */}
        <TabsContent value="calendar">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-5 h-5" /></Button>
                    <CardTitle className="text-lg">{monthNames[month]} {year}</CardTitle>
                    <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="w-5 h-5" /></Button>
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
                      const orders = getOrdersForDate(dateKey);
                      const isToday = dateKey === todayKey;
                      const isSelected = dateKey === selectedDate;
                      return (
                        <div
                          key={day}
                          onClick={() => setSelectedDate(dateKey)}
                          className={`relative p-2 min-h-[72px] rounded-lg cursor-pointer transition-all border
                            ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-300' : 'border-transparent hover:bg-muted/50'}
                            ${isToday ? 'bg-amber-50/50' : ''}`}
                          data-testid={`calendar-day-${day}`}
                        >
                          <span className={`text-sm ${isToday ? 'font-bold text-amber-700' : ''} ${isSelected ? 'text-blue-700 font-bold' : ''}`}>{day}</span>
                          {orders.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {orders.slice(0, 2).map((o, idx) => (
                                <div key={idx} className="text-[10px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded truncate">
                                  {o.modelName || o.clientName}
                                </div>
                              ))}
                              {orders.length > 2 && (
                                <div className="text-[10px] text-muted-foreground text-center">+{orders.length - 2}</div>
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
                          <Card key={order.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { const full = leads.find(l => l.id === order.id); if (full) openLead(full); }} data-testid={`calendar-order-${order.id}`}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-sm">{order.clientName || 'Без имени'}</span>
                                {order.totalAmount && <Badge variant="outline" className="text-xs">{Number(order.totalAmount).toLocaleString()} zł</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground">{order.modelName || '—'}</p>
                              {order.phone && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Phone className="w-3 h-3" />{order.phone}</p>}
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
              <Input placeholder="Поиск..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" data-testid="crm-search" />
            </div>
            <Select value={filterManager || "all"} onValueChange={(v) => setFilterManager(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[180px]" data-testid="filter-manager"><SelectValue placeholder="Менеджер" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все менеджеры</SelectItem>
                {uniqueManagers.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-[140px]" data-testid="filter-date-from" placeholder="От" />
              <span className="text-muted-foreground">—</span>
              <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-[140px]" data-testid="filter-date-to" placeholder="До" />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="clear-filters-btn"><X className="w-4 h-4 mr-1" />Сбросить</Button>
            )}
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(280px, 1fr))` }}>
            {stages.map(stage => {
              const isOver = dragOverStage === stage.id;
              return (
              <div
                key={stage.id}
                className={`rounded-lg p-3 transition-all ${isOver ? 'ring-2 ring-offset-1' : ''}`}
                style={{ backgroundColor: stage.color + (isOver ? '30' : '15'), ...(isOver ? { ringColor: stage.color } : {}) }}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
                data-testid={`kanban-stage-${stage.id}`}
              >
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: stage.color }}>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                  {stage.name}
                  <button
                    onClick={() => toggleColumnSort(stage.id)}
                    className={`ml-1 p-0.5 rounded hover:bg-black/10 transition-colors ${columnSort[stage.id] ? 'bg-black/10' : ''}`}
                    title="Сортировать по дате"
                    data-testid={`sort-col-${stage.id}`}
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                  {columnSort[stage.id] && <span className="text-[10px]">{columnSort[stage.id] === 'asc' ? '↑' : '↓'}</span>}
                  <Badge variant="secondary" className="ml-auto text-xs">{(leadsByStage[stage.id] || []).length}</Badge>
                </h3>
                <div className="space-y-2 max-h-[600px] overflow-y-auto min-h-[80px]">
                  {sortLeadsByDate(leadsByStage[stage.id] || [], columnSort[stage.id]).map(lead => {
                    const isDragging = draggedLead?.id === lead.id;
                    return (
                    <Card
                      key={lead.id}
                      className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${isDragging ? 'opacity-40 scale-95' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead)}
                      onDragEnd={handleDragEnd}
                      onClick={() => { if (!draggedLead) openLead(lead); }}
                      data-testid={`kanban-lead-${lead.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-1">
                          <span className="font-bold text-sm truncate">{lead.clientName || 'Без имени'}</span>
                          {lead.isImportant && <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{lead.modelName || lead.field_1 || '—'}</p>
                        {lead.manager && <p className="text-xs text-muted-foreground truncate"><User className="w-3 h-3 inline mr-1" />{lead.manager}</p>}
                        {(lead.totalAmount || lead.field_2) && (
                          <Badge variant="outline" className="mt-1 text-xs">{Number(lead.totalAmount || lead.field_2).toLocaleString()} zł</Badge>
                        )}
                        {lead.readyDate && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />{lead.readyDate.slice(0, 10)}</p>}
                        {(lead.documents || []).length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {lead.documents.map(d => (
                              <Badge key={d.id} className={`text-[10px] ${DOC_TYPES[d.type]?.color || DOC_TYPES.other.color}`}>{DOC_TYPES[d.type]?.label || d.type}</Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    );
                  })}
                  {(leadsByStage[stage.id] || []).length === 0 && (
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

        {/* List View */}
        <TabsContent value="list">
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Поиск..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterManager || "all"} onValueChange={(v) => setFilterManager(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Менеджер" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все менеджеры</SelectItem>
                {uniqueManagers.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-[140px]" />
              <span className="text-muted-foreground">—</span>
              <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-[140px]" />
            </div>
            <Button variant={sortDateOrder ? 'secondary' : 'ghost'} size="sm" onClick={toggleSort} data-testid="list-sort-date-btn">
              {sortDateOrder === 'asc' ? 'Дата ↑' : sortDateOrder === 'desc' ? 'Дата ↓' : 'Дата'}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}><X className="w-4 h-4 mr-1" />Сбросить</Button>
            )}
          </div>
          <div className="space-y-2">
            {sortLeadsByDate(filteredLeads, sortDateOrder).map(lead => {
              const stage = stages.find(s => s.id === lead.stageId);
              return (
                <Card key={lead.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openLead(lead)} data-testid={`list-lead-${lead.id}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage?.color || '#ccc' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold truncate">{lead.clientName || 'Без имени'}</span>
                        {lead.isImportant && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{lead.modelName || lead.field_1 || '—'} {lead.manager ? `• ${lead.manager}` : ''} {lead.phone ? `• ${lead.phone}` : ''}</p>
                    </div>
                    <Badge style={{ backgroundColor: stage?.color + '20', color: stage?.color }}>{stage?.name}</Badge>
                    {(lead.totalAmount || lead.field_2) && <span className="font-medium text-sm">{Number(lead.totalAmount || lead.field_2).toLocaleString()} zł</span>}
                    {lead.readyDate && <span className="text-xs text-muted-foreground">{lead.readyDate.slice(0, 10)}</span>}
                  </CardContent>
                </Card>
              );
            })}
            {filteredLeads.length === 0 && <p className="text-center text-muted-foreground py-12">Нет заказов</p>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Lead Detail Modal */}
      <Dialog open={!!selectedLead} onOpenChange={(v) => { if (!v) setSelectedLead(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <User className="w-5 h-5" />
              <div className="flex flex-col">
                <span className="font-bold">{selectedLead?.clientName || 'Заказ'}</span>
                {(selectedLead?.modelName || selectedLead?.field_1) && (
                  <span className="text-sm font-normal text-muted-foreground">{selectedLead?.modelName || selectedLead?.field_1}</span>
                )}
              </div>
              {selectedLead?.amocrm_link && (
                <a href={selectedLead.amocrm_link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </DialogTitle>
            <DialogDescription>ID: {selectedLead?.id} {selectedLead?.amocrm_id ? `• amoCRM: ${selectedLead.amocrm_id}` : ''}</DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-6">
              {/* Stage */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Этап</Label>
                <div className="flex gap-2 flex-wrap">
                  {stages.map(s => (
                    <Button
                      key={s.id}
                      size="sm"
                      variant={editData.stageId === s.id ? 'default' : 'outline'}
                      style={editData.stageId === s.id ? { backgroundColor: s.color, borderColor: s.color } : {}}
                      onClick={() => setEditData(prev => ({ ...prev, stageId: s.id }))}
                      data-testid={`stage-btn-${s.id}`}
                    >
                      {s.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Client Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Клиент</Label>
                  <Input value={editData.clientName || ''} onChange={(e) => setEditData(p => ({ ...p, clientName: e.target.value }))} data-testid="lead-clientName" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Телефон</Label>
                  <Input value={editData.phone || ''} onChange={(e) => setEditData(p => ({ ...p, phone: e.target.value }))} data-testid="lead-phone" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input value={editData.email || ''} onChange={(e) => setEditData(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Адрес</Label>
                  <Input value={editData.address || ''} onChange={(e) => setEditData(p => ({ ...p, address: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Менеджер</Label>
                  <Input value={editData.manager || ''} onChange={(e) => setEditData(p => ({ ...p, manager: e.target.value }))} data-testid="lead-manager" />
                </div>
              </div>

              {/* Custom Fields */}
              {enabledFields.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block font-semibold">Поля</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {enabledFields.map(f => (
                      <div key={f.id}>
                        <Label className="text-xs text-muted-foreground">{f.name}</Label>
                        <Input
                          type={f.fieldType === 'date' ? 'date' : f.fieldType === 'number' || f.fieldType === 'money' ? 'number' : 'text'}
                          value={editData[f.id] || ''}
                          onChange={(e) => setEditData(p => ({ ...p, [f.id]: e.target.value }))}
                          data-testid={`field-${f.id}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Production Dates */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Дата производства</Label>
                  <Input type="date" value={(editData.productionDate || '').slice(0, 10)} onChange={(e) => setEditData(p => ({ ...p, productionDate: e.target.value }))} data-testid="lead-productionDate" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Дата готовности</Label>
                  <Input type="date" value={(editData.readyDate || '').slice(0, 10)} onChange={(e) => setEditData(p => ({ ...p, readyDate: e.target.value }))} data-testid="lead-readyDate" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Дата доставки</Label>
                  <Input type="date" value={(editData.deliveryDate || '').slice(0, 10)} onChange={(e) => setEditData(p => ({ ...p, deliveryDate: e.target.value }))} data-testid="lead-deliveryDate" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs text-muted-foreground">Заметки</Label>
                <Textarea value={editData.notes || ''} onChange={(e) => setEditData(p => ({ ...p, notes: e.target.value }))} rows={3} data-testid="lead-notes" />
              </div>

              {/* Calculator & Tech Spec */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-semibold flex items-center gap-2"><Calculator className="w-4 h-4" />Калькулятор / Тех. задание</Label>
                </div>
                {loadingCalcOrder ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                    <Loader2 className="w-4 h-4 animate-spin" /> Загрузка...
                  </div>
                ) : calcOrder ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border bg-green-50/50 border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Link2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">Привязан заказ: {calcOrder.id}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        {calcOrder.modelName && <span>Модель: <strong>{calcOrder.modelName}</strong></span>}
                        {calcOrder.fullName && <span>Клиент: {calcOrder.fullName}</span>}
                        {calcOrder.total != null && <span>Сумма: {Number(calcOrder.total).toLocaleString()} PLN</span>}
                        {calcOrder.orderDate && <span>Дата: {new Date(calcOrder.orderDate).toLocaleDateString('ru-RU')}</span>}
                      </div>
                      {calcOrder.techSpec && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-amber-700">
                          <Wrench className="w-3 h-3" />
                          Тех. задание заполнено
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={openInCalculator} data-testid="open-in-calculator-btn">
                        <Calculator className="w-4 h-4 mr-1" />Открыть в калькуляторе
                      </Button>
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={openTechSpec} data-testid="open-tech-spec-btn">
                        <Wrench className="w-4 h-4 mr-1" />Тех. задание
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground py-2">Заказ из калькулятора не привязан</p>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="ID заказа (напр. SAU-XXXX)"
                        value={linkOrderId}
                        onChange={(e) => setLinkOrderId(e.target.value)}
                        className="flex-1 h-8 text-sm"
                        data-testid="link-order-id-input"
                      />
                      <Button size="sm" variant="outline" onClick={handleLinkOrder} disabled={linkingOrder || !linkOrderId.trim()} data-testid="link-order-btn">
                        {linkingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4 mr-1" />}
                        Привязать
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Documents */}
              {/* Production Status & Button */}
              <div>
                {selectedLead.inProduction ? (
                  <div className="p-3 rounded-lg border bg-amber-50/80 border-amber-200 mb-1">
                    <div className="flex items-center gap-2 text-amber-800">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm font-medium">Заказ в производстве</span>
                      {selectedLead.productionStageId && settings?.stages && (
                        <Badge variant="outline" className="text-xs ml-auto">{settings.stages.find(s => s.id === selectedLead.productionStageId)?.name || selectedLead.productionStageId}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-amber-700 mt-1">Изменения данных заказа — сообщите бригадиру производства</p>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white"
                    onClick={pushToProduction}
                    disabled={pushingToProduction}
                    data-testid="push-to-production-btn"
                  >
                    {pushingToProduction ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Hammer className="w-4 h-4 mr-2" />}
                    В производство
                  </Button>
                )}
              </div>

              {/* Documents Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4" />Документы</Label>
                  <div className="flex items-center gap-2">
                    <Select value={uploadDocType} onValueChange={setUploadDocType}>
                      <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(DOC_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <label>
                      <input type="file" className="hidden" onChange={(e) => { if (e.target.files[0]) uploadDocument(e.target.files[0]); e.target.value = ''; }} data-testid="doc-upload-input" />
                      <Button size="sm" variant="outline" asChild disabled={uploading}>
                        <span className="cursor-pointer">
                          {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                          Загрузить
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  {(editData.documents || []).length > 0 ? (editData.documents || []).map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30">
                      <Badge className={`${DOC_TYPES[doc.type]?.color || DOC_TYPES.other.color} text-xs`}>{DOC_TYPES[doc.type]?.label || doc.type}</Badge>
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm text-blue-600 hover:underline truncate">{doc.name || doc.filename}</a>
                      <span className="text-xs text-muted-foreground">{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('ru-RU') : ''}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => deleteDocument(doc.id)} data-testid={`doc-delete-${doc.id}`}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  )) : <p className="text-xs text-muted-foreground text-center py-4">Нет документов</p>}
                </div>
              </div>

              {/* History */}
              {(selectedLead.stageHistory || []).length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block font-semibold">История</Label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {[...(selectedLead.stageHistory || [])].reverse().map((h, i) => {
                      const fromStage = stages.find(s => s.id === h.fromStage);
                      const toStage = stages.find(s => s.id === (h.toStage || h.stageId));
                      return (
                        <div key={i} className="text-xs flex items-center gap-2 text-muted-foreground">
                          <span>{h.timestamp ? new Date(h.timestamp).toLocaleString('ru-RU') : ''}</span>
                          <span>—</span>
                          {h.action === 'created' ? <span>Создан в этапе "{toStage?.name}"</span> : (
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

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2 mr-auto">
              <Button size="sm" variant="outline" onClick={syncLeadToAmo} disabled={!selectedLead?.amocrm_id} data-testid="lead-sync-amo-btn">
                <Send className="w-4 h-4 mr-1" />В amoCRM
              </Button>
              <Button size="sm" variant="ghost" className="text-red-500" onClick={() => selectedLead && deleteLead(selectedLead.id)} data-testid="lead-delete-btn">
                <Trash2 className="w-4 h-4 mr-1" />Удалить
              </Button>
            </div>
            <Button variant="outline" onClick={() => setSelectedLead(null)}>Закрыть</Button>
            <Button onClick={saveLead} disabled={saving} data-testid="lead-save-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />Настройки CRM</DialogTitle>
          </DialogHeader>
          {settingsForm && (
            <Tabs defaultValue="fields">
              <TabsList className="mb-4">
                <TabsTrigger value="fields">Поля</TabsTrigger>
                <TabsTrigger value="stages">Этапы</TabsTrigger>
                <TabsTrigger value="sync">Синхронизация</TabsTrigger>
              </TabsList>

              <TabsContent value="fields">
                <div className="space-y-3">
                  {(settingsForm.fields || []).map((field, idx) => (
                    <div key={field.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Switch
                        checked={field.enabled}
                        onCheckedChange={(v) => {
                          const fields = [...settingsForm.fields];
                          fields[idx] = { ...fields[idx], enabled: v };
                          setSettingsForm(p => ({ ...p, fields }));
                        }}
                      />
                      <Input
                        className="flex-1"
                        value={field.name}
                        onChange={(e) => {
                          const fields = [...settingsForm.fields];
                          fields[idx] = { ...fields[idx], name: e.target.value };
                          setSettingsForm(p => ({ ...p, fields }));
                        }}
                        placeholder="Название"
                      />
                      <Select
                        value={field.fieldType}
                        onValueChange={(v) => {
                          const fields = [...settingsForm.fields];
                          fields[idx] = { ...fields[idx], fieldType: v };
                          setSettingsForm(p => ({ ...p, fields }));
                        }}
                      >
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Текст</SelectItem>
                          <SelectItem value="number">Число</SelectItem>
                          <SelectItem value="date">Дата</SelectItem>
                          <SelectItem value="money">Деньги</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        className="w-32"
                        value={field.amoFieldId}
                        onChange={(e) => {
                          const fields = [...settingsForm.fields];
                          fields[idx] = { ...fields[idx], amoFieldId: e.target.value };
                          setSettingsForm(p => ({ ...p, fields }));
                        }}
                        placeholder="amoCRM ID"
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="stages">
                <div className="space-y-3">
                  {(settingsForm.stages || []).map((stage, idx) => (
                    <div key={stage.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <input
                        type="color"
                        value={stage.color}
                        onChange={(e) => {
                          const stages = [...settingsForm.stages];
                          stages[idx] = { ...stages[idx], color: e.target.value };
                          setSettingsForm(p => ({ ...p, stages }));
                        }}
                        className="w-8 h-8 rounded cursor-pointer"
                      />
                      <Input
                        className="flex-1"
                        value={stage.name}
                        onChange={(e) => {
                          const stages = [...settingsForm.stages];
                          stages[idx] = { ...stages[idx], name: e.target.value };
                          setSettingsForm(p => ({ ...p, stages }));
                        }}
                        placeholder="Название этапа"
                      />
                      <Input
                        className="w-28"
                        value={stage.amoPipelineId}
                        onChange={(e) => {
                          const stages = [...settingsForm.stages];
                          stages[idx] = { ...stages[idx], amoPipelineId: e.target.value };
                          setSettingsForm(p => ({ ...p, stages }));
                        }}
                        placeholder="Pipeline ID"
                      />
                      <Input
                        className="w-28"
                        value={stage.amoStageId}
                        onChange={(e) => {
                          const stages = [...settingsForm.stages];
                          stages[idx] = { ...stages[idx], amoStageId: e.target.value };
                          setSettingsForm(p => ({ ...p, stages }));
                        }}
                        placeholder="Stage ID"
                      />
                      <Button size="icon" variant="ghost" className="text-red-500" onClick={() => {
                        setSettingsForm(p => ({ ...p, stages: p.stages.filter((_, i) => i !== idx) }));
                      }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => {
                    setSettingsForm(p => ({
                      ...p,
                      stages: [...p.stages, { id: `stage_${Date.now()}`, name: 'Новый этап', amoStageId: '', amoPipelineId: '', color: '#6b7280', sortOrder: p.stages.length + 1 }]
                    }));
                  }}><Plus className="w-4 h-4 mr-1" />Добавить этап</Button>
                </div>
              </TabsContent>

              <TabsContent value="sync">
                <div className="space-y-4">
                  <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                    <p className="text-sm font-medium">Кастомные поля amoCRM</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">ID поля "Имя клиента"</Label>
                        <Input
                          value={settingsForm.clientNameFieldId || ''}
                          onChange={(e) => setSettingsForm(p => ({ ...p, clientNameFieldId: e.target.value }))}
                          placeholder="например: 123456"
                          data-testid="crm-client-name-field-id"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">ID поля "Модель сауны"</Label>
                        <Input
                          value={settingsForm.modelFieldId || ''}
                          onChange={(e) => setSettingsForm(p => ({ ...p, modelFieldId: e.target.value }))}
                          placeholder="например: 654321"
                          data-testid="crm-model-field-id"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">Поля для обратной синхронизации в amoCRM</p>
                  {(settingsForm.syncBackFields || []).map((mapping, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <Select
                        value={mapping.fieldId || 'none'}
                        onValueChange={(v) => {
                          const sbf = [...(settingsForm.syncBackFields || [])];
                          sbf[idx] = { ...sbf[idx], fieldId: v === 'none' ? '' : v };
                          setSettingsForm(p => ({ ...p, syncBackFields: sbf }));
                        }}
                      >
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Поле в CRM" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Не выбрано</SelectItem>
                          <SelectItem value="readyDate">Дата готовности</SelectItem>
                          <SelectItem value="productionDate">Дата производства</SelectItem>
                          <SelectItem value="deliveryDate">Дата доставки</SelectItem>
                          <SelectItem value="notes">Заметки</SelectItem>
                          {enabledFields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <span className="text-muted-foreground">→</span>
                      <Input
                        className="flex-1"
                        value={mapping.amoFieldId || ''}
                        onChange={(e) => {
                          const sbf = [...(settingsForm.syncBackFields || [])];
                          sbf[idx] = { ...sbf[idx], amoFieldId: e.target.value };
                          setSettingsForm(p => ({ ...p, syncBackFields: sbf }));
                        }}
                        placeholder="amoCRM Field ID"
                      />
                      <Button size="icon" variant="ghost" className="text-red-500" onClick={() => {
                        setSettingsForm(p => ({ ...p, syncBackFields: (p.syncBackFields || []).filter((_, i) => i !== idx) }));
                      }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => {
                    setSettingsForm(p => ({ ...p, syncBackFields: [...(p.syncBackFields || []), { fieldId: '', amoFieldId: '' }] }));
                  }}><Plus className="w-4 h-4 mr-1" />Добавить маппинг</Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Отмена</Button>
            <Button onClick={saveSettings} data-testid="crm-save-settings-btn">Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tech Spec Modal */}
      <TechSpecModal
        open={techSpecOpen}
        onOpenChange={setTechSpecOpen}
        order={techSpecOrder}
        onSaved={handleTechSpecSaved}
        leadId={selectedLead?.id}
      />
    </div>
  );
};

export default SaunaCRMPage;
