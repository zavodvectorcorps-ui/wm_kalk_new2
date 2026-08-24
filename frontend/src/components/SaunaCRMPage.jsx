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
import { ProductionTelegramPanel } from './ProductionTelegramPanel';
import {
  Briefcase, Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  RefreshCw, Settings, Upload, FileText, File, Trash2, 
  Phone, Mail, MapPin, DollarSign, Clock, User, 
  ExternalLink, Send, Loader2, Plus, X, Search,
  ChevronDown, ChevronUp, Package, Star, StarOff,
  Wrench, Calculator, Link2, Unlink, Hammer, AlertTriangle, ArrowUpDown,
  MessageSquare, Eye, Users, Volume2, VolumeX, History
} from 'lucide-react';
import { toast } from 'sonner';
import { getApiUrl } from '../utils/api';
import { DuplicatesModal } from './DuplicatesModal';
import { KpDuplicatesModal } from './KpDuplicatesModal';
import { KpVersionsModal } from './KpVersionsModal';

const CAL_DATE_FIELDS = [
  { id: 'advancePaymentDate', label: 'Аванс' },
  { id: 'productionDate', label: 'Начало произв.' },
  { id: 'readyDate', label: 'Готовность' },
  { id: 'deliveryDate', label: 'Доставка' },
];
import { TechSpecModal } from './tech-spec';
import { ContractTemplateSettings } from './ContractTemplateSettings';
import { ContractGenerationModal } from './ContractGenerationModal';

const API_URL = getApiUrl();

const DOC_TYPES = {
  kp: { label: 'КП', color: 'bg-blue-100 text-blue-700' },
  contract: { label: 'Договор', color: 'bg-purple-100 text-purple-700' },
  tech_spec: { label: 'Тех. спец.', color: 'bg-amber-100 text-amber-700' },
  invoice: { label: 'Счёт', color: 'bg-green-100 text-green-700' },
  other: { label: 'Другое', color: 'bg-gray-100 text-gray-700' }
};

const SaunaCRMPage = () => {
  const isAdminUser = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('authUser') || '{}')?.role === 'admin'; } catch { return false; }
  }, []);
  const [settings, setSettings] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Calendar
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState({});
  const [calDateField, setCalDateField] = useState('advancePaymentDate');
  const [selectedDate, setSelectedDate] = useState(null);
  
  // Lead detail
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  
  // Documents
  const [uploading, setUploading] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('kp');
  const [generatingContract, setGeneratingContract] = useState(false);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  
  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [showKpDuplicatesModal, setShowKpDuplicatesModal] = useState(false);
  const [kpDupLeadId, setKpDupLeadId] = useState(null);
  const [showKpVersionsModal, setShowKpVersionsModal] = useState(false);
  const [kpVersionsOrderId, setKpVersionsOrderId] = useState(null);
  const [settingsForm, setSettingsForm] = useState(null);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterManager, setFilterManager] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  
  // Sort: per-stage column sorting by prepaymentDate. Key = stageId, value = 'asc' | 'desc' | ''
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

  const calendarDateField = settings?.calendarDateField || 'prepaymentDate';
  
  const sortLeadsByDate = (arr, order) => {
    if (!order) return arr;
    return [...arr].sort((a, b) => {
      const da = String(a[calendarDateField] || a.createdAt || '').slice(0, 10);
      const db2 = String(b[calendarDateField] || b.createdAt || '').slice(0, 10);
      if (!da && !db2) return 0;
      if (!da) return 1;
      if (!db2) return -1;
      return order === 'asc' ? da.localeCompare(db2) : db2.localeCompare(da);
    });
  };
  
  // Active view
  const [activeView, setActiveView] = useState('kanban');
  
  // Tech Spec & Calculator
  const [techSpecOpen, setTechSpecOpen] = useState(false);
  const [techSpecOrder, setTechSpecOrder] = useState(null);
  const [calcOrder, setCalcOrder] = useState(null);
  const [loadingCalcOrder, setLoadingCalcOrder] = useState(false);
  const [linkOrderId, setLinkOrderId] = useState('');
  const [relinkMode, setRelinkMode] = useState(false);
  const [linkingOrder, setLinkingOrder] = useState(false);
  const [pushingToProduction, setPushingToProduction] = useState(false);
  const [sendingToTelegram, setSendingToTelegram] = useState(false);
  const [prodMsgText, setProdMsgText] = useState('');
  const [sendingProdMsg, setSendingProdMsg] = useState(false);
  const [sendingLeadTgId, setSendingLeadTgId] = useState(null);
  const [showOnlyUnacked, setShowOnlyUnacked] = useState(false);
  const [lightbox, setLightbox] = useState({ open: false, photos: [], index: 0 });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('prodSoundEnabled') !== '0'; } catch { return true; }
  });
  const [chatHistoryOpen, setChatHistoryOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  
  // Drag & drop
  const [draggedLead, setDraggedLead] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  
  // Collapsed columns (for "Заказ выполнен" etc.)
  const [collapsedCols, setCollapsedCols] = useState({});
  
  // Sync single lead
  const [syncingLead, setSyncingLead] = useState(false);
  
  // amoCRM pipelines for stage mapping dropdowns
  const [amoPipelines, setAmoPipelines] = useState([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  
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
        // Initialize collapsed columns from settings
        const initCollapsed = {};
        (data.stages || []).forEach(s => {
          if (s.collapsed) initCollapsed[s.id] = true;
        });
        setCollapsedCols(prev => {
          // Only set defaults if not already explicitly toggled
          const merged = { ...initCollapsed };
          Object.keys(prev).forEach(k => { merged[k] = prev[k]; });
          return merged;
        });
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
      const res = await fetch(`${API_URL}/api/sauna-crm/calendar?month=${m}&year=${y}&dateField=${calDateField}`, { headers: authHeaders });
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
      await fetchLeads();
      setLoading(false);
    };
    init();
  }, [fetchSettings, fetchLeads]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  // Fetch amoCRM pipelines for stage mapping
  const fetchAmoPipelines = async () => {
    setLoadingPipelines(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/amocrm/pipelines`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setAmoPipelines(data.pipelines || []);
        if ((data.pipelines || []).length === 0 && data.error) {
          toast.error(data.error);
        }
      }
    } catch (e) { console.error(e); toast.error('Не удалось загрузить воронки amoCRM'); }
    setLoadingPipelines(false);
  };

  // Toggle collapsed column
  const toggleCollapsed = (stageId) => {
    setCollapsedCols(prev => ({ ...prev, [stageId]: !prev[stageId] }));
  };

  // Sync progress
  const [syncProgress, setSyncProgress] = useState(null);
  const syncPollRef = React.useRef(null);
  const prevUnseenRef = React.useRef(null);

  const pollSyncStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/sync-status`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setSyncProgress(data);
        if (data.status === 'completed' || data.status === 'error' || data.status === 'stale') {
          // Stop polling
          if (syncPollRef.current) { clearInterval(syncPollRef.current); syncPollRef.current = null; }
          setSyncing(false);
          if (data.status === 'completed') {
            toast.success(`Синхронизация завершена! ${data.message}`, { duration: 8000 });
            fetchLeads();
            fetchCalendar();
            fetchSettings();
          } else if (data.status === 'stale') {
            toast.error(data.message || 'Синхронизация зависла. Сбросьте и запустите снова.', { duration: 12000 });
          } else {
            toast.error(data.message || 'Ошибка синхронизации', { duration: 8000 });
          }
          // Keep the result visible for 15s so user can see it
          setTimeout(() => setSyncProgress(null), 15000);
        }
      }
    } catch (e) { console.error('Poll error', e); }
  }, []);

  // Check if sync is already running on mount (user might have refreshed page during sync)
  useEffect(() => {
    const checkRunningSync = async () => {
      try {
        const res = await fetch(`${API_URL}/api/sauna-crm/sync-status`, { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'running') {
            setSyncing(true);
            setSyncProgress(data);
            syncPollRef.current = setInterval(pollSyncStatus, 2000);
          } else if (data.status === 'stale') {
            // Stale sync from earlier session — show banner so user can reset
            setSyncProgress(data);
            setSyncing(false);
          } else if (data.status === 'completed' && data.completedAt) {
            // Show last completed sync for a few seconds
            const completedAt = new Date(data.completedAt);
            const now = new Date();
            if ((now - completedAt) < 60000) { // show if completed less than 60s ago
              setSyncProgress(data);
              setTimeout(() => setSyncProgress(null), 10000);
            }
          }
        }
      } catch {}
    };
    checkRunningSync();
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (syncPollRef.current) clearInterval(syncPollRef.current); };
  }, []);

  // ---- Actions ----
  const syncFromAmoCRM = async () => {
    setSyncing(true);
    setSyncProgress(null);
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/sync-from-amocrm`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (res.ok) {
        if (data.status === 'already_running') {
          toast.info(data.message);
        } else {
          toast.info('Синхронизация запущена, ожидайте...', { duration: 5000 });
        }
        // Start polling for progress
        setSyncProgress({ status: 'running', message: 'Запуск синхронизации...', imported: 0, updated: 0, errors: 0, processedStages: 0, totalStages: 0 });
        if (syncPollRef.current) clearInterval(syncPollRef.current);
        syncPollRef.current = setInterval(pollSyncStatus, 2000);
      } else {
        toast.error(data.detail || 'Ошибка');
        setSyncing(false);
      }
    } catch (e) { toast.error('Ошибка синхронизации'); setSyncing(false); }
  };

  const hasUnseenProdUpdate = (lead) => (
    lead.lastProductionUpdateAt &&
    (!lead.productionUpdatesSeenAt || new Date(lead.lastProductionUpdateAt) > new Date(lead.productionUpdatesSeenAt))
  );

  const openLead = (lead) => {
    setSelectedLead(lead);
    setEditData({ ...lead });
    setCalcOrder(null);
    setLinkOrderId('');
    setRelinkMode(false);
    fetchCalculatorOrder(lead);
    if (hasUnseenProdUpdate(lead)) {
      const seenAt = new Date().toISOString();
      fetch(`${API_URL}/api/integrations/telegram/mark-seen/${lead.id}`, { method: 'POST', headers: authHeaders })
        .then(() => {
          setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, productionUpdatesSeenAt: seenAt } : l));
          try { window.dispatchEvent(new Event('prod-updates-seen')); } catch {}
        }).catch(() => {});
    }
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

  const sendOrdersSummaryNow = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/telegram/send-orders-summary`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.status === 'ok') toast.success('Сводка отправлена и закреплена в чате алертов');
      else if (res.ok) toast.error('Не удалось отправить (проверьте настройки Telegram)');
      else toast.error(d.detail || 'Ошибка отправки');
    } catch (e) { toast.error('Ошибка сети'); }
  };

  const testDeficitAlert = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/telegram/test-deficit`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.status === 'ok') toast.success('Тестовый сигнал о дефиците отправлен в чат алертов');
      else toast.error(d.detail || 'Ошибка отправки');
    } catch (e) { toast.error('Ошибка сети'); }
  };

  const sendWeeklySummaryNow = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/telegram/send-weekly-summary`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.status === 'ok') toast.success('Недельная сводка отправлена в чат алертов');
      else if (res.ok) toast.error('Не удалось отправить (проверьте настройки Telegram)');
      else toast.error(d.detail || 'Ошибка отправки');
    } catch (e) { toast.error('Ошибка сети'); }
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

  const toggleSelect = (id) => setSelectedIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };

  const bulkDeleteLeads = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) { toast.info('Ничего не выбрано'); return; }
    if (!window.confirm(`Удалить выбранные заказы (${ids.length})? Действие необратимо.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/sauna-crm/leads/bulk-delete`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Удалено: ${d.deleted}`);
        exitSelectMode();
        fetchLeads();
        fetchCalendar();
      } else {
        toast.error(d.detail || 'Ошибка удаления');
      }
    } catch (e) { toast.error('Ошибка сети'); }
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
        const stageName = stages.find(s => s.id === targetStageId)?.name || targetStageId;
        const stageConf = stages.find(s => s.id === targetStageId);
        const hasAmoMapping = stageConf?.amoStageId && stageConf?.amoPipelineId;
        toast.success(`Этап изменён: ${stageName}${hasAmoMapping ? ' (+ синхронизация с amoCRM)' : ''}`);
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
      window.location.href = `/sauna/calculator?edit=${orderId}&crmLeadId=${selectedLead.id}`;
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
        setRelinkMode(false);
        fetchLeads();
      } else {
        toast.error(data.detail || 'Ошибка привязки');
      }
    } catch (e) { toast.error('Ошибка'); }
    setLinkingOrder(false);
  };

  const handleTechSpecSaved = async (techSpecData) => {
    if (calcOrder) {
      setCalcOrder(prev => ({ ...prev, techSpec: techSpecData }));
    }
    toast.success('Тех. задание сохранено');
    // Refresh the lead so the newly-linked tech spec document shows in the card
    if (selectedLead?.id) {
      try {
        const res = await fetch(`${API_URL}/api/sauna-crm/leads/${selectedLead.id}`, { headers: authHeaders });
        if (res.ok) {
          const fresh = await res.json();
          setSelectedLead(prev => ({ ...prev, documents: fresh.documents || [] }));
          setEditData(prev => ({ ...prev, documents: fresh.documents || [] }));
        }
      } catch (e) { /* non-fatal */ }
    }
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

  const sendToTelegramProduction = async () => {
    if (!selectedLead) return;
    setSendingToTelegram(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/telegram/send-to-production/${selectedLead.id}`, {
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
          setSelectedLead(prev => ({ ...prev, telegram_topic_id: data.topicId }));
          setEditData(prev => ({ ...prev, telegram_topic_id: data.topicId }));
        }
      } else {
        toast.error(data.detail || 'Ошибка отправки в Telegram');
      }
    } catch (e) { toast.error('Ошибка сети'); }
    setSendingToTelegram(false);
  };

  const sendProdMessage = async () => {
    if (!selectedLead || !prodMsgText.trim()) return;
    let author = 'Менеджер';
    try { author = (JSON.parse(localStorage.getItem('authUser') || '{}').username) || 'Менеджер'; } catch {}
    setSendingProdMsg(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/telegram/send-message/${selectedLead.id}`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prodMsgText.trim(), author }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Сообщение отправлено в тему');
        const msgs = [...(selectedLead.productionMessages || []), data.entry];
        setSelectedLead(prev => ({ ...prev, productionMessages: msgs }));
        setEditData(prev => ({ ...prev, productionMessages: msgs }));
        setProdMsgText('');
      } else {
        toast.error(data.detail || 'Ошибка отправки');
      }
    } catch (e) { toast.error('Ошибка сети'); }
    setSendingProdMsg(false);
  };

  const sendLeadToTelegram = async (lead, e) => {
    if (e) e.stopPropagation();
    setSendingLeadTgId(lead.id);
    try {
      const res = await fetch(`${API_URL}/api/integrations/telegram/send-to-production/${lead.id}`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.isUpdate ? 'Обновление отправлено в Telegram' : 'Заказ отправлен в Telegram');
        fetchLeads();
      } else {
        toast.error(data.detail || 'Ошибка отправки');
      }
    } catch (err) { toast.error('Ошибка сети'); }
    setSendingLeadTgId(null);
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
    // Date range (by calendarDateField)
    if (filterDateFrom) {
      const rd = String(l[calendarDateField] || '').slice(0, 10);
      if (!rd || rd < filterDateFrom) return false;
    }
    if (filterDateTo) {
      const rd = String(l[calendarDateField] || '').slice(0, 10);
      if (!rd || rd > filterDateTo) return false;
    }
    return true;
  });

  const hasActiveFilters = !!filterManager || !!filterDateFrom || !!filterDateTo;
  const clearFilters = () => { setFilterManager(''); setFilterDateFrom(''); setFilterDateTo(''); setSearchTerm(''); setColumnSort({}); };

  const stages = settings?.stages || [];
  const unseenProdCount = leads.filter(hasUnseenProdUpdate).length;
  const kanbanLeads = showOnlyUnacked
    ? filteredLeads.filter(l => l.telegram_topic_id && !l.productionAckedAt)
    : filteredLeads;
  const leadsByStage = {};
  stages.forEach(s => { leadsByStage[s.id] = []; });
  // Fallback: leads whose stageId doesn't match any configured stage (e.g. after an
  // amoCRM sync assigned an unmapped status) must NOT vanish — bucket them into the
  // first stage so they stay visible and can be re-staged (mirrors Production board).
  kanbanLeads.forEach(l => {
    if (leadsByStage[l.stageId]) leadsByStage[l.stageId].push(l);
    else if (stages.length > 0) leadsByStage[stages[0].id].push(l);
  });

  // Real-time signal: live SSE stream instead of polling
  useEffect(() => {
    let es;
    try {
      es = new EventSource(`${API_URL}/api/integrations/telegram/events`);
      es.onmessage = () => { fetchLeads(); };
      // EventSource auto-reconnects on error; refresh on (re)connect handled by onmessage
    } catch (e) { /* noop */ }
    return () => { if (es) es.close(); };
  }, [fetchLeads]);

  useEffect(() => {
    if (prevUnseenRef.current === null) { prevUnseenRef.current = unseenProdCount; return; }
    if (unseenProdCount > prevUnseenRef.current) {
      if (soundEnabled) {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (Ctx) {
            const ctx = new Ctx();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = 'sine'; o.frequency.value = 880;
            g.gain.setValueAtTime(0.0001, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
            o.start(); o.stop(ctx.currentTime + 0.37);
          }
        } catch (e) { /* noop */ }
      }
      const orig = document.title;
      document.title = `🔔 Новое от производства (${unseenProdCount})`;
      setTimeout(() => { document.title = orig; }, 4000);
      toast.info('🔔 Новое сообщение/фото от производства');
    }
    prevUnseenRef.current = unseenProdCount;
  }, [unseenProdCount, soundEnabled]);

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
            {unseenProdCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-rose-100 text-rose-700 animate-pulse" data-testid="prod-updates-header-badge">
                🔔 {unseenProdCount} новых от производства
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm">
            {settings?.lastSyncAt ? `Синхронизация: ${new Date(settings.lastSyncAt).toLocaleString('ru-RU')}` : 'Не синхронизировано'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => setSoundEnabled(v => { const nv = !v; try { localStorage.setItem('prodSoundEnabled', nv ? '1' : '0'); } catch {} return nv; })}
            title={soundEnabled ? 'Звук новых апдейтов включён' : 'Звук новых апдейтов выключен'}
            data-testid="prod-sound-toggle"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 mr-2 text-emerald-600" /> : <VolumeX className="w-4 h-4 mr-2 text-muted-foreground" />}
            Звук: {soundEnabled ? 'вкл' : 'выкл'}
          </Button>
          <Button variant="outline" size="sm" onClick={syncFromAmoCRM} disabled={syncing} data-testid="crm-sync-btn">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Синхронизировать
          </Button>
          {syncing && (
            <Button variant="outline" size="sm" className="text-red-600 border-red-300" onClick={async () => {
              try {
                await fetch(`${API_URL}/api/sauna-crm/sync-reset`, { method: 'POST', headers: authHeaders });
                setSyncing(false); setSyncProgress(null);
                toast?.success?.('Синхронизация сброшена') || alert('Синхронизация сброшена');
              } catch(e) { console.error(e); }
            }} data-testid="crm-sync-reset-btn">
              Сбросить
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowDuplicatesModal(true)} data-testid="crm-duplicates-btn">
            <Users className="w-4 h-4 mr-2" />Дубликаты
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setKpDupLeadId(null); setShowKpDuplicatesModal(true); }} data-testid="crm-kp-duplicates-btn">
            <FileText className="w-4 h-4 mr-2" />Дубли КП
          </Button>
          {selectMode ? (
            <>
              <Button variant="destructive" size="sm" onClick={bulkDeleteLeads} disabled={selectedIds.size === 0} data-testid="crm-bulk-delete-btn">
                <Trash2 className="w-4 h-4 mr-2" />Удалить выбранные ({selectedIds.size})
              </Button>
              <Button variant="ghost" size="sm" onClick={exitSelectMode} data-testid="crm-bulk-cancel-btn">Отмена</Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setSelectMode(true)} data-testid="crm-select-mode-btn">
              <Trash2 className="w-4 h-4 mr-2" />Выбрать / удалить
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} data-testid="crm-settings-btn">
            <Settings className="w-4 h-4 mr-2" />Настройки
          </Button>
        </div>
      </div>

      {/* Sync Progress Indicator */}
      {syncProgress && syncProgress.status !== 'idle' && (
        <div className={`mb-4 p-4 rounded-lg border-2 transition-all shadow-sm ${
          syncProgress.status === 'running' ? 'bg-blue-50 border-blue-300 animate-pulse' :
          syncProgress.status === 'completed' ? 'bg-green-50 border-green-300' :
          'bg-red-50 border-red-300'
        }`} data-testid="sync-progress-bar">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {syncProgress.status === 'running' && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
              {syncProgress.status === 'completed' && <RefreshCw className="w-5 h-5 text-green-600" />}
              {syncProgress.status === 'error' && <AlertTriangle className="w-5 h-5 text-red-600" />}
              <span className={`text-sm font-semibold ${
                syncProgress.status === 'running' ? 'text-blue-700' :
                syncProgress.status === 'completed' ? 'text-green-700' : 'text-red-700'
              }`}>
                {syncProgress.status === 'running' ? 'Синхронизация...' : syncProgress.status === 'completed' ? 'Синхронизация завершена' : 'Ошибка синхронизации'}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              {syncProgress.imported > 0 && <span className="text-green-700 font-medium">+ {syncProgress.imported} новых</span>}
              {syncProgress.updated > 0 && <span className="text-blue-700 font-medium">{syncProgress.updated} обновлено</span>}
              {syncProgress.errors > 0 && <span className="text-red-600 font-medium">{syncProgress.errors} ошибок</span>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{syncProgress.message}</p>
          {syncProgress.status === 'running' && syncProgress.totalStages > 0 && (
            <div className="w-full bg-blue-100 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.max(5, (syncProgress.processedStages / syncProgress.totalStages) * 100)}%` }}
              />
            </div>
          )}
          {syncProgress.status === 'running' && (!syncProgress.totalStages || syncProgress.totalStages === 0) && (
            <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-500 h-2 rounded-full w-1/3 animate-pulse" />
            </div>
          )}
          {syncProgress.status === 'completed' && (
            <button onClick={() => setSyncProgress(null)} className="text-xs text-muted-foreground hover:text-foreground mt-1 underline">Скрыть</button>
          )}
        </div>
      )}

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={setActiveView} className="mb-6">
        <TabsList>
          <TabsTrigger value="kanban" className="gap-2" data-testid="view-kanban"><Package className="w-4 h-4" />Канбан</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2" data-testid="view-calendar"><CalendarIcon className="w-4 h-4" />Календарь</TabsTrigger>
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
                  <div className="flex flex-wrap gap-1 mt-2" data-testid="cal-datefield-switcher">
                    {CAL_DATE_FIELDS.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setCalDateField(f.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${calDateField === f.id ? 'bg-sky-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                        data-testid={`cal-datefield-${f.id}`}
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
                                <div key={idx} className="text-[10px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded truncate" title={`${o.clientName || ''} — ${o.manager || ''}`}>
                                  {o.clientName || o.modelName}{o.manager ? ` · ${o.manager.split(' ')[0]}` : ''}
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
                              {order.manager && <p className="text-xs text-blue-600 font-medium mt-0.5">{order.manager}</p>}
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
            <Button
              variant={showOnlyUnacked ? 'default' : 'outline'}
              size="sm"
              className={showOnlyUnacked ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'text-amber-700 border-amber-300'}
              onClick={() => setShowOnlyUnacked(v => !v)}
              data-testid="filter-awaiting-ack-btn"
            >
              ⏳ Ждут приёмки{showOnlyUnacked ? ' ✓' : ''}
            </Button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {stages.map(stage => {
              const isOver = dragOverStage === stage.id;
              const isCollapsed = collapsedCols[stage.id];
              const stageLeads = leadsByStage[stage.id] || [];
              
              // Collapsed column — narrow vertical strip
              if (isCollapsed) {
                return (
                  <div
                    key={stage.id}
                    className={`rounded-lg transition-all cursor-pointer flex-shrink-0 ${isOver ? 'ring-2 ring-offset-1' : ''}`}
                    style={{ backgroundColor: stage.color + '20', width: '48px', minHeight: '200px' }}
                    onDragOver={(e) => handleDragOver(e, stage.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, stage.id)}
                    onClick={() => toggleCollapsed(stage.id)}
                    data-testid={`kanban-stage-${stage.id}`}
                    title={`${stage.name} (${stageLeads.length}) — нажмите чтобы развернуть`}
                  >
                    <div className="flex flex-col items-center pt-3 pb-3 h-full">
                      <div className="w-3 h-3 rounded-full mb-2" style={{ backgroundColor: stage.color }} />
                      <Badge variant="secondary" className="text-[10px] mb-2">{stageLeads.length}</Badge>
                      <span
                        className="text-xs font-semibold"
                        style={{ color: stage.color, writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                      >
                        {stage.name}
                      </span>
                      <ChevronRight className="w-4 h-4 mt-auto" style={{ color: stage.color }} />
                    </div>
                  </div>
                );
              }
              
              // Regular expanded column
              return (
              <div
                key={stage.id}
                className={`rounded-lg p-3 transition-all flex-shrink-0 ${isOver ? 'ring-2 ring-offset-1' : ''}`}
                style={{ backgroundColor: stage.color + (isOver ? '30' : '15'), width: '300px', minWidth: '280px' }}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
                data-testid={`kanban-stage-${stage.id}`}
              >
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: stage.color }}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                  <span className="truncate">{stage.name}</span>
                  <button
                    onClick={() => toggleColumnSort(stage.id)}
                    className={`ml-1 p-0.5 rounded hover:bg-black/10 transition-colors flex-shrink-0 ${columnSort[stage.id] ? 'bg-black/10' : ''}`}
                    title="Сортировать по дате"
                    data-testid={`sort-col-${stage.id}`}
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                  {columnSort[stage.id] && <span className="text-[10px]">{columnSort[stage.id] === 'asc' ? '↑' : '↓'}</span>}
                  <Badge variant="secondary" className="ml-auto text-xs flex-shrink-0">{stageLeads.length}</Badge>
                  <button
                    onClick={() => toggleCollapsed(stage.id)}
                    className="p-0.5 rounded hover:bg-black/10 transition-colors flex-shrink-0"
                    title="Свернуть колонку"
                    data-testid={`collapse-col-${stage.id}`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </h3>
                <div className="space-y-2 max-h-[600px] overflow-y-auto min-h-[80px]">
                  {sortLeadsByDate(stageLeads, columnSort[stage.id]).map(lead => {
                    const isDragging = draggedLead?.id === lead.id;
                    return (
                    <Card
                      key={lead.id}
                      className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${isDragging ? 'opacity-40 scale-95' : ''} ${lead.hasUnreviewedChanges ? 'ring-2 ring-amber-400 ring-offset-1' : ''} ${selectMode && selectedIds.has(lead.id) ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
                      draggable={!selectMode}
                      onDragStart={(e) => handleDragStart(e, lead)}
                      onDragEnd={handleDragEnd}
                      onClick={() => { if (selectMode) { toggleSelect(lead.id); return; } if (!draggedLead) openLead(lead); }}
                      data-testid={`kanban-lead-${lead.id}`}
                    >
                      <CardContent className="p-3">
                        {selectMode && (
                          <div className="flex items-center mb-2" onClick={(e) => { e.stopPropagation(); toggleSelect(lead.id); }}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(lead.id)}
                              onChange={() => toggleSelect(lead.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 accent-red-600 cursor-pointer"
                              data-testid={`lead-select-${lead.id}`}
                            />
                            <span className="text-[11px] text-muted-foreground ml-2">Выбрать</span>
                          </div>
                        )}
                        <div className="flex items-start justify-between mb-1">
                          <span className="font-bold text-sm truncate">{lead.clientName || 'Без имени'}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {lead.hasUnreviewedChanges && (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold animate-pulse" title="Есть непросмотренные изменения из amoCRM" data-testid={`change-badge-${lead.id}`}>!</span>
                            )}
                            {lead.isImportant && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{lead.modelName || lead.field_1 || '—'}</p>
                        {lead.amoComment && (
                          <p className="text-xs text-blue-600 truncate mt-0.5 italic" title={lead.amoComment}>
                            <MessageSquare className="w-3 h-3 inline mr-0.5" />{lead.amoComment}
                          </p>
                        )}
                        {lead.manager && <p className="text-xs text-muted-foreground truncate"><User className="w-3 h-3 inline mr-1" />{lead.manager}</p>}
                        {(lead.totalAmount || lead.field_2) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            <Badge variant="outline" className="text-[10px]">{Number(lead.totalAmount || lead.field_2).toLocaleString()} zl</Badge>
                            {lead.advancePayment > 0 && <Badge className="text-[10px] bg-green-100 text-green-700 hover:bg-green-100">Аванс: {Number(lead.advancePayment).toLocaleString()}</Badge>}
                            {(lead.remainingAmount > 0 || (lead.advancePayment > 0 && !lead.remainingAmount)) && (
                              <Badge className="text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-100">
                                Ост: {Number(lead.remainingAmount || ((lead.totalAmount || lead.field_2 || 0) - (lead.advancePayment || 0))).toLocaleString()}
                              </Badge>
                            )}
                          </div>
                        )}
                        {lead[calendarDateField] && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />{String(lead[calendarDateField]).slice(0, 10)}</p>}
                        {(lead.documents || []).length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {lead.documents.map(d => (
                              <Badge key={d.id} className={`text-[10px] ${DOC_TYPES[d.type]?.color || DOC_TYPES.other.color}`}>{DOC_TYPES[d.type]?.label || d.type}</Badge>
                            ))}
                          </div>
                        )}
                        {lead.kpInfo && (
                          <div className="mt-1" data-testid={`kp-info-${lead.id}`}>
                            <Badge
                              variant="outline"
                              className="text-[10px] border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-50 max-w-full inline-flex"
                              title={`Привязан КП: версия ${lead.kpInfo.versionNumber} из ${lead.kpInfo.versionCount}${lead.kpInfo.filename ? ` · ${lead.kpInfo.filename}` : ''}`}
                            >
                              <FileText className="w-3 h-3 mr-1 flex-shrink-0" />
                              <span className="truncate">
                                КП v{lead.kpInfo.versionNumber}/{lead.kpInfo.versionCount}
                                {lead.kpInfo.date ? ` · ${new Date(lead.kpInfo.date).toLocaleDateString('ru-RU')}` : ''}
                                {lead.kpInfo.filename ? ` · ${lead.kpInfo.filename}` : ''}
                              </span>
                            </Badge>
                          </div>
                        )}
                        <div className="mt-1.5 flex items-center gap-2">
                          <Button
                            size="sm" variant="ghost"
                            className="h-6 px-2 text-[11px] text-sky-600 hover:text-sky-700 hover:bg-sky-50"
                            onClick={(e) => sendLeadToTelegram(lead, e)}
                            disabled={sendingLeadTgId === lead.id}
                            data-testid={`kanban-telegram-${lead.id}`}
                          >
                            {sendingLeadTgId === lead.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                            {lead.telegram_topic_id ? 'Обновить в TG' : 'В Telegram'}
                          </Button>
                          {lead.telegram_topic_id && !lead.productionAckedAt && (
                            <span className="text-[10px] text-amber-600" title="Ожидает подтверждения производства">⏳ не принят</span>
                          )}
                          {lead.productionAckedAt && (
                            <span className="text-[10px] text-emerald-600" title={`Принял: ${lead.productionAckedBy || ''}`}>✅ принят</span>
                          )}
                          {hasUnseenProdUpdate(lead) && (
                            <span className="text-[10px] text-rose-600 font-medium animate-pulse" title="Новое фото или комментарий от производства" data-testid={`prod-update-badge-${lead.id}`}>🔔 новое</span>
                          )}
                        </div>
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
              <Input placeholder="Поиск..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" data-testid="crm-list-search" />
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
            <Button
              variant={showOnlyUnacked ? 'default' : 'outline'}
              size="sm"
              className={showOnlyUnacked ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'text-amber-700 border-amber-300'}
              onClick={() => setShowOnlyUnacked(v => !v)}
              data-testid="list-filter-awaiting-ack-btn"
            >
              ⏳ Ждут приёмки{showOnlyUnacked ? ' ✓' : ''}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}><X className="w-4 h-4 mr-1" />Сбросить</Button>
            )}
          </div>
          <div className="space-y-2">
            {sortLeadsByDate(kanbanLeads, sortDateOrder).map(lead => {
              const stage = stages.find(s => s.id === lead.stageId);
              return (
                <Card key={lead.id} className={`cursor-pointer hover:shadow-md transition-shadow ${lead.hasUnreviewedChanges ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`} onClick={() => openLead(lead)} data-testid={`list-lead-${lead.id}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage?.color || '#ccc' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold truncate">{lead.clientName || 'Без имени'}</span>
                        {lead.hasUnreviewedChanges && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold animate-pulse" title="Есть непросмотренные изменения из amoCRM">!</span>
                        )}
                        {lead.isImportant && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{lead.modelName || lead.field_1 || '—'} {lead.manager ? `• ${lead.manager}` : ''} {lead.phone ? `• ${lead.phone}` : ''}</p>
                      {lead.amoComment && <p className="text-xs text-blue-600 truncate italic"><MessageSquare className="w-3 h-3 inline mr-0.5" />{lead.amoComment}</p>}
                    </div>
                    <Badge style={{ backgroundColor: stage?.color + '20', color: stage?.color }}>{stage?.name}</Badge>
                    {(lead.totalAmount || lead.field_2) && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-medium text-sm">{Number(lead.totalAmount || lead.field_2).toLocaleString()} zl</span>
                        {lead.advancePayment > 0 && <Badge className="text-[10px] bg-green-100 text-green-700 hover:bg-green-100">Аванс: {Number(lead.advancePayment).toLocaleString()}</Badge>}
                        {(lead.remainingAmount > 0) && <Badge className="text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-100">Ост: {Number(lead.remainingAmount).toLocaleString()}</Badge>}
                      </div>
                    )}
                    {lead[calendarDateField] && <span className="text-xs text-muted-foreground">{String(lead[calendarDateField]).slice(0, 10)}</span>}
                  </CardContent>
                </Card>
              );
            })}
            {kanbanLeads.length === 0 && <p className="text-center text-muted-foreground py-12">Нет заказов</p>}
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
              {selectedLead?.amocrm_id && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground hover:text-blue-600"
                  disabled={syncingLead}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setSyncingLead(true);
                    try {
                      const res = await fetch(`${API_URL}/api/sauna-crm/leads/${selectedLead.id}/sync-from-amocrm`, { method: 'POST', headers: authHeaders });
                      const data = await res.json();
                      if (res.ok) {
                        if (data.changes > 0) {
                          toast.success(`Обновлено ${data.changes} полей: ${data.changedFields.join(', ')}`);
                        } else {
                          toast.info('Данные актуальны, изменений нет');
                        }
                        const updated = await (await fetch(`${API_URL}/api/sauna-crm/leads/${selectedLead.id}`, { headers: authHeaders })).json();
                        setSelectedLead(updated);
                        setEditData(updated);
                        fetchLeads();
                      } else {
                        toast.error(data.detail || 'Ошибка синхронизации');
                      }
                    } catch { toast.error('Ошибка сети'); }
                    setSyncingLead(false);
                  }}
                  data-testid="sync-lead-from-amo-btn"
                >
                  {syncingLead ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                  Обновить из amoCRM
                </Button>
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
              <div className="mt-2 border-t pt-3">
                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">Заполняется производством</p>
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
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs text-muted-foreground">Заметки</Label>
                <Textarea value={editData.notes || ''} onChange={(e) => setEditData(p => ({ ...p, notes: e.target.value }))} rows={3} data-testid="lead-notes" />
              </div>

              {/* amoCRM Comment from manager */}
              {selectedLead?.amoComment && (
                <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50">
                  <Label className="text-xs text-blue-700 font-semibold flex items-center gap-1.5 mb-1">
                    <MessageSquare className="w-3.5 h-3.5" />Комментарий менеджера (amoCRM)
                  </Label>
                  <p className="text-sm text-blue-900 whitespace-pre-wrap" data-testid="amo-comment-display">{selectedLead.amoComment}</p>
                </div>
              )}

              {/* Change Log from amoCRM */}
              {selectedLead?.hasUnreviewedChanges && (
                <div className="p-3 rounded-lg border border-amber-300 bg-amber-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-amber-800 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />Изменения из amoCRM (непросмотренные)
                    </Label>
                    <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
                      onClick={async () => {
                        try {
                          await fetch(`${API_URL}/api/sauna-crm/leads/${selectedLead.id}/acknowledge-changes`, { method: 'PUT', headers: authHeaders });
                          setSelectedLead(p => ({ ...p, hasUnreviewedChanges: false }));
                          setEditData(p => ({ ...p, hasUnreviewedChanges: false }));
                          fetchLeads();
                          toast.success('Изменения отмечены как просмотренные');
                        } catch { toast.error('Ошибка'); }
                      }}
                      data-testid="acknowledge-changes-btn"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />Просмотрено
                    </Button>
                  </div>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {(selectedLead.changeLog || []).filter(e => e.source === 'amocrm').slice(-15).reverse().map((entry, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs py-1 border-b border-amber-200/50 last:border-0">
                        <span className="text-amber-500 flex-shrink-0 mt-0.5">&bull;</span>
                        <span className="font-medium text-amber-800 flex-shrink-0 w-28 truncate">{entry.label}</span>
                        <span className="text-muted-foreground flex-shrink-0">{entry.oldValue || '—'}</span>
                        <span className="text-muted-foreground flex-shrink-0">&rarr;</span>
                        <span className="font-medium text-amber-900">{entry.newValue || '—'}</span>
                        <span className="text-muted-foreground ml-auto flex-shrink-0 text-[10px]">{entry.timestamp ? new Date(entry.timestamp).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Change History (collapsed) */}
              {(selectedLead?.changeLog || []).length > 0 && !selectedLead?.hasUnreviewedChanges && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors py-1">
                    История изменений ({(selectedLead.changeLog || []).length})
                  </summary>
                  <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto border rounded-lg p-2">
                    {(selectedLead.changeLog || []).slice(-20).reverse().map((entry, idx) => (
                      <div key={idx} className="flex items-start gap-2 py-1 border-b border-muted/50 last:border-0">
                        <span className="text-muted-foreground flex-shrink-0 mt-0.5">&bull;</span>
                        <span className="font-medium flex-shrink-0 w-28 truncate">{entry.label}</span>
                        <span className="text-muted-foreground">{entry.oldValue || '—'} &rarr; {entry.newValue || '—'}</span>
                        <span className="text-muted-foreground ml-auto flex-shrink-0 text-[10px]">{entry.timestamp ? new Date(entry.timestamp).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

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
                      {isAdminUser && calcOrder.totalCost != null && calcOrder.totalCost > 0 && (
                        <div
                          className="mt-2 p-2 rounded border border-amber-200 bg-amber-50/60 grid grid-cols-3 gap-2 text-[11px]"
                          data-testid="crm-order-cost-block"
                        >
                          <div>
                            <div className="text-muted-foreground">Себестоимость</div>
                            <div className="font-semibold text-amber-800">{Number(calcOrder.totalCost).toLocaleString()} PLN</div>
                          </div>
                          {(() => {
                            const totalNetto = Number(calcOrder.total || 0) / 1.23;
                            const extras = Number(calcOrder.retailExtraCost || 0);
                            const marginNetto = totalNetto - Number(calcOrder.totalCost || 0) - extras;
                            const marginPct = totalNetto > 0 ? (marginNetto / totalNetto) * 100 : 0;
                            const isLoss = marginNetto < 0;
                            const cls = isLoss ? 'text-red-600' : 'text-emerald-700';
                            return (
                              <>
                                {extras > 0 && (
                                  <div>
                                    <div className="text-muted-foreground">Розн. расходы</div>
                                    <div className="font-semibold text-red-600">−{extras.toLocaleString()} PLN</div>
                                  </div>
                                )}
                                <div>
                                  <div className="text-muted-foreground">Маржа (netto)</div>
                                  <div className={`font-semibold ${cls}`}>
                                    {Math.round(marginNetto).toLocaleString()} PLN
                                  </div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Маржа %</div>
                                  <div className={`font-semibold ${cls}`}>
                                    {marginPct.toFixed(0)}%
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
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
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => { setRelinkMode(!relinkMode); setLinkOrderId(''); }} data-testid="relink-order-btn">
                        <Unlink className="w-4 h-4 mr-1" />{relinkMode ? 'Отмена' : 'Сменить привязку'}
                      </Button>
                    </div>
                    {relinkMode && (
                      <div className="flex items-center gap-2 mt-2 p-2 rounded-lg border border-dashed border-orange-300 bg-orange-50/50">
                        <Input
                          placeholder="Новый ID заказа (напр. SAU-XXXX)"
                          value={linkOrderId}
                          onChange={(e) => setLinkOrderId(e.target.value)}
                          className="flex-1 h-8 text-sm"
                          data-testid="relink-order-id-input"
                          onKeyDown={(e) => { if (e.key === 'Enter' && linkOrderId.trim()) handleLinkOrder(); }}
                        />
                        <Button size="sm" onClick={handleLinkOrder} disabled={linkingOrder || !linkOrderId.trim()} data-testid="relink-order-confirm-btn">
                          {linkingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4 mr-1" />}
                          Привязать
                        </Button>
                      </div>
                    )}
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

              {/* Contract Generation Button */}
              <div>
                <Button
                  size="sm"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setContractModalOpen(true)}
                  disabled={generatingContract}
                  data-testid="generate-contract-btn"
                >
                  {generatingContract ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                  Создать договор
                </Button>
              </div>

              {/* Send to Telegram Production */}
              <div>
                <Button
                  size="sm"
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white"
                  onClick={sendToTelegramProduction}
                  disabled={sendingToTelegram}
                  data-testid="send-to-telegram-btn"
                >
                  {sendingToTelegram ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  {selectedLead.telegram_topic_id ? 'Отправить обновление в Telegram' : 'Отправить в Telegram (производство)'}
                </Button>
                {selectedLead.telegram_topic_id && (
                  <p className="text-[11px] text-sky-700 mt-1 flex items-center gap-1" data-testid="telegram-topic-status">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500" />
                    Тема в Telegram создана · спецификация и документы уходят в неё
                  </p>
                )}
              </div>

              {/* Production Messages + Telegram info (shared panel) */}
              <ProductionTelegramPanel
                order={selectedLead}
                authHeaders={authHeaders}
                onUpdated={(u) => { setSelectedLead(u); setEditData(prev => ({ ...prev, productionMessages: u.productionMessages })); }}
              />


              {/* Production stock deduction history */}
              {selectedLead?.productionStockSummary?.items?.length > 0 && (
                <div data-testid="crm-stock-summary">
                  <Label className="text-sm font-semibold flex items-center gap-2 mb-2"><Package className="w-4 h-4" />Списание материалов в производство</Label>
                  <div className="rounded-lg border bg-muted/30 divide-y">
                    {selectedLead.productionStockSummary.items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs">
                        <span className="truncate">{it.name}</span>
                        <span className="font-mono text-muted-foreground shrink-0 ml-2">
                          −{Number(it.qty).toLocaleString('ru-RU')} · {Number(it.before).toLocaleString('ru-RU')}→{Number(it.after).toLocaleString('ru-RU')}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex justify-between flex-wrap gap-1">
                    <span>Позиций: {selectedLead.productionStockSummary.applied}{selectedLead.productionStockSummary.at ? ` · ${new Date(selectedLead.productionStockSummary.at).toLocaleString('ru-RU')}` : ''}</span>
                    {isAdminUser && selectedLead.productionStockSummary.totalValue > 0 && (
                      <span className="text-amber-700 font-semibold">Себестоимость: {Number(selectedLead.productionStockSummary.totalValue).toLocaleString('ru-RU')} PLN</span>
                    )}
                  </div>
                </div>
              )}

              {/* Documents Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4" />Документы</Label>
                  <div className="flex items-center gap-2">
                    {selectedLead?.calculatorOrderId && (
                      <Button size="sm" variant="outline" onClick={() => { setKpVersionsOrderId(selectedLead.calculatorOrderId); setShowKpVersionsModal(true); }} data-testid="lead-kp-versions-btn">
                        <History className="w-4 h-4 mr-1" />Версии КП
                      </Button>
                    )}
                    {selectedLead?.amocrm_id && (
                      <Button size="sm" variant="outline" onClick={() => { setKpDupLeadId(selectedLead.id); setShowKpDuplicatesModal(true); }} data-testid="lead-kp-duplicates-btn">
                        <FileText className="w-4 h-4 mr-1" />Дубли КП
                      </Button>
                    )}
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
      <DuplicatesModal open={showDuplicatesModal} onClose={() => setShowDuplicatesModal(false)} onMerged={fetchLeads} />
      <KpDuplicatesModal
        open={showKpDuplicatesModal}
        leadId={kpDupLeadId}
        onClose={() => setShowKpDuplicatesModal(false)}
        onChanged={fetchLeads}
      />
      <KpVersionsModal
        open={showKpVersionsModal}
        orderId={kpVersionsOrderId}
        onClose={() => setShowKpVersionsModal(false)}
        onChanged={fetchLeads}
      />
      {selectedLead && (
        <ContractGenerationModal
          open={contractModalOpen}
          onOpenChange={setContractModalOpen}
          leadId={selectedLead.id}
          apiUrl={API_URL}
          authHeaders={authHeaders}
          onGenerated={async () => {
            const updated = await fetch(`${API_URL}/api/sauna-crm/leads/${selectedLead.id}`, { headers: authHeaders });
            if (updated.ok) {
              const updData = await updated.json();
              setSelectedLead(updData);
              setEditData(updData);
            }
          }}
        />
      )}
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
                <TabsTrigger value="contract">Шаблон договора</TabsTrigger>
              </TabsList>

              <TabsContent value="fields">
                <div className="space-y-3">
                  {/* Calendar date field selector */}
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <Label className="text-sm font-medium mb-2 block">Поле даты для фильтрации и календаря</Label>
                    <Select
                      value={settingsForm.calendarDateField || 'prepaymentDate'}
                      onValueChange={(v) => setSettingsForm(p => ({ ...p, calendarDateField: v }))}
                    >
                      <SelectTrigger className="w-full" data-testid="calendar-date-field-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prepaymentDate">Дата предоплаты (prepaymentDate)</SelectItem>
                        <SelectItem value="readyDate">Дата готовности (readyDate)</SelectItem>
                        <SelectItem value="productionDate">Дата производства (productionDate)</SelectItem>
                        <SelectItem value="deliveryDate">Дата доставки (deliveryDate)</SelectItem>
                        {(settingsForm.fields || []).filter(f => f.enabled).map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.name} ({f.id})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Это поле будет использоваться для фильтрации сделок по дате и отображения в календаре</p>
                  </div>

                  {/* Telegram: separate alerts chat */}
                  <div className="p-3 border rounded-lg bg-sky-50/60 space-y-3" data-testid="telegram-alerts-settings">
                    <div className="flex items-center gap-2">
                      <Send className="w-4 h-4 text-sky-600" />
                      <Label className="text-sm font-semibold">Telegram: отдельный чат для алертов</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">Заказы менеджеров остаются в основном чате. В этот чат будут падать: аналитика по менеджерам, дефицит склада и необходимость закупки.</p>
                    <div>
                      <Label className="text-xs mb-1 block">ID чата алертов</Label>
                      <Input
                        value={settingsForm.alertsChatId || ''}
                        onChange={(e) => setSettingsForm(p => ({ ...p, alertsChatId: e.target.value }))}
                        placeholder="напр. -1001234567890"
                        data-testid="alerts-chat-id-input"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm">Ежедневная сводка заказов (закреп)</Label>
                        <p className="text-xs text-muted-foreground">Раз в день: сколько заказов создали менеджеры (калькулятор + amoCRM). Сообщение закрепляется в чате.</p>
                      </div>
                      <Switch
                        checked={!!settingsForm.ordersSummaryEnabled}
                        onCheckedChange={(v) => setSettingsForm(p => ({ ...p, ordersSummaryEnabled: v }))}
                        data-testid="orders-summary-toggle"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="text-xs">Час отправки (UTC)</Label>
                      <Input
                        type="number" min="0" max="23"
                        className="w-20"
                        value={settingsForm.ordersSummaryHour ?? 9}
                        onChange={(e) => setSettingsForm(p => ({ ...p, ordersSummaryHour: parseInt(e.target.value || '9', 10) }))}
                        data-testid="orders-summary-hour-input"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={sendOrdersSummaryNow} data-testid="send-summary-now-btn">
                        <Send className="w-3.5 h-3.5 mr-1" />Отправить сводку сейчас
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" className="border-red-300 text-red-700 hover:bg-red-50" onClick={testDeficitAlert} data-testid="test-deficit-btn">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1" />Тест: сигнал о дефиците
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={sendWeeklySummaryNow} data-testid="send-weekly-now-btn">
                        <CalendarIcon className="w-3.5 h-3.5 mr-1" />Недельная сводка сейчас
                      </Button>
                    </div>
                  </div>
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
                      <Select
                        value={field.amoFieldId?.startsWith('_') ? field.amoFieldId : 'custom'}
                        onValueChange={(v) => {
                          const fields = [...settingsForm.fields];
                          fields[idx] = { ...fields[idx], amoFieldId: v === 'custom' ? '' : v };
                          setSettingsForm(p => ({ ...p, fields }));
                        }}
                      >
                        <SelectTrigger className="w-40"><SelectValue placeholder="Источник amoCRM" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">ID поля...</SelectItem>
                          <SelectItem value="_budget">Бюджет (price)</SelectItem>
                          <SelectItem value="_name">Название сделки</SelectItem>
                          <SelectItem value="_responsible">Ответственный</SelectItem>
                        </SelectContent>
                      </Select>
                      {(!field.amoFieldId || !field.amoFieldId.startsWith('_')) && (
                        <Input
                          className="w-28"
                          value={field.amoFieldId || ''}
                          onChange={(e) => {
                            const fields = [...settingsForm.fields];
                            fields[idx] = { ...fields[idx], amoFieldId: e.target.value };
                            setSettingsForm(p => ({ ...p, fields }));
                          }}
                          placeholder="amoCRM ID"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="stages">
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">Настройте этапы CRM и маппинг с воронками amoCRM</p>
                    <Button variant="outline" size="sm" onClick={fetchAmoPipelines} disabled={loadingPipelines} data-testid="load-amo-pipelines-btn">
                      {loadingPipelines ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                      Загрузить воронки amoCRM
                    </Button>
                  </div>
                  {(settingsForm.stages || []).map((stage, idx) => (
                    <div key={stage.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={stage.color}
                          onChange={(e) => {
                            const stages = [...settingsForm.stages];
                            stages[idx] = { ...stages[idx], color: e.target.value };
                            setSettingsForm(p => ({ ...p, stages }));
                          }}
                          className="w-8 h-8 rounded cursor-pointer flex-shrink-0"
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
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0 cursor-pointer" title="Свёрнут по умолчанию в канбане">
                          <input
                            type="checkbox"
                            checked={stage.collapsed || false}
                            onChange={(e) => {
                              const stages = [...settingsForm.stages];
                              stages[idx] = { ...stages[idx], collapsed: e.target.checked };
                              setSettingsForm(p => ({ ...p, stages }));
                            }}
                            className="rounded"
                          />
                          Свёрнут
                        </label>
                        <Button size="icon" variant="ghost" className="text-red-500 flex-shrink-0" onClick={() => {
                          setSettingsForm(p => ({ ...p, stages: p.stages.filter((_, i) => i !== idx) }));
                        }}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                      {/* amoCRM mapping */}
                      <div className="flex items-center gap-2 pl-11">
                        <span className="text-xs text-muted-foreground flex-shrink-0 w-16">amoCRM:</span>
                        {amoPipelines.length > 0 ? (
                          <>
                            <Select
                              value={stage.amoPipelineId || "none"}
                              onValueChange={(v) => {
                                const stages = [...settingsForm.stages];
                                stages[idx] = { ...stages[idx], amoPipelineId: v === "none" ? "" : v, amoStageId: "" };
                                setSettingsForm(p => ({ ...p, stages }));
                              }}
                            >
                              <SelectTrigger className="w-[180px] h-8 text-xs" data-testid={`amo-pipeline-${stage.id}`}>
                                <SelectValue placeholder="Воронка" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">— Не привязана —</SelectItem>
                                {amoPipelines.map(p => (
                                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={stage.amoStageId || "none"}
                              onValueChange={(v) => {
                                const stages = [...settingsForm.stages];
                                stages[idx] = { ...stages[idx], amoStageId: v === "none" ? "" : v };
                                setSettingsForm(p => ({ ...p, stages }));
                              }}
                            >
                              <SelectTrigger className="w-[200px] h-8 text-xs" data-testid={`amo-stage-${stage.id}`}>
                                <SelectValue placeholder="Этап воронки" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">— Не привязан —</SelectItem>
                                {(amoPipelines.find(p => String(p.id) === String(stage.amoPipelineId))?.statuses || []).map(s => (
                                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        ) : (
                          <>
                            <Input
                              className="w-28 h-8 text-xs"
                              value={stage.amoPipelineId}
                              onChange={(e) => {
                                const stages = [...settingsForm.stages];
                                stages[idx] = { ...stages[idx], amoPipelineId: e.target.value };
                                setSettingsForm(p => ({ ...p, stages }));
                              }}
                              placeholder="Pipeline ID"
                            />
                            <Input
                              className="w-28 h-8 text-xs"
                              value={stage.amoStageId}
                              onChange={(e) => {
                                const stages = [...settingsForm.stages];
                                stages[idx] = { ...stages[idx], amoStageId: e.target.value };
                                setSettingsForm(p => ({ ...p, stages }));
                              }}
                              placeholder="Stage ID"
                            />
                          </>
                        )}
                        {stage.amoStageId && stage.amoPipelineId && (
                          <Badge variant="outline" className="text-[10px] text-green-600 border-green-300 flex-shrink-0">Связан</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => {
                    setSettingsForm(p => ({
                      ...p,
                      stages: [...p.stages, { id: `stage_${Date.now()}`, name: 'Новый этап', amoStageId: '', amoPipelineId: '', color: '#6b7280', sortOrder: p.stages.length + 1, collapsed: false }]
                    }));
                  }}><Plus className="w-4 h-4 mr-1" />Добавить этап</Button>
                  {amoPipelines.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Нажмите "Загрузить воронки amoCRM" для выбора этапов из выпадающего списка. При переносе заказа в CRM карточка в amoCRM автоматически переместится в привязанный этап.
                    </p>
                  )}
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
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">ID поля "Комментарий менеджера" <span className="text-muted-foreground">(для уточнений из amoCRM)</span></Label>
                        <Input
                          value={settingsForm.commentFieldId || ''}
                          onChange={(e) => setSettingsForm(p => ({ ...p, commentFieldId: e.target.value }))}
                          placeholder="ID кастомного поля в amoCRM для комментариев"
                          data-testid="crm-comment-field-id"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">ID поля "Аванс / Залічка"</Label>
                        <Input
                          value={settingsForm.advanceFieldId || ''}
                          onChange={(e) => setSettingsForm(p => ({ ...p, advanceFieldId: e.target.value }))}
                          placeholder="ID поля суммы аванса в amoCRM"
                          data-testid="crm-advance-field-id"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">ID поля "Остаток"</Label>
                        <Input
                          value={settingsForm.remainingFieldId || ''}
                          onChange={(e) => setSettingsForm(p => ({ ...p, remainingFieldId: e.target.value }))}
                          placeholder="ID поля остатка в amoCRM"
                          data-testid="crm-remaining-field-id"
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
                          <SelectItem value="prepaymentDate">Дата залички</SelectItem>
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

                  {/* Auto-sync settings */}
                  <div className="mt-6 pt-4 border-t">
                    <p className="text-sm font-medium mb-3">Автоматическая синхронизация</p>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settingsForm.autoSyncEnabled || false}
                          onChange={(e) => setSettingsForm(p => ({ ...p, autoSyncEnabled: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-300"
                          data-testid="auto-sync-enabled"
                        />
                        <span className="text-sm">Включить автосинхронизацию</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">каждые</span>
                        <Input
                          type="number"
                          min={5}
                          max={120}
                          className="w-20"
                          value={settingsForm.autoSyncIntervalMinutes || 15}
                          onChange={(e) => setSettingsForm(p => ({ ...p, autoSyncIntervalMinutes: parseInt(e.target.value) || 15 }))}
                          data-testid="auto-sync-interval"
                        />
                        <span className="text-xs text-muted-foreground">мин.</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">При включении CRM будет автоматически синхронизироваться с amoCRM с заданным интервалом</p>
                  </div>

                  {/* Sales sync settings */}
                  <div className="mt-6 pt-4 border-t">
                    <p className="text-sm font-medium mb-3">Синхронизация с Продажами</p>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Этап, начиная с которого сделки попадают в Продажи</Label>
                        <select
                          className="w-full mt-1 border rounded-md px-3 py-2 text-sm"
                          value={settingsForm.salesStageId || ''}
                          onChange={(e) => setSettingsForm(p => ({ ...p, salesStageId: e.target.value }))}
                          data-testid="sales-stage-select"
                        >
                          <option value="">Не выбран (все кроме первого)</option>
                          {(settingsForm.stages || []).map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Поле "Предоплата получена" (флаг)</Label>
                        <select
                          className="w-full mt-1 border rounded-md px-3 py-2 text-sm"
                          value={settingsForm.salesPrepaymentFlagFieldId || ''}
                          onChange={(e) => setSettingsForm(p => ({ ...p, salesPrepaymentFlagFieldId: e.target.value }))}
                          data-testid="sales-flag-field-input"
                        >
                          <option value="">Не выбран (только по этапу)</option>
                          {(settingsForm.fields || []).filter(f => f.amoFieldId).map(f => (
                            <option key={f.id} value={f.amoFieldId}>{f.name} (amoCRM: {f.amoFieldId})</option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-0.5">Только сделки с этим флагом попадут в Продажи</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Поле CRM для даты продажи (дата получения аванса)</Label>
                        <select
                          className="w-full mt-1 border rounded-md px-3 py-2 text-sm"
                          value={settingsForm.salesDateFieldId || ''}
                          onChange={(e) => setSettingsForm(p => ({ ...p, salesDateFieldId: e.target.value }))}
                          data-testid="sales-date-field-select"
                        >
                          <option value="">Автоматически</option>
                          {(settingsForm.fields || []).filter(f => f.fieldType === 'date').map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="contract">
                <ContractTemplateSettings authHeaders={authHeaders} />
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
