import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { InputOrange } from './ui/input-orange';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { CheckboxOrange } from './ui/checkbox-orange';
import { RadioGroupOrange, RadioGroupItemOrange } from './ui/radio-group-orange';
import { SelectOrange, SelectContentOrange, SelectItemOrange, SelectTriggerOrange, SelectValueOrange } from './ui/select-orange';
import { toast } from 'sonner';
import { 
  FileDown, Save, RotateCcw, Loader2, User, Phone, MapPin, Calendar,
  Flame, DoorOpen, Layers, Lightbulb, Package, Truck,
  Percent, Calculator, Thermometer, Tag, Mail, X, Edit, Gift, Shield
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Category icons mapping
const categoryIcons = {
  'Kolor': Layers,
  'Piece': Flame,
  'Strona Pieca:': Flame,
  'Zbiornik na wodę na piec': Thermometer,
  'Ogrodzenie do pieca (drewniane)': Package,
  'Drzwi': DoorOpen,
  'Lokalizacja drzwi': DoorOpen,
  'Okna': Layers,
  'Szyba połpanoramiczna': Layers,
  'Ławki': Layers,
  'Oswietlenie': Lightbulb,
  'Opcje Dodatkowe': Package,
  'Belki podłużne do podstawy ramy sauny': Package,
  'Dostawa': Truck,
};

export const SaunaCalculator = ({ editingOrder = null, onEditComplete }) => {
  const { t, i18n } = useTranslation();
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [prices, setPrices] = useState({ models: [], categories: [] });
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  
  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editOrderId, setEditOrderId] = useState(null);
  const [adminGifts, setAdminGifts] = useState([]);
  const [adminDiscountApproved, setAdminDiscountApproved] = useState(false);
  
  const isAdminUser = isAdmin && isAdmin();
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    fullAddress: '',
    orderDate: new Date().toISOString().split('T')[0],
    selectedModel: '',
    selections: {},
    quantities: {},
    notes: '',
  });

  // Translations
  const texts = {
    ru: {
      saunaCalculator: 'Калькулятор саун',
      customerInfo: 'Данные клиента',
      fullName: 'Имя и фамилия',
      email: 'Email',
      phoneNumber: 'Телефон',
      fullAddress: 'Полный адрес',
      orderDate: 'Дата заказа',
      selectModel: 'Выберите модель сауны',
      model: 'Модель сауны',
      basePrice: 'Базовая цена',
      foundation: 'Фундамент',
      discount: 'Скидка',
      discountPercent: 'Скидка %',
      applyStandardDiscount: 'Стандартная скидка',
      noDiscountForModel: 'Для этой модели нет стандартной скидки',
      discountApplied: 'Скидка применена',
      notes: 'Комментарий к заказу',
      notesPlaceholder: 'Добавьте комментарий к заказу...',
      summary: 'Итог заказа',
      subtotal: 'Сумма опций',
      foundationPrice: 'Стоимость фундамента',
      discountAmount: 'Сумма скидки',
      priceBeforeDiscount: 'Цена до скидки',
      priceAfterDiscount: 'Цена после скидки',
      youSave: 'Вы экономите',
      total: 'ИТОГО',
      saveAndGeneratePDF: 'Сохранить и создать PDF',
      generatePDFOnly: 'Создать PDF',
      clearForm: 'Очистить форму',
      orderSaved: 'Заказ сауны сохранён!',
      pdfGenerated: 'PDF успешно создан!',
      formCleared: 'Форма очищена',
      fillRequired: 'Заполните обязательные поля',
      selectModelFirst: 'Сначала выберите модель',
      gratis: 'бесплатно',
      quantity: 'Кол-во',
      priceDepends: 'цена зависит от модели',
      // Category translations
      'Kolor': 'Цвет / Пропитка',
      'Piece': 'Печь',
      'Strona Pieca:': 'Расположение печи',
      'Zbiornik na wodę na piec': 'Бак для воды на печь',
      'Ogrodzenie do pieca (drewniane)': 'Ограждение печи (деревянное)',
      'Drzwi': 'Двери',
      'Lokalizacja drzwi': 'Расположение дверей',
      'Okna': 'Окна',
      'Szyba połpanoramiczna': 'Панорамное стекло',
      'Ławki': 'Лавки',
      'Oswietlenie': 'Освещение',
      'Opcje Dodatkowe': 'Дополнительные опции',
      'Belki podłużne do podstawy ramy sauny': 'Балки для фундамента',
      'Dostawa': 'Доставка',
    },
    pl: {
      saunaCalculator: 'Kalkulator saun',
      customerInfo: 'Dane klienta',
      fullName: 'Imię i nazwisko',
      email: 'Email',
      phoneNumber: 'Telefon',
      fullAddress: 'Adres',
      orderDate: 'Data zamówienia',
      selectModel: 'Wybierz model sauny',
      model: 'Model sauny',
      basePrice: 'Cena podstawowa',
      foundation: 'Fundament',
      discount: 'Rabat',
      discountPercent: 'Rabat %',
      applyStandardDiscount: 'Standardowa zniżka',
      noDiscountForModel: 'Dla tego modelu nie ma zdefiniowanej standardowej zniżki',
      discountApplied: 'Rabat zastosowany',
      notes: 'Komentarz do zamówienia',
      notesPlaceholder: 'Dodaj komentarz do zamówienia...',
      summary: 'Podsumowanie zamówienia',
      subtotal: 'Suma opcji',
      foundationPrice: 'Koszt fundamentu',
      discountAmount: 'Kwota rabatu',
      priceBeforeDiscount: 'Cena przed rabatem',
      priceAfterDiscount: 'Cena po rabacie',
      youSave: 'Oszczędzasz',
      total: 'RAZEM',
      saveAndGeneratePDF: 'Zapisz i generuj PDF',
      generatePDFOnly: 'Generuj PDF',
      clearForm: 'Wyczyść formularz',
      orderSaved: 'Zamówienie sauny zapisane!',
      pdfGenerated: 'PDF wygenerowany!',
      formCleared: 'Formularz wyczyszczony',
      fillRequired: 'Wypełnij wymagane pola',
      selectModelFirst: 'Najpierw wybierz model',
      gratis: 'gratis',
      quantity: 'Ilość',
      priceDepends: 'cena zależy od modelu',
      // Category translations (keep Polish names)
      'Kolor': 'Kolor / Impregnacja',
      'Piece': 'Piec',
      'Strona Pieca:': 'Strona pieca',
      'Zbiornik na wodę na piec': 'Zbiornik na wodę na piec',
      'Ogrodzenie do pieca (drewniane)': 'Ogrodzenie do pieca (drewniane)',
      'Drzwi': 'Drzwi',
      'Lokalizacja drzwi': 'Lokalizacja drzwi',
      'Okna': 'Okna',
      'Szyba połpanoramiczna': 'Szyba półpanoramiczna',
      'Ławki': 'Ławki',
      'Oswietlenie': 'Oświetlenie',
      'Opcje Dodatkowe': 'Opcje dodatkowe',
      'Belki podłużne do podstawy ramy sauny': 'Belki podłużne do podstawy ramy sauny',
      'Dostawa': 'Dostawa',
    },
  };

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  useEffect(() => {
    fetchPrices();
  }, []);

  // Load order data when editing
  useEffect(() => {
    if (editingOrder && prices.categories?.length > 0) {
      setIsEditMode(true);
      setEditOrderId(editingOrder.id);
      
      // Load customer data
      setFormData(prev => ({
        ...prev,
        fullName: editingOrder.fullName || '',
        email: editingOrder.email || '',
        phoneNumber: editingOrder.phoneNumber || '',
        fullAddress: editingOrder.fullAddress || '',
        orderDate: editingOrder.orderDate || new Date().toISOString().split('T')[0],
        selectedModel: editingOrder.selectedModel || '',
        notes: editingOrder.notes || '',
        selections: editingOrder.selections || prev.selections,
        quantities: editingOrder.quantities || {},
      }));
      
      // If selections is empty but we have selectedOptions, rebuild selections
      if ((!editingOrder.selections || Object.keys(editingOrder.selections).length === 0) && editingOrder.selectedOptions?.length > 0) {
        const rebuiltSelections = {};
        const rebuiltQuantities = {};
        
        prices.categories.forEach(cat => {
          if (cat.inputType === 'checkbox') {
            rebuiltSelections[cat.id] = {};
          } else {
            rebuiltSelections[cat.id] = '';
          }
        });
        
        // Apply selected options
        editingOrder.selectedOptions.forEach(opt => {
          const category = prices.categories.find(c => c.id === opt.categoryId);
          if (category) {
            const optionId = opt.optionId || opt.id;
            if (category.inputType === 'checkbox') {
              rebuiltSelections[opt.categoryId] = {
                ...(rebuiltSelections[opt.categoryId] || {}),
                [optionId]: true
              };
            } else {
              rebuiltSelections[opt.categoryId] = optionId;
            }
            // Restore quantity if available
            if (opt.quantity && opt.quantity > 1) {
              rebuiltQuantities[optionId] = opt.quantity;
            }
          }
        });
        
        setFormData(prev => ({ 
          ...prev, 
          selections: rebuiltSelections,
          quantities: rebuiltQuantities
        }));
      }
      
      // Load discount
      setAppliedDiscount(editingOrder.discountPercent || 0);
      
      // Load admin features
      setAdminGifts(editingOrder.adminGifts || []);
      setAdminDiscountApproved(editingOrder.adminDiscountApproved || false);
      
      toast.info(lang === 'pl' ? `Edycja zamówienia: ${editingOrder.id}` : `Редактирование заказа: ${editingOrder.id}`);
    }
  }, [editingOrder, prices.categories]);

  const fetchPrices = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sauna/prices`);
      setPrices(response.data);
      
      // Initialize selections for each category
      const initialSelections = {};
      (response.data.categories || []).forEach(cat => {
        if (cat.inputType === 'checkbox') {
          initialSelections[cat.id] = {};
        } else {
          initialSelections[cat.id] = '';
        }
      });
      
      setFormData(prev => ({
        ...prev,
        selections: initialSelections,
      }));
    } catch (error) {
      console.error('Error fetching sauna prices:', error);
      toast.error(t('error'));
    } finally {
      setInitialLoading(false);
    }
  };

  const getSelectedModel = () => {
    return prices.models?.find(m => m.id === formData.selectedModel);
  };

  const calculateOptionsTotal = () => {
    let total = 0;
    const categories = prices.categories || [];
    
    categories.forEach(category => {
      const selection = formData.selections[category.id];
      if (!selection) return;
      
      if (category.inputType === 'checkbox') {
        Object.entries(selection).forEach(([optId, isSelected]) => {
          if (isSelected) {
            const option = category.options?.find(o => o.id === optId);
            if (option) {
              const quantity = option.hasQuantity ? (formData.quantities[optId] || 1) : 1;
              total += option.price * quantity;
            }
          }
        });
      } else {
        const option = category.options?.find(o => o.id === selection);
        if (option) {
          const quantity = option.hasQuantity ? (formData.quantities[selection] || 1) : 1;
          total += option.price * quantity;
        }
      }
    });
    
    return total;
  };

  const calculateFoundationPrice = () => {
    const model = getSelectedModel();
    if (!model) return 0;
    
    const foundationCat = prices.categories?.find(c => c.id === 'fundament');
    if (foundationCat) {
      const selection = formData.selections[foundationCat.id];
      if (selection && selection.includes('dodaj')) {
        return model.foundationPrice || 0;
      }
    }
    return 0;
  };

  const calculateSubtotal = () => {
    const model = getSelectedModel();
    if (!model) return 0;
    
    const basePrice = model.basePrice || 0;
    const optionsTotal = calculateOptionsTotal();
    const foundationPrice = calculateFoundationPrice();
    
    return basePrice + optionsTotal + foundationPrice;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discountAmount = subtotal * (appliedDiscount / 100);
    return subtotal - discountAmount;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDiscountChange = (e) => {
    const maxDiscount = isAdminUser ? 100 : 10;
    const value = Math.max(0, Math.min(maxDiscount, parseFloat(e.target.value) || 0));
    setAppliedDiscount(value);
  };

  // Toggle gift status for an option
  const toggleGift = (optionId) => {
    setAdminGifts(prev => 
      prev.includes(optionId) 
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    );
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditOrderId(null);
    setAdminGifts([]);
    setAdminDiscountApproved(false);
    handleClear();
    if (onEditComplete) {
      onEditComplete();
    }
  };

  const handleModelChange = (modelId) => {
    setFormData(prev => ({
      ...prev,
      selectedModel: modelId,
    }));
    // Reset discount when model changes
    setAppliedDiscount(0);
  };

  const handleApplyStandardDiscount = () => {
    const model = getSelectedModel();
    if (!model) {
      toast.error(txt.selectModelFirst);
      return;
    }
    
    const maxDiscount = isAdminUser ? 100 : 10;
    const modelDiscount = Math.min(model.discount || 0, maxDiscount);
    if (modelDiscount > 0) {
      setAppliedDiscount(modelDiscount);
      toast.success(`${txt.discountApplied}: ${modelDiscount}%`);
    } else {
      toast.error(txt.noDiscountForModel);
    }
  };

  const handleRadioChange = (categoryId, optionId) => {
    setFormData(prev => ({
      ...prev,
      selections: {
        ...prev.selections,
        [categoryId]: optionId,
      },
    }));
  };

  const handleCheckboxChange = (categoryId, optionId, checked) => {
    setFormData(prev => ({
      ...prev,
      selections: {
        ...prev.selections,
        [categoryId]: {
          ...(prev.selections[categoryId] || {}),
          [optionId]: checked,
        },
      },
    }));
  };

  const handleQuantityChange = (optionId, quantity) => {
    const qty = Math.max(1, parseInt(quantity) || 1);
    setFormData(prev => ({
      ...prev,
      quantities: {
        ...prev.quantities,
        [optionId]: qty,
      },
    }));
  };

  const validateForm = () => {
    if (!formData.fullName || !formData.phoneNumber) {
      toast.error(txt.fillRequired);
      return false;
    }
    if (!formData.selectedModel) {
      toast.error(txt.selectModelFirst);
      return false;
    }
    return true;
  };

  // Get selected options for PDF
  const getSelectedOptions = () => {
    const options = [];
    const categories = prices.categories || [];
    
    categories.forEach(category => {
      const selection = formData.selections[category.id];
      if (!selection) return;
      
      if (category.inputType === 'checkbox') {
        Object.entries(selection).forEach(([optId, isSelected]) => {
          if (isSelected) {
            const option = category.options?.find(o => o.id === optId);
            if (option) {
              const quantity = option.hasQuantity ? (formData.quantities[optId] || 1) : 1;
              options.push({
                categoryId: category.id,
                categoryName: category.name,
                optionId: option.id,
                optionName: option.name,
                price: option.price,
                quantity: quantity,
                totalPrice: option.price * quantity,
                imageUrl: option.imageUrl || null,
                techSpecId: option.techSpecId || null,
                // Use option-level techSpecCategoryId if available, otherwise category-level
                techSpecCategoryId: option.techSpecCategoryId || category.techSpecCategoryId || null,
              });
            }
          }
        });
      } else {
        const option = category.options?.find(o => o.id === selection);
        if (option) {
          const quantity = option.hasQuantity ? (formData.quantities[selection] || 1) : 1;
          options.push({
            categoryId: category.id,
            categoryName: category.name,
            optionId: option.id,
            optionName: option.name,
            price: option.price,
            quantity: quantity,
            totalPrice: option.price * quantity,
            imageUrl: option.imageUrl || null,
            techSpecId: option.techSpecId || null,
            // Use option-level techSpecCategoryId if available, otherwise category-level
            techSpecCategoryId: option.techSpecCategoryId || category.techSpecCategoryId || null,
          });
        }
      }
    });
    
    return options;
  };

  const handleSaveAndGeneratePDF = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const model = getSelectedModel();
      const subtotal = calculateSubtotal();
      const selectedOptions = getSelectedOptions();
      
      // Calculate total considering admin gifts
      const giftsTotal = selectedOptions
        .filter(opt => adminGifts.includes(opt.optionId) || adminGifts.includes(opt.id))
        .reduce((sum, opt) => sum + (opt.totalPrice || opt.price || 0), 0);
      const discountableAmount = subtotal - giftsTotal;
      const discountAmount = discountableAmount * (appliedDiscount / 100);
      const total = discountableAmount - discountAmount;
      
      // Use existing order ID in edit mode, otherwise get from server
      const orderId = isEditMode && editOrderId 
        ? editOrderId 
        : null;
      
      const orderData = {
        id: orderId,
        fullName: formData.fullName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        fullAddress: formData.fullAddress,
        orderDate: formData.orderDate,
        selectedModel: formData.selectedModel,
        modelName: model?.name || '',
        modelImageUrl: model?.imageUrl || '',
        basePrice: model?.basePrice || 0,
        foundationPrice: calculateFoundationPrice(),
        discountPercent: appliedDiscount,
        selections: formData.selections,
        quantities: formData.quantities,
        selectedOptions: selectedOptions,
        notes: formData.notes,
        optionsTotal: calculateOptionsTotal(),
        subtotal: subtotal,
        total: total,
        createdBy: user?.username || '',
        // Admin fields
        adminGifts: adminGifts,
        adminDiscountApproved: appliedDiscount > 10 && isAdminUser ? adminDiscountApproved : false,
        adminDiscountApprovedBy: appliedDiscount > 10 && adminDiscountApproved ? user?.username : '',
        adminDiscountApprovedAt: appliedDiscount > 10 && adminDiscountApproved ? new Date().toISOString() : '',
      };

      let finalOrderId;
      
      // Save order - PUT for edit, POST for new
      if (isEditMode && editOrderId) {
        await axios.put(`${API_URL}/api/sauna/orders/${editOrderId}`, orderData);
        finalOrderId = editOrderId;
        toast.success(lang === 'pl' ? 'Zamówienie zaktualizowane!' : 'Заказ обновлён!');
      } else {
        const orderResponse = await axios.post(`${API_URL}/api/sauna/orders`, orderData);
        finalOrderId = orderResponse.data?.id || '';
        toast.success(txt.orderSaved);
      }

      // Generate PDF with order ID
      const pdfData = {
        ...orderData,
        orderId: finalOrderId,
        language: 'pl',
        categories: prices.categories,
      };

      const response = await axios.post(`${API_URL}/api/sauna/generate-pdf`, pdfData, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const currentDate = new Date().toLocaleDateString('pl-PL').replace(/\./g, '-');
      link.setAttribute('download', `Oferta_${formData.fullName.replace(/\s+/g, '_')}_${currentDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(txt.pdfGenerated);

      // If in edit mode, exit edit mode and notify parent
      if (isEditMode) {
        setIsEditMode(false);
        setEditOrderId(null);
        setAdminGifts([]);
        setAdminDiscountApproved(false);
        if (onEditComplete) {
          onEditComplete();
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleClearForm = () => {
    const initialSelections = {};
    (prices.categories || []).forEach(cat => {
      if (cat.inputType === 'checkbox') {
        initialSelections[cat.id] = {};
      } else {
        initialSelections[cat.id] = '';
      }
    });

    setFormData({
      fullName: '',
      email: '',
      phoneNumber: '',
      fullAddress: '',
      orderDate: new Date().toISOString().split('T')[0],
      selectedModel: '',
      selections: initialSelections,
      quantities: {},
      notes: '',
    });
    setAppliedDiscount(0);
    setAdminGifts([]);
    setAdminDiscountApproved(false);
    toast.success(txt.formCleared);
  };
  
  // Alias for cancel edit to use same clear logic
  const handleClear = handleClearForm;

  const getCategoryName = (category) => {
    return txt[category.name] || category.name;
  };

  const model = getSelectedModel();
  const optionsTotal = calculateOptionsTotal();
  const foundationPrice = calculateFoundationPrice();
  const subtotal = calculateSubtotal();
  const discountAmount = subtotal * (appliedDiscount / 100);
  const total = calculateTotal();

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Edit Mode Banner */}
      {isEditMode && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Edit className="h-5 w-5 text-amber-600" />
            <span className="font-medium text-amber-800">
              {lang === 'pl' 
                ? `Edycja zamówienia: ${editOrderId}` 
                : `Редактирование заказа: ${editOrderId}`}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleCancelEdit}>
            <X className="h-4 w-4 mr-1" />
            {lang === 'pl' ? 'Anuluj' : 'Отмена'}
          </Button>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <Card className="shadow-md">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
              <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
                <User className="h-5 w-5" />
                {txt.customerInfo}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">{txt.fullName} *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <InputOrange
                      id="fullName"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{txt.email}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <InputOrange
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">{txt.phoneNumber} *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <InputOrange
                      id="phoneNumber"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleInputChange}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orderDate">{txt.orderDate}</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <InputOrange
                      id="orderDate"
                      name="orderDate"
                      type="date"
                      value={formData.orderDate}
                      onChange={handleInputChange}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Model Selection */}
          <Card className="shadow-md">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
              <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
                <Calculator className="h-5 w-5" />
                {txt.model} *
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {prices.modelsDisplayType === 'dropdown' ? (
                // Dropdown View for Models
                <SelectOrange
                  value={formData.selectedModel}
                  onValueChange={(value) => handleModelChange(value)}
                >
                  <SelectTriggerOrange className="w-full">
                    <SelectValueOrange placeholder={txt.selectModel} />
                  </SelectTriggerOrange>
                  <SelectContentOrange>
                    {prices.models?.map((m) => (
                      <SelectItemOrange key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          {m.imageUrl && (
                            <img src={m.imageUrl} alt={m.name} className="w-8 h-6 object-cover rounded" />
                          )}
                          <span>{m.name}</span>
                          <span className="text-amber-700 font-medium ml-auto">
                            {m.basePrice.toLocaleString('pl-PL')} PLN
                          </span>
                          {m.discount > 0 && (
                            <span className="text-green-600 text-xs">-{m.discount}%</span>
                          )}
                        </div>
                      </SelectItemOrange>
                    ))}
                  </SelectContentOrange>
                </SelectOrange>
              ) : (
                // Grid/Tile View for Models (default)
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {prices.models?.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => handleModelChange(m.id)}
                      className={`
                        relative cursor-pointer rounded-lg border-2 p-3 transition-all
                        ${formData.selectedModel === m.id 
                          ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200' 
                          : 'border-border hover:border-amber-300 hover:bg-amber-50/50'
                        }
                      `}
                    >
                      {m.imageUrl && (
                        <div className="aspect-video mb-2 rounded overflow-hidden bg-muted">
                          <img 
                            src={m.imageUrl} 
                            alt={m.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="text-sm font-medium">{m.name}</div>
                      <div className="text-lg font-bold text-amber-700">{m.basePrice.toLocaleString('pl-PL')} PLN</div>
                      {m.discount > 0 && (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <Tag className="h-3 w-3" />
                          {txt.discount}: {m.discount}%
                        </div>
                      )}
                      {m.foundationPrice > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {txt.foundation}: +{m.foundationPrice} PLN
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Option Categories */}
          {prices.categories?.map((category) => {
            const Icon = categoryIcons[category.name] || Package;
            const isDropdownView = category.displayType === 'dropdown';
            
            return (
              <Card key={category.id} className="shadow-md">
                <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
                  <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
                    <Icon className="h-5 w-5" />
                    {getCategoryName(category)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {category.inputType === 'checkbox' ? (
                    // Checkbox type - always show as grid/tiles (checkboxes don't work well in dropdowns)
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {category.options?.map((option) => {
                        const isChecked = formData.selections[category.id]?.[option.id] || false;
                        const quantity = formData.quantities[option.id] || 1;
                        return (
                          <div
                            key={option.id}
                            className={`
                              flex items-start space-x-3 p-3 rounded-lg border transition-all
                              ${isChecked ? 'bg-amber-50 border-amber-400' : 'bg-muted/30 border-border hover:bg-muted/50'}
                            `}
                          >
                            <CheckboxOrange
                              id={`${category.id}-${option.id}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => handleCheckboxChange(category.id, option.id, checked)}
                            />
                            <div className="flex-1">
                              <Label
                                htmlFor={`${category.id}-${option.id}`}
                                className="cursor-pointer text-sm leading-tight block"
                              >
                                {option.name}
                              </Label>
                              <div className="flex items-center gap-2 flex-wrap">
                                {option.price > 0 ? (
                                  <span className="text-xs text-amber-700 font-medium">
                                    +{option.price.toLocaleString('pl-PL')} PLN
                                    {option.hasQuantity && quantity > 1 && ` × ${quantity} = ${(option.price * quantity).toLocaleString('pl-PL')} PLN`}
                                  </span>
                                ) : (
                                  <span className="text-xs text-green-600">
                                    {option.name.toLowerCase().includes('belki') ? txt.priceDepends : txt.gratis}
                                  </span>
                                )}
                                {option.hasQuantity && isChecked && (
                                  <div className="flex items-center gap-1">
                                    <Label className="text-xs text-muted-foreground">{txt.quantity}:</Label>
                                    <InputOrange
                                      type="number"
                                      min="1"
                                      value={quantity}
                                      onChange={(e) => handleQuantityChange(option.id, e.target.value)}
                                      className="w-16 h-6 text-xs"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            {option.imageUrl && (
                              <img 
                                src={option.imageUrl} 
                                alt={option.name}
                                className="w-16 h-12 object-cover rounded"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : isDropdownView ? (
                    // Dropdown/List View for Radio type
                    <SelectOrange
                      value={formData.selections[category.id] || ''}
                      onValueChange={(value) => handleRadioChange(category.id, value)}
                    >
                      <SelectTriggerOrange className="w-full">
                        <SelectValueOrange placeholder={getCategoryName(category)} />
                      </SelectTriggerOrange>
                      <SelectContentOrange>
                        {category.options?.map((option) => (
                          <SelectItemOrange key={option.id} value={option.id}>
                            <div className="flex items-center gap-2">
                              {option.imageUrl && (
                                <img src={option.imageUrl} alt={option.name} className="w-8 h-6 object-cover rounded" />
                              )}
                              <span>{option.name}</span>
                              <span className="text-amber-700 font-medium ml-2">
                                {option.price > 0 ? `+${option.price.toLocaleString('pl-PL')} PLN` : (option.name.toLowerCase().includes('belki') ? txt.priceDepends : txt.gratis)}
                              </span>
                            </div>
                          </SelectItemOrange>
                        ))}
                      </SelectContentOrange>
                    </SelectOrange>
                  ) : (
                    // Grid/Tile View for Radio type (default)
                    <RadioGroupOrange
                      value={formData.selections[category.id] || ''}
                      onValueChange={(value) => handleRadioChange(category.id, value)}
                      className="grid grid-cols-1 md:grid-cols-2 gap-3"
                    >
                      {category.options?.map((option) => {
                        const isSelected = formData.selections[category.id] === option.id;
                        const quantity = formData.quantities[option.id] || 1;
                        return (
                          <div
                            key={option.id}
                            className={`
                              flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer
                              ${isSelected ? 'bg-amber-50 border-amber-400' : 'bg-muted/30 border-border hover:bg-muted/50'}
                            `}
                            onClick={() => handleRadioChange(category.id, option.id)}
                          >
                            <RadioGroupItemOrange value={option.id} id={`${category.id}-${option.id}`} />
                            <div className="flex-1">
                              <Label
                                htmlFor={`${category.id}-${option.id}`}
                                className="cursor-pointer text-sm leading-tight block"
                              >
                                {option.name}
                              </Label>
                              <div className="flex items-center gap-2 flex-wrap">
                                {option.price > 0 ? (
                                  <span className="text-xs text-amber-700 font-medium">
                                    +{option.price.toLocaleString('pl-PL')} PLN
                                    {option.hasQuantity && quantity > 1 && ` × ${quantity} = ${(option.price * quantity).toLocaleString('pl-PL')} PLN`}
                                  </span>
                                ) : (
                                  <span className="text-xs text-green-600">
                                    {option.name.toLowerCase().includes('belki') ? txt.priceDepends : txt.gratis}
                                  </span>
                                )}
                                {option.hasQuantity && isSelected && (
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Label className="text-xs text-muted-foreground">{txt.quantity}:</Label>
                                    <InputOrange
                                      type="number"
                                      min="1"
                                      value={quantity}
                                      onChange={(e) => handleQuantityChange(option.id, e.target.value)}
                                      className="w-16 h-6 text-xs"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            {option.imageUrl && (
                              <img 
                                src={option.imageUrl} 
                                alt={option.name}
                                className="w-16 h-12 object-cover rounded"
                              />
                            )}
                          </div>
                        );
                      })}
                    </RadioGroupOrange>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Notes */}
          <Card className="shadow-md">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
              <CardTitle className="text-lg text-amber-800">{txt.notes}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder={txt.notesPlaceholder}
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary */}
        <div className="lg:col-span-1">
          <Card className="shadow-lg sticky top-4 border-amber-200">
            <CardHeader className="bg-gradient-to-r from-amber-100 to-orange-100">
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <Calculator className="h-5 w-5" />
                {txt.summary}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {model ? (
                <>
                  {/* Selected Model */}
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="text-sm text-amber-700 font-medium">{txt.model}</div>
                    <div className="font-medium">{model.name}</div>
                    <div className="text-amber-700 font-bold">{model.basePrice.toLocaleString('pl-PL')} PLN</div>
                  </div>

                  {/* Selected Options */}
                  {prices.categories?.map((category) => {
                    const selection = formData.selections[category.id];
                    if (!selection) return null;
                    
                    if (category.inputType === 'checkbox') {
                      const selectedOpts = Object.entries(selection)
                        .filter(([_, isSelected]) => isSelected)
                        .map(([optId]) => category.options?.find(o => o.id === optId))
                        .filter(Boolean);
                      
                      if (selectedOpts.length === 0) return null;
                      
                      return (
                        <div key={category.id} className="text-sm">
                          <div className="text-muted-foreground font-medium">{getCategoryName(category)}</div>
                          {selectedOpts.map(opt => {
                            const quantity = opt.hasQuantity ? (formData.quantities[opt.id] || 1) : 1;
                            const totalPrice = opt.price * quantity;
                            return (
                              <div key={opt.id} className="flex justify-between">
                                <span className="truncate pr-2">
                                  {opt.name}
                                  {opt.hasQuantity && quantity > 1 && ` (×${quantity})`}
                                </span>
                                <span className="text-amber-700 whitespace-nowrap font-medium">
                                  {opt.price > 0 
                                    ? (quantity > 1 
                                        ? `+${totalPrice.toLocaleString('pl-PL')} PLN` 
                                        : `+${opt.price.toLocaleString('pl-PL')} PLN`)
                                    : (opt.name.toLowerCase().includes('belki') ? txt.priceDepends : txt.gratis)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    } else {
                      const opt = category.options?.find(o => o.id === selection);
                      if (!opt) return null;
                      
                      const quantity = opt.hasQuantity ? (formData.quantities[opt.id] || 1) : 1;
                      const totalPrice = opt.price * quantity;
                      
                      return (
                        <div key={category.id} className="text-sm">
                          <div className="text-muted-foreground font-medium">{getCategoryName(category)}</div>
                          <div className="flex justify-between">
                            <span className="truncate pr-2">
                              {opt.name}
                              {opt.hasQuantity && quantity > 1 && ` (×${quantity})`}
                            </span>
                            <span className="text-amber-700 whitespace-nowrap font-medium">
                              {opt.price > 0 
                                ? (quantity > 1 
                                    ? `+${totalPrice.toLocaleString('pl-PL')} PLN` 
                                    : `+${opt.price.toLocaleString('pl-PL')} PLN`)
                                : (opt.name.toLowerCase().includes('belki') ? txt.priceDepends : txt.gratis)}
                            </span>
                          </div>
                        </div>
                      );
                    }
                  })}

                  {/* Foundation */}
                  {foundationPrice > 0 && (
                    <div className="text-sm">
                      <div className="flex justify-between">
                        <span>{txt.foundationPrice}</span>
                        <span className="text-amber-700 font-medium">+{foundationPrice.toLocaleString('pl-PL')} PLN</span>
                      </div>
                    </div>
                  )}

                  {/* Divider */}
                  <div className="border-t border-amber-200 my-2" />

                  {/* Subtotal */}
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{txt.priceBeforeDiscount}</span>
                    <span className="font-medium">{subtotal.toLocaleString('pl-PL')} PLN</span>
                  </div>

                  {/* Discount Section - Moved here */}
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200 space-y-3">
                    <div className="flex items-center gap-2 text-green-700 font-medium">
                      <Percent className="h-4 w-4" />
                      {txt.discount}
                    </div>
                    <div className="flex items-center gap-2">
                      <InputOrange
                        id="discountPercent"
                        type="number"
                        min="0"
                        max={isAdminUser ? 100 : 10}
                        value={appliedDiscount}
                        onChange={handleDiscountChange}
                        className="w-20 h-8"
                      />
                      <span className="text-sm text-muted-foreground">% (max {isAdminUser ? '100' : '10'})</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleApplyStandardDiscount}
                      className="w-full border-green-300 text-green-700 hover:bg-green-100"
                    >
                      <Tag className="h-4 w-4 mr-2" />
                      {txt.applyStandardDiscount}
                    </Button>
                    
                    {/* Admin discount approval checkbox - show when discount > 10% */}
                    {isAdminUser && appliedDiscount > 10 && (
                      <div className="flex items-center gap-2 pt-2 border-t border-green-200">
                        <CheckboxOrange
                          id="adminDiscountApproval"
                          checked={adminDiscountApproved}
                          onCheckedChange={setAdminDiscountApproved}
                        />
                        <Label htmlFor="adminDiscountApproval" className="text-sm text-green-700 cursor-pointer flex items-center gap-1">
                          <Shield className="h-4 w-4" />
                          {lang === 'pl' ? 'Zatwierdzam rabat jako administrator' : 'Одобряю скидку как администратор'}
                        </Label>
                      </div>
                    )}
                    
                    {appliedDiscount > 0 && (
                      <div className="text-sm text-green-700">
                        <div className="flex justify-between">
                          <span>{txt.discount} ({appliedDiscount}%)</span>
                          <span className="font-medium">-{discountAmount.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} PLN</span>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span>{txt.youSave}:</span>
                          <span className="font-bold">{discountAmount.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} PLN</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Admin Gifts Section - show when in edit mode and admin */}
                  {isAdminUser && isEditMode && adminGifts.length > 0 && (
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-700 font-medium">
                        <Gift className="h-4 w-4" />
                        {lang === 'pl' ? 'Prezenty' : 'Подарки'} ({adminGifts.length})
                      </div>
                      <div className="text-xs text-emerald-600">
                        {lang === 'pl' 
                          ? 'Opcje oznaczone jako prezent są darmowe' 
                          : 'Опции, отмеченные как подарок, бесплатны'}
                      </div>
                    </div>
                  )}

                  {/* Total */}
                  <div className="p-3 bg-amber-600 text-white rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{txt.total}</span>
                      <span className="text-2xl font-bold">
                        {total.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} PLN
                      </span>
                    </div>
                    {appliedDiscount > 0 && (
                      <div className="text-xs text-amber-100 mt-1">
                        {txt.discount}: {appliedDiscount}% ({txt.priceBeforeDiscount}: {subtotal.toLocaleString('pl-PL')} PLN)
                      </div>
                    )}
                  </div>

                  {/* Action Buttons - Moved here */}
                  <div className="space-y-2 pt-2">
                    <Button
                      onClick={handleSaveAndGeneratePDF}
                      disabled={loading}
                      className="w-full bg-amber-600 hover:bg-amber-700"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          <FileDown className="h-4 w-4 mr-2" />
                        </>
                      )}
                      {isEditMode 
                        ? (lang === 'pl' ? 'Zapisz zmiany i pobierz PDF' : 'Сохранить изменения и скачать PDF')
                        : txt.saveAndGeneratePDF
                      }
                    </Button>
                    
                    {isEditMode ? (
                      <Button
                        onClick={handleCancelEdit}
                        disabled={loading}
                        variant="outline"
                        className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                      >
                        <X className="h-4 w-4 mr-2" />
                        {lang === 'pl' ? 'Anuluj edycję' : 'Отменить редактирование'}
                      </Button>
                    ) : (
                      <Button
                        onClick={handleClearForm}
                        disabled={loading}
                        variant="outline"
                        className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {txt.clearForm}
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  {txt.selectModelFirst}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
