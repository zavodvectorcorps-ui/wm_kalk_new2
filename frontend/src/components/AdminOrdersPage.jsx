import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Eye, Flame, Search, Trash2, Gift, Percent, Wrench, Download, Edit, Shield, Calculator, Waves } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { TechSpecModal } from './tech-spec';
import { OrderPreviewModal } from './OrderPreviewModal';
import { OrderFullEditModal } from './OrderFullEditModal';
import { OrderFilters, OrdersPagination } from './orders';
import { useOrdersFiltering } from '../hooks/useOrdersFiltering';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const AdminOrdersPage = ({ onEditInCalculator }) => {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [techSpecModalOpen, setTechSpecModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editOrder, setEditOrder] = useState(null);

  // Use filtering hook
  const {
    searchQuery,
    setSearchQuery,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    typeFilter,
    setTypeFilter,
    currentPage,
    setCurrentPage,
    filteredAndSortedOrders,
    paginatedOrders,
    totalPages,
    startIndex,
    endIndex,
    hasActiveFilters,
    clearFilters,
  } = useOrdersFiltering(allOrders);

  // Translations
  const texts = {
    ru: {
      title: 'Все заказы',
      noOrders: 'Заказов пока нет',
      noResults: 'Ничего не найдено',
      type: 'Тип',
      edit: 'Редактировать',
      preview: 'Просмотр',
      techSpec: 'Тех.Задание',
      downloadPdf: 'Скачать PDF',
      delete: 'Удалить',
      confirmDelete: 'Удалить этот заказ?',
      orderDeleted: 'Заказ удалён',
      pdfGenerated: 'PDF создан',
      gift: 'Подарок',
      requestedDiscount: 'Запрошена скидка',
      adminDiscount: 'Скидка одобрена',
    },
    pl: {
      title: 'Wszystkie zamówienia',
      noOrders: 'Brak zamówień',
      noResults: 'Nic nie znaleziono',
      type: 'Typ',
      edit: 'Edytuj',
      preview: 'Podgląd',
      techSpec: 'Spec. Tech.',
      downloadPdf: 'Pobierz PDF',
      delete: 'Usuń',
      confirmDelete: 'Usunąć to zamówienie?',
      orderDeleted: 'Zamówienie usunięte',
      pdfGenerated: 'PDF został wygenerowany',
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
        
        setAllOrders([...baliaWithType, ...saunaWithType]);
      } catch (error) {
        console.error('Error fetching orders:', error);
        toast.error(t('error'));
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [t]);

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
      setAllOrders(prev => prev.filter(o => o.id !== order.id));
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
    setAllOrders(prev => prev.map(o => 
      o.id === updatedOrder.id ? { ...updatedOrder, _type: o._type } : o
    ));
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
      <Card className="shadow-lg" data-testid="admin-orders-page-card">
        <CardHeader className="bg-gradient-to-br from-purple-500/10 to-violet-500/10">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Shield className="h-6 w-6 text-purple-600" />
                {txt.title}
              </CardTitle>
              <Badge variant="secondary" className="text-lg px-3 py-1" data-testid="admin-orders-count">
                {filteredAndSortedOrders.length}
              </Badge>
            </div>
            
            {/* Filters with type filter enabled */}
            <OrderFilters
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              dateFrom={dateFrom}
              setDateFrom={setDateFrom}
              dateTo={dateTo}
              setDateTo={setDateTo}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
              showTypeFilter={true}
            />
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
                      <TableRow key={`${order._type}-${order.id}-${index}`} className={getRowBgClass(order)} data-testid={`admin-order-row-${order.id}`}>
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
                              data-testid={`admin-edit-btn-${order.id}`}
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
                                data-testid={`admin-quick-edit-btn-${order.id}`}
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
                              data-testid={`admin-preview-btn-${order.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            
                            {/* Download PDF */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadPDF(order)}
                              data-testid={`admin-pdf-btn-${order.id}`}
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
                                data-testid={`admin-techspec-btn-${order.id}`}
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
                                data-testid={`admin-delete-btn-${order.id}`}
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
              <OrdersPagination
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                totalPages={totalPages}
                startIndex={startIndex}
                endIndex={endIndex}
                totalCount={filteredAndSortedOrders.length}
              />
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
        calculatorType={editOrder?._type === 'sauna' ? 'sauna' : 'balia'}
        onSaved={handleOrderSaved}
      />
    </div>
  );
};
