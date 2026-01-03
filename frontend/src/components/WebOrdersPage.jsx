import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Separator } from './ui/separator';
import { toast } from 'sonner';
import { 
  Globe, Phone, User, MessageSquare, Clock, CheckCircle, XCircle, 
  Loader2, Trash2, Eye, FileText, FileSpreadsheet, RefreshCw, Bell, BellOff,
  Package, Edit2, ArrowRight, ExternalLink
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Notification sound URL (simple beep)
const NOTIFICATION_SOUND_URL = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleA4YR6PW0ZmGOU9hgZ+ZoaWtrKWbj3heR0M7Mjd+p7/KxaWBWz02LzJDfqO8xcu7n3dYQDIuNj1jhq7AyrqadlI8LiwxPVyEp7rGvJxyUDsqKzE8WYCjt8K7m3RQOywqLjlVfKC2wbubdFA7LCosMTtZgKS4wrybdFA7LCosMTtZgKS4wrybdFA7';

export const WebOrdersPage = ({ onEditInCalculator }) => {
  const { i18n } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastCount, setLastCount] = useState(0);
  const [transferring, setTransferring] = useState(false);
  const audioRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';

  const txt = {
    ru: {
      title: 'Заказы из интернета',
      noOrders: 'Нет заказов',
      newOrder: 'Новый',
      processing: 'В обработке',
      completed: 'Завершён',
      cancelled: 'Отменён',
      customer: 'Клиент',
      phone: 'Телефон',
      comment: 'Комментарий',
      model: 'Модель',
      heater: 'Печь',
      options: 'Опции',
      total: 'Итого',
      status: 'Статус',
      created: 'Создан',
      managerNotes: 'Заметки менеджера',
      save: 'Сохранить',
      delete: 'Удалить',
      refresh: 'Обновить',
      soundOn: 'Звук вкл',
      soundOff: 'Звук выкл',
      generatePdf: 'PDF',
      generateExcel: 'Excel',
      integrated: 'Встроенная',
      external: 'Внешняя',
      confirmDelete: 'Удалить этот заказ?',
      orderDetails: 'Детали заказа',
      close: 'Закрыть',
      editInCalculator: 'Редактировать',
      transferToMain: 'Перенести в общий список',
      transferred: 'Перенесён'
    },
    pl: {
      title: 'Zamówienia z internetu',
      noOrders: 'Brak zamówień',
      newOrder: 'Nowy',
      processing: 'W trakcie',
      completed: 'Zakończony',
      cancelled: 'Anulowany',
      customer: 'Klient',
      phone: 'Telefon',
      comment: 'Komentarz',
      model: 'Model',
      heater: 'Piec',
      options: 'Opcje',
      total: 'Suma',
      status: 'Status',
      created: 'Utworzono',
      managerNotes: 'Notatki menedżera',
      save: 'Zapisz',
      delete: 'Usuń',
      refresh: 'Odśwież',
      soundOn: 'Dźwięk wł',
      soundOff: 'Dźwięk wył',
      generatePdf: 'PDF',
      generateExcel: 'Excel',
      integrated: 'Zintegrowany',
      external: 'Zewnętrzny',
      confirmDelete: 'Usunąć to zamówienie?',
      orderDetails: 'Szczegóły zamówienia',
      close: 'Zamknij'
    }
  }[lang];

  const statusColors = {
    new: 'bg-red-100 text-red-800 border-red-300',
    processing: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    completed: 'bg-green-100 text-green-800 border-green-300',
    cancelled: 'bg-gray-100 text-gray-800 border-gray-300'
  };

  const statusLabels = {
    new: txt.newOrder,
    processing: txt.processing,
    completed: txt.completed,
    cancelled: txt.cancelled
  };

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  }, [soundEnabled]);

  // Fetch orders
  const fetchOrders = useCallback(async (showToast = false) => {
    try {
      const response = await axios.get(`${API_URL}/api/web-orders`);
      const newOrders = response.data;
      
      // Check for new orders
      const newCount = newOrders.filter(o => o.status === 'new').length;
      if (newCount > lastCount && lastCount > 0) {
        playNotificationSound();
        toast.info(lang === 'ru' ? 'Новый заказ!' : 'Nowe zamówienie!');
      }
      setLastCount(newCount);
      
      setOrders(newOrders);
      if (showToast) {
        toast.success(lang === 'ru' ? 'Обновлено' : 'Odświeżono');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      if (showToast) {
        toast.error(lang === 'ru' ? 'Ошибка загрузки' : 'Błąd ładowania');
      }
    } finally {
      setLoading(false);
    }
  }, [lastCount, playNotificationSound, lang]);

  // Initial fetch and polling
  useEffect(() => {
    fetchOrders();
    
    // Poll every 30 seconds for new orders
    pollIntervalRef.current = setInterval(() => {
      fetchOrders();
    }, 30000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchOrders]);

  // Update order status
  const handleUpdateStatus = async (orderId, status) => {
    try {
      await axios.put(`${API_URL}/api/web-orders/${orderId}`, { status });
      fetchOrders();
      toast.success(lang === 'ru' ? 'Статус обновлён' : 'Status zaktualizowany');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(lang === 'ru' ? 'Ошибка' : 'Błąd');
    }
  };

  // Update order notes
  const handleUpdateNotes = async (orderId, notes) => {
    try {
      await axios.put(`${API_URL}/api/web-orders/${orderId}`, { notes });
      toast.success(lang === 'ru' ? 'Сохранено' : 'Zapisano');
    } catch (error) {
      console.error('Error updating notes:', error);
      toast.error(lang === 'ru' ? 'Ошибка' : 'Błąd');
    }
  };

  // Transfer order to main list
  const handleTransferToMain = async (order) => {
    if (transferring) return;
    
    const confirmMsg = lang === 'ru' 
      ? 'Перенести заказ в основной список?' 
      : 'Przenieść zamówienie do głównej listy?';
    if (!window.confirm(confirmMsg)) return;
    
    setTransferring(true);
    try {
      const response = await axios.post(`${API_URL}/api/web-orders/${order.id}/transfer-to-main`);
      if (response.data.success) {
        toast.success(lang === 'ru' ? 'Заказ перенесён в основной список' : 'Zamówienie przeniesione do głównej listy');
        setDetailsOpen(false);
        fetchOrders();
      }
    } catch (error) {
      console.error('Error transferring order:', error);
      toast.error(lang === 'ru' ? 'Ошибка при переносе' : 'Błąd podczas przenoszenia');
    } finally {
      setTransferring(false);
    }
  };

  // Delete order
  const handleDelete = async (orderId) => {
    if (!window.confirm(txt.confirmDelete)) return;
    
    try {
      await axios.delete(`${API_URL}/api/web-orders/${orderId}`);
      setOrders(prev => prev.filter(o => o.id !== orderId));
      setDetailsOpen(false);
      toast.success(lang === 'ru' ? 'Удалено' : 'Usunięto');
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error(lang === 'ru' ? 'Ошибка' : 'Błąd');
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString(lang === 'pl' ? 'pl-PL' : 'ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Open order details
  const openDetails = (order) => {
    setSelectedOrder(order);
    setDetailsOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const newOrdersCount = orders.filter(o => o.status === 'new').length;

  return (
    <div className="space-y-6">
      {/* Hidden audio element for notifications */}
      <audio ref={audioRef} src={NOTIFICATION_SOUND_URL} preload="auto" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">{txt.title}</h1>
          {newOrdersCount > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {newOrdersCount} {txt.newOrder.toLowerCase()}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={soundEnabled ? 'text-green-600' : 'text-gray-400'}
          >
            {soundEnabled ? <Bell className="h-4 w-4 mr-1" /> : <BellOff className="h-4 w-4 mr-1" />}
            {soundEnabled ? txt.soundOn : txt.soundOff}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOrders(true)}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            {txt.refresh}
          </Button>
        </div>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{txt.noOrders}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <Card 
              key={order.id} 
              className={`cursor-pointer hover:shadow-md transition-shadow ${
                order.status === 'new' ? 'border-l-4 border-l-red-500' : ''
              }`}
              onClick={() => openDetails(order)}
            >
              <CardContent className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Badge className={`${statusColors[order.status]} border`}>
                      {statusLabels[order.status]}
                    </Badge>
                    <div>
                      <p className="font-semibold">{order.customerName}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {order.customerPhone}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <p className="text-muted-foreground">{txt.model}</p>
                      <p className="font-medium">{order.modelName || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{txt.total}</p>
                      <p className="font-bold text-blue-600">{order.total?.toLocaleString()} {order.currency}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{txt.created}</p>
                      <p className="font-medium">{formatDate(order.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Order Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {txt.orderDetails}
            </DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              {/* Status selector */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">{txt.status}:</span>
                <Select
                  value={selectedOrder.status}
                  onValueChange={(value) => {
                    handleUpdateStatus(selectedOrder.id, value);
                    setSelectedOrder(prev => ({ ...prev, status: value }));
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">{txt.newOrder}</SelectItem>
                    <SelectItem value="processing">{txt.processing}</SelectItem>
                    <SelectItem value="completed">{txt.completed}</SelectItem>
                    <SelectItem value="cancelled">{txt.cancelled}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Customer info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {txt.customer}
                  </p>
                  <p className="font-semibold">{selectedOrder.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {txt.phone}
                  </p>
                  <p className="font-semibold">{selectedOrder.customerPhone}</p>
                </div>
              </div>

              {selectedOrder.customerComment && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    {txt.comment}
                  </p>
                  <p className="bg-gray-50 p-2 rounded mt-1">{selectedOrder.customerComment}</p>
                </div>
              )}

              <Separator />

              {/* Order details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{txt.model}</p>
                  <p className="font-semibold">{selectedOrder.modelName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{txt.heater}</p>
                  <p className="font-semibold">
                    {selectedOrder.heaterVariantType === 'integrated' ? txt.integrated : txt.external}
                  </p>
                </div>
              </div>

              {/* Selected options */}
              {selectedOrder.selectedOptions?.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">{txt.options}</p>
                  <div className="space-y-1">
                    {selectedOrder.selectedOptions.map((opt, idx) => (
                      <div key={idx} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                        <span>{opt.categoryName}: {opt.name}</span>
                        {opt.price > 0 && (
                          <span className="text-blue-600">+{opt.price} {selectedOrder.currency}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">{txt.total}</p>
                <p className="text-2xl font-bold text-blue-600">
                  {selectedOrder.total?.toLocaleString()} {selectedOrder.currency}
                </p>
              </div>

              <Separator />

              {/* Manager notes */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">{txt.managerNotes}</p>
                <Textarea
                  value={selectedOrder.notes || ''}
                  onChange={(e) => setSelectedOrder(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder={lang === 'ru' ? 'Добавить заметку...' : 'Dodaj notatkę...'}
                  rows={3}
                />
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => handleUpdateNotes(selectedOrder.id, selectedOrder.notes)}
                >
                  {txt.save}
                </Button>
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleTransferToMain(selectedOrder)}
                  disabled={transferring}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {transferring ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-1" />
                  )}
                  {txt.transferToMain}
                </Button>
                {onEditInCalculator && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onEditInCalculator(selectedOrder);
                      setDetailsOpen(false);
                    }}
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    {txt.editInCalculator}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(selectedOrder.id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {txt.delete}
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                <p>ID: {selectedOrder.id}</p>
                <p>{txt.created}: {formatDate(selectedOrder.createdAt)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WebOrdersPage;
