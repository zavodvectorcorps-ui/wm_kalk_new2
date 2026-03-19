import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import { FileText, Loader2, User, Phone, MessageSquare, Package, Layout, Eye, Download, RefreshCw } from 'lucide-react';
import axios from 'axios';

// Smart API URL - auto-detect on production
const getApiUrl = () => { 
  if (typeof window !== 'undefined') { 
    const o = window.location.origin; 
    if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o; 
  } 
  return process.env.REACT_APP_BACKEND_URL || ''; 
};
const API_URL = getApiUrl();

export const TechSpecModal = ({ open, onOpenChange, order, onSaved }) => {
  const { i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [masterCategories, setMasterCategories] = useState([]);
  const [formData, setFormData] = useState({
    comment: '',
    selections: {},
    textInputs: {},
  });
  
  // Layout (planowka) state
  const [layoutData, setLayoutData] = useState(null);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [layoutImage, setLayoutImage] = useState(null);
  
  // Fetch layout for selected model
  const fetchLayout = useCallback(async () => {
    setLayoutLoading(true);
    try {
      // Strategy 0: If layout image URL is saved directly in the order
      if (order?.layoutImageUrl) {
        setLayoutImage(order.layoutImageUrl);
        setLayoutData({ imageUrl: order.layoutImageUrl, source: 'order' });
        return;
      }
      
      // Strategy 1: If order has selectedLayoutId, fetch that specific layout
      if (order?.selectedLayoutId) {
        const [faqRes, confRes] = await Promise.allSettled([
          axios.get(`${API_URL}/api/faq/layout-variants`),
          axios.get(`${API_URL}/api/layout-configurator/published-layouts`)
        ]);
        
        const faqVariants = faqRes.status === 'fulfilled' ? (faqRes.value.data || []) : [];
        const confLayouts = confRes.status === 'fulfilled' ? (confRes.value.data || []) : [];
        
        // Search in FAQ variants
        let found = faqVariants.find(v => v._id === order.selectedLayoutId || v.id === order.selectedLayoutId);
        if (found?.imageUrl) {
          setLayoutData(found);
          setLayoutImage(found.imageUrl);
          return;
        }
        
        // Search in configurator layouts
        found = confLayouts.find(l => l.id === order.selectedLayoutId);
        if (found?.imageUrl) {
          setLayoutData(found);
          setLayoutImage(found.imageUrl);
          return;
        }
      }
      
      // Strategy 2: Try layout-configurator/layouts with model/variant info
      const modelId = order?.modelId || order?.selectedModelId || order?.selectedModel;
      const variantId = order?.selectedVariantId || order?.selectedModelVariant || null;
      
      if (modelId) {
        try {
          const layoutsRes = await axios.get(`${API_URL}/api/layout-configurator/layouts`, {
            params: { modelId, variantId, published: true }
          });
          const layouts = layoutsRes.data?.layouts || [];
          if (layouts.length > 0 && layouts[0].imageUrl) {
            setLayoutData(layouts[0]);
            setLayoutImage(layouts[0].imageUrl);
            return;
          }
        } catch (e) { /* continue to next strategy */ }
      }
      
      // Strategy 3: Get layout from selectedLayoutSize in published layouts
      if (order?.selectedLayoutSize) {
        try {
          const confRes = await axios.get(`${API_URL}/api/layout-configurator/published-layouts`);
          const layouts = confRes.data || [];
          const matched = layouts.find(l => l.modelSize === order.selectedLayoutSize);
          if (matched?.imageUrl) {
            setLayoutData(matched);
            setLayoutImage(matched.imageUrl);
            return;
          }
        } catch (e) { /* no layout found */ }
      }
      
      setLayoutData(null);
      setLayoutImage(null);
    } catch (error) {
      console.error('Error fetching layout:', error);
      setLayoutData(null);
      setLayoutImage(null);
    } finally {
      setLayoutLoading(false);
    }
  }, [order]);
  
  // Fetch layout when modal opens
  useEffect(() => {
    if (open && order) {
      fetchLayout();
    }
  }, [open, order, fetchLayout]);

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/tech-spec/categories`);
        setCategories(response.data.categories || []);
        setMasterCategories(response.data.masterCategories || []);
      } catch (error) {
        console.error('Error fetching tech spec categories:', error);
      }
    };
    if (open) {
      fetchCategories();
    }
  }, [open]);

  // Initialize form with order data and existing tech spec
  useEffect(() => {
    if (order && open && categories.length > 0) {
      const existingTechSpec = order.techSpec || {};
      
      // Pre-fill selections from existing tech spec first
      const initialSelections = { ...existingTechSpec.selections };
      const initialTextInputs = { ...existingTechSpec.textInputs };
      
      // PRIMARY: Map from selectedOptions array which contains techSpecId mappings
      if (order.selectedOptions && order.selectedOptions.length > 0) {
        order.selectedOptions.forEach(selOpt => {
          // Use techSpecCategoryId and techSpecId for direct matching
          const techSpecCatId = selOpt.techSpecCategoryId;
          const techSpecOptId = selOpt.techSpecId;
          
          if (techSpecCatId && techSpecOptId) {
            // Direct match using IDs
            const techCategory = categories.find(tc => tc.id === techSpecCatId);
            if (techCategory && !initialSelections[techCategory.id]) {
              const techOptExists = techCategory.options?.some(to => to.id === techSpecOptId);
              if (techOptExists) {
                if (techCategory.inputType === 'checkbox') {
                  const existing = initialSelections[techCategory.id] || [];
                  if (!existing.includes(techSpecOptId)) {
                    initialSelections[techCategory.id] = [...existing, techSpecOptId];
                  }
                } else {
                  initialSelections[techCategory.id] = techSpecOptId;
                }
                return;
              }
            }
          }
          
          // Fallback: Try to find tech spec category by name similarity
          const techCategory = categories.find(tc => {
            const tcName = tc.name.toLowerCase();
            const optCatName = selOpt.categoryName?.toLowerCase() || '';
            return tcName.includes(optCatName) || optCatName.includes(tcName);
          });
          
          if (!techCategory || initialSelections[techCategory.id]) return;
          
          // Try to find option by name
          const techOpt = techCategory.options?.find(to => {
            const toName = to.name.toLowerCase();
            const soName = selOpt.optionName?.toLowerCase() || '';
            return toName === soName || toName.includes(soName) || soName.includes(toName);
          });
          
          if (techOpt) {
            if (techCategory.inputType === 'checkbox') {
              const existing = initialSelections[techCategory.id] || [];
              if (!existing.includes(techOpt.id)) {
                initialSelections[techCategory.id] = [...existing, techOpt.id];
              }
            } else {
              initialSelections[techCategory.id] = techOpt.id;
            }
          }
        });
      }
      
      setFormData({
        comment: existingTechSpec.comment || '',
        selections: initialSelections,
        textInputs: initialTextInputs,
      });
    }
  }, [order, open, categories]);

  const handleRadioChange = useCallback((categoryId, value) => {
    setFormData(prev => ({
      ...prev,
      selections: {
        ...prev.selections,
        [categoryId]: value,
      },
    }));
  }, []);

  const handleCheckboxChange = useCallback((categoryId, optionId, checked) => {
    setFormData(prev => {
      const current = prev.selections[categoryId] || [];
      const updated = checked
        ? [...current, optionId]
        : current.filter(id => id !== optionId);
      return {
        ...prev,
        selections: {
          ...prev.selections,
          [categoryId]: updated,
        },
      };
    });
  }, []);

  const handleTextChange = useCallback((categoryId, optionId, value) => {
    setFormData(prev => ({
      ...prev,
      textInputs: {
        ...prev.textInputs,
        [`${categoryId}_${optionId}`]: value,
      },
    }));
  }, []);

  const handleCommentChange = useCallback((e) => {
    setFormData(prev => ({ ...prev, comment: e.target.value }));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const techSpecData = {
        ...formData,
        createdAt: new Date().toISOString(),
        orderId: order.id,
        // Include layout data if available
        layout: layoutData ? {
          id: layoutData.id,
          name: layoutData.name || layoutData.namePl,
          modelId: layoutData.modelId,
          modelName: layoutData.modelName,
          imageUrl: layoutImage,
        } : null,
      };

      await axios.put(`${API_URL}/api/sauna/orders/${order.id}/tech-spec`, techSpecData);
      toast.success('Техническое задание сохранено!');
      onSaved && onSaved(techSpecData);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving tech spec:', error);
      toast.error('Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setLoading(true);
    try {
      // First save the tech spec
      const techSpecData = {
        ...formData,
        createdAt: new Date().toISOString(),
        orderId: order.id,
        // Include layout data
        layout: layoutData ? {
          id: layoutData.id,
          name: layoutData.name || layoutData.namePl,
          modelId: layoutData.modelId,
          modelName: layoutData.modelName,
          imageUrl: layoutImage,
        } : null,
      };

      await axios.put(`${API_URL}/api/sauna/orders/${order.id}/tech-spec`, techSpecData);

      // Then generate PDF
      const response = await axios.post(
        `${API_URL}/api/sauna/generate-tech-spec-pdf`,
        { order, techSpec: techSpecData },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TechSpec_${order.id}_${order.fullName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('PDF создан!');
      onSaved && onSaved(techSpecData);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Ошибка генерации PDF');
    } finally {
      setLoading(false);
    }
  };

  const renderCategory = (category) => {
    const { id, name, inputType, layout, options, hasImages } = category;

    return (
      <div key={id} className="border rounded-lg p-2 bg-white/50">
        <Label className="font-semibold text-amber-800 block mb-1 text-sm">{name}</Label>
        
        {inputType === 'radio' && (
          <RadioGroup
            value={formData.selections[id] || ''}
            onValueChange={(value) => handleRadioChange(id, value)}
            className={hasImages ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2' : (layout === 'row' ? 'flex flex-wrap gap-3' : 'space-y-2')}
          >
            {options.map((option) => {
              const isSelected = formData.selections[id] === option.id;
              return (
                <div 
                  key={option.id} 
                  className={hasImages 
                    ? `relative flex flex-col items-center p-2 border-2 rounded-lg cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-amber-500 bg-amber-50 shadow-md' 
                          : 'border-gray-200 bg-white hover:border-amber-300'
                      }` 
                    : 'flex items-center gap-2'
                  }
                >
                  <RadioGroupItem value={option.id} id={`${id}-${option.id}`} className={hasImages ? 'sr-only' : ''} />
                  {hasImages && option.imageUrl && (
                    <label htmlFor={`${id}-${option.id}`} className="cursor-pointer w-full">
                      <img 
                        src={option.imageUrl} 
                        alt={option.name} 
                        className={`w-full h-20 object-contain rounded mb-1 ${isSelected ? 'ring-2 ring-amber-500 ring-offset-1' : ''}`} 
                      />
                    </label>
                  )}
                  <Label 
                    htmlFor={`${id}-${option.id}`} 
                    className={`cursor-pointer text-xs text-center ${isSelected ? 'font-semibold text-amber-700' : ''}`}
                  >
                    {option.name}
                  </Label>
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </RadioGroup>
        )}

        {inputType === 'checkbox' && (
          <div className={layout === 'row' ? 'flex flex-wrap gap-4' : 'space-y-2'}>
            {options.map((option) => {
              const isChecked = (formData.selections[id] || []).includes(option.id) || option.required;
              return (
                <div key={option.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`${id}-${option.id}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => handleCheckboxChange(id, option.id, checked)}
                    disabled={option.required}
                  />
                  <Label htmlFor={`${id}-${option.id}`} className="cursor-pointer text-sm">
                    {option.name}
                  </Label>
                </div>
              );
            })}
          </div>
        )}

        {inputType === 'text' && (
          <div className={layout === 'row' ? 'flex flex-wrap gap-2' : 'space-y-1'}>
            {options.map((option) => (
              <div key={option.id} className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">{option.name}:</Label>
                <Input
                  value={formData.textInputs[`${id}_${option.id}`] || ''}
                  onChange={(e) => handleTextChange(id, option.id, e.target.value)}
                  placeholder={option.placeholder}
                  className="h-7 w-32 text-sm"
                />
              </div>
            ))}
          </div>
        )}

        {inputType === 'textarea' && (
          <Textarea
            value={formData.textInputs[`${id}_${options[0]?.id}`] || ''}
            onChange={(e) => handleTextChange(id, options[0]?.id, e.target.value)}
            placeholder={options[0]?.placeholder}
            rows={1}
            className="text-sm min-h-[32px]"
          />
        )}

        {inputType === 'mixed' && (
          <div className="space-y-2">
            {options.map((option) => (
              <div key={option.id} className="flex items-center gap-2">
                {option.inputType === 'radio' ? (
                  <>
                    <input
                      type="radio"
                      name={id}
                      value={option.id}
                      checked={formData.selections[id] === option.id}
                      onChange={() => handleRadioChange(id, option.id)}
                      className="h-4 w-4"
                    />
                    <Label className="text-sm">{option.name}</Label>
                  </>
                ) : (
                  <>
                    <Label className="text-sm w-40">{option.name}</Label>
                    <Input
                      value={formData.textInputs[`${id}_${option.id}`] || ''}
                      onChange={(e) => handleTextChange(id, option.id, e.target.value)}
                      placeholder={option.placeholder}
                      className="h-8 w-24"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-amber-800">
            <FileText className="h-5 w-5" />
            Techniczne zestawienie sauny
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <div className="space-y-4 pb-4">
            {/* Order Info Header */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Данные заказа #{order.id}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{order.fullName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{order.phoneNumber}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Модель:</span>{' '}
                  <span className="font-medium">{order.modelName}</span>
                </div>
              </div>
              
              {/* Show order selections */}
              {order.categories && order.categories.length > 0 && (
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <p className="text-xs text-muted-foreground mb-2">Выбранные опции из заказа:</p>
                  <div className="flex flex-wrap gap-2">
                    {order.categories.map((cat, idx) => (
                      <span key={idx} className="bg-white px-2 py-1 rounded text-xs border">
                        {cat.name}: {cat.selectedOption}
                        {cat.quantity && cat.quantity > 1 && ` (x${cat.quantity})`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Layout (Planowka) Section */}
            <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
              <Label className="font-semibold text-blue-800 flex items-center gap-2 mb-3 text-base">
                <Layout className="h-5 w-5" />
                Планировка сауны
              </Label>
              
              {layoutLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-sm text-muted-foreground">Загрузка планировки...</span>
                </div>
              ) : layoutData ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-blue-900">{layoutData.name || layoutData.namePl}</p>
                      <p className="text-sm text-muted-foreground">
                        Модель: {layoutData.modelName || order?.modelName}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={fetchLayout}
                        title="Обновить планировку"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Layout Preview */}
                  {layoutImage ? (
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <img 
                        src={layoutImage} 
                        alt="Планировка сауны" 
                        className="w-full h-auto max-h-[300px] object-contain"
                      />
                    </div>
                  ) : layoutData.canvasState?.objects ? (
                    <div className="border rounded-lg p-4 bg-white">
                      <p className="text-sm text-muted-foreground mb-2">Элементы планировки:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {layoutData.canvasState.objects
                          .filter(obj => obj.assetName && !obj.isRoom && !obj.isOutline && !obj.isGrid)
                          .map((obj, idx) => (
                            <div key={idx} className="text-xs bg-gray-50 px-2 py-1 rounded flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: obj.fill || '#888' }}></span>
                              {obj.assetName}
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      Планировка доступна, но предпросмотр недоступен
                    </div>
                  )}
                  
                  {/* Layout dimensions */}
                  {layoutData.canvasState?.objects && (
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      {(() => {
                        const room = layoutData.canvasState.objects.find(obj => obj.isRoom);
                        if (room) {
                          return (
                            <>
                              <span>Размер: {room.outerWidthCm || room.width}x{room.outerHeightCm || room.height} см</span>
                            </>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Layout className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Планировка для этой модели не найдена</p>
                  <p className="text-xs mt-1">Создайте планировку в разделе "Planowki"</p>
                </div>
              )}
            </div>

            {/* Internal Comment */}
            <div className="border rounded-lg p-3 bg-white/50">
              <Label className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4" />
                Комментарий (внутренний)
              </Label>
              <Textarea
                value={formData.comment}
                onChange={handleCommentChange}
                placeholder="Особые требования, примечания для производства..."
                rows={3}
              />
            </div>

            {/* Technical Options - Grouped by Master Categories */}
            {masterCategories.map(master => {
              const masterCats = categories.filter(c => c.masterCategoryId === master.id);
              if (masterCats.length === 0) return null;
              
              return (
                <div key={master.id} className="space-y-3">
                  <div className="bg-amber-100 border border-amber-300 rounded-lg px-4 py-2">
                    <h3 className="font-bold text-amber-800 text-base flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      {master.name}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-2">
                    {masterCats.map(category => (
                      <div 
                        key={category.id} 
                        className={category.displayWidth === 'full' ? 'md:col-span-2' : ''}
                      >
                        {renderCategory(category)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            
            {/* Categories without master */}
            {(() => {
              const unassignedCats = categories.filter(c => !c.masterCategoryId);
              if (unassignedCats.length === 0) return null;
              
              return (
                <div className="space-y-3">
                  <div className="bg-gray-100 border border-gray-300 rounded-lg px-4 py-2">
                    <h3 className="font-bold text-gray-700 text-base flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Прочее
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-2">
                    {unassignedCats.map(category => (
                      <div 
                        key={category.id} 
                        className={category.displayWidth === 'full' ? 'md:col-span-2' : ''}
                      >
                        {renderCategory(category)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <DialogFooter className="mt-4 flex gap-2 flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={loading} className="bg-amber-600 hover:bg-amber-700">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Сохранить
          </Button>
          <Button onClick={handleDownloadPDF} disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Создать PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
