import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { 
  FileDown, Save, RotateCcw, Loader2, User, Phone, MapPin, Calendar,
  Flame, DoorOpen, Layers, Lightbulb, Package, Truck,
  Percent, Calculator, Thermometer, Tag, Mail
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

export const SaunaCalculator = () => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [prices, setPrices] = useState({ models: [], categories: [] });
  const [appliedDiscount, setAppliedDiscount] = useState(0); // Скидка применяется по кнопке
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    fullAddress: '',
    orderDate: new Date().toISOString().split('T')[0],
    selectedModel: '',
    selections: {},
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
              total += option.price;
            }
          }
        });
      } else {
        const option = category.options?.find(o => o.id === selection);
        if (option) {
          total += option.price;
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
    const value = Math.max(0, Math.min(10, parseFloat(e.target.value) || 0));
    setAppliedDiscount(value);
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
    
    const modelDiscount = Math.min(model.discount || 0, 10); // Max 10%
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
              options.push({
                categoryId: category.id,
                categoryName: category.name,
                optionId: option.id,
                optionName: option.name,
                price: option.price,
                imageUrl: option.imageUrl || null,
              });
            }
          }
        });
      } else {
        const option = category.options?.find(o => o.id === selection);
        if (option) {
          options.push({
            categoryId: category.id,
            categoryName: category.name,
            optionId: option.id,
            optionName: option.name,
            price: option.price,
            imageUrl: option.imageUrl || null,
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
      const total = calculateTotal();
      const selectedOptions = getSelectedOptions();
      
      const orderData = {
        fullName: formData.fullName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        fullAddress: formData.fullAddress,
        orderDate: formData.orderDate,
        selectedModel: formData.selectedModel,
        modelName: model?.name || '',
        basePrice: model?.basePrice || 0,
        foundationPrice: calculateFoundationPrice(),
        discountPercent: appliedDiscount,
        selections: formData.selections,
        selectedOptions: selectedOptions,
        notes: formData.notes,
        optionsTotal: calculateOptionsTotal(),
        subtotal: subtotal,
        total: total,
      };

      // 1. Save order and get the order ID
      const orderResponse = await axios.post(`${API_URL}/api/sauna/orders`, orderData);
      const orderId = orderResponse.data?.id || '';
      toast.success(txt.orderSaved);

      // 2. Generate PDF with order ID
      const pdfData = {
        ...orderData,
        orderId: orderId,
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
      notes: '',
    });
    setAppliedDiscount(0);
    toast.success(txt.formCleared);
  };

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
                    <Input
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
                    <Input
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
                    <Input
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
                    <Input
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
                <Select
                  value={formData.selectedModel}
                  onValueChange={(value) => handleModelChange(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={txt.selectModel} />
                  </SelectTrigger>
                  <SelectContent>
                    {prices.models?.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
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
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {category.options?.map((option) => {
                        const isChecked = formData.selections[category.id]?.[option.id] || false;
                        return (
                          <div
                            key={option.id}
                            className={`
                              flex items-start space-x-3 p-3 rounded-lg border transition-all
                              ${isChecked ? 'bg-amber-50 border-amber-400' : 'bg-muted/30 border-border hover:bg-muted/50'}
                            `}
                          >
                            <Checkbox
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
                              {option.price > 0 ? (
                                <span className="text-xs text-amber-700 font-medium">
                                  +{option.price.toLocaleString('pl-PL')} PLN
                                </span>
                              ) : (
                                <span className="text-xs text-green-600">{txt.gratis}</span>
                              )}
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
                  ) : (
                    <RadioGroup
                      value={formData.selections[category.id] || ''}
                      onValueChange={(value) => handleRadioChange(category.id, value)}
                      className="grid grid-cols-1 md:grid-cols-2 gap-3"
                    >
                      {category.options?.map((option) => {
                        const isSelected = formData.selections[category.id] === option.id;
                        return (
                          <div
                            key={option.id}
                            className={`
                              flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer
                              ${isSelected ? 'bg-amber-50 border-amber-400' : 'bg-muted/30 border-border hover:bg-muted/50'}
                            `}
                            onClick={() => handleRadioChange(category.id, option.id)}
                          >
                            <RadioGroupItem value={option.id} id={`${category.id}-${option.id}`} />
                            <div className="flex-1">
                              <Label
                                htmlFor={`${category.id}-${option.id}`}
                                className="cursor-pointer text-sm leading-tight block"
                              >
                                {option.name}
                              </Label>
                              {option.price > 0 ? (
                                <span className="text-xs text-amber-700 font-medium">
                                  +{option.price.toLocaleString('pl-PL')} PLN
                                </span>
                              ) : (
                                <span className="text-xs text-green-600">{txt.gratis}</span>
                              )}
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
                    </RadioGroup>
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
                          {selectedOpts.map(opt => (
                            <div key={opt.id} className="flex justify-between">
                              <span className="truncate pr-2">{opt.name}</span>
                              <span className="text-amber-700 whitespace-nowrap font-medium">
                                {opt.price > 0 ? `+${opt.price.toLocaleString('pl-PL')} PLN` : txt.gratis}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    } else {
                      const opt = category.options?.find(o => o.id === selection);
                      if (!opt) return null;
                      
                      return (
                        <div key={category.id} className="text-sm">
                          <div className="text-muted-foreground font-medium">{getCategoryName(category)}</div>
                          <div className="flex justify-between">
                            <span className="truncate pr-2">{opt.name}</span>
                            <span className="text-amber-700 whitespace-nowrap font-medium">
                              {opt.price > 0 ? `+${opt.price.toLocaleString('pl-PL')} PLN` : txt.gratis}
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
                      <Input
                        id="discountPercent"
                        type="number"
                        min="0"
                        max="10"
                        value={appliedDiscount}
                        onChange={handleDiscountChange}
                        className="w-20 h-8"
                      />
                      <span className="text-sm text-muted-foreground">% (max 10)</span>
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
                      {txt.saveAndGeneratePDF}
                    </Button>
                    
                    <Button
                      onClick={handleClearForm}
                      disabled={loading}
                      variant="outline"
                      className="w-full"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      {txt.clearForm}
                    </Button>
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
