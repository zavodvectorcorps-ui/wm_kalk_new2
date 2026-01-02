import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { FileDown, Eye, Package, Flame, Search, Trash2, X, FileText, Gift, Percent, UserCircle, Wrench, Download, Edit, Shield, Calculator, ChevronLeft, ChevronRight, Calendar, Waves, Filter } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { TechSpecModal } from './tech-spec';
import { OrderPreviewModal } from './OrderPreviewModal';
import { OrderFullEditModal } from './OrderFullEditModal';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const AdminOrdersPage = ({ onEditInCalculator }) => {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const [baliaOrders, setBaliaOrders] = useState([]);
  const [saunaOrders, setSaunaOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'balia', 'sauna'
  
  // Modal states
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [techSpecModalOpen, setTechSpecModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  
  // Date filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 10;

  // Translations
  const texts = {
    ru: {
      title: 'Все заказы',
      searchPlaceholder: 'Поиск по номеру, имени или телефону...',
      noOrders: 'Заказов пока нет',
      noResults: 'Ничего не найдено',
      all: 'Все',
      balia: 'Купели',
      sauna: 'Сауны',
      type: 'Тип',
      dateFrom: 'Дата от',
      dateTo: 'Дата до',
      clearFilters: 'Сбросить',
      page: 'Страница',
      of: 'из',
      showing: 'Показано',
      ordersCount: 'заказов',
      edit: 'Редактировать',
      preview: 'Просмотр',
      techSpec: 'Тех.Задание',
      downloadPdf: 'Скачать PDF',
      delete: 'Удалить',
      confirmDelete: 'Удалить этот заказ?',
      orderDeleted: 'Заказ удалён',
      pdfGenerated: 'PDF создан',
      discount: 'Скидка',
      gift: 'Подарок',
      requestedDiscount: 'Запрошена скидка',
      adminDiscount: 'Скидка одобрена',
    },
    pl: {
      title: 'Wszystkie zamówienia',
      searchPlaceholder: 'Szukaj po numerze, nazwisku lub telefonie...',
      noOrders: 'Brak zamówień',
      noResults: 'Nic nie znaleziono',
      all: 'Wszystkie',
      balia: 'Balie',
      sauna: 'Sauny',
      type: 'Typ',
      dateFrom: 'Data od',
      dateTo: 'Data do',
      clearFilters: 'Wyczyść',
      page: 'Strona',
      of: 'z',
      showing: 'Pokazano',
      ordersCount: 'zamówień',
      edit: 'Edytuj',
      preview: 'Podgląd',
      techSpec: 'Spec. Tech.',
      downloadPdf: 'Pobierz PDF',
      delete: 'Usuń',
      confirmDelete: 'Usunąć to zamówienie?',
      orderDeleted: 'Zamówienie usunięte',
      pdfGenerated: 'PDF został wygenerowany',
      discount: 'Rabat',
      gift: 'Prezent',
      requestedDiscount: 'Wnioskowany rabat',
      adminDiscount: 'Rabat zatwierdzony',
    },
  };

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  // Fetch all orders
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const [baliaRes, saunaRes] = await Promise.all([
          axios.get(`${API_URL}/api/orders`),
          axios.get(`${API_URL}/api/sauna/orders`)
        ]);
        
        // Add type to each order
        const baliaWithType = (baliaRes.data || []).map(order => ({ ...order, _type: 'balia' }));
        const saunaWithType = (saunaRes.data || []).map(order => ({ ...order, _type: 'sauna' }));
        
        setBaliaOrders(baliaWithType);
        setSaunaOrders(saunaWithType);
      } catch (error) {
        console.error('Error fetching orders:', error);
        toast.error(t('error'));
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [t]);

  // Combine and filter orders
  const filteredAndSortedOrders = useMemo(() => {
    let allOrders = [...baliaOrders, ...saunaOrders];
    
    // Apply type filter
    if (typeFilter === 'balia') {
      allOrders = baliaOrders;
    } else if (typeFilter === 'sauna') {
      allOrders = saunaOrders;
    }
    
    // Apply text search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const queryNormalized = query.replace(/\s+/g, '');
      allOrders = allOrders.filter(order => {
        const orderId = (order.id || '').toLowerCase();
        const fullName = (order.fullName || '').toLowerCase();
        const phoneNumber = (order.phoneNumber || '').replace(/\s+/g, '').toLowerCase();
        return orderId.includes(query) || fullName.includes(query) || phoneNumber.includes(queryNormalized);
      });
    }
    
    // Apply date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      allOrders = allOrders.filter(order => {
        const orderDate = new Date(order.orderDate || order.createdAt);
        return orderDate >= fromDate;
      });
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      allOrders = allOrders.filter(order => {
        const orderDate = new Date(order.orderDate || order.createdAt);
        return orderDate <= toDate;
      });
    }
    
    // Sort by creation time - newest first
    allOrders.sort((a, b) => {
      const extractTimestamp = (order) => {
        const id = order.id || '';
        const match = id.match(/WM[SB]-(\d{2})-(\d{2})-(\d{4})-(\d{6})/);
        if (match) {
          const [, day, month, year, time] = match;
          const hours = time.substring(0, 2);
          const minutes = time.substring(2, 4);
          const seconds = time.substring(4, 6);
          return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}`).getTime();
        }
        if (order.createdAt) return new Date(order.createdAt).getTime();
        if (order.orderDate) return new Date(order.orderDate).getTime();
        return 0;
      };
      
      const timeA = extractTimestamp(a);
      const timeB = extractTimestamp(b);
      return timeB - timeA;
    });
    
    return allOrders;
  }, [baliaOrders, saunaOrders, searchQuery, dateFrom, dateTo, typeFilter]);
  
  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedOrders.length / ordersPerPage);
  const startIndex = (currentPage - 1) * ordersPerPage;
  const endIndex = startIndex + ordersPerPage;
  const paginatedOrders = filteredAndSortedOrders.slice(startIndex, endIndex);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateFrom, dateTo, typeFilter]);
  
  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setTypeFilter('all');
    setCurrentPage(1);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL');
  };

  const formatPrice = (price, currency = 'EUR') => {
    if (!price && price !== 0) return '-';
    return `${Number(price).toLocaleString('pl-PL')} ${currency}`;
  };

  // Handle PDF download
  const handleDownloadPDF = async (order) => {
    try {
      const isSauna = order._type === 'sauna';
      const endpoint = isSauna ? `${API_URL}/api/sauna/generate-pdf` : `${API_URL}/api/generate-pdf`;
      const response = await axios.post(endpoint, 
        { ...order, orderId: order.id, type: 'customer', language: 'pl' },
        { responseType: 'blob' }
      );

      let safeName = (order.fullName || 'Klient').replace(/\s+/g, '_');
      safeName = safeName.replace(/[<>:"/\\|?*]/g, '');
      if (!safeName || safeName === '_') safeName = 'Klient';
      const prefix = isSauna ? 'SAUNA' : 'BALIA';
      const filename = `${prefix}_${safeName}_${order.id}.pdf`;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(txt.pdfGenerated);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(t('error'));
    }
  };

  // Handle delete
  const handleDeleteOrder = async (order) => {
    if (!window.confirm(txt.confirmDelete)) return;
    
    try {
      const isSauna = order._type === 'sauna';
      const endpoint = isSauna 
        ? `${API_URL}/api/sauna/orders/${order.id}`
        : `${API_URL}/api/orders/${order.id}`;
      
      await axios.delete(endpoint);
      
      if (isSauna) {
        setSaunaOrders(prev => prev.filter(o => o.id !== order.id));
      } else {
        setBaliaOrders(prev => prev.filter(o => o.id !== order.id));
      }
      
      toast.success(txt.orderDeleted);
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error(t('error'));
    }
  };

  // Handle edit in calculator
  const handleEditInCalculator = (order) => {
    if (onEditInCalculator) {
      onEditInCalculator(order, order._type);
    }
  };

  // Handle quick edit (admin modal)
  const handleEditOrder = (order) => {
    setEditOrder(order);
    setEditModalOpen(true);
  };

  // Handle order saved from modal
  const handleOrderSaved = (updatedOrder) => {
    const isSauna = updatedOrder._type === 'sauna';
    if (isSauna) {
      setSaunaOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...updatedOrder, _type: 'sauna' } : o));
    } else {
      setBaliaOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...updatedOrder, _type: 'balia' } : o));
    }
    setEditModalOpen(false);
  };

  // Get type badge
  const getTypeBadge = (order) => {
    if (order._type === 'sauna') {
      return (
        <Badge className="bg-orange-100 text-orange-700 gap-1">
          <Flame className="w-3 h-3" />
          Sauna
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-100 text-blue-700 gap-1">
        <Waves className="w-3 h-3" />
        Balia
      </Badge>
    );
  };

  // Get row background class
  const getRowBgClass = (order) => {
    if (order._type === 'sauna') {
      return 'bg-orange-50/50 hover:bg-orange-100/50';
    }
    return 'bg-blue-50/50 hover:bg-blue-100/50';
  };

  // Check for discount status
  const getDiscountStatus = (order) => {
    const hasRequestedDiscount = order.requestedDiscount && order.requestedDiscount > 0;
    const hasAdminDiscount = order.adminDiscountApproved || (order.discountPercent && order.discountPercent > 10);
    const hasGifts = order.adminGifts && order.adminGifts.length > 0;
    
    return { hasRequestedDiscount, hasAdminDiscount, hasGifts };
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Card className="shadow-lg">
        <CardHeader className="bg-gradient-to-br from-purple-500/10 to-violet-500/10">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Shield className="h-6 w-6 text-purple-600" />
                {txt.title}
              </CardTitle>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {filteredAndSortedOrders.length}
              </Badge>
            </div>
            
            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Type Filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{txt.all}</SelectItem>
                  <SelectItem value="balia">
                    <div className="flex items-center gap-2">
                      <Waves className="w-4 h-4 text-blue-500" />
                      {txt.balia}
                    </div>
                  </SelectItem>
                  <SelectItem value="sauna">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-500" />
                      {txt.sauna}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={txt.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {/* Date Range Filters */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground hidden sm:block" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-36"
                  title={txt.dateFrom}
                />
                <span className="text-muted-foreground">—</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-36"
                  title={txt.dateTo}
                />
                {(searchQuery || dateFrom || dateTo || typeFilter !== 'all') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearFilters}
                    className="whitespace-nowrap"
                  >
                    <X className="h-4 w-4 mr-1" />
                    {txt.clearFilters}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
            </div>
          ) : filteredAndSortedOrders.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">{txt.noResults}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{txt.type}</TableHead>
                    <TableHead>{t('orderNumber')}</TableHead>
                    <TableHead>{t('customer')}</TableHead>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead className="text-right">{t('total')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.map((order, index) => {
                    const { hasRequestedDiscount, hasAdminDiscount, hasGifts } = getDiscountStatus(order);
                    const isSauna = order._type === 'sauna';
                    
                    return (
                      <TableRow key={`${order._type}-${order.id}-${index}`} className={getRowBgClass(order)}>
                        <TableCell>
                          {getTypeBadge(order)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {order.id || '-'}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.fullName || '-'}</div>
                            <div className="text-sm text-muted-foreground">{order.phoneNumber || '-'}</div>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(order.orderDate)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {hasGifts && (
                              <Gift className="w-4 h-4 text-emerald-500" title={txt.gift} />
                            )}
                            {hasRequestedDiscount && !hasAdminDiscount && (
                              <div className="relative" title={txt.requestedDiscount}>
                                <Percent className="w-4 h-4 text-amber-500" />
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                              </div>
                            )}
                            {hasAdminDiscount && (
                              <Shield className="w-4 h-4 text-purple-500" title={txt.adminDiscount} />
                            )}
                            <span className="font-bold">
                              {formatPrice(order.total, isSauna ? 'PLN' : (order.currency || 'EUR'))}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {/* Edit in Calculator */}
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleEditInCalculator(order)}
                              title={txt.edit}
                              className={isSauna ? 'bg-orange-500 hover:bg-orange-600' : ''}
                            >
                              <Calculator className="h-4 w-4 mr-1" />
                              {txt.edit}
                            </Button>
                            
                            {/* Quick Edit (Admin) */}
                            {isAdmin && isAdmin() && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditOrder(order)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {/* Preview */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedOrder(order);
                                setPreviewModalOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            
                            {/* Download PDF */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadPDF(order)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              PDF
                            </Button>
                            
                            {/* Tech Spec (Sauna only) */}
                            {isSauna && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setTechSpecModalOpen(true);
                                }}
                              >
                                <Wrench className="h-4 w-4 mr-1" />
                                {txt.techSpec}
                              </Button>
                            )}
                            
                            {/* Delete */}
                            {isAdmin && isAdmin() && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteOrder(order)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-2">
                  <div className="text-sm text-muted-foreground">
                    {txt.showing} {startIndex + 1}-{Math.min(endIndex, filteredAndSortedOrders.length)} {txt.of} {filteredAndSortedOrders.length} {txt.ordersCount}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm px-2">
                      {txt.page} {currentPage} {txt.of} {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <OrderPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        order={selectedOrder}
        isSauna={selectedOrder?._type === 'sauna'}
      />

      {/* Tech Spec Modal */}
      {selectedOrder && selectedOrder._type === 'sauna' && (
        <TechSpecModal
          open={techSpecModalOpen}
          onOpenChange={setTechSpecModalOpen}
          order={selectedOrder}
        />
      )}

      {/* Edit Modal */}
      <OrderFullEditModal
        key={editOrder?.id}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        order={editOrder}
        isSauna={editOrder?._type === 'sauna'}
        onSaved={handleOrderSaved}
      />
    </div>
  );
};
