import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { 
  Package, Truck, Search, Clock, MapPin, 
  Box, CheckCircle, History, RefreshCw,
  Calendar, ChevronDown, ChevronUp, GripVertical, Phone, Copy,
  Settings, TruckIcon, PackageCheck, PackageX,
  ArrowDownToLine, Send, CircleCheckBig, Loader2, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { getApiUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const API_URL = getApiUrl();

// Warehouse statuses
const WAREHOUSE_STATUSES = {
  request: { label: 'Заявка', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Clock },
  picking: { label: 'Комплектация', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Package },
  ready: { label: 'Готов к загрузке', color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle }
};

// Dovoz stages
const DOVOZ_STAGES = {
  accepted: { label: 'Довоз принят', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: ArrowDownToLine, bgLight: 'bg-indigo-50/50', bgActive: 'bg-indigo-100 ring-2 ring-indigo-400', textColor: 'text-indigo-800' },
  sent: { label: 'Довоз отправлен', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: Send, bgLight: 'bg-amber-50/50', bgActive: 'bg-amber-100 ring-2 ring-amber-400', textColor: 'text-amber-800' },
  delivered: { label: 'Довоз доставлен', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CircleCheckBig, bgLight: 'bg-emerald-50/50', bgActive: 'bg-emerald-100 ring-2 ring-emerald-400', textColor: 'text-emerald-800' }
};

const SECTION_BADGES = {
  balia: { label: 'Balia', color: 'bg-blue-500' },
  greenhouse: { label: 'Greenhouse', color: 'bg-green-500' },
  sauna: { label: 'Sauna', color: 'bg-orange-500' }
};

const WarehousePage = ({ onBack }) => {
  const { isStorekeeper } = useAuth();
  const canDelete = !isStorekeeper(); // storekeeper cannot delete
  const [activeTab, setActiveTab] = useState('dovoz');
  const [orders, setOrders] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderHistory, setOrderHistory] = useState({});

  // Dovoz state
  const [dovozOrders, setDovozOrders] = useState([]);
  const [dovozStats, setDovozStats] = useState(null);
  const [dovozSearch, setDovozSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [expandedDovoz, setExpandedDovoz] = useState(null);
  const [dovozHistory, setDovozHistory] = useState({});

  // Settings
  const [warehouseSettings, setWarehouseSettings] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    sections_enabled: { orders: true, trips: true, dovoz: true },
    dovoz_config: { source_pipeline_id: '', source_status_id: '', sent_status_id: '', delivered_status_id: '' }
  });

  // Pipelines for settings dropdown
  const [pipelines, setPipelines] = useState([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);

  const token = localStorage.getItem('authToken');
  const headers = { 'Authorization': `Bearer ${token}` };

  // ---- Data fetching ----

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/dovoz/settings`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setWarehouseSettings(data);
        setSettingsForm({
          sections_enabled: data.sections_enabled || { orders: true, trips: true, dovoz: true },
          dovoz_config: data.dovoz_config || { source_pipeline_id: '', source_status_id: '', sent_status_id: '', delivered_status_id: '' }
        });
      }
    } catch (e) { console.error('Error fetching settings:', e); }
  }, [token]);

  const fetchOrders = useCallback(async () => {
    try {
      let url = `${API_URL}/api/warehouse/orders?`;
      if (sectionFilter !== 'all') url += `section=${sectionFilter}&`;
      if (statusFilter !== 'all') url += `status=${statusFilter}&`;
      if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (e) { toast.error('Ошибка загрузки заказов'); }
  }, [token, sectionFilter, statusFilter, searchTerm]);

  const fetchTrips = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/warehouse/trips`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setTrips(data.trips || []); }
    } catch (e) { toast.error('Ошибка загрузки рейсов'); }
  }, [token]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/warehouse/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setStats(data); }
    } catch (e) { console.error(e); }
  }, [token]);

  const fetchDovozOrders = useCallback(async () => {
    try {
      let url = `${API_URL}/api/dovoz/orders`;
      if (dovozSearch) url += `?search=${encodeURIComponent(dovozSearch)}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setDovozOrders(data.orders || []);
      }
    } catch (e) { toast.error('Ошибка загрузки довозов'); }
  }, [token, dovozSearch]);

  const fetchDovozStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/dovoz/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setDovozStats(data); }
    } catch (e) { console.error(e); }
  }, [token]);

  const fetchPipelines = async () => {
    setLoadingPipelines(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/amocrm/pipelines`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setPipelines(data.pipelines || []);
      }
    } catch (e) { console.error(e); }
    setLoadingPipelines(false);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchSettings();
      await Promise.all([fetchDovozOrders(), fetchDovozStats()]);
      setLoading(false);
    };
    loadData();
  }, [fetchSettings, fetchDovozOrders, fetchDovozStats]);

  // Load orders/trips only when their tabs are active and enabled
  useEffect(() => {
    if (activeTab === 'orders' && warehouseSettings?.sections_enabled?.orders) {
      fetchOrders(); fetchStats();
    } else if (activeTab === 'trips' && warehouseSettings?.sections_enabled?.trips) {
      fetchTrips();
    }
  }, [activeTab, warehouseSettings, fetchOrders, fetchStats, fetchTrips]);

  // ---- Actions ----

  const syncFromAmoCRM = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/api/dovoz/sync-from-amocrm`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchDovozOrders();
        fetchDovozStats();
      } else {
        toast.error(data.detail || 'Ошибка синхронизации');
      }
    } catch (e) { toast.error('Ошибка синхронизации'); }
    setSyncing(false);
  };

  const updateDovozStage = async (orderId, newStage) => {
    try {
      const res = await fetch(`${API_URL}/api/dovoz/orders/${orderId}/stage?stage=${newStage}`, {
        method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        if (data.amo_sync?.status === 'ok') {
          toast.success(`amoCRM синхронизирован`);
        } else if (data.amo_sync?.status === 'error') {
          toast.error(`Ошибка amoCRM: ${data.amo_sync.detail?.slice(0,100)}`);
        } else if (data.amo_sync?.status === 'skipped') {
          toast.info(`amoCRM: ${data.amo_sync.reason}`);
        }
        fetchDovozOrders();
        fetchDovozStats();
        if (expandedDovoz === orderId) fetchDovozOrderHistory(orderId);
      } else {
        toast.error(data.detail || 'Ошибка');
      }
    } catch (e) { toast.error('Ошибка обновления'); }
  };

  const deleteDovozOrder = async (orderId) => {
    if (!window.confirm('Удалить заказ из довозов?')) return;
    try {
      const res = await fetch(`${API_URL}/api/dovoz/orders/${orderId}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Удалено');
        fetchDovozOrders();
        fetchDovozStats();
      }
    } catch (e) { toast.error('Ошибка удаления'); }
  };

  const fetchDovozOrderHistory = async (orderId) => {
    try {
      const res = await fetch(`${API_URL}/api/dovoz/orders/${orderId}/history`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setDovozHistory(prev => ({ ...prev, [orderId]: data.history }));
      }
    } catch (e) { console.error(e); }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(`${API_URL}/api/warehouse/orders/${orderId}/status?status=${newStatus}`, {
        method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        fetchOrders(); fetchStats();
      }
    } catch (e) { toast.error('Ошибка обновления статуса'); }
  };

  const fetchOrderHistory = async (orderId) => {
    try {
      const res = await fetch(`${API_URL}/api/warehouse/orders/${orderId}/history`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setOrderHistory(prev => ({ ...prev, [orderId]: data.history }));
      }
    } catch (e) { console.error(e); }
  };

  const saveSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/dovoz/settings`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm)
      });
      if (res.ok) {
        toast.success('Настройки сохранены');
        setSettingsOpen(false);
        fetchSettings();
      }
    } catch (e) { toast.error('Ошибка сохранения'); }
  };

  // ---- Drag & Drop for warehouse ----
  const [draggedOrder, setDraggedOrder] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);

  const handleDragStart = (e, order, type = 'warehouse') => {
    setDraggedOrder({ ...order, _type: type });
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, status) => { e.preventDefault(); setDragOverStatus(status); };
  const handleDragLeave = () => setDragOverStatus(null);
  const handleDrop = async (e, newStatus, type = 'warehouse') => {
    e.preventDefault();
    setDragOverStatus(null);
    if (!draggedOrder) return;
    if (type === 'dovoz' && draggedOrder._type === 'dovoz') {
      if ((draggedOrder.dovozStage || 'accepted') !== newStatus) {
        await updateDovozStage(draggedOrder.id, newStatus);
      }
    } else if (type === 'warehouse' && draggedOrder._type === 'warehouse') {
      if ((draggedOrder.warehouseStatus || 'request') !== newStatus) {
        await updateOrderStatus(draggedOrder.id, newStatus);
      }
    }
    setDraggedOrder(null);
  };
  const handleDragEnd = () => { setDraggedOrder(null); setDragOverStatus(null); };

  // Helpers
  const getDisplayName = (o) => o.client_name || o.clientName || o.fullName || o.lead_name || 'Без имени';
  const getDisplayPhone = (o) => o.phone || o.clientPhone || '';

  // Group orders
  const ordersByStatus = {
    request: orders.filter(o => o.warehouseStatus === 'request' || !o.warehouseStatus),
    picking: orders.filter(o => o.warehouseStatus === 'picking'),
    ready: orders.filter(o => o.warehouseStatus === 'ready')
  };

  const dovozByStage = {
    accepted: dovozOrders.filter(o => o.dovozStage === 'accepted'),
    sent: dovozOrders.filter(o => o.dovozStage === 'sent'),
    delivered: dovozOrders.filter(o => o.dovozStage === 'delivered')
  };

  const sectionsEnabled = warehouseSettings?.sections_enabled || { orders: true, trips: true, dovoz: true };

  // ---- Dovoz Order Card ----
  const DovozCard = ({ order }) => {
    const stage = DOVOZ_STAGES[order.dovozStage || 'accepted'];
    const isExpanded = expandedDovoz === order.id;
    const StageIcon = stage.icon;
    const isDragging = draggedOrder?.id === order.id;

    return (
      <Card
        className={`mb-3 transition-all cursor-grab active:cursor-grabbing ${isExpanded ? 'ring-2 ring-primary' : ''} ${isDragging ? 'opacity-50 scale-95' : ''}`}
        draggable
        onDragStart={(e) => handleDragStart(e, order, 'dovoz')}
        onDragEnd={handleDragEnd}
        data-testid={`dovoz-card-${order.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground/50" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={`${stage.color} border text-xs`}>
                  <StageIcon className="w-3 h-3 mr-1" />
                  {stage.label}
                </Badge>
                {order.price > 0 && (
                  <Badge variant="secondary" className="text-xs">{order.price?.toLocaleString()} zł</Badge>
                )}
                {order.debt > 0 && (
                  <Badge variant="secondary" className="text-xs bg-red-100 text-red-700" data-testid={`dovoz-debt-${order.id}`}>Долг: {order.debt?.toLocaleString()} zł</Badge>
                )}
              </div>
              <h4 className="font-medium text-sm truncate flex items-center gap-1">
                {getDisplayName(order)}
                {getDisplayName(order) && <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(getDisplayName(order)); toast.success('Имя скопировано'); }} className="text-muted-foreground/40 hover:text-primary transition-colors" data-testid={`copy-name-${order.id}`}><Copy className="w-3 h-3" /></button>}
              </h4>
              <p className="text-xs text-muted-foreground truncate">{order.lead_name}</p>
              {order.amocrm_id && (
                <p className="text-xs text-muted-foreground">amoCRM: {order.amocrm_id}</p>
              )}
              {order.address && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{order.address}</span>
                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(order.address); toast.success('Адрес скопирован'); }} className="text-muted-foreground/40 hover:text-primary transition-colors flex-shrink-0" data-testid={`copy-address-${order.id}`}><Copy className="w-3 h-3" /></button>
                </div>
              )}
              {order.address_index && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <span className="ml-4">{order.address_index}</span>
                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(order.address_index); toast.success('Индекс скопирован'); }} className="text-muted-foreground/40 hover:text-primary transition-colors flex-shrink-0" data-testid={`copy-index-${order.id}`}><Copy className="w-3 h-3" /></button>
                </div>
              )}
              {getDisplayPhone(order) && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Phone className="w-3 h-3" />
                  <span>{getDisplayPhone(order)}</span>
                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(getDisplayPhone(order)); toast.success('Телефон скопирован'); }} className="text-muted-foreground/40 hover:text-primary transition-colors flex-shrink-0" data-testid={`copy-phone-${order.id}`}><Copy className="w-3 h-3" /></button>
                </div>
              )}
              {order.products && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs" data-testid={`dovoz-products-${order.id}`}>
                  <div className="font-medium text-amber-800 mb-1 flex items-center gap-1">
                    <Box className="w-3 h-3" />Товары
                  </div>
                  <div className="text-amber-700 whitespace-pre-line">{order.products}</div>
                </div>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                {order.deal_created_at && (
                  <span className="flex items-center gap-1" data-testid={`dovoz-deal-date-${order.id}`}>
                    <Calendar className="w-3 h-3" />
                    {new Date(order.deal_created_at).toLocaleDateString('ru-RU')}
                  </span>
                )}
                {order.responsible_user && (
                  <span className="flex items-center gap-1" data-testid={`dovoz-responsible-${order.id}`}>
                    <span className="w-3 h-3 rounded-full bg-blue-200 flex items-center justify-center text-[8px] font-bold text-blue-700">{order.responsible_user.charAt(0)}</span>
                    {order.responsible_user}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => {
                if (isExpanded) { setExpandedDovoz(null); } else {
                  setExpandedDovoz(order.id);
                  if (!dovozHistory[order.id]) fetchDovozOrderHistory(order.id);
                }
              }}>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-4 pt-4 border-t space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-muted-foreground mr-2">Перевести в:</span>
                {Object.entries(DOVOZ_STAGES).map(([key, val]) => {
                  if (key === (order.dovozStage || 'accepted')) return null;
                  const Icon = val.icon;
                  return (
                    <Button key={key} size="sm" variant="outline" className="text-xs" onClick={() => updateDovozStage(order.id, key)} data-testid={`dovoz-move-${order.id}-${key}`}>
                      <Icon className="w-3 h-3 mr-1" />{val.label}
                    </Button>
                  );
                })}
                {canDelete && <Button size="sm" variant="ghost" className="text-xs text-red-500 hover:text-red-700" onClick={() => deleteDovozOrder(order.id)} data-testid={`dovoz-delete-${order.id}`}>
                  <Trash2 className="w-3 h-3 mr-1" />Удалить
                </Button>}
              </div>
              <div>
                <h5 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <History className="w-4 h-4" />История
                </h5>
                {dovozHistory[order.id] ? (
                  dovozHistory[order.id].length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {dovozHistory[order.id].map((entry, idx) => (
                        <div key={idx} className="text-xs bg-muted p-2 rounded">
                          <div className="flex justify-between">
                            <span>
                              {DOVOZ_STAGES[entry.oldStage]?.label || entry.oldStage} →{' '}
                              <strong>{DOVOZ_STAGES[entry.newStage]?.label || entry.newStage}</strong>
                            </span>
                            <span className="text-muted-foreground">{entry.changedBy}</span>
                          </div>
                          <div className="text-muted-foreground mt-1">
                            {new Date(entry.changedAt).toLocaleString('ru-RU')}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Нет истории</p>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground">Загрузка...</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ---- Warehouse Order Card ----
  const OrderCard = ({ order }) => {
    const status = WAREHOUSE_STATUSES[order.warehouseStatus || 'request'];
    const section = SECTION_BADGES[order.section];
    const isExpanded = expandedOrder === order.id;
    const StatusIcon = status.icon;
    const isDragging = draggedOrder?.id === order.id;

    return (
      <Card
        className={`mb-3 transition-all cursor-grab active:cursor-grabbing ${isExpanded ? 'ring-2 ring-primary' : ''} ${isDragging ? 'opacity-50 scale-95' : ''}`}
        draggable onDragStart={(e) => handleDragStart(e, order, 'warehouse')} onDragEnd={handleDragEnd}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2"><GripVertical className="w-4 h-4 text-muted-foreground/50" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={`${section?.color} text-white text-xs`}>{section?.label}</Badge>
                <Badge variant="outline" className={`${status.color} border text-xs`}>
                  <StatusIcon className="w-3 h-3 mr-1" />{status.label}
                </Badge>
              </div>
              <h4 className="font-medium text-sm truncate">{getDisplayName(order)}</h4>
              <p className="text-xs text-muted-foreground truncate">ID: {order.id}</p>
              {order.deliveryAddress && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" /><span className="truncate">{order.deliveryAddress}</span>
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => {
              if (expandedOrder === order.id) setExpandedOrder(null);
              else { setExpandedOrder(order.id); if (!orderHistory[order.id]) fetchOrderHistory(order.id); }
            }}>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
          {isExpanded && (
            <div className="mt-4 pt-4 border-t space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-muted-foreground mr-2">Перевести в:</span>
                {Object.entries(WAREHOUSE_STATUSES).map(([key, val]) => {
                  if (key === (order.warehouseStatus || 'request')) return null;
                  const Icon = val.icon;
                  return (
                    <Button key={key} size="sm" variant="outline" className="text-xs" onClick={() => updateOrderStatus(order.id, key)}>
                      <Icon className="w-3 h-3 mr-1" />{val.label}
                    </Button>
                  );
                })}
              </div>
              <div>
                <h5 className="text-sm font-medium flex items-center gap-2 mb-2"><History className="w-4 h-4" />История</h5>
                {orderHistory[order.id] ? (
                  orderHistory[order.id].length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {orderHistory[order.id].map((entry, idx) => (
                        <div key={idx} className="text-xs bg-muted p-2 rounded">
                          <div className="flex justify-between">
                            <span>{WAREHOUSE_STATUSES[entry.oldStatus]?.label} → <strong>{WAREHOUSE_STATUSES[entry.newStatus]?.label}</strong></span>
                            <span className="text-muted-foreground">{entry.changedBy}</span>
                          </div>
                          <div className="text-muted-foreground mt-1">{new Date(entry.changedAt).toLocaleString('ru-RU')}</div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-muted-foreground">Нет истории</p>
                ) : <p className="text-xs text-muted-foreground">Загрузка...</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ---- Trip Card ----
  const TripCard = ({ trip }) => {
    const [expanded, setExpanded] = useState(false);
    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="w-5 h-5 text-teal-600" />
                {trip.name || `Рейс ${trip.id?.slice(-6) || 'N/A'}`}
              </CardTitle>
              <CardDescription className="mt-1">
                {trip.driverName && <span className="mr-3">{trip.driverName}</span>}
                {trip.departureDate && <span>{trip.departureDate}</span>}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline">{trip.orderCount || trip.orderIds?.length || 0} заказов</Badge>
              <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        {expanded && (
          <CardContent className="pt-0">
            <div className="border-t pt-4 space-y-2">
              {trip.orders?.length > 0 ? trip.orders.map((o, idx) => (
                <div key={o.id || idx} className="p-3 bg-muted rounded-lg flex items-center gap-3">
                  <Badge className={`${SECTION_BADGES[o.section]?.color || 'bg-gray-500'} text-white text-xs`}>{SECTION_BADGES[o.section]?.label || 'N/A'}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{getDisplayName(o)}</p>
                    <p className="text-xs text-muted-foreground">ID: {o.id}</p>
                  </div>
                </div>
              )) : <p className="text-muted-foreground text-sm">Нет заказов</p>}
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  // ---- Settings Dialog ----
  const selectedPipeline = pipelines.find(p => String(p.id) === String(settingsForm.dovoz_config.source_pipeline_id));
  const pipelineStatuses = selectedPipeline?.statuses || [];

  const SettingsDialog = () => (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />Настройки склада</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Section toggles */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Разделы</Label>
            <div className="space-y-2">
              {[
                { key: 'orders', label: 'Заказы (Канбан)', icon: Package },
                { key: 'trips', label: 'Рейсы', icon: Truck },
                { key: 'dovoz', label: 'Довозы', icon: TruckIcon }
              ].map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{label}</span>
                  </div>
                  <Switch
                    checked={settingsForm.sections_enabled[key]}
                    onCheckedChange={(v) => setSettingsForm(prev => ({
                      ...prev,
                      sections_enabled: { ...prev.sections_enabled, [key]: v }
                    }))}
                    data-testid={`toggle-${key}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Dovoz amoCRM config */}
          {settingsForm.sections_enabled.dovoz && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Настройки довозов (amoCRM)</Label>
                <Button variant="outline" size="sm" onClick={fetchPipelines} disabled={loadingPipelines} data-testid="load-pipelines-btn">
                  {loadingPipelines ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                  Загрузить воронки
                </Button>
              </div>

              {pipelines.length > 0 ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Воронка (pipeline)</Label>
                    <Select
                      value={settingsForm.dovoz_config.source_pipeline_id || 'none'}
                      onValueChange={(v) => setSettingsForm(prev => ({
                        ...prev,
                        dovoz_config: { ...prev.dovoz_config, source_pipeline_id: v === 'none' ? '' : v, source_status_id: '', sent_status_id: '', delivered_status_id: '' }
                      }))}
                    >
                      <SelectTrigger data-testid="pipeline-select"><SelectValue placeholder="Выберите воронку" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Не выбрано</SelectItem>
                        {pipelines.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {pipelineStatuses.length > 0 && (
                    <>
                      <div>
                        <Label className="text-xs text-muted-foreground">Этап-источник (откуда забирать в "Довоз принят")</Label>
                        <Select
                          value={settingsForm.dovoz_config.source_status_id || 'none'}
                          onValueChange={(v) => setSettingsForm(prev => ({
                            ...prev,
                            dovoz_config: { ...prev.dovoz_config, source_status_id: v === 'none' ? '' : v }
                          }))}
                        >
                          <SelectTrigger data-testid="source-status-select"><SelectValue placeholder="Выберите этап" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Не выбрано</SelectItem>
                            {pipelineStatuses.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Этап "Довоз отправлен" (куда перемещать в amoCRM)</Label>
                        <Select
                          value={settingsForm.dovoz_config.sent_status_id || 'none'}
                          onValueChange={(v) => setSettingsForm(prev => ({
                            ...prev,
                            dovoz_config: { ...prev.dovoz_config, sent_status_id: v === 'none' ? '' : v }
                          }))}
                        >
                          <SelectTrigger data-testid="sent-status-select"><SelectValue placeholder="Выберите этап" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Не выбрано</SelectItem>
                            {pipelineStatuses.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Этап "Довоз доставлен" (куда перемещать в amoCRM)</Label>
                        <Select
                          value={settingsForm.dovoz_config.delivered_status_id || 'none'}
                          onValueChange={(v) => setSettingsForm(prev => ({
                            ...prev,
                            dovoz_config: { ...prev.dovoz_config, delivered_status_id: v === 'none' ? '' : v }
                          }))}
                        >
                          <SelectTrigger data-testid="delivered-status-select"><SelectValue placeholder="Выберите этап" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Не выбрано</SelectItem>
                            {pipelineStatuses.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  <div className="pt-2 border-t">
                    <Label className="text-xs font-semibold">Товары (ID полей amoCRM)</Label>
                    <p className="text-xs text-muted-foreground mb-2">Данные из этих полей будут объединены в поле "Товары"</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Поле товаров 1</Label>
                        <Input value={settingsForm.dovoz_config.products_field_id_1 || ''} onChange={(e) => setSettingsForm(prev => ({ ...prev, dovoz_config: { ...prev.dovoz_config, products_field_id_1: e.target.value } }))} placeholder="ID поля amoCRM" data-testid="products-field-1-dropdown" />
                      </div>
                      <div>
                        <Label className="text-xs">Поле товаров 2</Label>
                        <Input value={settingsForm.dovoz_config.products_field_id_2 || ''} onChange={(e) => setSettingsForm(prev => ({ ...prev, dovoz_config: { ...prev.dovoz_config, products_field_id_2: e.target.value } }))} placeholder="ID поля amoCRM" data-testid="products-field-2-dropdown" />
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <Label className="text-xs font-semibold">Задолженность</Label>
                    <div className="grid grid-cols-2 gap-3 mt-1">
                      <div>
                        <Label className="text-xs">ID поля задолженности</Label>
                        <Input value={settingsForm.dovoz_config.debt_field_id || ''} onChange={(e) => setSettingsForm(prev => ({ ...prev, dovoz_config: { ...prev.dovoz_config, debt_field_id: e.target.value } }))} placeholder="ID поля amoCRM" data-testid="debt-field-dropdown" />
                      </div>
                      <div>
                        <Label className="text-xs">ID поля имени клиента</Label>
                        <Input value={settingsForm.dovoz_config.name_field_id || ''} onChange={(e) => setSettingsForm(prev => ({ ...prev, dovoz_config: { ...prev.dovoz_config, name_field_id: e.target.value } }))} placeholder="ID поля amoCRM" data-testid="name-field-dropdown" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                  <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Нажмите "Загрузить воронки" или введите ID вручную:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Pipeline ID</Label>
                      <Input value={settingsForm.dovoz_config.source_pipeline_id} onChange={(e) => setSettingsForm(prev => ({ ...prev, dovoz_config: { ...prev.dovoz_config, source_pipeline_id: e.target.value } }))} placeholder="ID воронки" data-testid="pipeline-id-input" />
                    </div>
                    <div>
                      <Label className="text-xs">Source Status ID</Label>
                      <Input value={settingsForm.dovoz_config.source_status_id} onChange={(e) => setSettingsForm(prev => ({ ...prev, dovoz_config: { ...prev.dovoz_config, source_status_id: e.target.value } }))} placeholder="ID этапа-источника" data-testid="source-status-input" />
                    </div>
                    <div>
                      <Label className="text-xs">Sent Status ID</Label>
                      <Input value={settingsForm.dovoz_config.sent_status_id} onChange={(e) => setSettingsForm(prev => ({ ...prev, dovoz_config: { ...prev.dovoz_config, sent_status_id: e.target.value } }))} placeholder="ID этапа 'отправлен'" data-testid="sent-status-input" />
                    </div>
                    <div>
                      <Label className="text-xs">Delivered Status ID</Label>
                      <Input value={settingsForm.dovoz_config.delivered_status_id} onChange={(e) => setSettingsForm(prev => ({ ...prev, dovoz_config: { ...prev.dovoz_config, delivered_status_id: e.target.value } }))} placeholder="ID этапа 'доставлен'" data-testid="delivered-status-input" />
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <Label className="text-xs font-semibold">Товары (ID полей amoCRM)</Label>
                    <p className="text-xs text-muted-foreground mb-2">Данные из этих полей будут объединены в поле "Товары"</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Поле товаров 1</Label>
                        <Input value={settingsForm.dovoz_config.products_field_id_1 || ''} onChange={(e) => setSettingsForm(prev => ({ ...prev, dovoz_config: { ...prev.dovoz_config, products_field_id_1: e.target.value } }))} placeholder="ID поля amoCRM" data-testid="products-field-1-input" />
                      </div>
                      <div>
                        <Label className="text-xs">Поле товаров 2</Label>
                        <Input value={settingsForm.dovoz_config.products_field_id_2 || ''} onChange={(e) => setSettingsForm(prev => ({ ...prev, dovoz_config: { ...prev.dovoz_config, products_field_id_2: e.target.value } }))} placeholder="ID поля amoCRM" data-testid="products-field-2-input" />
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <Label className="text-xs font-semibold">Задолженность</Label>
                    <div className="grid grid-cols-2 gap-3 mt-1">
                      <div>
                        <Label className="text-xs">ID поля задолженности</Label>
                        <Input value={settingsForm.dovoz_config.debt_field_id || ''} onChange={(e) => setSettingsForm(prev => ({ ...prev, dovoz_config: { ...prev.dovoz_config, debt_field_id: e.target.value } }))} placeholder="ID поля amoCRM" data-testid="debt-field-input" />
                      </div>
                      <div>
                        <Label className="text-xs">ID поля имени клиента</Label>
                        <Input value={settingsForm.dovoz_config.name_field_id || ''} onChange={(e) => setSettingsForm(prev => ({ ...prev, dovoz_config: { ...prev.dovoz_config, name_field_id: e.target.value } }))} placeholder="ID поля amoCRM" data-testid="name-field-input" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSettingsOpen(false)}>Отмена</Button>
          <Button onClick={saveSettings} data-testid="save-settings-btn">Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ---- Loading ----
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Determine initial tab
  const availableTabs = [];
  if (sectionsEnabled.dovoz) availableTabs.push('dovoz');
  if (sectionsEnabled.orders) availableTabs.push('orders');
  if (sectionsEnabled.trips) availableTabs.push('trips');

  return (
    <div className="container mx-auto p-4 max-w-7xl" data-testid="warehouse-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} data-testid="warehouse-back-btn">← Назад</Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="w-7 h-7 text-amber-600" />
              Склад
            </h1>
            <p className="text-muted-foreground">Управление комплектацией и довозами</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} data-testid="warehouse-settings-btn">
            <Settings className="w-4 h-4 mr-2" />Настройки
          </Button>
        </div>
      </div>

      {/* Dovoz Stats */}
      {sectionsEnabled.dovoz && dovozStats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {Object.entries(DOVOZ_STAGES).map(([key, val]) => {
            const Icon = val.icon;
            return (
              <Card key={key} className={`${val.bgLight} border`} data-testid={`dovoz-stat-${key}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm ${val.textColor}`}>{val.label}</p>
                      <p className={`text-2xl font-bold ${val.textColor}`}>{dovozStats.by_stage?.[key] || 0}</p>
                    </div>
                    <Icon className={`w-8 h-8 ${val.textColor} opacity-40`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <Card className="bg-slate-50 border" data-testid="dovoz-stat-total">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Всего довозов</p>
                  <p className="text-2xl font-bold text-slate-700">{dovozStats.total || 0}</p>
                </div>
                <Box className="w-8 h-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      {availableTabs.length > 0 ? (
        <Tabs value={availableTabs.includes(activeTab) ? activeTab : availableTabs[0]} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            {sectionsEnabled.dovoz && (
              <TabsTrigger value="dovoz" className="gap-2" data-testid="tab-dovoz">
                <TruckIcon className="w-4 h-4" />Довозы
              </TabsTrigger>
            )}
            {sectionsEnabled.orders && (
              <TabsTrigger value="orders" className="gap-2" data-testid="tab-orders">
                <Package className="w-4 h-4" />Заказы
              </TabsTrigger>
            )}
            {sectionsEnabled.trips && (
              <TabsTrigger value="trips" className="gap-2" data-testid="tab-trips">
                <Truck className="w-4 h-4" />Рейсы
              </TabsTrigger>
            )}
          </TabsList>

          {/* Dovoz Tab */}
          {sectionsEnabled.dovoz && (
            <TabsContent value="dovoz">
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Поиск по имени или amoCRM ID..."
                      value={dovozSearch}
                      onChange={(e) => setDovozSearch(e.target.value)}
                      className="pl-10"
                      data-testid="dovoz-search"
                    />
                  </div>
                </div>
                <Button onClick={syncFromAmoCRM} disabled={syncing} data-testid="sync-amocrm-btn">
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Синхронизировать с amoCRM
                </Button>
                <Button variant="outline" onClick={() => { fetchDovozOrders(); fetchDovozStats(); }} data-testid="refresh-dovoz-btn">
                  <RefreshCw className="w-4 h-4 mr-2" />Обновить
                </Button>
              </div>

              {/* Kanban */}
              <div className="grid grid-cols-3 gap-6">
                {Object.entries(DOVOZ_STAGES).map(([stageKey, stageVal]) => {
                  const StageIcon = stageVal.icon;
                  const stageOrders = dovozByStage[stageKey] || [];
                  return (
                    <div
                      key={stageKey}
                      className={`rounded-lg p-4 transition-all ${dragOverStatus === stageKey ? stageVal.bgActive : stageVal.bgLight}`}
                      onDragOver={(e) => handleDragOver(e, stageKey)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, stageKey, 'dovoz')}
                      data-testid={`dovoz-column-${stageKey}`}
                    >
                      <h3 className={`font-semibold mb-4 flex items-center gap-2 ${stageVal.textColor}`}>
                        <StageIcon className="w-5 h-5" />
                        {stageVal.label}
                        <Badge variant="secondary" className="ml-auto">{stageOrders.length}</Badge>
                      </h3>
                      <div className="space-y-3 max-h-[600px] overflow-y-auto min-h-[100px]">
                        {stageOrders.map(order => <DovozCard key={order.id} order={order} />)}
                        {stageOrders.length === 0 && (
                          <p className="text-center text-muted-foreground py-8">
                            {dragOverStatus === stageKey ? 'Отпустите для перемещения' : 'Нет заказов'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          )}

          {/* Orders Tab */}
          {sectionsEnabled.orders && (
            <TabsContent value="orders">
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Поиск по ID или клиенту..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                  </div>
                </div>
                <Select value={sectionFilter} onValueChange={setSectionFilter}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Секция" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все секции</SelectItem>
                    <SelectItem value="balia">Balia</SelectItem>
                    <SelectItem value="greenhouse">Greenhouse</SelectItem>
                    <SelectItem value="sauna">Sauna</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Статус" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все статусы</SelectItem>
                    <SelectItem value="request">Заявка</SelectItem>
                    <SelectItem value="picking">Комплектация</SelectItem>
                    <SelectItem value="ready">Готов к загрузке</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => { fetchOrders(); fetchStats(); }}>
                  <RefreshCw className="w-4 h-4 mr-2" />Обновить
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-6">
                {Object.entries(WAREHOUSE_STATUSES).map(([statusKey, statusVal]) => {
                  const StatusIcon = statusVal.icon;
                  const statusOrders = ordersByStatus[statusKey] || [];
                  return (
                    <div
                      key={statusKey}
                      className={`rounded-lg p-4 transition-all ${dragOverStatus === statusKey ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-muted/30'}`}
                      onDragOver={(e) => handleDragOver(e, statusKey)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, statusKey, 'warehouse')}
                    >
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <StatusIcon className="w-5 h-5" />{statusVal.label}
                        <Badge variant="secondary" className="ml-auto">{statusOrders.length}</Badge>
                      </h3>
                      <div className="space-y-3 max-h-[600px] overflow-y-auto min-h-[100px]">
                        {statusOrders.map(order => <OrderCard key={order.id} order={order} />)}
                        {statusOrders.length === 0 && (
                          <p className="text-center text-muted-foreground py-8">Нет заказов</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          )}

          {/* Trips Tab */}
          {sectionsEnabled.trips && (
            <TabsContent value="trips">
              <div className="mb-4 flex justify-between items-center">
                <p className="text-muted-foreground">Просмотр сформированных рейсов</p>
                <Button variant="outline" onClick={fetchTrips}><RefreshCw className="w-4 h-4 mr-2" />Обновить</Button>
              </div>
              {trips.length > 0 ? (
                <div className="space-y-4">{trips.map(trip => <TripCard key={trip.id} trip={trip} />)}</div>
              ) : (
                <Card><CardContent className="p-12 text-center"><Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Нет рейсов</p></CardContent></Card>
              )}
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <Card><CardContent className="p-12 text-center"><Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Все разделы отключены. Нажмите "Настройки" чтобы включить.</p></CardContent></Card>
      )}

      <SettingsDialog />
    </div>
  );
};

export default WarehousePage;
