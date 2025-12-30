import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  DollarSign,
  Gift,
  Percent,
  Calendar,
  Download,
  RefreshCw,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Flame,
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const StatisticsPage = ({ calculatorType = 'sauna' }) => {
  const { i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [employees, setEmployees] = useState([]);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('all');

  const isSauna = calculatorType === 'sauna';

  const texts = {
    ru: {
      statistics: 'Статистика',
      filters: 'Фильтры',
      dateFrom: 'Дата от',
      dateTo: 'Дата до',
      employee: 'Сотрудник',
      allEmployees: 'Все сотрудники',
      apply: 'Применить',
      reset: 'Сбросить',
      export: 'Экспорт',
      exportCSV: 'Экспорт CSV',
      totalOrders: 'Всего заказов',
      totalRevenue: 'Общая выручка',
      averageCheck: 'Средний чек',
      topModels: 'Топ моделей',
      promotions: 'Промоакции',
      discount: 'Скидка',
      gift: 'Подарок',
      dailySales: 'Продажи по дням',
      employeeStats: 'Статистика по сотрудникам',
      orders: 'заказов',
      order: 'заказ',
      revenue: 'выручка',
      comparison: 'Сравнение с предыдущим периодом',
      currentPeriod: 'Текущий период',
      previousPeriod: 'Предыдущий период',
      change: 'Изменение',
      noData: 'Нет данных за выбранный период',
      loading: 'Загрузка...',
      days: 'дней',
      avgCheck: 'Средний чек',
      totalDiscountSaved: 'Сумма скидок',
    },
    pl: {
      statistics: 'Statystyki',
      filters: 'Filtry',
      dateFrom: 'Data od',
      dateTo: 'Data do',
      employee: 'Pracownik',
      allEmployees: 'Wszyscy pracownicy',
      apply: 'Zastosuj',
      reset: 'Resetuj',
      export: 'Eksport',
      exportCSV: 'Eksport CSV',
      totalOrders: 'Łączna liczba zamówień',
      totalRevenue: 'Łączny przychód',
      averageCheck: 'Średni rachunek',
      topModels: 'Najpopularniejsze modele',
      promotions: 'Promocje',
      discount: 'Rabat',
      gift: 'Prezent',
      dailySales: 'Sprzedaż dzienna',
      employeeStats: 'Statystyki pracowników',
      orders: 'zamówień',
      order: 'zamówienie',
      revenue: 'przychód',
      comparison: 'Porównanie z poprzednim okresem',
      currentPeriod: 'Bieżący okres',
      previousPeriod: 'Poprzedni okres',
      change: 'Zmiana',
      noData: 'Brak danych za wybrany okres',
      loading: 'Ładowanie...',
      days: 'dni',
      avgCheck: 'Średni rachunek',
      totalDiscountSaved: 'Kwota rabatów',
    },
  };

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  // Set default date range (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  // Fetch employees list
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/statistics/${calculatorType}/employees`);
        setEmployees(response.data);
      } catch (error) {
        console.error('Error fetching employees:', error);
      }
    };
    fetchEmployees();
  }, [calculatorType]);

  // Fetch statistics
  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (selectedEmployee && selectedEmployee !== 'all') params.append('employee', selectedEmployee);
      
      const response = await axios.get(`${API_URL}/api/statistics/${calculatorType}?${params.toString()}`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      toast.error('Ошибка загрузки статистики');
    } finally {
      setLoading(false);
    }
  };

  // Load stats when filters are set
  useEffect(() => {
    if (startDate && endDate) {
      fetchStatistics();
    }
  }, [startDate, endDate, selectedEmployee, calculatorType]);

  const handleReset = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setSelectedEmployee('all');
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (selectedEmployee && selectedEmployee !== 'all') params.append('employee', selectedEmployee);
      params.append('format', 'csv');
      
      const response = await axios.get(`${API_URL}/api/statistics/${calculatorType}/export?${params.toString()}`);
      
      // Create CSV content
      const data = response.data.data;
      if (!data || data.length === 0) {
        toast.error(txt.noData);
        return;
      }
      
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(';'),
        ...data.map(row => headers.map(h => row[h] || '').join(';'))
      ].join('\n');
      
      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `statistics_${calculatorType}_${startDate}_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('CSV экспортирован!');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Ошибка экспорта');
    }
  };

  const formatCurrency = (value) => {
    const currency = stats?.currency || (isSauna ? 'PLN' : '€');
    if (isSauna) {
      return `${Math.round(value).toLocaleString('pl-PL')} ${currency}`;
    }
    return `${value.toFixed(2)} ${currency}`;
  };

  const themeColor = isSauna ? 'orange' : 'blue';
  const Icon = isSauna ? Flame : Package;

  // Calculate max values for bar charts
  const maxDailyRevenue = useMemo(() => {
    if (!stats?.dailyStats) return 0;
    return Math.max(...stats.dailyStats.map(d => d.revenue));
  }, [stats?.dailyStats]);

  const maxEmployeeRevenue = useMemo(() => {
    if (!stats?.employeeStats) return 0;
    return Math.max(...stats.employeeStats.map(e => e.revenue));
  }, [stats?.employeeStats]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
            <BarChart3 className={`h-6 w-6 text-${themeColor}-600`} />
          </div>
          <h1 className="text-2xl font-bold">{txt.statistics}</h1>
        </div>
        <Button variant="outline" onClick={handleExportCSV} className="gap-2">
          <Download className="h-4 w-4" />
          {txt.exportCSV}
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {txt.filters}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>{txt.dateFrom}</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label>{txt.dateTo}</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label>{txt.employee}</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={txt.allEmployees} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{txt.allEmployees}</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp} value={emp}>{emp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {txt.reset}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !stats || stats.totalOrders === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">{txt.noData}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Main Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Total Orders */}
            <Card className={`border-l-4 border-l-${themeColor}-500`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{txt.totalOrders}</p>
                    <p className="text-3xl font-bold">{stats.totalOrders}</p>
                  </div>
                  <div className={`p-3 rounded-full bg-${themeColor}-100`}>
                    <ShoppingCart className={`h-6 w-6 text-${themeColor}-600`} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Revenue */}
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{txt.totalRevenue}</p>
                    <p className="text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                  </div>
                  <div className="p-3 rounded-full bg-green-100">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Average Check */}
            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{txt.averageCheck}</p>
                    <p className="text-3xl font-bold">{formatCurrency(stats.averageCheck)}</p>
                  </div>
                  <div className="p-3 rounded-full bg-purple-100">
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Period Comparison */}
          {stats.periodComparison && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">{txt.comparison}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{txt.currentPeriod} ({stats.periodComparison.periodDays} {txt.days})</span>
                      <span className="font-semibold">
                        {stats.periodComparison.currentPeriod.orders} {txt.orders}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{txt.previousPeriod}</span>
                      <span className="font-semibold">
                        {stats.periodComparison.previousPeriod.orders} {txt.orders}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{txt.change}</span>
                      <Badge variant={stats.periodComparison.ordersChange >= 0 ? 'default' : 'destructive'} className="gap-1">
                        {stats.periodComparison.ordersChange >= 0 ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {stats.periodComparison.ordersChange >= 0 ? '+' : ''}{stats.periodComparison.ordersChange}%
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{txt.revenue} ({txt.currentPeriod})</span>
                      <span className="font-semibold">{formatCurrency(stats.periodComparison.currentPeriod.revenue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{txt.revenue} ({txt.previousPeriod})</span>
                      <span className="font-semibold">{formatCurrency(stats.periodComparison.previousPeriod.revenue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{txt.change}</span>
                      <Badge variant={stats.periodComparison.revenueChange >= 0 ? 'default' : 'destructive'} className="gap-1">
                        {stats.periodComparison.revenueChange >= 0 ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {stats.periodComparison.revenueChange >= 0 ? '+' : ''}{stats.periodComparison.revenueChange}%
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Top Models */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Icon className={`h-5 w-5 text-${themeColor}-600`} />
                  {txt.topModels}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.topModels.map((model, index) => (
                    <div key={model.name} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium truncate pr-2">
                          {index + 1}. {model.name}
                        </span>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {model.count} {txt.orders} ({model.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-${themeColor}-500 rounded-full`}
                          style={{ width: `${model.percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {txt.revenue}: {formatCurrency(model.revenue)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Promotions Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gift className="h-5 w-5 text-red-500" />
                  {txt.promotions}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-full">
                        <Percent className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{txt.discount}</p>
                        <p className="text-sm text-muted-foreground">
                          {stats.promotionStats.discountPercentage}% {txt.orders}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">{stats.promotionStats.discount}</p>
                      <p className="text-xs text-muted-foreground">
                        {txt.totalDiscountSaved}: {formatCurrency(stats.promotionStats.totalDiscountAmount)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 rounded-full">
                        <Gift className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium">{txt.gift}</p>
                        <p className="text-sm text-muted-foreground">
                          {stats.promotionStats.giftPercentage}% {txt.orders}
                        </p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-red-600">{stats.promotionStats.gift}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Sales Chart */}
          {stats.dailyStats.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {txt.dailySales}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="min-w-[600px]">
                    <div className="flex items-end gap-1 h-48">
                      {stats.dailyStats.map((day) => {
                        const height = maxDailyRevenue > 0 ? (day.revenue / maxDailyRevenue * 100) : 0;
                        return (
                          <div key={day.date} className="flex-1 flex flex-col items-center group">
                            <div className="relative w-full">
                              <div 
                                className={`w-full bg-${themeColor}-500 rounded-t transition-all group-hover:bg-${themeColor}-600`}
                                style={{ height: `${Math.max(height, 2)}%`, minHeight: '4px' }}
                              />
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                {day.count} {txt.orders}<br/>
                                {formatCurrency(day.revenue)}
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground mt-1 -rotate-45 origin-top-left">
                              {day.date.slice(5)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Employee Stats */}
          {stats.employeeStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {txt.employeeStats}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.employeeStats.map((emp) => {
                    const widthPercent = maxEmployeeRevenue > 0 ? (emp.revenue / maxEmployeeRevenue * 100) : 0;
                    return (
                      <div key={emp.name} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full bg-${themeColor}-100 flex items-center justify-center`}>
                              <Users className={`h-4 w-4 text-${themeColor}-600`} />
                            </div>
                            <span className="font-medium">{emp.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrency(emp.revenue)}</p>
                            <p className="text-xs text-muted-foreground">
                              {emp.count} {txt.orders} • {txt.avgCheck}: {formatCurrency(emp.averageCheck)}
                            </p>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r from-${themeColor}-400 to-${themeColor}-600 rounded-full`}
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default StatisticsPage;
