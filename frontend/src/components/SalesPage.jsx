import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { 
  Plus, Pencil, Trash2, Upload, Download, Search, 
  Calendar, Users, DollarSign, TrendingUp, Calculator,
  FileSpreadsheet, RefreshCw, Filter, X, Percent
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Status badge colors
const statusColors = {
  'реализовано': 'bg-green-100 text-green-800',
  'в процессе': 'bg-blue-100 text-blue-800',
  'запланировано': 'bg-yellow-100 text-yellow-800',
  'отменено': 'bg-red-100 text-red-800',
  'новый': 'bg-gray-100 text-gray-800',
};

// Format currency
const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '-';
  return new Intl.NumberFormat('pl-PL', { 
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2 
  }).format(amount) + ' zł';
};

// Format date for display
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL');
  } catch {
    return dateStr;
  }
};

export const SalesPage = () => {
  const [sales, setSales] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState({ total_amount: 0, paid_amount: 0, remaining: 0 });
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterManager, setFilterManager] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Dialogs
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false);
  const [managerSettingsOpen, setManagerSettingsOpen] = useState(false);
  
  // Edit form
  const [editingSale, setEditingSale] = useState(null);
  const [formData, setFormData] = useState({
    order_id: '',
    product_name: '',
    client_name: '',
    total_amount: '',
    paid_amount: '',
    advance_amount: '',
    order_date: '',
    prepayment_terms: '',
    payment_method: '',
    delivery_date: '',
    status: 'новый',
    manager: '',
    notes: ''
  });
  
  // Bonus calculation
  const [bonusData, setBonusData] = useState(null);
  const [bonusStartDate, setBonusStartDate] = useState('');
  const [bonusEndDate, setBonusEndDate] = useState('');
  const [bonusManager, setBonusManager] = useState('');
  
  // Manager settings
  const [newManagerName, setNewManagerName] = useState('');
  const [newManagerPercent, setNewManagerPercent] = useState(5);

  // Fetch sales
  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (filterManager) params.append('manager', filterManager);
      if (filterStatus) params.append('status', filterStatus);
      
      const response = await axios.get(`${API_URL}/api/sales?${params.toString()}`);
      setSales(response.data.sales || []);
      setTotals(response.data.totals || { total_amount: 0, paid_amount: 0, remaining: 0 });
    } catch (error) {
      console.error('Error fetching sales:', error);
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterManager, filterStatus]);

  // Fetch managers
  const fetchManagers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sales/managers`);
      setManagers(response.data.managers || []);
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  useEffect(() => {
    fetchSales();
    fetchManagers();
  }, [fetchSales]);

  // Get unique managers from sales
  const uniqueManagers = [...new Set(sales.map(s => s.manager).filter(Boolean))];

  // Handle save sale
  const handleSaveSale = async () => {
    try {
      const payload = {
        ...formData,
        total_amount: parseFloat(formData.total_amount) || 0,
        paid_amount: parseFloat(formData.paid_amount) || 0,
        advance_amount: parseFloat(formData.advance_amount) || 0,
      };
      
      if (editingSale) {
        await axios.put(`${API_URL}/api/sales/${editingSale.id}`, payload);
        toast.success('Запись обновлена');
      } else {
        await axios.post(`${API_URL}/api/sales`, payload);
        toast.success('Запись добавлена');
      }
      
      setEditDialogOpen(false);
      setEditingSale(null);
      resetForm();
      fetchSales();
    } catch (error) {
      console.error('Error saving sale:', error);
      toast.error('Ошибка сохранения');
    }
  };

  // Handle delete
  const handleDelete = async (saleId) => {
    if (!window.confirm('Удалить эту запись?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/sales/${saleId}`);
      toast.success('Запись удалена');
      fetchSales();
    } catch (error) {
      console.error('Error deleting sale:', error);
      toast.error('Ошибка удаления');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      order_id: '',
      product_name: '',
      client_name: '',
      total_amount: '',
      paid_amount: '',
      advance_amount: '',
      order_date: '',
      prepayment_terms: '',
      payment_method: '',
      delivery_date: '',
      status: 'новый',
      manager: '',
      notes: ''
    });
  };

  // Open edit dialog
  const openEditDialog = (sale = null) => {
    if (sale) {
      setEditingSale(sale);
      setFormData({
        order_id: sale.order_id || '',
        product_name: sale.product_name || '',
        client_name: sale.client_name || '',
        total_amount: sale.total_amount || '',
        paid_amount: sale.paid_amount || '',
        advance_amount: sale.advance_amount || '',
        order_date: sale.order_date || '',
        prepayment_terms: sale.prepayment_terms || '',
        payment_method: sale.payment_method || '',
        delivery_date: sale.delivery_date || '',
        status: sale.status || 'новый',
        manager: sale.manager || '',
        notes: sale.notes || ''
      });
    } else {
      setEditingSale(null);
      resetForm();
    }
    setEditDialogOpen(true);
  };

  // Handle Excel import
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/sales/import-excel`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(`Импортировано: ${response.data.imported} записей`);
      if (response.data.skipped > 0) {
        toast.info(`Пропущено: ${response.data.skipped} пустых строк`);
      }
      
      setImportDialogOpen(false);
      fetchSales();
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error.response?.data?.detail || 'Ошибка импорта');
    } finally {
      setLoading(false);
    }
  };

  // Calculate bonus
  const handleCalculateBonus = async () => {
    if (!bonusStartDate || !bonusEndDate) {
      toast.error('Выберите период');
      return;
    }
    
    try {
      const params = new URLSearchParams({
        start_date: bonusStartDate,
        end_date: bonusEndDate
      });
      if (bonusManager) params.append('manager', bonusManager);
      
      const response = await axios.get(`${API_URL}/api/sales/bonus-calculation?${params.toString()}`);
      setBonusData(response.data);
    } catch (error) {
      console.error('Error calculating bonus:', error);
      toast.error('Ошибка расчёта');
    }
  };

  // Save manager settings
  const handleSaveManager = async () => {
    if (!newManagerName) return;
    
    try {
      await axios.post(`${API_URL}/api/sales/managers`, {
        manager_name: newManagerName,
        bonus_percent: parseFloat(newManagerPercent) || 5
      });
      toast.success('Настройки сохранены');
      fetchManagers();
      setNewManagerName('');
      setNewManagerPercent(5);
    } catch (error) {
      console.error('Error saving manager:', error);
      toast.error('Ошибка сохранения');
    }
  };

  // Delete manager
  const handleDeleteManager = async (name) => {
    try {
      await axios.delete(`${API_URL}/api/sales/managers/${encodeURIComponent(name)}`);
      toast.success('Удалено');
      fetchManagers();
    } catch (error) {
      console.error('Error deleting manager:', error);
    }
  };

  // Clear filters
  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setFilterManager('');
    setFilterStatus('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Продажи</h1>
            <p className="text-slate-500">Управление заказами и расчёт бонусов</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setImportDialogOpen(true)} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Импорт Excel
            </Button>
            <Button onClick={() => setBonusDialogOpen(true)} variant="outline" className="text-green-600 border-green-300 hover:bg-green-50">
              <Calculator className="h-4 w-4 mr-2" />
              Расчёт бонуса
            </Button>
            <Button onClick={() => setManagerSettingsOpen(true)} variant="outline">
              <Percent className="h-4 w-4 mr-2" />
              Проценты
            </Button>
            <Button onClick={() => openEditDialog()} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Добавить
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Всего заказов</p>
                  <p className="text-2xl font-bold text-slate-800">{sales.length}</p>
                </div>
                <FileSpreadsheet className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-l-4 border-l-green-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Общая сумма</p>
                  <p className="text-2xl font-bold text-slate-800">{formatCurrency(totals.total_amount)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-l-4 border-l-yellow-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Оплачено</p>
                  <p className="text-2xl font-bold text-slate-800">{formatCurrency(totals.paid_amount)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-l-4 border-l-red-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Остаток к оплате</p>
                  <p className="text-2xl font-bold text-slate-800">{formatCurrency(totals.remaining)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-white">
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs text-slate-500">Дата от</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs text-slate-500">Дата до</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs text-slate-500">Менеджер</Label>
                <Select value={filterManager} onValueChange={setFilterManager}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Все" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Все</SelectItem>
                    {uniqueManagers.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs text-slate-500">Статус</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Все" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Все</SelectItem>
                    <SelectItem value="реализовано">Реализовано</SelectItem>
                    <SelectItem value="в процессе">В процессе</SelectItem>
                    <SelectItem value="запланировано">Запланировано</SelectItem>
                    <SelectItem value="новый">Новый</SelectItem>
                    <SelectItem value="отменено">Отменено</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={fetchSales} variant="outline" size="icon">
                  <Search className="h-4 w-4" />
                </Button>
                <Button onClick={clearFilters} variant="ghost" size="icon">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Table */}
        <Card className="bg-white">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">ID</TableHead>
                    <TableHead className="font-semibold">Наименование</TableHead>
                    <TableHead className="font-semibold">Клиент</TableHead>
                    <TableHead className="font-semibold text-right">Сумма</TableHead>
                    <TableHead className="font-semibold text-right">Оплачено</TableHead>
                    <TableHead className="font-semibold">Дата заказа</TableHead>
                    <TableHead className="font-semibold">Статус</TableHead>
                    <TableHead className="font-semibold">Менеджер</TableHead>
                    <TableHead className="font-semibold text-center">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                        {loading ? 'Загрузка...' : 'Нет данных'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales.map((sale) => (
                      <TableRow key={sale.id} className="hover:bg-slate-50">
                        <TableCell className="font-mono text-xs text-slate-500">
                          {sale.order_id?.slice(0, 12) || sale.id?.slice(0, 8)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={sale.product_name}>
                          {sale.product_name}
                        </TableCell>
                        <TableCell>{sale.client_name}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(sale.total_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(sale.paid_amount)}
                        </TableCell>
                        <TableCell>{formatDate(sale.order_date)}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[sale.status] || 'bg-gray-100'}>
                            {sale.status || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell>{sale.manager || '-'}</TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(sale)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-500 hover:text-red-700"
                              onClick={() => handleDelete(sale.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSale ? 'Редактировать запись' : 'Новая запись'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2">
                <Label>Наименование *</Label>
                <Input
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  placeholder="Сауна 2.5м, Бочка и т.д."
                />
              </div>
              <div>
                <Label>Клиент *</Label>
                <Input
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  placeholder="Имя клиента"
                />
              </div>
              <div>
                <Label>Менеджер *</Label>
                <Input
                  value={formData.manager}
                  onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                  placeholder="Имя менеджера"
                />
              </div>
              <div>
                <Label>Сумма (zł)</Label>
                <Input
                  type="number"
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Оплачено (zł)</Label>
                <Input
                  type="number"
                  value={formData.paid_amount}
                  onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Аванс (zł)</Label>
                <Input
                  type="number"
                  value={formData.advance_amount}
                  onChange={(e) => setFormData({ ...formData, advance_amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Дата заказа</Label>
                <Input
                  type="date"
                  value={formData.order_date}
                  onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Дата сдачи</Label>
                <Input
                  type="date"
                  value={formData.delivery_date}
                  onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Статус</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="новый">Новый</SelectItem>
                    <SelectItem value="в процессе">В процессе</SelectItem>
                    <SelectItem value="запланировано">Запланировано</SelectItem>
                    <SelectItem value="реализовано">Реализовано</SelectItem>
                    <SelectItem value="отменено">Отменено</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Метод оплаты</Label>
                <Input
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  placeholder="Наличка, перевод..."
                />
              </div>
              <div className="col-span-2">
                <Label>Условия предоплаты</Label>
                <Input
                  value={formData.prepayment_terms}
                  onChange={(e) => setFormData({ ...formData, prepayment_terms: e.target.value })}
                  placeholder="30% депозит / 70% наличка"
                />
              </div>
              <div className="col-span-2">
                <Label>Примечания</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Дополнительная информация"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Отмена</Button>
              <Button onClick={handleSaveSale}>Сохранить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Импорт из Excel</DialogTitle>
              <DialogDescription>
                Загрузите файл Excel (.xlsx) с данными о продажах
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-10 w-10 mx-auto mb-4 text-slate-400" />
                <p className="text-sm text-slate-500 mb-4">
                  Перетащите файл или нажмите для выбора
                </p>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImport}
                  className="max-w-[200px] mx-auto"
                />
              </div>
              <div className="mt-4 text-xs text-slate-500">
                <p className="font-medium mb-1">Ожидаемые колонки:</p>
                <p>наименование, клиент, сумма, внесено, дата заказа, статус заказа, менеджер</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bonus Calculation Dialog */}
        <Dialog open={bonusDialogOpen} onOpenChange={setBonusDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Расчёт бонуса менеджера</DialogTitle>
              <DialogDescription>
                Бонус рассчитывается от общей суммы продаж за период
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Дата от *</Label>
                  <Input
                    type="date"
                    value={bonusStartDate}
                    onChange={(e) => setBonusStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Дата до *</Label>
                  <Input
                    type="date"
                    value={bonusEndDate}
                    onChange={(e) => setBonusEndDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Менеджер</Label>
                  <Select value={bonusManager} onValueChange={setBonusManager}>
                    <SelectTrigger>
                      <SelectValue placeholder="Все" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Все</SelectItem>
                      {uniqueManagers.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Button onClick={handleCalculateBonus} className="w-full">
                <Calculator className="h-4 w-4 mr-2" />
                Рассчитать
              </Button>
              
              {bonusData && (
                <div className="mt-6 space-y-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-500 mb-2">
                      Период: {bonusData.period.start} — {bonusData.period.end}
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-500">Общие продажи</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(bonusData.totals.total_sales)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Общий бонус</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {formatCurrency(bonusData.totals.total_bonus)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Менеджер</TableHead>
                        <TableHead className="text-right">Заказов</TableHead>
                        <TableHead className="text-right">Продажи</TableHead>
                        <TableHead className="text-right">%</TableHead>
                        <TableHead className="text-right">Бонус</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bonusData.bonuses.map((b, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{b.manager}</TableCell>
                          <TableCell className="text-right">{b.order_count}</TableCell>
                          <TableCell className="text-right">{formatCurrency(b.total_sales)}</TableCell>
                          <TableCell className="text-right">{b.bonus_percent}%</TableCell>
                          <TableCell className="text-right font-bold text-green-600">
                            {formatCurrency(b.bonus_amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Manager Settings Dialog */}
        <Dialog open={managerSettingsOpen} onOpenChange={setManagerSettingsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Настройки процентов менеджеров</DialogTitle>
              <DialogDescription>
                Укажите процент от продаж для каждого менеджера
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Add new manager */}
              <div className="flex gap-2">
                <Input
                  placeholder="Имя менеджера"
                  value={newManagerName}
                  onChange={(e) => setNewManagerName(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="%"
                  value={newManagerPercent}
                  onChange={(e) => setNewManagerPercent(e.target.value)}
                  className="w-20"
                />
                <Button onClick={handleSaveManager}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Existing managers */}
              <div className="space-y-2">
                {managers.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium">{m.manager_name}</p>
                      <p className="text-sm text-slate-500">{m.bonus_percent}% от продаж</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-500"
                      onClick={() => handleDeleteManager(m.manager_name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {managers.length === 0 && (
                  <p className="text-center text-slate-500 py-4">
                    Нет настроек. По умолчанию используется 5%.
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
};

export default SalesPage;
