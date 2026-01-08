import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Package, Truck, Search, ArrowRight, Clock, User, MapPin, 
  ChevronRight, Box, CheckCircle, History, Filter, RefreshCw,
  Calendar, Eye, ChevronDown, ChevronUp, GripVertical, Phone, Mail
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Warehouse statuses with colors
const WAREHOUSE_STATUSES = {
  request: { label: 'Заявка', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Clock },
  picking: { label: 'Комплектация', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Package },
  ready: { label: 'Готов к загрузке', color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle }
};

// Section badges
const SECTION_BADGES = {
  balia: { label: 'Balia', color: 'bg-blue-500' },
  greenhouse: { label: 'Greenhouse', color: 'bg-green-500' },
  sauna: { label: 'Sauna', color: 'bg-orange-500' }
};

const WarehousePage = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderHistory, setOrderHistory] = useState({});

  const token = localStorage.getItem('authToken');

  const fetchOrders = useCallback(async () => {
    try {
      let url = `${API_URL}/api/warehouse/orders?`;
      if (sectionFilter !== 'all') url += `section=${sectionFilter}&`;
      if (statusFilter !== 'all') url += `status=${statusFilter}&`;
      if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch orders');
      
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Ошибка загрузки заказов');
    }
  }, [token, sectionFilter, statusFilter, searchTerm]);

  const fetchTrips = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/warehouse/trips`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch trips');
      
      const data = await response.json();
      setTrips(data.trips || []);
    } catch (error) {
      console.error('Error fetching trips:', error);
      toast.error('Ошибка загрузки рейсов');
    }
  }, [token]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/warehouse/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch stats');
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [token]);

  const fetchOrderHistory = async (orderId) => {
    try {
      const response = await fetch(`${API_URL}/api/warehouse/orders/${orderId}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch history');
      
      const data = await response.json();
      setOrderHistory(prev => ({ ...prev, [orderId]: data.history }));
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const response = await fetch(`${API_URL}/api/warehouse/orders/${orderId}/status?status=${newStatus}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to update status');
      
      const data = await response.json();
      toast.success(data.message);
      
      // Refresh orders
      fetchOrders();
      fetchStats();
      
      // Refresh history if expanded
      if (expandedOrder === orderId) {
        fetchOrderHistory(orderId);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Ошибка обновления статуса');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchOrders(), fetchTrips(), fetchStats()]);
      setLoading(false);
    };
    loadData();
  }, [fetchOrders, fetchTrips, fetchStats]);

  const handleExpandOrder = (orderId) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(orderId);
      if (!orderHistory[orderId]) {
        fetchOrderHistory(orderId);
      }
    }
  };

  // Drag and drop handlers
  const [draggedOrder, setDraggedOrder] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);

  const handleDragStart = (e, order) => {
    setDraggedOrder(order);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', order.id);
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    setDragOverStatus(null);
    
    if (draggedOrder && (draggedOrder.warehouseStatus || 'request') !== newStatus) {
      await updateOrderStatus(draggedOrder.id, newStatus);
    }
    setDraggedOrder(null);
  };

  const handleDragEnd = () => {
    setDraggedOrder(null);
    setDragOverStatus(null);
  };

  // Helper to get order display name
  const getOrderDisplayName = (order) => {
    return order.clientName || order.fullName || order.customerName || order.name || 'Без имени';
  };

  // Helper to get order address
  const getOrderAddress = (order) => {
    return order.deliveryAddress || order.address || order.city || '';
  };

  // Helper to get order phone
  const getOrderPhone = (order) => {
    return order.phone || order.clientPhone || order.telephone || '';
  };

  // Group orders by status for kanban view
  const ordersByStatus = {
    request: orders.filter(o => o.warehouseStatus === 'request' || !o.warehouseStatus),
    picking: orders.filter(o => o.warehouseStatus === 'picking'),
    ready: orders.filter(o => o.warehouseStatus === 'ready')
  };

  const OrderCard = ({ order, showActions = true }) => {
    const status = WAREHOUSE_STATUSES[order.warehouseStatus || 'request'];
    const section = SECTION_BADGES[order.section];
    const isExpanded = expandedOrder === order.id;
    const StatusIcon = status.icon;

    return (
      <Card className={`mb-3 transition-all ${isExpanded ? 'ring-2 ring-primary' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={`${section?.color} text-white text-xs`}>
                  {section?.label}
                </Badge>
                <Badge variant="outline" className={`${status.color} border text-xs`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {status.label}
                </Badge>
              </div>
              
              <h4 className="font-medium text-sm truncate">{order.clientName || 'Без имени'}</h4>
              <p className="text-xs text-muted-foreground truncate">ID: {order.id}</p>
              
              {order.deliveryAddress && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{order.deliveryAddress}</span>
                </div>
              )}
              
              {order.dispatchDate && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>Отправка: {order.dispatchDate}</span>
                </div>
              )}
            </div>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleExpandOrder(order.id)}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
          
          {/* Expanded content */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t space-y-4">
              {/* Order details */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {order.phone && (
                  <div>
                    <span className="text-muted-foreground">Телефон:</span>
                    <p className="font-medium">{order.phone}</p>
                  </div>
                )}
                {order.email && (
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-medium">{order.email}</p>
                  </div>
                )}
                {order.totalPrice && (
                  <div>
                    <span className="text-muted-foreground">Сумма:</span>
                    <p className="font-medium">{order.totalPrice} PLN</p>
                  </div>
                )}
                {order.amocrm_id && (
                  <div>
                    <span className="text-muted-foreground">amoCRM:</span>
                    <p className="font-medium">{order.amocrm_id}</p>
                  </div>
                )}
              </div>
              
              {/* Status actions */}
              {showActions && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground mr-2">Перевести в:</span>
                  {Object.entries(WAREHOUSE_STATUSES).map(([key, value]) => {
                    const currentStatus = order.warehouseStatus || 'request';
                    if (key === currentStatus) return null;
                    const Icon = value.icon;
                    return (
                      <Button
                        key={key}
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => updateOrderStatus(order.id, key)}
                      >
                        <Icon className="w-3 h-3 mr-1" />
                        {value.label}
                      </Button>
                    );
                  })}
                </div>
              )}
              
              {/* History */}
              <div>
                <h5 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <History className="w-4 h-4" />
                  История изменений
                </h5>
                {orderHistory[order.id] ? (
                  orderHistory[order.id].length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {orderHistory[order.id].map((entry, idx) => (
                        <div key={idx} className="text-xs bg-muted p-2 rounded">
                          <div className="flex justify-between">
                            <span>
                              {WAREHOUSE_STATUSES[entry.oldStatus]?.label || entry.oldStatus} → 
                              <strong className="ml-1">{WAREHOUSE_STATUSES[entry.newStatus]?.label || entry.newStatus}</strong>
                            </span>
                            <span className="text-muted-foreground">{entry.changedBy}</span>
                          </div>
                          <div className="text-muted-foreground mt-1">
                            {new Date(entry.changedAt).toLocaleString('ru-RU')}
                          </div>
                          {entry.comment && (
                            <div className="mt-1 italic">"{entry.comment}"</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Нет истории изменений</p>
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

  const TripCard = ({ trip }) => {
    const [expanded, setExpanded] = useState(false);
    
    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="w-5 h-5 text-teal-600" />
                {trip.name || `Рейс ${trip.id.slice(-6)}`}
              </CardTitle>
              <CardDescription className="mt-1">
                {trip.driverName && <span className="mr-3">🚗 {trip.driverName}</span>}
                {trip.departureDate && <span>📅 {trip.departureDate}</span>}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm">
                {trip.orderCount || trip.orders?.length || 0} заказов
              </Badge>
              <Badge className={
                trip.status === 'completed' ? 'bg-gray-500' :
                trip.status === 'in_progress' ? 'bg-blue-500' :
                trip.status === 'ready' ? 'bg-green-500' :
                'bg-yellow-500'
              }>
                {trip.status === 'completed' ? 'Завершён' :
                 trip.status === 'in_progress' ? 'В пути' :
                 trip.status === 'ready' ? 'Готов' :
                 trip.status === 'delivered' ? 'Доставлен' :
                 'Формируется'}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {expanded && (
          <CardContent className="pt-0">
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Box className="w-4 h-4" />
                Заказы в рейсе
              </h4>
              {trip.orders && trip.orders.length > 0 ? (
                <div className="space-y-2">
                  {trip.orders.map((order, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge className={`${SECTION_BADGES[order.section]?.color} text-white text-xs`}>
                          {SECTION_BADGES[order.section]?.label}
                        </Badge>
                        <div>
                          <p className="font-medium text-sm">{order.clientName || 'Без имени'}</p>
                          <p className="text-xs text-muted-foreground">{order.deliveryAddress}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {order.warehouseStatus === 'ready' && (
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Скомплектован
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {trip.orderStatuses?.[order.id] || 'pending'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Нет заказов в рейсе</p>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            ← Назад
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="w-7 h-7 text-amber-600" />
              Склад
            </h1>
            <p className="text-muted-foreground">Управление комплектацией заказов</p>
          </div>
        </div>
        
        <Button variant="outline" onClick={() => { fetchOrders(); fetchTrips(); fetchStats(); }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Обновить
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">Заявки</p>
                  <p className="text-2xl font-bold text-blue-700">{stats.byStatus?.request || 0}</p>
                </div>
                <Clock className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600">Комплектация</p>
                  <p className="text-2xl font-bold text-yellow-700">{stats.byStatus?.picking || 0}</p>
                </div>
                <Package className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">Готовы к загрузке</p>
                  <p className="text-2xl font-bold text-green-700">{stats.byStatus?.ready || 0}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Всего заказов</p>
                  <p className="text-2xl font-bold text-gray-700">{stats.total || 0}</p>
                </div>
                <Box className="w-8 h-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="orders" className="gap-2">
            <Package className="w-4 h-4" />
            Заказы
          </TabsTrigger>
          <TabsTrigger value="trips" className="gap-2">
            <Truck className="w-4 h-4" />
            Рейсы
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Поиск по ID или клиенту..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Секция" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все секции</SelectItem>
                <SelectItem value="balia">Balia</SelectItem>
                <SelectItem value="greenhouse">Greenhouse</SelectItem>
                <SelectItem value="sauna">Sauna</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="request">Заявка</SelectItem>
                <SelectItem value="picking">Комплектация</SelectItem>
                <SelectItem value="ready">Готов к загрузке</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Kanban Board */}
          <div className="grid grid-cols-3 gap-6">
            {/* Request Column */}
            <div className="bg-blue-50/50 rounded-lg p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-blue-800">
                <Clock className="w-5 h-5" />
                Заявка
                <Badge variant="secondary" className="ml-auto">{ordersByStatus.request.length}</Badge>
              </h3>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {ordersByStatus.request.map(order => (
                  <OrderCard key={order.id} order={order} />
                ))}
                {ordersByStatus.request.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Нет заказов</p>
                )}
              </div>
            </div>

            {/* Picking Column */}
            <div className="bg-yellow-50/50 rounded-lg p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-yellow-800">
                <Package className="w-5 h-5" />
                Комплектация
                <Badge variant="secondary" className="ml-auto">{ordersByStatus.picking.length}</Badge>
              </h3>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {ordersByStatus.picking.map(order => (
                  <OrderCard key={order.id} order={order} />
                ))}
                {ordersByStatus.picking.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Нет заказов</p>
                )}
              </div>
            </div>

            {/* Ready Column */}
            <div className="bg-green-50/50 rounded-lg p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-green-800">
                <CheckCircle className="w-5 h-5" />
                Готов к загрузке
                <Badge variant="secondary" className="ml-auto">{ordersByStatus.ready.length}</Badge>
              </h3>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {ordersByStatus.ready.map(order => (
                  <OrderCard key={order.id} order={order} />
                ))}
                {ordersByStatus.ready.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Нет заказов</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Trips Tab */}
        <TabsContent value="trips">
          <div className="mb-4">
            <p className="text-muted-foreground">
              Просмотр сформированных рейсов (только для чтения)
            </p>
          </div>
          
          {trips.length > 0 ? (
            <div className="space-y-4">
              {trips.map(trip => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Нет сформированных рейсов</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WarehousePage;
