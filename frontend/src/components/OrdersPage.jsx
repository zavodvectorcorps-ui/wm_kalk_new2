import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { FileDown, Eye, Package, Flame, Search, Trash2, X } from 'lucide-react';
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
      searchPlaceholder: 'Поиск по номеру заказа или имени...',
      deleteOrder: 'Удалить заказ',
      confirmDelete: 'Удалить этот заказ?',
      orderDeleted: 'Заказ удалён',
      noResults: 'Ничего не найдено',
    },
    pl: {
      ordersList: isSauna ? 'Zamówienia saun' : 'Lista zamówień',
      noOrders: isSauna ? 'Brak zamówień saun' : 'Brak zamówień',
      searchPlaceholder: 'Szukaj po numerze zamówienia lub nazwisku...',
      deleteOrder: 'Usuń zamówienie',
      confirmDelete: 'Usunąć to zamówienie?',
      orderDeleted: 'Zamówienie usunięte',
      noResults: 'Nic nie znaleziono',
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
    return orderId.includes(query) || fullName.includes(query);
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const Icon = isSauna ? Flame : Package;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Card className="shadow-lg">
        <CardHeader className={`bg-gradient-to-br ${isSauna ? 'from-green-500/10 to-emerald-500/10' : 'from-primary/5 to-accent/5'}`}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Icon className={`h-6 w-6 ${isSauna ? 'text-green-600' : 'text-primary'}`} />
              {txt.ordersList}
            </CardTitle>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {orders.length}
            </Badge>
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
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('orderNumber')}</TableHead>
                    <TableHead>{t('customer')}</TableHead>
                    {isSauna && <TableHead>Model</TableHead>}
                    <TableHead>{t('date')}</TableHead>
                    <TableHead className="text-right">{t('total')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order, index) => (
                    <TableRow key={order.id || index}>
                      <TableCell className="font-medium">
                        #{(order.id || '').substring(0, 8)}
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
