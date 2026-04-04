import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { 
  Plus, Edit, Trash2, Filter, Download, Upload, Calculator, 
  Users, TrendingUp, Calendar, DollarSign, Loader2, RefreshCw,
  FileSpreadsheet, Percent, Award
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const STATUS_COLORS = {
  'запланировано': 'bg-blue-100 text-blue-800',
  'в процессе': 'bg-yellow-100 text-yellow-800',
  'реализовано': 'bg-green-100 text-green-800',
  'ожидается информация': 'bg-orange-100 text-orange-800',
  'отменено': 'bg-red-100 text-red-800',
};

const EMPTY_RECORD = {
  orderNumber: '',
  productName: '',
  clientName: '',
  totalAmount: 0,
  paidAmount: 0,
  advanceZl: 0,
  orderDate: new Date().toISOString().split('T')[0],
  prepaymentDate: '',
  prepaymentTerms: '',
  paymentMethod: '',
  deliveryDate: '',
  status: 'запланировано',
  manager: '',
  material: '',
  door: '',
  glass: '',
  woodenDoor: '',
  panorama: '',
  tray: '',
  boiler: '',
  notes: '',
};

export const SalesTrackingPage = () => {
  const [activeTab, setActiveTab] = useState('records');
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [managers, setManagers] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  
  // Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    manager: '',
    status: '',
  });
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState(EMPTY_RECORD);
  
  // Statistics state
  const [statistics, setStatistics] = useState(null);
  const [statsFilters, setStatsFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    manager: '',
  });
  
  // Bonus calculation state
  const [bonusCalc, setBonusCalc] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    manager: '',
    bonusPercent: 5,
  });
  const [bonusResult, setBonusResult] = useState(null);
  
  // Bonus settings state
  const [bonusSettings, setBonusSettings] = useState([]);

  // Fetch records
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.manager) params.append('manager', filters.manager);
      if (filters.status) params.append('status', filters.status);
      
      const response = await axios.get(`${API_URL}/api/sales-tracking/records?${params.toString()}`);
      setRecords(response.data.records || []);
      setTotalRecords(response.data.total || 0);
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch managers
  const fetchManagers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sales-tracking/managers`);
      setManagers(response.data.managers || []);
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  // Fetch statuses
  const fetchStatuses = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sales-tracking/statuses`);
      setStatuses(response.data.statuses || []);
    } catch (error) {
      console.error('Error fetching statuses:', error);
    }
  };

  // Fetch bonus settings
  const fetchBonusSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sales-tracking/bonus-settings`);
      setBonusSettings(response.data.settings || []);
    } catch (error) {
      console.error('Error fetching bonus settings:', error);
    }
  };

  // Fetch statistics
  const fetchStatistics = async () => {
    if (!statsFilters.startDate || !statsFilters.endDate) {
      toast.error('Выберите диапазон дат');
      return;
    }
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: statsFilters.startDate,
        endDate: statsFilters.endDate,
      });
      if (statsFilters.manager) params.append('manager', statsFilters.manager);
      
      const response = await axios.get(`${API_URL}/api/sales-tracking/statistics?${params.toString()}`);
      setStatistics(response.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      toast.error('Ошибка загрузки статистики');
    } finally {
      setLoading(false);
    }
  };

  // Calculate bonus
  const calculateBonus = async () => {
    if (!bonusCalc.startDate || !bonusCalc.endDate || !bonusCalc.manager) {
      toast.error('Заполните все поля');
      return;
    }
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: bonusCalc.startDate,
        endDate: bonusCalc.endDate,
        manager: bonusCalc.manager,
        bonusPercent: bonusCalc.bonusPercent.toString(),
      });
      
      const response = await axios.get(`${API_URL}/api/sales-tracking/bonus-calculation?${params.toString()}`);
      setBonusResult(response.data);
    } catch (error) {
      console.error('Error calculating bonus:', error);
      toast.error('Ошибка расчета бонуса');
    } finally {
      setLoading(false);
    }
  };

  // Save record
  const handleSave = async () => {
    if (!formData.productName || !formData.clientName || !formData.manager) {
      toast.error('Заполните обязательные поля');
      return;
    }
    
    setLoading(true);
    try {
      if (editingRecord) {
        await axios.put(`${API_URL}/api/sales-tracking/records/${editingRecord.id || editingRecord.orderNumber}`, formData);
        toast.success('Запись обновлена');
      } else {
        await axios.post(`${API_URL}/api/sales-tracking/records`, formData);
        toast.success('Запись создана');
      }
      setDialogOpen(false);
      setEditingRecord(null);
      setFormData(EMPTY_RECORD);
      fetchRecords();
      fetchManagers();
    } catch (error) {
      console.error('Error saving record:', error);
      toast.error('Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  // Delete record
  const handleDelete = async (record) => {
    if (!window.confirm('Удалить запись?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/sales-tracking/records/${record.id || record.orderNumber}`);
      toast.success('Запись удалена');
      fetchRecords();
    } catch (error) {
      console.error('Error deleting record:', error);
      toast.error('Ошибка удаления');
    }
  };

  // Open edit dialog
  const openEditDialog = (record) => {
    setEditingRecord(record);
    setFormData({ ...EMPTY_RECORD, ...record });
    setDialogOpen(true);
  };

  // Open create dialog
  const openCreateDialog = () => {
    setEditingRecord(null);
    setFormData(EMPTY_RECORD);
    setDialogOpen(true);
  };

  // Save bonus settings for manager
  const saveBonusSettings = async (managerName, percent) => {
    try {
      await axios.post(`${API_URL}/api/sales-tracking/bonus-settings`, {
        managerId: managerName.toLowerCase().replace(/\s+/g, '_'),
        managerName: managerName,
        bonusPercent: percent,
      });
      toast.success('Настройки бонуса сохранены');
      fetchBonusSettings();
    } catch (error) {
      console.error('Error saving bonus settings:', error);
      toast.error('Ошибка сохранения');
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchManagers();
    fetchStatuses();
    fetchBonusSettings();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          Учет продаж
        </h1>
        <Badge variant="outline" className="text-sm">
          Только для администраторов
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="records" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Записи продаж
          </TabsTrigger>
          <TabsTrigger value="statistics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Статистика
          </TabsTrigger>
          <TabsTrigger value="bonus" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Расчет бонуса
          </TabsTrigger>
        </TabsList>

        {/* RECORDS TAB */}
        <TabsContent value="records" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Фильтры
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <Label className="text-xs">Дата от</Label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Дата до</Label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Менеджер</Label>
                  <Select value={filters.manager} onValueChange={(v) => setFilters({ ...filters, manager: v === 'all' ? '' : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Все" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все</SelectItem>
                      {managers.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Статус</Label>
                  <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v === 'all' ? '' : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Все" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все</SelectItem>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={fetchRecords} size="sm">
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Обновить
                  </Button>
                  <Button onClick={async () => {
                    try {
                      const res = await axios.post(`${API_URL}/api/sales/sync-from-crm`);
                      toast.success(`Синхронизировано: ${res.data.imported} новых, ${res.data.updated} обновлено`);
                      fetchRecords();
                    } catch (e) { toast.error('Ошибка синхронизации'); }
                  }} size="sm" variant="outline" data-testid="sales-sync-crm-btn">
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Из CRM
                  </Button>
                  <Button onClick={openCreateDialog} size="sm" variant="default">
                    <Plus className="h-4 w-4 mr-1" />
                    Добавить
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Records Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">№</TableHead>
                      <TableHead>Наименование</TableHead>
                      <TableHead>Клиент</TableHead>
                      <TableHead className="text-right">Сумма</TableHead>
                      <TableHead>Дата аванса</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Менеджер</TableHead>
                      <TableHead className="w-[100px]">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : records.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Нет записей
                        </TableCell>
                      </TableRow>
                    ) : (
                      records.map((record, idx) => (
                        <TableRow key={record.id || idx}>
                          <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={record.productName}>
                            {record.productName}
                          </TableCell>
                          <TableCell>{record.clientName}</TableCell>
                          <TableCell className="text-right font-medium">
                            {record.totalAmount?.toLocaleString()} zł
                          </TableCell>
                          <TableCell>{record.prepaymentDate?.slice(0, 10) || record.orderDate}</TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[record.status] || 'bg-gray-100'}>
                              {record.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{record.manager}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEditDialog(record)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(record)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="p-3 border-t text-sm text-muted-foreground">
                Всего записей: {totalRecords}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* STATISTICS TAB */}
        <TabsContent value="statistics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Статистика продаж
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label>Дата от</Label>
                  <Input
                    type="date"
                    value={statsFilters.startDate}
                    onChange={(e) => setStatsFilters({ ...statsFilters, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Дата до</Label>
                  <Input
                    type="date"
                    value={statsFilters.endDate}
                    onChange={(e) => setStatsFilters({ ...statsFilters, endDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Менеджер</Label>
                  <Select value={statsFilters.manager} onValueChange={(v) => setStatsFilters({ ...statsFilters, manager: v === 'all' ? '' : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Все менеджеры" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все менеджеры</SelectItem>
                      {managers.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={fetchStatistics} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calculator className="h-4 w-4 mr-2" />}
                    Рассчитать
                  </Button>
                </div>
              </div>

              {statistics && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-green-50">
                      <CardContent className="p-4 text-center">
                        <DollarSign className="h-8 w-8 mx-auto text-green-600" />
                        <p className="text-2xl font-bold text-green-700">{statistics.summary.totalSales?.toLocaleString()} zł</p>
                        <p className="text-sm text-muted-foreground">Общая сумма продаж</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-50">
                      <CardContent className="p-4 text-center">
                        <Award className="h-8 w-8 mx-auto text-blue-600" />
                        <p className="text-2xl font-bold text-blue-700">{statistics.summary.totalBonus?.toLocaleString()} zł</p>
                        <p className="text-sm text-muted-foreground">Общий бонус</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-50">
                      <CardContent className="p-4 text-center">
                        <Users className="h-8 w-8 mx-auto text-purple-600" />
                        <p className="text-2xl font-bold text-purple-700">{statistics.summary.managersCount}</p>
                        <p className="text-sm text-muted-foreground">Менеджеров</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* By Manager */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Менеджер</TableHead>
                        <TableHead className="text-right">Всего продаж</TableHead>
                        <TableHead className="text-right">Реализовано</TableHead>
                        <TableHead className="text-right">Заказов</TableHead>
                        <TableHead className="text-right">Завершено</TableHead>
                        <TableHead className="text-right">% бонуса</TableHead>
                        <TableHead className="text-right">Бонус</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statistics.statistics.map((stat) => (
                        <TableRow key={stat.manager}>
                          <TableCell className="font-medium">{stat.manager}</TableCell>
                          <TableCell className="text-right">{stat.totalSales?.toLocaleString()} zł</TableCell>
                          <TableCell className="text-right">{stat.completedSales?.toLocaleString()} zł</TableCell>
                          <TableCell className="text-right">{stat.ordersCount}</TableCell>
                          <TableCell className="text-right">{stat.completedOrders}</TableCell>
                          <TableCell className="text-right">{stat.bonusPercent}%</TableCell>
                          <TableCell className="text-right font-bold text-green-600">
                            {stat.bonusAmount?.toLocaleString()} zł
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BONUS CALCULATION TAB */}
        <TabsContent value="bonus" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Bonus Calculator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Расчет бонуса менеджера
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Дата от</Label>
                    <Input
                      type="date"
                      value={bonusCalc.startDate}
                      onChange={(e) => setBonusCalc({ ...bonusCalc, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Дата до</Label>
                    <Input
                      type="date"
                      value={bonusCalc.endDate}
                      onChange={(e) => setBonusCalc({ ...bonusCalc, endDate: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Менеджер</Label>
                  <Select value={bonusCalc.manager} onValueChange={(v) => setBonusCalc({ ...bonusCalc, manager: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите менеджера" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Процент с продажи (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={bonusCalc.bonusPercent}
                    onChange={(e) => setBonusCalc({ ...bonusCalc, bonusPercent: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <Button onClick={calculateBonus} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calculator className="h-4 w-4 mr-2" />}
                  Рассчитать бонус
                </Button>

                {bonusResult && (
                  <div className="mt-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <div className="text-center space-y-2">
                      <p className="text-sm text-muted-foreground">Бонус для {bonusResult.manager}</p>
                      <p className="text-4xl font-bold text-green-600">
                        {bonusResult.bonusAmount?.toLocaleString()} zł
                      </p>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Завершенных заказов: {bonusResult.completedOrders}</p>
                        <p>Сумма продаж: {bonusResult.totalSales?.toLocaleString()} zł</p>
                        <p>Процент: {bonusResult.bonusPercent}%</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bonus Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Настройки % бонуса по менеджерам
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {managers.map((manager) => {
                    const setting = bonusSettings.find(s => s.managerName === manager);
                    return (
                      <div key={manager} className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 font-medium">{manager}</span>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          className="w-20"
                          defaultValue={setting?.bonusPercent || 5}
                          onBlur={(e) => saveBonusSettings(manager, parseFloat(e.target.value) || 5)}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    );
                  })}
                  {managers.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      Добавьте записи продаж, чтобы увидеть менеджеров
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? 'Редактировать запись' : 'Новая запись продажи'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label>Наименование продукта *</Label>
              <Input
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                placeholder="Сауна 2x2, Бочка 3.5m и т.д."
              />
            </div>
            
            <div>
              <Label>Клиент *</Label>
              <Input
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
              />
            </div>
            
            <div>
              <Label>Менеджер *</Label>
              <Input
                value={formData.manager}
                onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                list="managers-list"
              />
              <datalist id="managers-list">
                {managers.map((m) => <option key={m} value={m} />)}
              </datalist>
            </div>
            
            <div>
              <Label>Сумма (zł)</Label>
              <Input
                type="number"
                value={formData.totalAmount}
                onChange={(e) => setFormData({ ...formData, totalAmount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            
            <div>
              <Label>Оплачено (zł)</Label>
              <Input
                type="number"
                value={formData.paidAmount}
                onChange={(e) => setFormData({ ...formData, paidAmount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            
            <div>
              <Label>Аванс (zł)</Label>
              <Input
                type="number"
                value={formData.advanceZl}
                onChange={(e) => setFormData({ ...formData, advanceZl: parseFloat(e.target.value) || 0 })}
              />
            </div>
            
            <div>
              <Label>Дата заказа</Label>
              <Input
                type="date"
                value={formData.orderDate}
                onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
              />
            </div>
            
            <div>
              <Label>Дата сдачи</Label>
              <Input
                type="date"
                value={formData.deliveryDate}
                onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
              />
            </div>
            
            <div>
              <Label>Статус</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Условия предоплаты</Label>
              <Input
                value={formData.prepaymentTerms}
                onChange={(e) => setFormData({ ...formData, prepaymentTerms: e.target.value })}
                placeholder="30% депозит / 70% наличка"
              />
            </div>
            
            <div>
              <Label>Метод оплаты</Label>
              <Input
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                placeholder="Наличка, Перевод и т.д."
              />
            </div>
            
            <div>
              <Label>Материал</Label>
              <Input
                value={formData.material}
                onChange={(e) => setFormData({ ...formData, material: e.target.value })}
              />
            </div>
            
            <div className="col-span-2">
              <Label>Примечания</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingRecord ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesTrackingPage;
