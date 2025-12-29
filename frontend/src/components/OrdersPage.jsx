import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { FileDown, Eye, Package, Flame, Search, Trash2, X, FileText, Gift, Percent, UserCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const OrdersPage = ({ calculatorType = 'balia' }) => {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
    },
  };
  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

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

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const prefix = isSauna ? 'sauna' : 'order';
      const orderId = order.id || 'unknown';
      link.setAttribute('download', `${prefix}_${orderId}_${order.fullName}.pdf`);
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
                        <TableCell>
                          {order.discountPercent > 0 ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <Percent className="h-3 w-3 mr-1" />
                              {txt.discount} {order.discountPercent}%
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              <Gift className="h-3 w-3 mr-1" />
                              {txt.gift}
                            </Badge>
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
                        {isSauna 
                          ? `${(order.total || 0).toLocaleString('pl-PL', { maximumFractionDigits: 0 })} PLN`
                          : `${(order.total || 0).toFixed(2)}€`
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadPDF(order, 'customer')}
                          >
                            <FileDown className="h-4 w-4 mr-1" />
                            {t('downloadPDF')}
                          </Button>
                          {isSauna && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => window.open('http://tk-sauna.wm-kalkulator.pl', '_blank')}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Тех.Задание
                            </Button>
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
    </div>
  );
};
