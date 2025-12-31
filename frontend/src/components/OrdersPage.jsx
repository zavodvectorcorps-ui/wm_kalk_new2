import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { FileDown, Eye, Package, Flame, Search, Trash2, X, FileText, Gift, Percent, UserCircle, Wrench, Download, Edit, Shield, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { TechSpecModal } from './tech-spec';
import { OrderPreviewModal } from './OrderPreviewModal';
import { OrderFullEditModal } from './OrderFullEditModal';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const OrdersPage = ({ calculatorType = 'balia', onEditInCalculator }) => {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tech Spec Modal state
  const [techSpecModalOpen, setTechSpecModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Preview Modal state
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewOrder, setPreviewOrder] = useState(null);
  
  // Edit Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editOrder, setEditOrder] = useState(null);

  const isSauna = calculatorType === 'sauna';

  // Translations
  const texts = {
    ru: {
      ordersList: isSauna ? 'Заказы саун' : 'Список заказов',
      noOrders: isSauna ? 'Заказов саун пока нет' : 'Заказов пока нет',
      searchPlaceholder: 'Поиск по номеру, имени или телефону...',
      deleteOrder: 'Удалить заказ',
      confirmDelete: 'Удалить этот заказ?',
      orderDeleted: 'Заказ удалён',
      noResults: 'Ничего не найдено',
      promo: 'Акция',
      gift: 'Подарок',
      discount: 'Скидка',
      createdBy: 'Сотрудник',
      preview: 'Просмотр',
      edit: 'Быстрое редактирование',
      editInCalculator: 'Редактировать в калькуляторе',
      adminDiscount: 'Скидка одобрена администратором',
      requestedDiscount: 'Запрошена скидка',
    },
    pl: {
      ordersList: isSauna ? 'Zamówienia saun' : 'Lista zamówień',
      noOrders: isSauna ? 'Brak zamówień saun' : 'Brak zamówień',
      searchPlaceholder: 'Szukaj po numerze, nazwisku lub telefonie...',
      deleteOrder: 'Usuń zamówienie',
      confirmDelete: 'Usunąć to zamówienie?',
      orderDeleted: 'Zamówienie usunięte',
      noResults: 'Nic nie znaleziono',
      promo: 'Promocja',
      gift: 'Prezent',
      discount: 'Rabat',
      createdBy: 'Pracownik',
      preview: 'Podgląd',
      edit: 'Szybka edycja',
      editInCalculator: 'Edytuj w kalkulatorze',
      adminDiscount: 'Rabat zatwierdzony przez administratora',
      requestedDiscount: 'Wnioskowany rabat',
    },
  };
  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  // Open preview modal
  const handlePreviewOrder = (order) => {
    setPreviewOrder(order);
    setPreviewModalOpen(true);
  };

  // Open edit modal (quick edit for customer data, discount, gifts)
  const handleEditOrder = (order) => {
    setEditOrder(order);
    setEditModalOpen(true);
  };
  
  // Open order in calculator for full editing (model, options change)
  const handleEditInCalculator = (order) => {
    if (onEditInCalculator) {
      onEditInCalculator(order);
    }
  };
  
  // Handle order saved from edit modal
  const handleOrderSaved = (updatedOrder) => {
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
  };

  useEffect(() => {
    fetchOrders();
  }, [calculatorType]);

  const fetchOrders = async () => {
    try {
      const endpoint = isSauna ? `${API_URL}/api/sauna/orders` : `${API_URL}/api/orders`;
      const response = await axios.get(endpoint);
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (order, type = 'customer') => {
    try {
      const endpoint = isSauna ? `${API_URL}/api/sauna/generate-pdf` : `${API_URL}/api/generate-pdf`;
      const response = await axios.post(endpoint, 
        { ...order, orderId: order.id, type, language: 'pl' },
        { responseType: 'blob' }
      );

      // Get filename from Content-Disposition header or use order ID
      let filename = `${order.id || 'order'}.pdf`;
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
        const match = contentDisposition.match(/filename=(.+\.pdf)/);
        if (match) {
          filename = match[1];
        }
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(t('pdfGenerated'));
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(t('error'));
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm(txt.confirmDelete)) return;
    
    try {
      const endpoint = isSauna 
        ? `${API_URL}/api/sauna/orders/${orderId}` 
        : `${API_URL}/api/orders/${orderId}`;
      await axios.delete(endpoint);
      setOrders(prev => prev.filter(o => o.id !== orderId));
      toast.success(txt.orderDeleted);
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error(t('error'));
    }
  };

  // Open Tech Spec Modal
  const handleOpenTechSpec = (order) => {
    setSelectedOrder(order);
    setTechSpecModalOpen(true);
  };

  // Download existing Tech Spec PDF
  const handleDownloadTechSpec = async (order) => {
    try {
      const techSpec = order.techSpec || {};
      const response = await axios.post(
        `${API_URL}/api/sauna/generate-tech-spec-pdf`,
        { order, techSpec },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TechSpec_${order.id}_${order.fullName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('PDF скачан!');
    } catch (error) {
      console.error('Error downloading tech spec:', error);
      toast.error(t('error'));
    }
  };

  // Callback when tech spec is saved
  const handleTechSpecSaved = (techSpecData) => {
    setOrders(prev => prev.map(o => 
      o.id === selectedOrder?.id ? { ...o, techSpec: techSpecData } : o
    ));
  };

  // Filter orders based on search query
  const filteredOrders = orders.filter(order => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const orderId = (order.id || '').toLowerCase();
    const fullName = (order.fullName || '').toLowerCase();
    const phoneNumber = (order.phoneNumber || '').replace(/\s+/g, '').toLowerCase();
    const queryNormalized = query.replace(/\s+/g, '');
    return orderId.includes(query) || fullName.includes(query) || phoneNumber.includes(queryNormalized);
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const Icon = isSauna ? Flame : Package;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Card className="shadow-lg">
        <CardHeader className={`bg-gradient-to-br ${isSauna ? 'from-green-500/10 to-emerald-500/10' : 'from-primary/5 to-accent/5'}`}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Icon className={`h-6 w-6 ${isSauna ? 'text-green-600' : 'text-primary'}`} />
                {txt.ordersList}
              </CardTitle>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {filteredOrders.length}
              </Badge>
            </div>
            
            {/* Search Input */}
            <div className="relative">
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
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t('loading')}</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <Icon className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">{txt.noOrders}</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">{txt.noResults}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('orderNumber')}</TableHead>
                    <TableHead>{t('customer')}</TableHead>
                    {isSauna && <TableHead>Model</TableHead>}
                    {isSauna && <TableHead>{txt.promo}</TableHead>}
                    {isSauna && <TableHead>{txt.createdBy}</TableHead>}
                    <TableHead>{t('date')}</TableHead>
                    <TableHead className="text-right">{t('total')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order, index) => (
                    <TableRow key={order.id || index}>
                      <TableCell className="font-medium font-mono text-sm">
                        {order.id || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.fullName}</p>
                          <p className="text-sm text-muted-foreground">{order.phoneNumber}</p>
                        </div>
                      </TableCell>
                      {isSauna && (
                        <TableCell>
                          <p className="text-sm">{order.modelName || '-'}</p>
                        </TableCell>
                      )}
                      {isSauna && (
                        <TableCell className="text-center">
                          {order.discountPercent > 0 ? (
                            <div 
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600" 
                              title={`${txt.discount} ${order.discountPercent}%`}
                            >
                              <Percent className="h-4 w-4" />
                            </div>
                          ) : (
                            <div 
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-600" 
                              title={txt.gift}
                            >
                              <Gift className="h-4 w-4" />
                            </div>
                          )}
                        </TableCell>
                      )}
                      {isSauna && (
                        <TableCell>
                          {order.createdBy ? (
                            <div className="flex items-center gap-1 text-sm">
                              <UserCircle className="h-4 w-4 text-muted-foreground" />
                              <span>{order.createdBy}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>{formatDate(order.orderDate)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        <div className="flex items-center justify-end gap-1">
                          {/* Show shield if admin approved, otherwise show request icon if there's a requested discount */}
                          {order.adminDiscountApproved ? (
                            <Shield className="h-4 w-4 text-green-600" title={txt.adminDiscount} />
                          ) : order.requestedDiscount > 0 ? (
                            <Percent className="h-4 w-4 text-amber-500 animate-pulse" title={`${txt.requestedDiscount}: ${order.requestedDiscount}%`} />
                          ) : null}
                          {(order.adminGifts?.length > 0) && (
                            <Gift className="h-4 w-4 text-green-600" title={txt.gift} />
                          )}
                          {isSauna 
                            ? `${(order.total || 0).toLocaleString('pl-PL', { maximumFractionDigits: 0 })} PLN`
                            : `${(order.total || 0).toFixed(2)}€`
                          }
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          {/* Preview Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePreviewOrder(order)}
                            title={txt.preview}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {/* Edit in Calculator Button - Available to all employees */}
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => handleEditInCalculator(order)}
                            title={txt.editInCalculator}
                          >
                            <Calculator className="h-4 w-4 mr-1" />
                            {lang === 'pl' ? 'Edytuj' : 'Редактировать'}
                          </Button>
                          {/* Quick Edit Button - Only for admins (discount, gifts) */}
                          {isAdmin && isAdmin() && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditOrder(order)}
                              title={txt.edit}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadPDF(order, 'customer')}
                          >
                            <FileDown className="h-4 w-4 mr-1" />
                            {t('downloadPDF')}
                          </Button>
                          {isSauna && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleOpenTechSpec(order)}
                                title="Создать/редактировать тех.задание"
                              >
                                <Wrench className="h-4 w-4 mr-1" />
                                Тех.Задание
                              </Button>
                              {order.techSpec && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadTechSpec(order)}
                                  title="Скачать тех.задание PDF"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                          {!isSauna && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleDownloadPDF(order, 'technical')}
                            >
                              <FileDown className="h-4 w-4 mr-1" />
                              {t('downloadTechnical')}
                            </Button>
                          )}
                          {isAdmin && isAdmin() && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteOrder(order.id)}
                              title={txt.deleteOrder}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tech Spec Modal */}
      {isSauna && (
        <TechSpecModal
          open={techSpecModalOpen}
          onOpenChange={setTechSpecModalOpen}
          order={selectedOrder}
          onSaved={handleTechSpecSaved}
        />
      )}

      {/* Order Preview Modal */}
      <OrderPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        order={previewOrder}
        calculatorType={calculatorType}
      />
      
      {/* Order Full Edit Modal */}
      <OrderFullEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        order={editOrder}
        calculatorType={calculatorType}
        onSaved={handleOrderSaved}
      />
    </div>
  );
};
