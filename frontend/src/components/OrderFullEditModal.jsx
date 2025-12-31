import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { 
  AlertTriangle, Shield, Save, X, Gift, Trash2, 
  Package, User, Phone, MapPin, Calendar,
  Percent, FileText, DollarSign, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const OrderFullEditModal = ({ 
  open, 
  onOpenChange, 
  order, 
  calculatorType = 'balia',
  prices = null,
  onSaved 
}) => {
  const { t, i18n } = useTranslation();
  const { isAdmin, user } = useAuth();
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [availablePrices, setAvailablePrices] = useState(null);
  const [discountMode, setDiscountMode] = useState('percent'); // 'percent' or 'amount'
  
  const isSauna = calculatorType === 'sauna';
  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const isAdminUser = isAdmin && isAdmin();
  
  const txt = {
    ru: {
      editOrder: 'Редактирование заказа',
      customerData: 'Данные клиента',
      fullName: 'ФИО',
      phone: 'Телефон',
      address: 'Адрес',
      orderDate: 'Дата заказа',
      model: 'Модель',
      selectedOptions: 'Выбранные опции',
      noOptions: 'Нет выбранных опций',
      price: 'Цена',
      makeGift: 'Сделать подарком',
      giftFromAdmin: 'Подарок от администратора',
      removeOption: 'Удалить опцию',
      discount: 'Скидка',
      discountPercent: 'Процент',
      discountAmount: 'Сумма',
      adminDiscountHint: 'Одобрить скидку как администратор',
      adminDiscountApproved: 'Скидка одобрена администратором',
      approvedBy: 'Одобрил:',
      notes: 'Примечания',
      summary: 'Итого',
      subtotal: 'Подытог',
      total: 'К оплате',
      save: 'Сохранить',
      cancel: 'Отмена',
      saved: 'Заказ сохранён',
      error: 'Ошибка сохранения',
      maxDiscountWarning: 'Максимальная скидка: 10%',
      giftAdded: 'Опция добавлена как подарок',
      giftRemoved: 'Подарок убран',
      requestedDiscount: 'Запрашиваемая скидка от менеджера',
      requestedDiscountNote: 'Комментарий к запросу',
      hasRequestedDiscount: 'Менеджер запросил скидку',
    },
    pl: {
      editOrder: 'Edycja zamówienia',
      customerData: 'Dane klienta',
      fullName: 'Imię i nazwisko',
      phone: 'Telefon',
      address: 'Adres',
      orderDate: 'Data zamówienia',
      model: 'Model',
      selectedOptions: 'Wybrane opcje',
      noOptions: 'Brak wybranych opcji',
      price: 'Cena',
      makeGift: 'Oznacz jako prezent',
      giftFromAdmin: 'Prezent od administratora',
      removeOption: 'Usuń opcję',
      discount: 'Rabat',
      discountPercent: 'Procent',
      discountAmount: 'Kwota',
      adminDiscountHint: 'Zatwierdź rabat jako administrator',
      adminDiscountApproved: 'Rabat zatwierdzony przez administratora',
      approvedBy: 'Zatwierdził:',
      notes: 'Uwagi',
      summary: 'Podsumowanie',
      subtotal: 'Suma częściowa',
      total: 'Do zapłaty',
      save: 'Zapisz',
      cancel: 'Anuluj',
      saved: 'Zamówienie zapisane',
      error: 'Błąd zapisu',
      maxDiscountWarning: 'Maksymalny rabat: 10%',
      giftAdded: 'Opcja dodana jako prezent',
      giftRemoved: 'Prezent usunięty',
      requestedDiscount: 'Wnioskowany rabat od menedżera',
      requestedDiscountNote: 'Komentarz do wniosku',
      hasRequestedDiscount: 'Menedżer wnioskował o rabat',
    },
  };
  
  const text = txt[lang];
  
  // Load prices for available options
  useEffect(() => {
    const fetchPrices = async () => {
      if (prices) {
        setAvailablePrices(prices);
        return;
      }
      try {
        const endpoint = isSauna ? '/api/sauna/prices' : '/api/prices';
        const response = await axios.get(`${API_URL}${endpoint}`);
        setAvailablePrices(response.data);
      } catch (error) {
        console.error('Error fetching prices:', error);
      }
    };
    if (open) {
      fetchPrices();
    }
  }, [open, isSauna, prices]);
  
  useEffect(() => {
    if (order && open) {
      // Force update formData when order changes
      setFormData({
        ...order,
        discountPercent: order.discountPercent || 0,
        adminDiscountApproved: order.adminDiscountApproved || false,
        adminDiscountApprovedBy: order.adminDiscountApprovedBy || '',
        adminDiscountApprovedAt: order.adminDiscountApprovedAt || '',
        adminGifts: order.adminGifts || [],
        selectedOptions: order.selectedOptions || [],
        requestedDiscount: order.requestedDiscount || 0,
        requestedDiscountNote: order.requestedDiscountNote || '',
      });
      setDiscountMode('percent'); // Reset discount mode
    }
  }, [order?.id, open]); // Use order.id as dependency for proper re-render
  
  // Calculate totals
  const calculateTotals = useCallback((data) => {
    const modelPrice = data.modelPrice || data.basePrice || 0;
    const foundationPrice = data.foundationPrice || 0;
    
    let optionsTotal = 0;
    const adminGifts = data.adminGifts || [];
    
    (data.selectedOptions || []).forEach(opt => {
      const optId = opt.id || opt.optionId;
      if (!adminGifts.includes(optId)) {
        const quantity = opt.quantity || 1;
        optionsTotal += (opt.price || 0) * quantity;
      }
    });
    
    const subtotal = modelPrice + foundationPrice + optionsTotal;
    const discountPercent = data.discountPercent || 0;
    const discountAmount = subtotal * (discountPercent / 100);
    const total = subtotal - discountAmount;
    
    return { subtotal, discountAmount, total, optionsTotal };
  }, []);
  
  const handleDiscountPercentChange = (value) => {
    const discount = Math.max(0, parseFloat(value) || 0);
    
    // Non-admin users are limited to 10%
    if (!isAdminUser && discount > 10) {
      toast.warning(text.maxDiscountWarning);
      return;
    }
    
    const newData = {
      ...formData,
      discountPercent: discount,
    };
    
    if (isAdminUser && discount > 10) {
      newData.adminDiscountApproved = true;
      newData.adminDiscountApprovedBy = user?.username || 'Admin';
      newData.adminDiscountApprovedAt = new Date().toISOString();
    } else if (discount <= 10) {
      newData.adminDiscountApproved = false;
      newData.adminDiscountApprovedBy = '';
      newData.adminDiscountApprovedAt = '';
    }
    
    const { subtotal, total } = calculateTotals(newData);
    newData.subtotal = subtotal;
    newData.total = total;
    
    setFormData(newData);
  };
  
  // Handle discount amount change (admin only)
  const handleDiscountAmountChange = (value) => {
    const amount = Math.max(0, parseFloat(value) || 0);
    const { subtotal } = calculateTotals(formData);
    
    // Calculate percent from amount
    const percent = subtotal > 0 ? (amount / subtotal) * 100 : 0;
    
    const newData = {
      ...formData,
      discountPercent: Math.round(percent * 100) / 100, // Round to 2 decimal places
    };
    
    if (percent > 10) {
      newData.adminDiscountApproved = true;
      newData.adminDiscountApprovedBy = user?.username || 'Admin';
      newData.adminDiscountApprovedAt = new Date().toISOString();
    }
    
    newData.subtotal = subtotal;
    newData.total = subtotal - amount;
    
    setFormData(newData);
  };
  
  const toggleGift = (optionId) => {
    if (!isAdminUser) return;
    
    const adminGifts = formData.adminGifts || [];
    const isGift = adminGifts.includes(optionId);
    
    let newGifts;
    if (isGift) {
      newGifts = adminGifts.filter(id => id !== optionId);
      toast.info(text.giftRemoved);
    } else {
      newGifts = [...adminGifts, optionId];
      toast.success(text.giftAdded);
    }
    
    const newData = {
      ...formData,
      adminGifts: newGifts,
    };
    
    const { subtotal, total } = calculateTotals(newData);
    newData.subtotal = subtotal;
    newData.total = total;
    
    setFormData(newData);
  };
  
  const removeOption = (optionId) => {
    const newOptions = (formData.selectedOptions || []).filter(opt => (opt.id || opt.optionId) !== optionId);
    const newGifts = (formData.adminGifts || []).filter(id => id !== optionId);
    
    const newData = {
      ...formData,
      selectedOptions: newOptions,
      adminGifts: newGifts,
    };
    
    const { subtotal, total } = calculateTotals(newData);
    newData.subtotal = subtotal;
    newData.total = total;
    
    setFormData(newData);
  };
  
  const handleSave = async () => {
    setSaving(true);
    try {
      const { subtotal, total } = calculateTotals(formData);
      const dataToSave = {
        ...formData,
        subtotal,
        total,
      };
      
      const endpoint = isSauna 
        ? `${API_URL}/api/sauna/orders/${order.id}`
        : `${API_URL}/api/orders/${order.id}`;
      
      await axios.put(endpoint, dataToSave);
      toast.success(text.saved);
      onSaved && onSaved(dataToSave);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error(text.error);
    } finally {
      setSaving(false);
    }
  };
  
  if (!order) return null;
  
  const currency = isSauna ? 'PLN' : (formData.currency || '€');
  const { subtotal, discountAmount, total } = calculateTotals(formData);
  const adminGifts = formData.adminGifts || [];
  
  const formatPrice = (price) => {
    if (isSauna) {
      return `${(price || 0).toLocaleString('pl-PL', { maximumFractionDigits: 0 })} ${currency}`;
    }
    return `${(price || 0).toFixed(2)} ${currency}`;
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            {text.editOrder}
            <Badge variant="outline" className="font-mono">{order.id}</Badge>
          </DialogTitle>
        </DialogHeader>
        
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 pb-2" style={{ maxHeight: 'calc(90vh - 180px)' }}>
          <div className="space-y-4 py-2">
            {/* Requested Discount Alert (for Admin view) */}
            {isAdminUser && formData.requestedDiscount > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg">
                <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
                  <MessageSquare className="h-4 w-4" />
                  {text.hasRequestedDiscount}: {formData.requestedDiscount}%
                </div>
                {formData.requestedDiscountNote && (
                  <p className="text-sm text-amber-700">{formData.requestedDiscountNote}</p>
                )}
              </div>
            )}
            
            {/* Customer Data */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {text.customerData}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{text.fullName}</Label>
                    <Input
                      value={formData.fullName || ''}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{text.phone}</Label>
                    <Input
                      value={formData.phoneNumber || ''}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{text.address}</Label>
                    <Input
                      value={formData.fullAddress || ''}
                      onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{text.orderDate}</Label>
                    <Input
                      type="date"
                      value={formData.orderDate || ''}
                      onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                      className="h-9"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Model */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {text.model}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="font-medium">{formData.modelName || '-'}</span>
                  <span className="font-bold text-blue-600">
                    {formatPrice(formData.modelPrice || formData.basePrice)}
                  </span>
                </div>
              </CardContent>
            </Card>
            
            {/* Selected Options */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {text.selectedOptions}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(formData.selectedOptions || []).length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">{text.noOptions}</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {(formData.selectedOptions || []).map(option => {
                      const optId = option.id || option.optionId;
                      const isGift = adminGifts.includes(optId);
                      const quantity = option.quantity || 1;
                      const totalPrice = (option.price || 0) * quantity;
                      return (
                        <div 
                          key={optId} 
                          className={`flex items-center justify-between p-2 rounded-lg border ${
                            isGift ? 'bg-green-50 border-green-200' : 'bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="font-medium text-sm truncate">
                              {option.name || option.optionName}
                              {quantity > 1 && ` (×${quantity})`}
                            </span>
                            {isGift && (
                              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs shrink-0">
                                <Gift className="h-3 w-3 mr-1" />
                                {lang === 'pl' ? 'Prezent' : 'Подарок'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`font-medium text-sm ${isGift ? 'line-through text-muted-foreground' : 'text-blue-600'}`}>
                              {formatPrice(totalPrice)}
                            </span>
                            {isGift && (
                              <span className="font-bold text-green-600 text-sm">0 {currency}</span>
                            )}
                            {isAdminUser && (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant={isGift ? "default" : "outline"}
                                  className={`h-7 w-7 p-0 ${isGift ? "bg-green-600 hover:bg-green-700" : ""}`}
                                  onClick={() => toggleGift(optId)}
                                  title={text.makeGift}
                                >
                                  <Gift className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => removeOption(optId)}
                                  title={text.removeOption}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Discount */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  {text.discount}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Admin can choose percent or amount */}
                {isAdminUser && (
                  <div className="flex gap-2 mb-3">
                    <Button
                      size="sm"
                      variant={discountMode === 'percent' ? 'default' : 'outline'}
                      onClick={() => setDiscountMode('percent')}
                      className="flex-1"
                    >
                      <Percent className="h-3 w-3 mr-1" />
                      {text.discountPercent}
                    </Button>
                    <Button
                      size="sm"
                      variant={discountMode === 'amount' ? 'default' : 'outline'}
                      onClick={() => setDiscountMode('amount')}
                      className="flex-1"
                    >
                      <DollarSign className="h-3 w-3 mr-1" />
                      {text.discountAmount}
                    </Button>
                  </div>
                )}
                
                <div className="flex items-center gap-3">
                  {discountMode === 'percent' || !isAdminUser ? (
                    <>
                      <Input
                        type="number"
                        min="0"
                        max={isAdminUser ? "100" : "10"}
                        step="0.5"
                        value={formData.discountPercent || 0}
                        onChange={(e) => handleDiscountPercentChange(e.target.value)}
                        className="w-24 h-9"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                      <span className="text-sm text-muted-foreground">
                        = {formatPrice(discountAmount)}
                      </span>
                    </>
                  ) : (
                    <>
                      <Input
                        type="number"
                        min="0"
                        step="100"
                        value={Math.round(discountAmount)}
                        onChange={(e) => handleDiscountAmountChange(e.target.value)}
                        className="w-32 h-9"
                      />
                      <span className="text-sm text-muted-foreground">{currency}</span>
                      <span className="text-sm text-muted-foreground">
                        = {(formData.discountPercent || 0).toFixed(1)}%
                      </span>
                    </>
                  )}
                </div>
                
                {!isAdminUser && (
                  <p className="text-xs text-muted-foreground">{text.maxDiscountWarning}</p>
                )}
                
                {/* Admin Discount Approval */}
                {isAdminUser && formData.discountPercent > 10 && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <Checkbox
                      id="adminApproval"
                      checked={formData.adminDiscountApproved}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        adminDiscountApproved: checked,
                        adminDiscountApprovedBy: checked ? (user?.username || 'Admin') : '',
                        adminDiscountApprovedAt: checked ? new Date().toISOString() : '',
                      })}
                    />
                    <Label htmlFor="adminApproval" className="text-sm cursor-pointer">
                      {text.adminDiscountHint}
                    </Label>
                  </div>
                )}
                
                {formData.adminDiscountApproved && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <Shield className="h-4 w-4 text-green-600" />
                    <div className="text-sm">
                      <span className="font-medium text-green-700">{text.adminDiscountApproved}</span>
                      {formData.adminDiscountApprovedBy && (
                        <span className="text-green-600 ml-2">
                          ({text.approvedBy} {formData.adminDiscountApprovedBy})
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Notes */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {text.notes}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="resize-none"
                />
              </CardContent>
            </Card>
            
            {/* Summary */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{text.subtotal}:</span>
                    <span className="font-medium">{formatPrice(subtotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>{text.discount} ({formData.discountPercent}%):</span>
                      <span className="font-medium">-{formatPrice(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>{text.total}:</span>
                    <span className="text-blue-600">{formatPrice(total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        <DialogFooter className="p-6 pt-4 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            {text.cancel}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? '...' : text.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
