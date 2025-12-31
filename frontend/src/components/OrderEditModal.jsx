import React, { useState, useEffect } from 'react';
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
import { AlertTriangle, Shield, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const OrderEditModal = ({ 
  open, 
  onOpenChange, 
  order, 
  calculatorType = 'balia',
  onSaved 
}) => {
  const { t, i18n } = useTranslation();
  const { isAdmin, user } = useAuth();
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  
  const isSauna = calculatorType === 'sauna';
  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  
  const txt = {
    ru: {
      editOrder: 'Редактирование заказа',
      customerData: 'Данные клиента',
      fullName: 'ФИО',
      phone: 'Телефон',
      address: 'Адрес',
      orderDetails: 'Детали заказа',
      discount: 'Скидка (%)',
      adminDiscount: 'Административная скидка',
      adminDiscountHint: 'Разрешить скидку больше 20%',
      adminDiscountApproved: 'Скидка одобрена администратором',
      approvedBy: 'Одобрено:',
      notes: 'Примечания',
      total: 'Итого',
      save: 'Сохранить',
      cancel: 'Отмена',
      saved: 'Заказ сохранён',
      error: 'Ошибка сохранения',
      maxDiscountWarning: 'Максимальная скидка для сотрудников: 10%',
    },
    pl: {
      editOrder: 'Edycja zamówienia',
      customerData: 'Dane klienta',
      fullName: 'Imię i nazwisko',
      phone: 'Telefon',
      address: 'Adres',
      orderDetails: 'Szczegóły zamówienia',
      discount: 'Rabat (%)',
      adminDiscount: 'Rabat administracyjny',
      adminDiscountHint: 'Zezwól na rabat powyżej 10%',
      adminDiscountApproved: 'Rabat zatwierdzony przez administratora',
      approvedBy: 'Zatwierdził:',
      notes: 'Uwagi',
      total: 'Suma',
      save: 'Zapisz',
      cancel: 'Anuluj',
      saved: 'Zamówienie zapisane',
      error: 'Błąd zapisu',
      maxDiscountWarning: 'Maksymalny rabat dla pracowników: 10%',
    },
  };
  
  const text = txt[lang];
  
  useEffect(() => {
    if (order && open) {
      setFormData({
        ...order,
        discountPercent: order.discountPercent || 0,
        adminDiscountApproved: order.adminDiscountApproved || false,
        adminDiscountApprovedBy: order.adminDiscountApprovedBy || '',
        adminDiscountApprovedAt: order.adminDiscountApprovedAt || '',
      });
    }
  }, [order, open]);
  
  const calculateTotal = (data) => {
    const subtotal = data.subtotal || data.total || 0;
    const discount = data.discountPercent || 0;
    return subtotal * (1 - discount / 100);
  };
  
  const handleDiscountChange = (value) => {
    const discount = parseFloat(value) || 0;
    const isAdminUser = isAdmin && isAdmin();
    
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
      // If discount is reduced to 10% or less, remove admin approval
      newData.adminDiscountApproved = false;
      newData.adminDiscountApprovedBy = '';
      newData.adminDiscountApprovedAt = '';
    }
    
    // Recalculate total
    newData.total = calculateTotal(newData);
    
    setFormData(newData);
  };
  
  const handleAdminApprovalChange = (checked) => {
    if (!isAdmin || !isAdmin()) return;
    
    setFormData(prev => ({
      ...prev,
      adminDiscountApproved: checked,
      adminDiscountApprovedBy: checked ? (user?.username || 'Admin') : '',
      adminDiscountApprovedAt: checked ? new Date().toISOString() : '',
    }));
  };
  
  const handleSave = async () => {
    setSaving(true);
    try {
      const endpoint = isSauna 
        ? `${API_URL}/api/sauna/orders/${order.id}`
        : `${API_URL}/api/orders/${order.id}`;
      
      await axios.put(endpoint, formData);
      toast.success(text.saved);
      onSaved && onSaved(formData);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error(text.error);
    } finally {
      setSaving(false);
    }
  };
  
  if (!order) return null;
  
  const isAdminUser = isAdmin && isAdmin();
  const currency = isSauna ? 'PLN' : (formData.currency || '€');
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {text.editOrder}
            <Badge variant="outline" className="font-mono">{order.id}</Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Customer Data */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">{text.customerData}</h3>
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
            <div>
              <Label>{text.address}</Label>
              <Input
                value={formData.fullAddress || ''}
                onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
              />
            </div>
          </div>
          
          {/* Order Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">{text.orderDetails}</h3>
            
            {/* Discount */}
            <div className="space-y-2">
              <Label>{text.discount}</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min="0"
                  max={isAdminUser ? "100" : "20"}
                  step="1"
                  value={formData.discountPercent || 0}
                  onChange={(e) => handleDiscountChange(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">%</span>
                
                {!isAdminUser && formData.discountPercent > 20 && (
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {text.maxDiscountWarning}
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Admin Discount Approval */}
            {isAdminUser && formData.discountPercent > 20 && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Checkbox
                  id="adminApproval"
                  checked={formData.adminDiscountApproved}
                  onCheckedChange={handleAdminApprovalChange}
                />
                <Label htmlFor="adminApproval" className="text-sm cursor-pointer">
                  {text.adminDiscountHint}
                </Label>
              </div>
            )}
            
            {/* Show admin approval badge */}
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
            
            {/* Notes */}
            <div>
              <Label>{text.notes}</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
            
            {/* Total */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <span className="font-semibold">{text.total}:</span>
              <span className="text-2xl font-bold">
                {isSauna 
                  ? `${(formData.total || 0).toLocaleString('pl-PL', { maximumFractionDigits: 0 })} ${currency}`
                  : `${(formData.total || 0).toFixed(2)} ${currency}`
                }
              </span>
            </div>
          </div>
        </div>
        
        <DialogFooter>
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

export default OrderEditModal;
