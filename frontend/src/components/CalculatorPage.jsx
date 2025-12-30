import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { DynamicCustomerForm } from './CustomerInfoForm';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { FileDown, Save, RotateCcw, Loader2, Droplets, Check, Package, Info, Percent, Tag } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Helper to get full image URL
const getImageUrl = (url) => {
  if (!url) return '';
  // If it's already an absolute URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // If it's a relative path, prepend the API URL
  return `${API_URL}${url}`;
};

// Simple image component like in SaunaCalculator - fast and reliable
const SimpleImage = ({ src, alt, className }) => {
  const fullSrc = React.useMemo(() => {
    if (!src) return null;
    if (src.startsWith('http')) return src;
    if (src.startsWith('/api/')) return `${API_URL}${src}`;
    return src;
  }, [src]);

  if (!fullSrc) return null;

  return (
    <img 
      src={fullSrc}
      alt={alt || ''}
      className={className}
      loading="eager"
      decoding="async"
    />
  );
};

// Preload function for images
const preloadImages = (urls) => {
  urls.forEach(url => {
    if (url) {
      const img = new Image();
      img.src = url.startsWith('http') ? url : url.startsWith('/api/') ? `${API_URL}${url}` : url;
    }
  });
};

export const CalculatorPage = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prices, setPrices] = useState({ models: [], categories: [], currency: 'EUR', currencySymbol: '€' });
  const [discountPercent, setDiscountPercent] = useState(0);
  
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    fullAddress: '',
    orderDate: new Date().toISOString().split('T')[0],
    selectedModel: '',
    selections: {},
    notes: '',
  });

  useEffect(() => {
    fetchPrices();
  }, []);

  const fetchPrices = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/prices`);
      const data = response.data || {};
      
      // Ensure arrays are always arrays
      const safeData = {
        ...data,
        models: Array.isArray(data.models) ? data.models : [],
        categories: Array.isArray(data.categories) ? data.categories : [],
        currency: data.currency || 'EUR',
        currencySymbol: data.currencySymbol || '€'
      };
      
      setPrices(safeData);
      
      // Collect ALL image URLs for preloading
      const imageUrls = [];
      
      // Model images
      safeData.models.forEach(model => {
        if (model.imageUrl) imageUrls.push(model.imageUrl);
      });
      
      // Category and option images
      safeData.categories.forEach(cat => {
        if (cat.imageUrl) imageUrls.push(cat.imageUrl);
        cat.options?.forEach(opt => {
          if (opt.imageUrl) imageUrls.push(opt.imageUrl);
        });
      });
      
      // Preload all images at once
      preloadImages(imageUrls);
      
      // Initialize selections
      const categories = safeData.categories;
      const initialSelections = {};
      categories.forEach(cat => {
        if (cat.inputType === 'checkbox') {
          initialSelections[cat.id] = {};
        } else {
          // Set first option as default for dropdowns
          const firstOption = cat.options?.[0];
          initialSelections[cat.id] = firstOption?.id || '';
        }
      });
      
      setFormData(prev => ({ ...prev, selections: initialSelections }));
    } catch (error) {
      console.error('Error fetching prices:', error);
      toast.error(t('balia.error'));
    } finally {
      setLoading(false);
    }
  };

  const selectedModel = prices.models?.find(m => m.id === formData.selectedModel);

  const calculateSubtotal = () => {
    let total = selectedModel?.basePrice || 0;
    
    prices.categories?.forEach(category => {
      const selection = formData.selections[category.id];
      
      if (category.inputType === 'checkbox') {
        // Sum all selected checkboxes
        Object.entries(selection || {}).forEach(([optId, isSelected]) => {
          if (isSelected) {
            const opt = category.options?.find(o => o.id === optId);
            if (opt) total += opt.price || 0;
          }
        });
      } else {
        // Single selection
        const opt = category.options?.find(o => o.id === selection);
        if (opt) total += opt.price || 0;
      }
    });
    
    return total;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discountAmount = subtotal * (discountPercent / 100);
    return subtotal - discountAmount;
  };

  const getDiscountAmount = () => {
    return calculateSubtotal() * (discountPercent / 100);
  };

  const getOptionsTotal = () => {
    let total = 0;
    
    prices.categories?.forEach(category => {
      const selection = formData.selections[category.id];
      
      if (category.inputType === 'checkbox') {
        Object.entries(selection || {}).forEach(([optId, isSelected]) => {
          if (isSelected) {
            const opt = category.options?.find(o => o.id === optId);
            if (opt) total += opt.price || 0;
          }
        });
      } else {
        const opt = category.options?.find(o => o.id === selection);
        if (opt) total += opt.price || 0;
      }
    });
    
    return total;
  };

  const handleModelSelect = (modelId) => {
    setFormData(prev => ({ ...prev, selectedModel: modelId }));
  };

  const handleSelectionChange = (categoryId, value) => {
    setFormData(prev => ({
      ...prev,
      selections: { ...prev.selections, [categoryId]: value }
    }));
  };

  const handleCheckboxChange = (categoryId, optionId, checked) => {
    setFormData(prev => ({
      ...prev,
      selections: {
        ...prev.selections,
        [categoryId]: {
          ...prev.selections[categoryId],
          [optionId]: checked
        }
      }
    }));
  };

  const handleSaveOrderAndGeneratePdf = async () => {
    if (!formData.fullName || !formData.selectedModel) {
      toast.error(t('balia.fillRequired'));
      return;
    }
    
    setSaving(true);
    try {
      // Prepare selected options
      const selectedOptions = [];
      prices.categories?.forEach(cat => {
        const selection = formData.selections[cat.id];
        if (cat.inputType === 'checkbox') {
          Object.entries(selection || {}).forEach(([optId, isSelected]) => {
            if (isSelected) {
              const opt = cat.options?.find(o => o.id === optId);
              if (opt) {
                selectedOptions.push({
                  categoryId: cat.id,
                  categoryName: cat[`name${lang === 'pl' ? 'Pl' : 'Ru'}`] || cat.name,
                  optionId: opt.id,
                  optionName: opt[`name${lang === 'pl' ? 'Pl' : 'Ru'}`] || opt.name,
                  price: opt.price
                });
              }
            }
          });
        } else if (selection) {
          const opt = cat.options?.find(o => o.id === selection);
          if (opt && opt.price > 0) {
            selectedOptions.push({
              categoryId: cat.id,
              categoryName: cat[`name${lang === 'pl' ? 'Pl' : 'Ru'}`] || cat.name,
              optionId: opt.id,
              optionName: opt[`name${lang === 'pl' ? 'Pl' : 'Ru'}`] || opt.name,
              price: opt.price
            });
          }
        }
      });

      // Generate order ID in format WMB-DD-MM-YYYY-HHMMSS
      const now = new Date();
      const orderId = `WMB-${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

      const order = {
        id: orderId,
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        fullAddress: formData.fullAddress,
        orderDate: formData.orderDate,
        modelId: selectedModel?.id,
        modelName: selectedModel?.[`name${lang === 'pl' ? 'Pl' : 'Ru'}`] || selectedModel?.name,
        modelPrice: selectedModel?.basePrice || 0,
        selections: formData.selections,
        selectedOptions,
        notes: formData.notes,
        discountPercent: discountPercent,
        subtotal: calculateSubtotal(),
        total: calculateTotal(),
        currency: prices.currency || 'EUR',
        createdAt: new Date().toISOString(),
        createdBy: user?.username || '',
      };

      // Step 1: Save the order
      await axios.post(`${API_URL}/api/orders`, order);
      toast.success(t('balia.saved'));

      // Step 2: Generate PDF with the same order ID
      const pdfRequest = {
        orderId: orderId,  // Pass order ID for filename
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        fullAddress: formData.fullAddress,
        orderDate: formData.orderDate,
        modelId: selectedModel?.id,
        modelName: getModelName(selectedModel),
        modelPrice: selectedModel?.basePrice || 0,
        modelImageUrl: getImageUrl(selectedModel?.imageUrl) || '',
        selections: formData.selections,
        selectedOptions,
        notes: formData.notes,
        discountPercent: discountPercent,
        subtotal: calculateSubtotal(),
        total: calculateTotal(),
        currency: prices.currency || 'EUR',
        language: 'pl',
        type: 'customer'
      };

      const response = await axios.post(`${API_URL}/api/generate-pdf`, pdfRequest, {
        responseType: 'blob'
      });
      
      // Use order ID as filename
      const filename = `${orderId}.pdf`;
      
      // Download the PDF
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(t('balia.pdfGenerated') || 'PDF created!');
    } catch (error) {
      console.error('Error:', error);
      toast.error(t('balia.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    const initialSelections = {};
    prices.categories?.forEach(cat => {
      if (cat.inputType === 'checkbox') {
        initialSelections[cat.id] = {};
      } else {
        const firstOption = cat.options?.[0];
        initialSelections[cat.id] = firstOption?.id || '';
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
    setDiscountPercent(0);
  };

  const getOptionName = (option) => {
    return option[`name${lang === 'pl' ? 'Pl' : 'Ru'}`] || option.name;
  };

  const getCategoryName = (category) => {
    return category[`name${lang === 'pl' ? 'Pl' : 'Ru'}`] || category.name;
  };

  const getModelName = (model) => {
    return model[`name${lang === 'pl' ? 'Pl' : 'Ru'}`] || model.name;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <h1 className="text-2xl font-bold text-blue-800 mb-6 flex items-center gap-2">
        <Droplets className="h-6 w-6" />
        {t('balia.title')}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Customer & Model */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <DynamicCustomerForm calculatorType="balia" formData={formData} setFormData={setFormData} />

          {/* Model Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-700">{t('balia.selectModel')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {prices.models?.map(model => (
                  <div
                    key={model.id}
                    onClick={() => handleModelSelect(model.id)}
                    className={`relative p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.selectedModel === model.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {/* Info icon for model hint */}
                    {model.hint && (
                      <Tooltip>
                        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <div className="absolute top-2 left-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full p-1 z-10 cursor-help shadow-sm">
                            <Info className="h-4 w-4" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-sm bg-gray-900 text-white p-2">
                          {model.hint}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {model.imageUrl && (
                      <div className="w-full h-32 rounded mb-2 bg-gray-100 overflow-hidden">
                        <SimpleImage 
                          src={getImageUrl(model.imageUrl)} 
                          alt={getModelName(model)}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    {!model.imageUrl && (
                      <div className="w-full h-32 rounded mb-2 bg-gray-100 flex items-center justify-center">
                        <Droplets className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-sm">{getModelName(model)}</span>
                      {formData.selectedModel === model.id && (
                        <Check className="h-5 w-5 text-blue-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-lg font-bold text-blue-600">
                      {model.basePrice} {prices.currencySymbol}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {model.heaterType === 'external' ? t('balia.externalHeater') : t('balia.integratedHeater')}
                    </div>
                    {model.type === 'acrylic' && (
                      <Badge variant="outline" className="mt-2 text-xs">Acrylic</Badge>
                    )}
                  </div>
                ))}
              </div>

              {/* Model Specs */}
              {selectedModel && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  {/* Model hint as text block */}
                  {selectedModel.hint && (
                    <div className="flex items-start gap-2 mb-3 p-2 bg-white rounded-md border border-blue-100">
                      <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-gray-600 leading-relaxed">{selectedModel.hint}</p>
                    </div>
                  )}
                  <h4 className="font-semibold text-blue-800 mb-2">{t('balia.modelInfo')}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                    {selectedModel.specs?.outerDiameter && (
                      <div><span className="text-muted-foreground">{t('balia.outerDiameter')}:</span> {selectedModel.specs.outerDiameter} cm</div>
                    )}
                    {selectedModel.specs?.outerWidth && (
                      <div><span className="text-muted-foreground">{t('balia.size')}:</span> {selectedModel.specs.outerWidth}×{selectedModel.specs.outerLength} cm</div>
                    )}
                    {selectedModel.specs?.depth && (
                      <div><span className="text-muted-foreground">{t('balia.depth')}:</span> {selectedModel.specs.depth} cm</div>
                    )}
                    {selectedModel.specs?.heaterPower && (
                      <div><span className="text-muted-foreground">{t('balia.heaterPower')}:</span> {selectedModel.specs.heaterPower} kW</div>
                    )}
                    {selectedModel.specs?.waterCapacity && (
                      <div><span className="text-muted-foreground">{t('balia.waterCapacity')}:</span> {selectedModel.specs.waterCapacity} L</div>
                    )}
                  </div>
                  {selectedModel.includes && selectedModel.includes.length > 0 && (
                    <div className="mt-3">
                      <span className="text-muted-foreground text-sm">{t('balia.included')}:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedModel.includes.map(item => (
                          <Badge key={item} variant="secondary" className="text-xs">{item.replace(/_/g, ' ')}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-700">{t('balia.options')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {prices.categories?.map(category => (
                <div key={category.id} className="border-b pb-4 last:border-b-0">
                  <div className="flex items-center gap-3 mb-3">
                    {category.imageUrl && (
                      <SimpleImage 
                        src={getImageUrl(category.imageUrl)} 
                        alt={getCategoryName(category)}
                        className="w-10 h-10 object-contain rounded"
                      />
                    )}
                    <Label className="font-semibold text-sm">{getCategoryName(category)}</Label>
                  </div>
                  
                  {/* Tiles display for categories with images */}
                  {(category.displayType === 'tiles' || category.displayType === 'grid') ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {category.options?.map(option => {
                        const isSelected = category.inputType === 'checkbox'
                          ? formData.selections[category.id]?.[option.id]
                          : formData.selections[category.id] === option.id;
                        
                        return (
                          <div
                            key={option.id}
                            onClick={() => {
                              if (category.inputType === 'checkbox') {
                                handleCheckboxChange(category.id, option.id, !isSelected);
                              } else {
                                handleSelectionChange(category.id, option.id);
                              }
                            }}
                            className={`relative p-2 border-2 rounded-lg cursor-pointer transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
                                : 'border-gray-200 hover:border-blue-300'
                            }`}
                          >
                            {isSelected && (
                              <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-0.5 z-10">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                            {option.hint && (
                              <Tooltip>
                                <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <div className="absolute top-1 left-1 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full p-1 z-10 cursor-help shadow-sm">
                                    <Info className="h-4 w-4" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs text-sm bg-gray-900 text-white p-2">
                                  {option.hint}
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {option.imageUrl && (
                              <div className="w-full h-20 rounded mb-2 bg-gray-100 overflow-hidden">
                                <SimpleImage 
                                  src={getImageUrl(option.imageUrl)} 
                                  alt={getOptionName(option)}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            {!option.imageUrl && (
                              <div className="w-full h-20 rounded mb-2 bg-gray-100 flex items-center justify-center">
                                <Package className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                            <div className="text-xs font-medium text-center line-clamp-2">
                              {getOptionName(option)}
                            </div>
                            {option.price > 0 && (
                              <div className="text-xs text-blue-600 font-semibold text-center mt-1">
                                +{option.price} {prices.currencySymbol}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : category.inputType === 'checkbox' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {category.options?.map(option => (
                        <div key={option.id} className="flex items-center gap-2">
                          {option.imageUrl && (
                            <img 
                              src={getImageUrl(option.imageUrl)} 
                              alt={getOptionName(option)}
                              className="w-8 h-8 object-contain rounded"
                              onError={(e) => e.target.style.display = 'none'}
                            />
                          )}
                          <Checkbox
                            id={option.id}
                            checked={formData.selections[category.id]?.[option.id] || false}
                            onCheckedChange={(checked) => handleCheckboxChange(category.id, option.id, checked)}
                          />
                          <Label htmlFor={option.id} className="text-sm cursor-pointer flex-1 flex items-center gap-1">
                            {getOptionName(option)}
                            {option.hint && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help flex-shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs text-sm bg-gray-900 text-white p-2">
                                  {option.hint}
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {option.price > 0 && (
                              <span className="text-blue-600 ml-1">+{option.price} {prices.currencySymbol}</span>
                            )}
                          </Label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Select
                        value={formData.selections[category.id] || ''}
                        onValueChange={(value) => handleSelectionChange(category.id, value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {category.options?.map(option => (
                            <SelectItem key={option.id} value={option.id}>
                              <div className="flex items-center gap-2">
                                {option.imageUrl && (
                                  <img 
                                    src={getImageUrl(option.imageUrl)} 
                                    alt={getOptionName(option)}
                                    className="w-6 h-6 object-contain rounded"
                                  />
                                )}
                                <span className="flex items-center gap-1">
                                  {getOptionName(option)}
                                  {option.price > 0 && ` (+${option.price} ${prices.currencySymbol})`}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* Show hint text below dropdown for selected option */}
                      {(() => {
                        const selectedOpt = category.options?.find(o => o.id === formData.selections[category.id]);
                        return selectedOpt?.hint ? (
                          <div className="flex items-start gap-1.5 p-2 bg-blue-50 rounded-md border border-blue-100">
                            <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-gray-600 leading-relaxed">
                              {selectedOpt.hint}
                            </p>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-700">{t('balia.notes')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder={t('balia.notesPlaceholder')}
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader className="bg-blue-600 text-white rounded-t-lg">
              <CardTitle>{t('balia.total')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {selectedModel && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('balia.basePrice')}:</span>
                    <span className="font-semibold">{selectedModel.basePrice} {prices.currencySymbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('balia.optionsPrice')}:</span>
                    <span className="font-semibold">{getOptionsTotal()} {prices.currencySymbol}</span>
                  </div>
                  
                  {/* Subtotal before discount */}
                  <div className="border-t pt-3 flex justify-between">
                    <span className="text-muted-foreground">{lang === 'pl' ? 'Przed rabatem' : 'До скидки'}:</span>
                    <span className="font-semibold">{calculateSubtotal().toFixed(2)} {prices.currencySymbol}</span>
                  </div>
                  
                  {/* Discount Section */}
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200 space-y-3">
                    <div className="flex items-center gap-2 text-green-700 font-medium">
                      <Percent className="h-4 w-4" />
                      {lang === 'pl' ? 'Rabat' : 'Скидка'}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="20"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(Math.max(0, Math.min(20, parseFloat(e.target.value) || 0)))}
                        className="w-20 h-8"
                      />
                      <span className="text-sm text-muted-foreground">% (max 20)</span>
                    </div>
                    {discountPercent > 0 && (
                      <div className="text-sm text-green-700 space-y-1">
                        <div className="flex justify-between">
                          <span>{lang === 'pl' ? 'Kwota rabatu' : 'Сумма скидки'}:</span>
                          <span className="font-medium">-{getDiscountAmount().toFixed(2)} {prices.currencySymbol}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{lang === 'pl' ? 'Oszczędzasz' : 'Вы экономите'}:</span>
                          <span className="font-bold">{getDiscountAmount().toFixed(2)} {prices.currencySymbol}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Final Total */}
                  <div className="p-3 bg-blue-600 text-white rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{t('balia.total')}:</span>
                      <span className="text-2xl font-bold">
                        {calculateTotal().toFixed(2)} {prices.currencySymbol}
                      </span>
                    </div>
                    {discountPercent > 0 && (
                      <div className="text-xs text-blue-100 mt-1">
                        {lang === 'pl' ? 'Rabat' : 'Скидка'}: {discountPercent}%
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="space-y-2 pt-4">
                <Button
                  onClick={handleSaveOrderAndGeneratePdf}
                  disabled={saving || !formData.selectedModel}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                    </>
                  )}
                  {lang === 'pl' ? 'Zapisz i pobierz PDF' : 'Сохранить и скачать PDF'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleClear}
                  className="w-full"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t('balia.clear')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
};
