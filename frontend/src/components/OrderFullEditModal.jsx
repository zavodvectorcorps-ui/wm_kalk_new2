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
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { 
  AlertTriangle, Shield, Save, X, Gift, Trash2, 
  Plus, Package, User, Phone, MapPin, Calendar,
  Percent, FileText
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
      discount: 'Скидка (%)',
      adminDiscountHint: 'Разрешить скидку больше 10%',
      adminDiscountApproved: 'Скидка одобрена администратором',
      approvedBy: 'Одобрил:',
      notes: 'Примечания',
      summary: 'Итого',
      subtotal: 'Подытог',
      discountAmount: 'Скидка',
      total: 'К оплате',
      save: 'Сохранить',
      cancel: 'Отмена',
      saved: 'Заказ сохранён',
      error: 'Ошибка сохранения',
      maxDiscountWarning: 'Максимальная скидка для сотрудников: 10%',
      giftAdded: 'Опция добавлена как подарок',
      giftRemoved: 'Подарок убран',
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
      makeGift: 'Zrób prezent',
      giftFromAdmin: 'Prezent od administratora',
      removeOption: 'Usuń opcję',
      discount: 'Rabat (%)',
      adminDiscountHint: 'Zezwól na rabat powyżej 10%',
      adminDiscountApproved: 'Rabat zatwierdzony przez administratora',
      approvedBy: 'Zatwierdził:',
      notes: 'Uwagi',
      summary: 'Podsumowanie',
      subtotal: 'Suma częściowa',
      discountAmount: 'Rabat',
      total: 'Do zapłaty',
      save: 'Zapisz',
      cancel: 'Anuluj',
      saved: 'Zamówienie zapisane',
      error: 'Błąd zapisu',
      maxDiscountWarning: 'Maksymalny rabat dla pracowników: 10%',
      giftAdded: 'Opcja dodana jako prezent',
      giftRemoved: 'Prezent usunięty',
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
      // Initialize form with order data, ensuring adminGifts array exists
      setFormData({
        ...order,
        discountPercent: order.discountPercent || 0,
        adminDiscountApproved: order.adminDiscountApproved || false,
        adminDiscountApprovedBy: order.adminDiscountApprovedBy || '',
        adminDiscountApprovedAt: order.adminDiscountApprovedAt || '',
        adminGifts: order.adminGifts || [], // Array of option IDs that are gifts
        selectedOptions: order.selectedOptions || [],
      });
    }
  }, [order, open]);
  
  // Calculate totals
  const calculateTotals = useCallback((data) => {
    const modelPrice = data.modelPrice || data.basePrice || 0;
    const foundationPrice = data.foundationPrice || 0;
    
    // Calculate options total (excluding gifts)
    let optionsTotal = 0;
    const adminGifts = data.adminGifts || [];
    
    (data.selectedOptions || []).forEach(opt => {
      if (!adminGifts.includes(opt.id)) {
        optionsTotal += opt.price || 0;
      }
    });
    
    const subtotal = modelPrice + foundationPrice + optionsTotal;
    const discountPercent = data.discountPercent || 0;
    const discountAmount = subtotal * (discountPercent / 100);
    const total = subtotal - discountAmount;
    
    return { subtotal, discountAmount, total, optionsTotal };
  }, []);
  
  const handleDiscountChange = (value) => {
    const discount = parseFloat(value) || 0;
    
    // Non-admin users are limited to 10%
    if (!isAdminUser && discount > 10) {
      toast.warning(text.maxDiscountWarning);
      return;
    }
    
    const newData = {
      ...formData,
      discountPercent: discount,
    };
    
    // If admin sets discount > 10%, mark it as admin approved
    if (isAdminUser && discount > 10) {
      newData.adminDiscountApproved = true;
      newData.adminDiscountApprovedBy = user?.username || 'Admin';
      newData.adminDiscountApprovedAt = new Date().toISOString();
    } else if (discount <= 10) {
      newData.adminDiscountApproved = false;
      newData.adminDiscountApprovedBy = '';
      newData.adminDiscountApprovedAt = '';
    }
    
    // Recalculate totals
    const { subtotal, total } = calculateTotals(newData);
    newData.subtotal = subtotal;
    newData.total = total;
    
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
    
    // Recalculate totals
    const { subtotal, total } = calculateTotals(newData);
    newData.subtotal = subtotal;
    newData.total = total;
    
    setFormData(newData);
  };
  
  const removeOption = (optionId) => {
    const newOptions = (formData.selectedOptions || []).filter(opt => opt.id !== optionId);
    const newGifts = (formData.adminGifts || []).filter(id => id !== optionId);
    
    const newData = {
      ...formData,
      selectedOptions: newOptions,
      adminGifts: newGifts,
    };
    
    // Recalculate totals
    const { subtotal, total } = calculateTotals(newData);
    newData.subtotal = subtotal;
    newData.total = total;
    
    setFormData(newData);
  };
  
  const handleSave = async () => {
    setSaving(true);
    try {
      // Recalculate final totals before saving
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
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {text.editOrder}
            <Badge variant="outline" className="font-mono">{order.id}</Badge>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Customer Data */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {text.customerData}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{text.fullName}</Label>
                    <Input
                      value={formData.fullName || ''}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{text.phone}</Label>
                    <Input
                      value={formData.phoneNumber || ''}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{text.address}</Label>
                    <Input
                      value={formData.fullAddress || ''}
                      onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{text.orderDate}</Label>
                    <Input
                      type="date"
                      value={formData.orderDate || ''}
                      onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
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
                  <div className="space-y-2">
                    {(formData.selectedOptions || []).map(option => {
                      const isGift = adminGifts.includes(option.id);
                      return (
                        <div 
                          key={option.id} 
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isGift ? 'bg-green-50 border-green-200' : 'bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <span className="font-medium">{option.name || option.optionName}</span>
                            {isGift && (
                              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                                <Gift className="h-3 w-3 mr-1" />
                                {text.giftFromAdmin}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={`font-medium ${isGift ? 'line-through text-muted-foreground' : 'text-blue-600'}`}>
                              {isGift ? formatPrice(option.price) : `+${formatPrice(option.price)}`}
                            </span>
                            {isGift && (
                              <span className="font-bold text-green-600">0 {currency}</span>
                            )}
                            {isAdminUser && (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant={isGift ? "default" : "outline"}
                                  className={isGift ? "bg-green-600 hover:bg-green-700" : ""}
                                  onClick={() => toggleGift(option.id)}
                                  title={text.makeGift}
                                >
                                  <Gift className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => removeOption(option.id)}
                                  title={text.removeOption}
                                >
                                  <Trash2 className="h-4 w-4" />
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
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min="0"
                    max={isAdminUser ? "100" : "10"}
                    step="1"
                    value={formData.discountPercent || 0}
                    onChange={(e) => handleDiscountChange(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  
                  {!isAdminUser && formData.discountPercent > 10 && (
                    <Badge variant="outline" className="text-orange-600 border-orange-300">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {text.maxDiscountWarning}
                    </Badge>
                  )}
                </div>
                
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
                <CardTitle className="text-sm">{text.notes}</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </CardContent>
            </Card>
            
            {/* Summary */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">{text.summary}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>{text.subtotal}</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>{text.discountAmount} ({formData.discountPercent}%)</span>
                    <span>-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                {adminGifts.length > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span className="flex items-center gap-1">
                      <Gift className="h-4 w-4" />
                      {text.giftFromAdmin} ({adminGifts.length})
                    </span>
                    <span>
                      -{formatPrice((formData.selectedOptions || [])
                        .filter(opt => adminGifts.includes(opt.id))
                        .reduce((sum, opt) => sum + (opt.price || 0), 0)
                      )}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-xl font-bold pt-2">
                  <span>{text.total}</span>
                  <span className="text-blue-700">{formatPrice(total)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
        
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" />
            {text.cancel}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? '...' : text.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderFullEditModal;
