import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  History, Download, Search, Calendar, Truck, User, Package, 
  MapPin, Route, Filter, ChevronDown, ChevronUp, Gauge,
  Warehouse, Waves, Flame, CheckCircle, Clock, X
} from 'lucide-react';
import { SECTIONS, TRIP_STATUSES } from './constants';

// Section icons mapping
const SECTION_ICONS = {
  greenhouse: Warehouse,
  balia: Waves,
  sauna: Flame
};

const SECTION_NAMES = {
  greenhouse: 'Теплицы',
  balia: 'Купели',
  sauna: 'Сауны'
};

const SECTION_COLORS = {
  greenhouse: 'bg-green-100 text-green-700',
  balia: 'bg-blue-100 text-blue-700',
  sauna: 'bg-orange-100 text-orange-700'
};

export const TripsHistory = ({ trips, drivers }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [expandedTrip, setExpandedTrip] = useState(null);

  // Filter and sort trips
  const filteredTrips = useMemo(() => {
    let result = [...trips];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(trip => 
        trip.id?.toLowerCase().includes(query) ||
        trip.name?.toLowerCase().includes(query) ||
        trip.driverName?.toLowerCase().includes(query)
      );
    }

    // Section filter
    if (sectionFilter !== 'all') {
      result = result.filter(trip => trip.section === sectionFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(trip => (trip.status || 'planned') === statusFilter);
    }

    // Date filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      result = result.filter(trip => {
        const tripDate = new Date(trip.createdAt || trip.departureDate);
        return tripDate >= fromDate;
      });
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59);
      result = result.filter(trip => {
        const tripDate = new Date(trip.createdAt || trip.departureDate);
        return tripDate <= toDate;
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc':
          return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        case 'date_desc':
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case 'orders_desc':
          return (b.orderIds?.length || 0) - (a.orderIds?.length || 0);
        case 'mileage_desc':
          return (b.mileage?.total || 0) - (a.mileage?.total || 0);
        default:
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
    });

    return result;
  }, [trips, searchQuery, sectionFilter, statusFilter, dateFrom, dateTo, sortBy]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'ID рейса',
      'Название',
      'Раздел',
      'Статус',
      'Водитель',
      'Дата создания',
      'Дата отправки',
      'Дата завершения',
      'Кол-во заказов',
      'Пробег начало (км)',
      'Пробег конец (км)',
      'Пробег итого (км)'
    ];

    const rows = filteredTrips.map(trip => [
      trip.id || '',
      trip.name || '',
      SECTION_NAMES[trip.section] || trip.section || '',
      TRIP_STATUSES[trip.status]?.label || trip.status || 'Не указан',
      trip.driverName || '',
      trip.createdAt ? new Date(trip.createdAt).toLocaleDateString('ru-RU') : '',
      trip.departureDate ? new Date(trip.departureDate).toLocaleDateString('ru-RU') : '',
      trip.finishedAt ? new Date(trip.finishedAt).toLocaleDateString('ru-RU') : '',
      trip.orderIds?.length || 0,
      trip.mileage?.start || '',
      trip.mileage?.end || '',
      trip.mileage?.total || ''
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `trips_history_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSectionFilter('all');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = searchQuery || sectionFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo;

  // Statistics
  const stats = useMemo(() => {
    const totalTrips = filteredTrips.length;
    const totalOrders = filteredTrips.reduce((sum, t) => sum + (t.orderIds?.length || 0), 0);
    const totalMileage = filteredTrips.reduce((sum, t) => sum + (t.mileage?.total || 0), 0);
    const deliveredTrips = filteredTrips.filter(t => t.status === 'delivered').length;
    
    return { totalTrips, totalOrders, totalMileage, deliveredTrips };
  }, [filteredTrips]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <History className="h-6 w-6 text-purple-600" />
              История рейсов
            </CardTitle>
            <Button onClick={exportToCSV} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Экспорт CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-700">{stats.totalTrips}</div>
              <div className="text-xs text-purple-600">Всего рейсов</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{stats.deliveredTrips}</div>
              <div className="text-xs text-green-600">Доставлено</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{stats.totalOrders}</div>
              <div className="text-xs text-blue-600">Всего заказов</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-700">{stats.totalMileage.toLocaleString()}</div>
              <div className="text-xs text-orange-600">Общий пробег (км)</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">Поиск</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ID, название, водитель..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Section filter */}
            <div className="w-[150px]">
              <label className="text-xs text-muted-foreground mb-1 block">Раздел</label>
              <Select value={sectionFilter} onValueChange={setSectionFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все разделы</SelectItem>
                  <SelectItem value="greenhouse">Теплицы</SelectItem>
                  <SelectItem value="balia">Купели</SelectItem>
                  <SelectItem value="sauna">Сауны</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status filter */}
            <div className="w-[160px]">
              <label className="text-xs text-muted-foreground mb-1 block">Статус</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="planned">Готов к отправке</SelectItem>
                  <SelectItem value="in_transit">В пути</SelectItem>
                  <SelectItem value="delivered">Доставлен</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date from */}
            <div className="w-[150px]">
              <label className="text-xs text-muted-foreground mb-1 block">Дата от</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            {/* Date to */}
            <div className="w-[150px]">
              <label className="text-xs text-muted-foreground mb-1 block">Дата до</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {/* Sort */}
            <div className="w-[180px]">
              <label className="text-xs text-muted-foreground mb-1 block">Сортировка</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">Новые сначала</SelectItem>
                  <SelectItem value="date_asc">Старые сначала</SelectItem>
                  <SelectItem value="orders_desc">По кол-ву заказов</SelectItem>
                  <SelectItem value="mileage_desc">По пробегу</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
                <X className="h-4 w-4 mr-1" />
                Сбросить
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Trips Table */}
      <Card>
        <CardContent className="p-0">
          {filteredTrips.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Нет рейсов по выбранным фильтрам</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">ID</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Название</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Раздел</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Статус</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Водитель</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Дата</th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground">Заказов</th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground">Пробег (км)</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrips.map((trip) => {
                    const SectionIcon = SECTION_ICONS[trip.section] || Package;
                    const statusInfo = TRIP_STATUSES[trip.status] || TRIP_STATUSES.planned;
                    const StatusIcon = statusInfo.icon || Clock;
                    const isExpanded = expandedTrip === trip.id;

                    return (
                      <React.Fragment key={trip.id}>
                        <tr className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <code className="text-xs bg-muted px-2 py-1 rounded">{trip.id?.slice(0, 12)}...</code>
                          </td>
                          <td className="p-3">
                            <span className="font-medium">{trip.name || 'Без названия'}</span>
                          </td>
                          <td className="p-3">
                            <Badge variant="secondary" className={`gap-1 ${SECTION_COLORS[trip.section] || ''}`}>
                              <SectionIcon className="h-3 w-3" />
                              {SECTION_NAMES[trip.section] || trip.section}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant="secondary" className={`gap-1 ${statusInfo.color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {statusInfo.label}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {trip.driverName ? (
                              <span className="flex items-center gap-1 text-sm">
                                <User className="h-3 w-3 text-muted-foreground" />
                                {trip.driverName}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </td>
                          <td className="p-3 text-sm">
                            {trip.departureDate ? (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                {new Date(trip.departureDate).toLocaleDateString('ru-RU')}
                              </span>
                            ) : trip.createdAt ? (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {new Date(trip.createdAt).toLocaleDateString('ru-RU')}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className="gap-1">
                              <Package className="h-3 w-3" />
                              {trip.orderIds?.length || 0}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            {trip.mileage?.total ? (
                              <span className="flex items-center justify-end gap-1 font-medium">
                                <Gauge className="h-3 w-3 text-muted-foreground" />
                                {trip.mileage.total.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedTrip(isExpanded ? null : trip.id)}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </td>
                        </tr>
                        
                        {/* Expanded details */}
                        {isExpanded && (
                          <tr className="bg-muted/20">
                            <td colSpan="9" className="p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground block text-xs mb-1">Дата создания</span>
                                  <span>{formatDate(trip.createdAt)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-xs mb-1">Дата отправки</span>
                                  <span>{formatDate(trip.departureDate)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-xs mb-1">Дата завершения</span>
                                  <span>{formatDate(trip.finishedAt)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-xs mb-1">Завершил</span>
                                  <span>{trip.finishedBy || '—'}</span>
                                </div>
                                {trip.mileage && (
                                  <>
                                    <div>
                                      <span className="text-muted-foreground block text-xs mb-1">Пробег начало</span>
                                      <span>{trip.mileage.start ? `${trip.mileage.start.toLocaleString()} км` : '—'}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block text-xs mb-1">Пробег конец</span>
                                      <span>{trip.mileage.end ? `${trip.mileage.end.toLocaleString()} км` : '—'}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block text-xs mb-1">Пробег итого</span>
                                      <span className="font-medium text-green-600">
                                        {trip.mileage.total ? `${trip.mileage.total.toLocaleString()} км` : '—'}
                                      </span>
                                    </div>
                                  </>
                                )}
                                <div>
                                  <span className="text-muted-foreground block text-xs mb-1">ID водителя</span>
                                  <span className="text-xs">{trip.driverId || '—'}</span>
                                </div>
                              </div>
                              
                              {/* Order IDs */}
                              {trip.orderIds && trip.orderIds.length > 0 && (
                                <div className="mt-4">
                                  <span className="text-muted-foreground block text-xs mb-2">ID заказов в рейсе:</span>
                                  <div className="flex flex-wrap gap-1">
                                    {trip.orderIds.map((orderId, idx) => (
                                      <code key={idx} className="text-xs bg-muted px-2 py-0.5 rounded">
                                        {orderId}
                                      </code>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="text-sm text-muted-foreground text-center">
        Показано {filteredTrips.length} из {trips.length} рейсов
      </div>
    </div>
  );
};

export default TripsHistory;
