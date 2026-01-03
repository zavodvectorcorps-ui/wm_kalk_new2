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
import { FileDown, Save, RotateCcw, Loader2, Droplets, Check, Package, Info, Percent, Tag, X, Edit, Gift, Shield, Circle, Ruler, ArrowDownUp, Gauge, Users, Flame, Weight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Helper to get full image URL - handles both full URLs and legacy relative paths
const getImageUrl = (url) => {
  if (!url) return '';
  // If it's already a full URL (new format), return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Legacy: convert relative path to full URL
  if (url.startsWith('/api/')) {
    return `${API_URL}${url}`;
  }
  return url;
};

export const CalculatorPage = ({ editingOrder = null, onEditComplete }) => {
  const { t, i18n } = useTranslation();
  const { user, isAdmin } = useAuth();
  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prices, setPrices] = useState({ models: [], categories: [], currency: 'EUR', currencySymbol: '€' });
  const [discountPercent, setDiscountPercent] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editOrderId, setEditOrderId] = useState(null);
  // Admin features
  const [adminGifts, setAdminGifts] = useState([]);
  const [adminDiscountApproved, setAdminDiscountApproved] = useState(false);
  // Manager requested discount (visible to admin)
  const [requestedDiscount, setRequestedDiscount] = useState(0);
  const [requestedDiscountNote, setRequestedDiscountNote] = useState('');
  
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    fullAddress: '',
    orderDate: new Date().toISOString().split('T')[0],
    selectedModel: '',
    selectedHeaterType: 'integrated', // New: heater type selection
    selections: {},
    notes: '',
  });

  const isAdminUser = isAdmin && isAdmin();

  useEffect(() => {
    fetchPrices();
  }, []);

  // Load order data when editing
  useEffect(() => {
    if (editingOrder && prices.categories?.length > 0) {
      // Set edit mode
      setIsEditMode(true);
      setEditOrderId(editingOrder.id);
      
      // Load customer data
      setFormData(prev => ({
        ...prev,
        fullName: editingOrder.fullName || '',
        phoneNumber: editingOrder.phoneNumber || '',
        fullAddress: editingOrder.fullAddress || '',
        orderDate: editingOrder.orderDate || new Date().toISOString().split('T')[0],
        selectedModel: editingOrder.modelId || '',
        selectedHeaterType: editingOrder.heaterType || 'integrated', // Load heater type
        notes: editingOrder.notes || '',
        selections: editingOrder.selections || prev.selections,
      }));
      
      // Load requested discount from original order (important for managers editing their orders)
      setRequestedDiscount(editingOrder.requestedDiscount || 0);
      setRequestedDiscountNote(editingOrder.requestedDiscountNote || '');
      
      // If selections is empty but we have selectedOptions, rebuild selections
      if ((!editingOrder.selections || Object.keys(editingOrder.selections).length === 0) && editingOrder.selectedOptions?.length > 0) {
        const rebuiltSelections = {};
        prices.categories.forEach(cat => {
          if (cat.inputType === 'checkbox') {
            rebuiltSelections[cat.id] = {};
          } else {
            // Set first option as default
            const firstOption = cat.options?.[0];
            rebuiltSelections[cat.id] = firstOption?.id || '';
          }
        });
        
        // Apply selected options
        editingOrder.selectedOptions.forEach(opt => {
          const category = prices.categories.find(c => c.id === opt.categoryId);
          if (category) {
            if (category.inputType === 'checkbox') {
              rebuiltSelections[opt.categoryId] = {
                ...(rebuiltSelections[opt.categoryId] || {}),
                [opt.optionId]: true
              };
            } else {
              rebuiltSelections[opt.categoryId] = opt.optionId;
            }
          }
        });
        
        setFormData(prev => ({ ...prev, selections: rebuiltSelections }));
      }
      
      // Load discount
      setDiscountPercent(editingOrder.discountPercent || 0);
      
      // Load admin features
      setAdminGifts(editingOrder.adminGifts || []);
      setAdminDiscountApproved(editingOrder.adminDiscountApproved || false);
      
      toast.info(lang === 'pl' ? `Edycja zamówienia: ${editingOrder.id}` : `Редактирование заказа: ${editingOrder.id}`);
    }
  }, [editingOrder, prices.categories]);

  // Preload all images when prices are loaded
  useEffect(() => {
    if (prices.models?.length > 0) {
      const imageUrls = [];
      
      // Collect model images
      prices.models.forEach(model => {
        if (model.imageUrl) {
          imageUrls.push(getImageUrl(model.imageUrl));
        }
      });
      
      // Collect option images
      prices.categories?.forEach(cat => {
        cat.options?.forEach(opt => {
          if (opt.imageUrl) {
            imageUrls.push(getImageUrl(opt.imageUrl));
          }
        });
      });
      
      // Preload all images
      imageUrls.forEach(url => {
        const img = new Image();
        img.src = url;
      });
    }
  }, [prices]);

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
      
      // Initialize selections only if not editing
      if (!editingOrder) {
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
      }
    } catch (error) {
      console.error('Error fetching prices:', error);
      toast.error(t('balia.error'));
    } finally {
      setLoading(false);
    }
  };

  const selectedModel = prices.models?.find(m => m.id === formData.selectedModel);
  
  // Get selected heater variant for current model
  const selectedHeaterVariant = selectedModel?.heaterVariants?.find(
    v => v.type === formData.selectedHeaterType
  ) || selectedModel?.heaterVariants?.[0];
  
  // Get the correct image URL based on heater selection
  const getModelImageUrl = (model) => {
    if (!model) return '';
    // If model has heater variants, get image from selected variant
    if (model.heaterVariants?.length > 0) {
      const variant = model.heaterVariants.find(v => v.type === formData.selectedHeaterType);
      if (variant?.imageUrl) return variant.imageUrl;
      // Fallback to first variant's image
      if (model.heaterVariants[0]?.imageUrl) return model.heaterVariants[0].imageUrl;
    }
    // Fallback to model's own image
    return model.imageUrl || '';
  };
  
  // Get hint based on heater selection
  const getModelHint = (model) => {
    if (!model) return '';
    // If model has heater variants, get hint from selected variant first
    if (model.heaterVariants?.length > 0) {
      const variant = model.heaterVariants.find(v => v.type === formData.selectedHeaterType);
      if (variant?.hint) return variant.hint;
    }
    // Fallback to model's general hint
    return model.hint || '';
  };
  
  // Get price based on heater selection
  const getModelPrice = (model) => {
    if (!model) return 0;
    // If model has heater variants, get price from selected variant
    if (model.heaterVariants?.length > 0) {
      const variant = model.heaterVariants.find(v => v.type === formData.selectedHeaterType);
      if (variant?.price !== undefined) return variant.price;
      // Fallback to first variant's price
      if (model.heaterVariants[0]?.price !== undefined) return model.heaterVariants[0].price;
    }
    // Fallback to model's base price
    return model.basePrice || 0;
  };

  const calculateSubtotal = () => {
    let total = getModelPrice(selectedModel);
    
    prices.categories?.forEach(category => {
      // Skip dependent categories that should be hidden
      if (category.dependsOn && category.dependsOnValue) {
        const parentValue = formData.selections[category.dependsOn];
        if (parentValue !== category.dependsOnValue) {
          return; // Skip this category
        }
      }
      
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
      // Skip dependent categories that should be hidden
      if (category.dependsOn && category.dependsOnValue) {
        const parentValue = formData.selections[category.dependsOn];
        if (parentValue !== category.dependsOnValue) {
          return; // Skip this category
        }
      }
      
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
    const model = prices.models?.find(m => m.id === modelId);
    // Set default heater type based on available variants
    const defaultHeaterType = model?.heaterVariants?.[0]?.type || 'integrated';
    setFormData(prev => ({ 
      ...prev, 
      selectedModel: modelId,
      selectedHeaterType: defaultHeaterType 
    }));
  };
  
  const handleHeaterTypeChange = (heaterType) => {
    setFormData(prev => ({ ...prev, selectedHeaterType: heaterType }));
  };

  const handleSelectionChange = (categoryId, value) => {
    setFormData(prev => {
      const newSelections = { ...prev.selections, [categoryId]: value };
      
      // Clear dependent category selections when parent value changes
      prices.categories?.forEach(cat => {
        if (cat.dependsOn === categoryId && cat.dependsOnValue !== value) {
          // Reset this dependent category's selection
          if (cat.inputType === 'checkbox') {
            newSelections[cat.id] = {};
          } else {
            delete newSelections[cat.id];
          }
        }
      });
      
      return { ...prev, selections: newSelections };
    });
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
      // Prepare selected options - include ALL categories, show "не выбрано" if nothing selected
      const selectedOptions = [];
      prices.categories?.forEach(cat => {
        const selection = formData.selections[cat.id];
        let hasSelection = false;
        
        if (cat.inputType === 'checkbox') {
          Object.entries(selection || {}).forEach(([optId, isSelected]) => {
            if (isSelected) {
              const opt = cat.options?.find(o => o.id === optId);
              if (opt) {
                hasSelection = true;
                selectedOptions.push({
                  id: opt.id,
                  categoryId: cat.id,
                  categoryName: cat[`name${lang === 'pl' ? 'Pl' : 'Ru'}`] || cat.name,
                  optionId: opt.id,
                  optionName: opt[`name${lang === 'pl' ? 'Pl' : 'Ru'}`] || opt.name,
                  name: opt[`name${lang === 'pl' ? 'Pl' : 'Ru'}`] || opt.name,
                  price: opt.price
                });
              }
            }
          });
        } else if (selection) {
          const opt = cat.options?.find(o => o.id === selection);
          if (opt) {
            hasSelection = true;
            selectedOptions.push({
              id: opt.id,
              categoryId: cat.id,
              categoryName: cat[`name${lang === 'pl' ? 'Pl' : 'Ru'}`] || cat.name,
              optionId: opt.id,
              optionName: opt[`name${lang === 'pl' ? 'Pl' : 'Ru'}`] || opt.name,
              name: opt[`name${lang === 'pl' ? 'Pl' : 'Ru'}`] || opt.name,
              price: opt.price
            });
          }
        }
        
        // If nothing selected in this category, add "Bez [category]" entry
        if (!hasSelection) {
          const categoryName = cat[`name${lang === 'pl' ? 'Pl' : 'Ru'}`] || cat.name;
          
          // Use custom "without" label if provided, otherwise generate from category name
          let withoutText;
          if (cat.withoutLabelPl && lang === 'pl') {
            withoutText = cat.withoutLabelPl;
          } else if (cat.withoutLabelRu && lang !== 'pl') {
            withoutText = cat.withoutLabelRu;
          } else {
            // Fallback: generate "Bez X" / "Без X" format
            withoutText = lang === 'pl' 
              ? `Bez ${categoryName.toLowerCase()}`
              : `Без ${categoryName.toLowerCase()}`;
          }
          
          selectedOptions.push({
            id: `${cat.id}_not_selected`,
            categoryId: cat.id,
            categoryName: categoryName,
            optionId: null,
            optionName: withoutText,
            name: withoutText,
            price: 0,
            notSelected: true
          });
        }
      });

      // Use existing order ID in edit mode, otherwise generate new one
      const orderId = isEditMode && editOrderId 
        ? editOrderId 
        : `WMB-${String(new Date().getDate()).padStart(2, '0')}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${new Date().getFullYear()}-${String(new Date().getHours()).padStart(2, '0')}${String(new Date().getMinutes()).padStart(2, '0')}${String(new Date().getSeconds()).padStart(2, '0')}`;

      // Calculate total considering admin gifts
      const subtotal = calculateSubtotal();
      const giftsTotal = selectedOptions
        .filter(opt => adminGifts.includes(opt.id) || adminGifts.includes(opt.optionId))
        .reduce((sum, opt) => sum + (opt.price || 0), 0);
      const discountableAmount = subtotal - giftsTotal;
      const discountAmount = discountableAmount * (discountPercent / 100);
      const total = discountableAmount - discountAmount;

      const order = {
        id: orderId,
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        fullAddress: formData.fullAddress,
        orderDate: formData.orderDate,
        modelId: selectedModel?.id,
        modelName: selectedModel?.[`name${lang === 'pl' ? 'Pl' : 'Ru'}`] || selectedModel?.name,
        modelPrice: getModelPrice(selectedModel),
        modelImageUrl: getImageUrl(getModelImageUrl(selectedModel)) || '',
        modelSpecs: selectedModel?.specs || {},
        heaterType: formData.selectedHeaterType,
        heaterTypeName: formData.selectedHeaterType === 'integrated' 
          ? (lang === 'pl' ? 'Piec zintegrowany' : 'Встроенная печь')
          : (lang === 'pl' ? 'Piec zewnętrzny' : 'Внешняя печь'),
        selectedHeaterVariantId: selectedHeaterVariant?.id || `${selectedModel?.id}_${formData.selectedHeaterType}`,
        selections: formData.selections,
        selectedOptions,
        notes: formData.notes,
        discountPercent: discountPercent,
        subtotal: subtotal,
        total: total,
        currency: prices.currency || 'EUR',
        createdAt: isEditMode ? (editingOrder?.createdAt || new Date().toISOString()) : new Date().toISOString(),
        createdBy: user?.username || '',
        // Admin fields
        adminGifts: adminGifts,
        adminDiscountApproved: discountPercent > 10 && isAdminUser ? adminDiscountApproved : false,
        adminDiscountApprovedBy: discountPercent > 10 && adminDiscountApproved ? user?.username : '',
        adminDiscountApprovedAt: discountPercent > 10 && adminDiscountApproved ? new Date().toISOString() : '',
        // Manager requested discount
        requestedDiscount: !isAdminUser ? requestedDiscount : 0,
        requestedDiscountNote: !isAdminUser ? requestedDiscountNote : '',
      };

      // Save order - PUT for edit, POST for new
      if (isEditMode) {
        await axios.put(`${API_URL}/api/orders/${orderId}`, order);
        toast.success(lang === 'pl' ? 'Zamówienie zaktualizowane!' : 'Заказ обновлён!');
      } else {
        await axios.post(`${API_URL}/api/orders`, order);
        toast.success(t('balia.saved'));
      }

      // Generate PDF
      const pdfRequest = {
        orderId: orderId,
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        fullAddress: formData.fullAddress,
        orderDate: formData.orderDate,
        modelId: selectedModel?.id,
        modelName: getModelName(selectedModel),
        modelPrice: getModelPrice(selectedModel),
        modelImageUrl: getImageUrl(getModelImageUrl(selectedModel)) || '',
        modelSpecs: selectedModel?.specs || {},
        heaterType: formData.selectedHeaterType,
        heaterTypeName: formData.selectedHeaterType === 'integrated' 
          ? (lang === 'pl' ? 'Piec zintegrowany' : 'Встроенная печь')
          : (lang === 'pl' ? 'Piec zewnętrzny' : 'Внешняя печь'),
        selectedHeaterVariantId: selectedHeaterVariant?.id || `${selectedModel?.id}_${formData.selectedHeaterType}`,
        selections: formData.selections,
        selectedOptions,
        notes: formData.notes,
        discountPercent: discountPercent,
        subtotal: subtotal,
        total: total,
        currency: prices.currency || 'EUR',
        language: 'pl',
        type: 'customer',
        adminGifts: adminGifts,
      };

      const response = await axios.post(`${API_URL}/api/generate-pdf`, pdfRequest, {
        responseType: 'blob'
      });
      
      // Generate filename: BALIA_ClientName_OrderId
      let safeName = (formData.fullName || 'Klient').replace(/\s+/g, '_');
      safeName = safeName.replace(/[<>:"/\\|?*]/g, '');
      if (!safeName || safeName === '_') safeName = 'Klient';
      const filename = `BALIA_${safeName}_${orderId}.pdf`;
      
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
      toast.error(t('balia.error'));
    } finally {
      setSaving(false);
    }
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

  // Toggle gift status for an option
  const toggleGift = (optionId) => {
    setAdminGifts(prev => 
      prev.includes(optionId) 
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    );
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
    setAdminGifts([]);
    setAdminDiscountApproved(false);
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
      {/* Edit Mode Banner */}
      {isEditMode && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Edit className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-800">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {prices.models?.map(model => {
                  const isSelected = formData.selectedModel === model.id;
                  // Get preview image (first variant or model image)
                  const previewImage = model.heaterVariants?.[0]?.imageUrl || model.imageUrl;
                  // Check if model has multiple heater options
                  const hasHeaterOptions = model.heaterVariants?.length > 1;
                  
                  return (
                    <div
                      key={model.id}
                      onClick={() => handleModelSelect(model.id)}
                      className={`relative p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        isSelected
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
                      <div className="w-full h-28 rounded mb-2 bg-gray-100 overflow-hidden relative">
                        {previewImage ? (
                          <img 
                            src={getImageUrl(previewImage)} 
                            alt={getModelName(model)}
                            className="w-full h-full object-contain"
                            loading="eager"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Droplets className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-xs">{getModelName(model)}</span>
                        {isSelected && (
                          <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        )}
                      </div>
                      {hasHeaterOptions && (
                        <div className="text-xs text-muted-foreground">
                          {lang === 'pl' ? '2 warianty pieca' : '2 варианта печи'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Heater Type Selection - appears when model is selected and has variants */}
              {selectedModel && selectedModel.heaterVariants?.length > 1 && (
                <div className="mt-4 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                  <Label className="text-sm font-semibold text-orange-800 mb-3 block">
                    {lang === 'pl' ? 'Wybierz typ pieca:' : 'Выберите тип печки:'}
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedModel.heaterVariants.map(variant => {
                      const isVariantSelected = formData.selectedHeaterType === variant.type;
                      const variantLabel = variant.type === 'integrated' 
                        ? (lang === 'pl' ? 'Zintegrowany piec' : 'Встроенная печь')
                        : (lang === 'pl' ? 'Zewnętrzny piec' : 'Внешняя печь');
                      
                      return (
                        <div
                          key={variant.type}
                          onClick={() => handleHeaterTypeChange(variant.type)}
                          className={`p-3 border-2 rounded-lg cursor-pointer transition-all flex items-center gap-3 ${
                            isVariantSelected
                              ? 'border-orange-500 bg-orange-100 shadow-md'
                              : 'border-orange-200 bg-white hover:border-orange-400'
                          }`}
                        >
                          {variant.imageUrl && (
                            <img 
                              src={getImageUrl(variant.imageUrl)} 
                              alt={variantLabel}
                              className="w-16 h-16 object-contain rounded bg-white"
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{variantLabel}</span>
                              {isVariantSelected && (
                                <Check className="h-4 w-4 text-orange-600" />
                              )}
                            </div>
                            <div className="text-lg font-bold text-orange-600">
                              {variant.price?.toLocaleString('pl-PL')} {prices.currencySymbol}
                            </div>
                            {variant.hint && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{variant.hint}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Model Specs */}
              {selectedModel && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  {/* Selected configuration image */}
                  {getModelImageUrl(selectedModel) && (
                    <div className="mb-4 flex justify-center">
                      <img 
                        src={getImageUrl(getModelImageUrl(selectedModel))} 
                        alt={getModelName(selectedModel)}
                        className="max-h-48 object-contain rounded-lg shadow-sm"
                      />
                    </div>
                  )}
                  {/* Model hint - from selected variant or model */}
                  {getModelHint(selectedModel) && (
                    <div className="flex items-start gap-2 mb-3 p-2 bg-white rounded-md border border-blue-100">
                      <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-gray-600 leading-relaxed">{getModelHint(selectedModel)}</p>
                    </div>
                  )}
                  <h4 className="font-semibold text-blue-800 mb-2">{t('balia.modelInfo')}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                    {/* Outer Diameter */}
                    {!!(selectedModel.specs?.outerDiameter && selectedModel.specs.outerDiameter !== '0' && selectedModel.specs.outerDiameter !== 0) && (
                      <div className="flex items-center gap-1.5">
                        <Circle className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                        <span className="text-muted-foreground text-xs">zew:</span>
                        <span>{selectedModel.specs.outerDiameter}{!String(selectedModel.specs.outerDiameter).includes('cm') ? 'cm' : ''}</span>
                      </div>
                    )}
                    {/* Inner Diameter */}
                    {!!(selectedModel.specs?.innerDiameter && selectedModel.specs.innerDiameter !== '0' && selectedModel.specs.innerDiameter !== 0) && (
                      <div className="flex items-center gap-1.5">
                        <Circle className="h-3 w-3 text-blue-400 flex-shrink-0" />
                        <span className="text-muted-foreground text-xs">wew:</span>
                        <span>{selectedModel.specs.innerDiameter}{!String(selectedModel.specs.innerDiameter).includes('cm') ? 'cm' : ''}</span>
                      </div>
                    )}
                    {/* Dimensions for non-round models */}
                    {!!selectedModel.specs?.dimensions && (
                      <div className="flex items-center gap-1.5">
                        <Ruler className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                        <span className="text-muted-foreground text-xs">wym:</span>
                        <span>{selectedModel.specs.dimensions}</span>
                      </div>
                    )}
                    {/* Legacy: outerWidth x outerLength */}
                    {!!(!selectedModel.specs?.dimensions && selectedModel.specs?.outerWidth && selectedModel.specs.outerWidth !== 0) && (
                      <div className="flex items-center gap-1.5">
                        <Ruler className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                        <span className="text-muted-foreground text-xs">wym:</span>
                        <span>{selectedModel.specs.outerWidth}×{selectedModel.specs.outerLength}cm</span>
                      </div>
                    )}
                    {/* Depth */}
                    {!!(selectedModel.specs?.depth && selectedModel.specs.depth !== '0' && selectedModel.specs.depth !== 0) && (
                      <div className="flex items-center gap-1.5">
                        <ArrowDownUp className="h-3.5 w-3.5 text-cyan-500 flex-shrink-0" />
                        <span className="text-muted-foreground text-xs">głęb:</span>
                        <span>{selectedModel.specs.depth}{!String(selectedModel.specs.depth).includes('cm') ? 'cm' : ''}</span>
                      </div>
                    )}
                    {/* Total Height */}
                    {!!(selectedModel.specs?.totalHeight && selectedModel.specs.totalHeight !== 0 && selectedModel.specs.totalHeight !== '0') && (
                      <div className="flex items-center gap-1.5">
                        <ArrowDownUp className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                        <span className="text-muted-foreground text-xs">wys:</span>
                        <span>{selectedModel.specs.totalHeight}{!String(selectedModel.specs.totalHeight).includes('cm') ? 'cm' : ''}</span>
                      </div>
                    )}
                    {/* Volume (water capacity) */}
                    {!!(selectedModel.specs?.volume || (selectedModel.specs?.waterCapacity && selectedModel.specs.waterCapacity !== 0)) && (
                      <div className="flex items-center gap-1.5">
                        <Droplets className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                        <span className="text-muted-foreground text-xs">poj:</span>
                        <span>{selectedModel.specs.volume || selectedModel.specs.waterCapacity}{!String(selectedModel.specs.volume || selectedModel.specs.waterCapacity).includes('L') ? 'L' : ''}</span>
                      </div>
                    )}
                    {/* Seats */}
                    {!!(selectedModel.specs?.seats && selectedModel.specs.seats !== 0 && selectedModel.specs.seats !== '0') && (
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        <span className="text-muted-foreground text-xs">os:</span>
                        <span>{selectedModel.specs.seats}</span>
                      </div>
                    )}
                    {/* Heater power */}
                    {!!(selectedModel.specs?.heaterPower && selectedModel.specs.heaterPower !== 0 && selectedModel.specs.heaterPower !== '0') && (
                      <div className="flex items-center gap-1.5">
                        <Flame className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                        <span className="text-muted-foreground text-xs">moc:</span>
                        <span>{selectedModel.specs.heaterPower}{!String(selectedModel.specs.heaterPower).includes('kW') ? 'kW' : ''}</span>
                      </div>
                    )}
                    {/* Weight */}
                    {!!(selectedModel.specs?.weight && selectedModel.specs.weight !== '0' && selectedModel.specs.weight !== 0) && (
                      <div className="flex items-center gap-1.5">
                        <Weight className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                        <span className="text-muted-foreground text-xs">waga:</span>
                        <span>{selectedModel.specs.weight}{!String(selectedModel.specs.weight).includes('kg') ? 'kg' : ''}</span>
                      </div>
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
              {prices.categories?.filter(category => {
                // Filter dependent categories - show only if parent value matches
                if (category.dependsOn && category.dependsOnValue) {
                  const parentValue = formData.selections[category.dependsOn];
                  if (parentValue !== category.dependsOnValue) {
                    return false;
                  }
                }
                return true;
              }).map(category => (
                <div key={category.id} className="border-b pb-4 last:border-b-0">
                  <div className="flex items-center gap-3 mb-3">
                    {category.imageUrl && (
                      <img 
                        src={getImageUrl(category.imageUrl)} 
                        alt={getCategoryName(category)}
                        className="w-10 h-10 object-contain rounded"
                        loading="eager"
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
                            <div className="w-full h-20 rounded mb-2 bg-gray-100 overflow-hidden">
                              {option.imageUrl ? (
                                <img 
                                  src={getImageUrl(option.imageUrl)} 
                                  alt={getOptionName(option)}
                                  className="w-full h-full object-cover"
                                  loading="eager"
                                />
                              ) : option.colorPreview ? (
                                <div 
                                  className="w-full h-full flex items-center justify-center relative"
                                  style={{ backgroundColor: option.colorPreview }}
                                >
                                  {/* Glitter effect for special colors */}
                                  {option.id?.includes('black_gold') && (
                                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/30 via-transparent to-yellow-600/20" />
                                  )}
                                  {option.id?.includes('black_pink') && (
                                    <div className="absolute inset-0 bg-gradient-to-br from-pink-400/30 via-transparent to-pink-600/20" />
                                  )}
                                  {option.id?.includes('black_silver') && (
                                    <div className="absolute inset-0 bg-gradient-to-br from-gray-300/40 via-transparent to-gray-400/30" />
                                  )}
                                  {option.id?.includes('marble') && (
                                    <div className="absolute inset-0 opacity-30" 
                                         style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")'}} 
                                    />
                                  )}
                                  {option.id?.includes('pearl') && (
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-white/20" />
                                  )}
                                  {option.id?.includes('galaxy') && (
                                    <>
                                      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 via-blue-900/30 to-indigo-900/50" />
                                      <div className="absolute w-1 h-1 bg-white rounded-full top-2 left-3 animate-pulse" />
                                      <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-6 right-4" />
                                      <div className="absolute w-1 h-1 bg-white rounded-full bottom-3 left-6 animate-pulse" />
                                    </>
                                  )}
                                  {option.id?.includes('snowflake') && (
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-100/30 via-white/20 to-cyan-100/30" />
                                  )}
                                </div>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="h-6 w-6 text-gray-400" />
                                </div>
                              )}
                            </div>
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
                      {category.options?.map(option => {
                        const isSelected = formData.selections[category.id]?.[option.id] || false;
                        const isGift = adminGifts.includes(option.id);
                        return (
                          <div key={option.id} className={`flex items-center gap-2 p-1 rounded ${isGift ? 'bg-emerald-50' : ''}`}>
                            {option.imageUrl && (
                              <img 
                                src={getImageUrl(option.imageUrl)} 
                                alt={getOptionName(option)}
                                className="w-8 h-8 object-contain rounded"
                                loading="eager"
                              />
                            )}
                            <Checkbox
                              id={option.id}
                              checked={isSelected}
                              onCheckedChange={(checked) => handleCheckboxChange(category.id, option.id, checked)}
                            />
                            <Label htmlFor={option.id} className="text-sm cursor-pointer flex-1 flex items-center gap-1">
                              {isGift && <Gift className="h-3 w-3 text-emerald-600" />}
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
                                <span className={`ml-1 ${isGift ? 'line-through text-gray-400' : 'text-blue-600'}`}>
                                  +{option.price} {prices.currencySymbol}
                                </span>
                              )}
                              {isGift && <span className="text-emerald-600 font-medium ml-1">0 {prices.currencySymbol}</span>}
                            </Label>
                            {/* Admin gift button - only in edit mode */}
                            {isAdminUser && isEditMode && isSelected && (
                              <Button
                                type="button"
                                size="sm"
                                variant={isGift ? "default" : "ghost"}
                                className={`h-6 px-2 ${isGift ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
                                onClick={() => toggleGift(option.id)}
                                title={isGift ? (lang === 'pl' ? 'Usuń prezent' : 'Убрать подарок') : (lang === 'pl' ? 'Oznacz jako prezent' : 'Сделать подарком')}
                              >
                                <Gift className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Select
                        value={formData.selections[category.id] || ''}
                        onValueChange={(value) => handleSelectionChange(category.id, value)}
                      >
                        <SelectTrigger className="w-full">
                          {(() => {
                            const selectedOpt = category.options?.find(o => o.id === formData.selections[category.id]);
                            if (selectedOpt) {
                              return (
                                <div className="flex items-center gap-2">
                                  {selectedOpt.colorPreview && (
                                    <div 
                                      className="w-5 h-5 rounded border border-gray-300 flex-shrink-0"
                                      style={{ backgroundColor: selectedOpt.colorPreview }}
                                    />
                                  )}
                                  <span>{getOptionName(selectedOpt)}</span>
                                </div>
                              );
                            }
                            return <SelectValue placeholder={lang === 'pl' ? 'Wybierz...' : 'Выберите...'} />;
                          })()}
                        </SelectTrigger>
                        <SelectContent>
                          {category.options?.map(option => (
                            <SelectItem key={option.id} value={option.id}>
                              <div className="flex items-center gap-2">
                                {option.colorPreview ? (
                                  <div 
                                    className="w-5 h-5 rounded border border-gray-300 flex-shrink-0"
                                    style={{ backgroundColor: option.colorPreview }}
                                  />
                                ) : option.imageUrl && (
                                  <img 
                                    src={getImageUrl(option.imageUrl)} 
                                    alt={getOptionName(option)}
                                    className="w-6 h-6 object-contain rounded"
                                    loading="eager"
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
                    <span className="font-semibold">{getModelPrice(selectedModel)} {prices.currencySymbol}</span>
                  </div>
                  {/* Show heater type if model has variants */}
                  {selectedModel.heaterVariants?.length > 1 && selectedHeaterVariant && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {selectedHeaterVariant.type === 'integrated' 
                          ? (lang === 'pl' ? 'Piec zintegrowany' : 'Встроенная печь')
                          : (lang === 'pl' ? 'Piec zewnętrzny' : 'Внешняя печь')}
                      </span>
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                  )}
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
                        max={isAdminUser ? 100 : 10}
                        value={discountPercent}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const max = isAdminUser ? 100 : 10;
                          setDiscountPercent(Math.max(0, Math.min(max, val)));
                        }}
                        className="w-20 h-8"
                      />
                      <span className="text-sm text-muted-foreground">% (max {isAdminUser ? '100' : '10'})</span>
                    </div>
                    
                    {/* Admin discount approval checkbox - show when discount > 10% */}
                    {isAdminUser && discountPercent > 10 && (
                      <div className="flex items-center gap-2 pt-2 border-t border-green-200">
                        <Checkbox
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
                  
                  {/* Requested Discount Section - for non-admin users */}
                  {!isAdminUser && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
                      <div className="flex items-center gap-2 text-amber-700 font-medium">
                        <Tag className="h-4 w-4" />
                        {lang === 'pl' ? 'Wnioskowany rabat' : 'Запрашиваемая скидка'}
                      </div>
                      <p className="text-xs text-amber-600">
                        {lang === 'pl' 
                          ? 'Jeśli klient potrzebuje rabatu większego niż 10%, wpisz tutaj. Administrator zobaczy ten wniosek.'
                          : 'Если клиенту нужна скидка больше 10%, введите здесь. Администратор увидит этот запрос.'}
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={requestedDiscount}
                          onChange={(e) => setRequestedDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                          className="w-20 h-8"
                          placeholder="0"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                      {requestedDiscount > 0 && (
                        <Input
                          type="text"
                          value={requestedDiscountNote}
                          onChange={(e) => setRequestedDiscountNote(e.target.value)}
                          placeholder={lang === 'pl' ? 'Komentarz do wniosku...' : 'Комментарий к запросу...'}
                          className="h-8 text-sm"
                        />
                      )}
                    </div>
                  )}
                  
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
                  {isEditMode 
                    ? (lang === 'pl' ? 'Zapisz zmiany i pobierz PDF' : 'Сохранить изменения и скачать PDF')
                    : (lang === 'pl' ? 'Zapisz i pobierz PDF' : 'Сохранить и скачать PDF')
                  }
                </Button>
                {isEditMode ? (
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    className="w-full"
                  >
                    <X className="h-4 w-4 mr-2" />
                    {lang === 'pl' ? 'Anuluj edycję' : 'Отменить редактирование'}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={handleClear}
                    className="w-full"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {t('balia.clear')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
};
