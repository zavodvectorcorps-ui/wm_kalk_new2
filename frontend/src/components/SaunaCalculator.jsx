import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { toast } from 'sonner';
import { 
  FileDown, Save, RotateCcw, Loader2, User, Phone, MapPin, Calendar,
  Flame, DoorOpen, Layers, Lightbulb, Package, Truck, Image as ImageIcon,
  Percent, Calculator, Thermometer
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
  
  const [formData, setFormData] = useState({
    fullName: '',
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
      customerInfo: 'Информация о клиенте',
      fullName: 'Полное имя',
      phoneNumber: 'Номер телефона',
      fullAddress: 'Полный адрес',
      orderDate: 'Дата заказа',
      selectModel: 'Выберите модель сауны',
      model: 'Модель сауны',
      basePrice: 'Базовая цена',
      foundation: 'Фундамент',
      discount: 'Скидка',
      notes: 'Примечания',
      notesPlaceholder: 'Добавьте примечания к заказу...',
      summary: 'Итог заказа',
      subtotal: 'Сумма опций',
      foundationPrice: 'Стоимость фундамента',
      discountAmount: 'Сумма скидки',
      total: 'ИТОГО',
      saveAndGeneratePDF: 'Сохранить и создать PDF',
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
      phoneNumber: 'Numer telefonu',
      fullAddress: 'Pełny adres',
      orderDate: 'Data zamówienia',
      selectModel: 'Wybierz model sauny',
      model: 'Model sauny',
      basePrice: 'Cena podstawowa',
      foundation: 'Fundament',
      discount: 'Rabat',
      notes: 'Uwagi',
      notesPlaceholder: 'Dodaj uwagi do zamówienia...',
      summary: 'Podsumowanie zamówienia',
      subtotal: 'Suma opcji',
      foundationPrice: 'Koszt fundamentu',
      discountAmount: 'Kwota rabatu',
      total: 'RAZEM',
      saveAndGeneratePDF: 'Zapisz i generuj PDF',
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
        // Sum all selected checkboxes
        Object.entries(selection).forEach(([optId, isSelected]) => {
          if (isSelected) {
            const option = category.options?.find(o => o.id === optId);
            if (option) {
              total += option.price;
            }
          }
        });
      } else {
        // Single selection (radio)
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
    
    // Check if foundation is selected (Belki podłużne)
    const foundationCat = prices.categories?.find(c => c.id === 'fundament');
    if (foundationCat) {
      const selection = formData.selections[foundationCat.id];
      // If "Dodaj do sauny Belki podłużne" is selected, add foundation price
      if (selection && selection.includes('dodaj')) {
        return model.foundationPrice || 0;
      }
    }
    return 0;
  };

  const calculateTotal = () => {
    const model = getSelectedModel();
    if (!model) return 0;
    
    const basePrice = model.basePrice || 0;
    const optionsTotal = calculateOptionsTotal();
    const foundationPrice = calculateFoundationPrice();
    const subtotal = basePrice + optionsTotal + foundationPrice;
    const discount = model.discount || 0;
    const discountAmount = subtotal * (discount / 100);
    
    return subtotal - discountAmount;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleModelChange = (modelId) => {
    setFormData(prev => ({
      ...prev,
      selectedModel: modelId,
    }));
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
    if (!formData.fullName || !formData.phoneNumber || !formData.fullAddress) {
      toast.error(txt.fillRequired);
      return false;
    }
    if (!formData.selectedModel) {
      toast.error(txt.selectModelFirst);
      return false;
    }
    return true;
  };

  const handleSaveAndGeneratePDF = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const model = getSelectedModel();
      const orderData = {
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        fullAddress: formData.fullAddress,
        orderDate: formData.orderDate,
        selectedModel: formData.selectedModel,
        modelName: model?.name || '',
        basePrice: model?.basePrice || 0,
        foundationPrice: calculateFoundationPrice(),
        discount: model?.discount || 0,
        selections: formData.selections,
        notes: formData.notes,
        optionsTotal: calculateOptionsTotal(),
        total: calculateTotal(),
      };

      // 1. Save order
      await axios.post(`${API_URL}/api/sauna/orders`, orderData);
      toast.success(txt.orderSaved);

      // 2. Generate PDF (always in Polish)
      const pdfData = {
        ...orderData,
        language: 'pl',
        categories: prices.categories,
      };

      const response = await axios.post(`${API_URL}/api/sauna/generate-pdf`, pdfData, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sauna_${formData.fullName.replace(/\s+/g, '_')}.pdf`);
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
      phoneNumber: '',
      fullAddress: '',
      orderDate: new Date().toISOString().split('T')[0],
      selectedModel: '',
      selections: initialSelections,
      notes: '',
    });
    toast.success(txt.formCleared);
  };

  const getCategoryName = (category) => {
    return txt[category.name] || category.name;
  };

  const model = getSelectedModel();
  const optionsTotal = calculateOptionsTotal();
  const foundationPrice = calculateFoundationPrice();
  const subtotal = (model?.basePrice || 0) + optionsTotal + foundationPrice;
  const discountAmount = subtotal * ((model?.discount || 0) / 100);
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" />
                {txt.customerInfo}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <Label htmlFor="fullAddress">{txt.fullAddress} *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullAddress"
                      name="fullAddress"
                      value={formData.fullAddress}
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calculator className="h-5 w-5 text-primary" />
                {txt.model} *
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {prices.models?.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => handleModelChange(m.id)}
                    className={`
                      relative cursor-pointer rounded-lg border-2 p-3 transition-all
                      ${formData.selectedModel === m.id 
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
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
                    <div className="text-lg font-bold text-primary">{m.basePrice.toLocaleString()} PLN</div>
                    {m.discount > 0 && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <Percent className="h-3 w-3" />
                        -{m.discount}% {txt.discount}
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
            </CardContent>
          </Card>

          {/* Option Categories */}
          {prices.categories?.map((category) => {
            const Icon = categoryIcons[category.name] || Package;
            
            return (
              <Card key={category.id} className="shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Icon className="h-5 w-5 text-primary" />
                    {getCategoryName(category)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {category.inputType === 'checkbox' ? (
                    // Checkbox options
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {category.options?.map((option) => {
                        const isChecked = formData.selections[category.id]?.[option.id] || false;
                        return (
                          <div
                            key={option.id}
                            className={`
                              flex items-start space-x-3 p-3 rounded-lg border transition-all
                              ${isChecked ? 'bg-primary/5 border-primary' : 'bg-muted/30 border-border hover:bg-muted/50'}
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
                              {option.price > 0 && (
                                <span className="text-xs text-primary font-medium">
                                  +{option.price} PLN
                                </span>
                              )}
                              {option.price === 0 && (
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
                    // Radio options
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
                              ${isSelected ? 'bg-primary/5 border-primary' : 'bg-muted/30 border-border hover:bg-muted/50'}
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
                              {option.price > 0 && (
                                <span className="text-xs text-primary font-medium">
                                  +{option.price} PLN
                                </span>
                              )}
                              {option.price === 0 && (
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
            <CardHeader>
              <CardTitle className="text-lg">{txt.notes}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder={txt.notesPlaceholder}
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleSaveAndGeneratePDF}
              disabled={loading}
              size="lg"
              className="flex-1 min-w-[250px]"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  <FileDown className="h-5 w-5 mr-2" />
                </>
              )}
              {txt.saveAndGeneratePDF}
            </Button>
            
            <Button
              onClick={handleClearForm}
              disabled={loading}
              variant="outline"
              size="lg"
            >
              <RotateCcw className="h-5 w-5 mr-2" />
              {txt.clearForm}
            </Button>
          </div>
        </div>

        {/* Right Column - Summary */}
        <div className="lg:col-span-1">
          <Card className="shadow-lg sticky top-4">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                {txt.summary}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {model ? (
                <>
                  {/* Selected Model */}
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">{txt.model}</div>
                    <div className="font-medium">{model.name}</div>
                    <div className="text-primary font-bold">{model.basePrice.toLocaleString()} PLN</div>
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
                          <div className="text-muted-foreground">{getCategoryName(category)}</div>
                          {selectedOpts.map(opt => (
                            <div key={opt.id} className="flex justify-between">
                              <span className="truncate pr-2">{opt.name}</span>
                              <span className="text-primary whitespace-nowrap">+{opt.price} PLN</span>
                            </div>
                          ))}
                        </div>
                      );
                    } else {
                      const opt = category.options?.find(o => o.id === selection);
                      if (!opt) return null;
                      
                      return (
                        <div key={category.id} className="text-sm">
                          <div className="text-muted-foreground">{getCategoryName(category)}</div>
                          <div className="flex justify-between">
                            <span className="truncate pr-2">{opt.name}</span>
                            <span className="text-primary whitespace-nowrap">+{opt.price} PLN</span>
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
                        <span className="text-primary">+{foundationPrice} PLN</span>
                      </div>
                    </div>
                  )}

                  {/* Discount */}
                  {model.discount > 0 && (
                    <div className="text-sm text-green-600">
                      <div className="flex justify-between">
                        <span>{txt.discount} ({model.discount}%)</span>
                        <span>-{discountAmount.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} PLN</span>
                      </div>
                    </div>
                  )}

                  {/* Divider */}
                  <div className="border-t my-2" />

                  {/* Total */}
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>{txt.total}</span>
                    <span className="text-2xl text-primary">
                      {total.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} PLN
                    </span>
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
