import React, { memo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Settings, Upload, X, Loader2, Package, Calculator } from 'lucide-react';

// Smart API URL - auto-detect on production
const getApiUrl = () => { 
  if (typeof window !== 'undefined') { 
    const o = window.location.origin; 
    if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o; 
  } 
  return process.env.REACT_APP_BACKEND_URL || ''; 
};
const API_URL = getApiUrl();

const getFullImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/api/')) return `${API_URL}${url}`;
  return url;
};

export const ModelEditDialog = memo(({ 
  open, 
  model,
  isNew,
  onClose,
  onSave,
  txt,
  currencySymbol,
  categories = [],
  eurRate = 4.30
}) => {
  const [formData, setFormData] = useState(model || {});
  const [uploadingVariant, setUploadingVariant] = useState(null);
  const [uploadingHintImage, setUploadingHintImage] = useState(false);
  
  // Get color categories (categories with "color" or "цвет" in name or id)
  const colorCategories = categories.filter(cat => 
    cat.name?.toLowerCase().includes('color') || 
    cat.name?.toLowerCase().includes('цвет') ||
    cat.name?.toLowerCase().includes('kolor') ||
    cat.id?.toLowerCase().includes('color') ||
    cat.id?.toLowerCase().includes('kolor')
  );
  
  useEffect(() => {
    if (model) {
      const data = { ...model };
      if (!data.heaterVariants || data.heaterVariants.length === 0) {
        data.heaterVariants = [
          { type: 'integrated', price: data.basePrice || 0, imageUrl: data.imageUrl || '' },
          { type: 'external', price: data.basePrice || 0, imageUrl: '' },
          { type: 'none', price: data.basePrice || 0, imageUrl: '' }
        ];
      }
      // Ensure 'none' variant exists for existing models
      if (!data.heaterVariants.find(v => v.type === 'none')) {
        data.heaterVariants.push({ type: 'none', price: data.basePrice || 0, imageUrl: '' });
      }
      if (!data.specs) {
        data.specs = {};
      }
      setFormData(data);
    }
  }, [model]);

  const handleHintImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingHintImage(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const response = await fetch(`${API_URL}/api/upload/image`, {
        method: 'POST',
        body: formDataUpload
      });
      const data = await response.json();
      const fullUrl = data.url.startsWith('http') ? data.url : `${API_URL}${data.url}`;
      setFormData(prev => ({ ...prev, hintImageUrl: fullUrl }));
    } catch (error) {
      console.error('Hint image upload error:', error);
    } finally {
      setUploadingHintImage(false);
    }
  };

  const handleVariantImageUpload = async (e, variantType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingVariant(variantType);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const response = await fetch(`${API_URL}/api/upload/image`, {
        method: 'POST',
        body: formDataUpload
      });
      const data = await response.json();
      const fullUrl = data.url.startsWith('http') ? data.url : `${API_URL}${data.url}`;
      
      setFormData(prev => ({
        ...prev,
        heaterVariants: prev.heaterVariants.map(v => 
          v.type === variantType ? { ...v, imageUrl: fullUrl } : v
        )
      }));
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploadingVariant(null);
    }
  };

  const updateVariantPrice = (variantType, price) => {
    setFormData(prev => ({
      ...prev,
      heaterVariants: prev.heaterVariants.map(v => 
        v.type === variantType ? { ...v, price: parseFloat(price) || 0 } : v
      )
    }));
  };

  const updateVariantField = (variantType, field, value) => {
    setFormData(prev => ({
      ...prev,
      heaterVariants: prev.heaterVariants.map(v => 
        v.type === variantType ? { ...v, [field]: value } : v
      )
    }));
  };

  const removeVariantImage = (variantType) => {
    setFormData(prev => ({
      ...prev,
      heaterVariants: prev.heaterVariants.map(v => 
        v.type === variantType ? { ...v, imageUrl: '' } : v
      )
    }));
  };

  if (!model) return null;

  const integratedVariant = formData.heaterVariants?.find(v => v.type === 'integrated') || { type: 'integrated', price: 0, imageUrl: '' };
  const externalVariant = formData.heaterVariants?.find(v => v.type === 'external') || { type: 'external', price: 0, imageUrl: '' };
  const noneVariant = formData.heaterVariants?.find(v => v.type === 'none') || { type: 'none', price: 0, imageUrl: '' };

  const handleSave = () => {
    const updatedData = {
      ...formData,
      basePrice: integratedVariant.price,
      imageUrl: integratedVariant.imageUrl || externalVariant.imageUrl
    };
    onSave(updatedData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? txt.newModel : txt.editModel}</DialogTitle>
          <DialogDescription>
            Настройка вариантов печки, цен и технических характеристик модели
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Basic Model Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{txt.nameRu}</Label>
              <Input 
                value={formData.nameRu || ''} 
                onChange={(e) => setFormData({ ...formData, nameRu: e.target.value })}
                placeholder="Круглая 200см"
              />
            </div>
            <div className="space-y-2">
              <Label>{txt.namePl}</Label>
              <Input 
                value={formData.namePl || ''} 
                onChange={(e) => setFormData({ ...formData, namePl: e.target.value })}
                placeholder="Okrągła 200cm"
              />
            </div>
          </div>

          {/* Hint fields - RU and PL */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Описание (RU)</Label>
              <textarea 
                value={formData.hint || ''} 
                onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
                placeholder="Подробное описание модели..."
                className="w-full min-h-[60px] px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Opis (PL)</Label>
              <textarea 
                value={formData.hintPl || ''} 
                onChange={(e) => setFormData({ ...formData, hintPl: e.target.value })}
                placeholder="Szczegółowy opis modelu..."
                className="w-full min-h-[60px] px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                rows={2}
              />
            </div>
          </div>

          {/* Hint Media Section */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
            <h4 className="text-sm font-medium text-blue-800">Медиа для подсказки / Media podpowiedzi</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-blue-700">Изображение подсказки</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={formData.hintImageUrl || ''} 
                    onChange={(e) => setFormData({ ...formData, hintImageUrl: e.target.value })}
                    placeholder="URL или загрузите"
                    className="flex-1"
                  />
                  <label>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleHintImageUpload}
                      disabled={uploadingHintImage}
                    />
                    <Button type="button" variant="outline" size="sm" asChild disabled={uploadingHintImage}>
                      <span>
                        {uploadingHintImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                      </span>
                    </Button>
                  </label>
                  {formData.hintImageUrl && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                      onClick={() => setFormData({ ...formData, hintImageUrl: '' })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {formData.hintImageUrl && (
                  <img 
                    src={getFullImageUrl(formData.hintImageUrl)} 
                    alt="Hint preview" 
                    className="w-full max-h-24 object-contain rounded border bg-white mt-1"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-blue-700">URL видео подсказки</Label>
                <Input 
                  value={formData.hintVideoUrl || ''} 
                  onChange={(e) => setFormData({ ...formData, hintVideoUrl: e.target.value })}
                  placeholder="YouTube или прямая ссылка"
                />
                <p className="text-xs text-blue-500">Поддерживается YouTube и прямые ссылки</p>
              </div>
            </div>
          </div>

          {/* Heater Variants Section */}
          <div className="border rounded-lg p-4 bg-orange-50 space-y-4">
            <h3 className="font-semibold text-orange-800 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Варианты печки
            </h3>
            
            {/* Available Heater Types Selection */}
            <div className="p-3 bg-white rounded border space-y-2">
              <Label className="text-sm font-medium">Доступные типы печей для этой модели:</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.availableHeaterTypes?.includes('integrated') ?? true}
                    onChange={(e) => {
                      const types = formData.availableHeaterTypes || ['integrated', 'external'];
                      if (e.target.checked) {
                        setFormData(prev => ({ ...prev, availableHeaterTypes: [...new Set([...types, 'integrated'])] }));
                      } else {
                        setFormData(prev => ({ ...prev, availableHeaterTypes: types.filter(t => t !== 'integrated') }));
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm">Встроенная (Zintegrowany)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.availableHeaterTypes?.includes('external') ?? true}
                    onChange={(e) => {
                      const types = formData.availableHeaterTypes || ['integrated', 'external'];
                      if (e.target.checked) {
                        setFormData(prev => ({ ...prev, availableHeaterTypes: [...new Set([...types, 'external'])] }));
                      } else {
                        setFormData(prev => ({ ...prev, availableHeaterTypes: types.filter(t => t !== 'external') }));
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm">Внешняя (Zewnętrzny)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.availableHeaterTypes?.includes('none') ?? false}
                    onChange={(e) => {
                      const types = formData.availableHeaterTypes || ['integrated', 'external'];
                      if (e.target.checked) {
                        setFormData(prev => ({ ...prev, availableHeaterTypes: [...new Set([...types, 'none'])] }));
                      } else {
                        setFormData(prev => ({ ...prev, availableHeaterTypes: types.filter(t => t !== 'none') }));
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm">Без печи (Bez pieca)</span>
                </label>
              </div>
              <p className="text-xs text-orange-600">Выберите, какие типы печей можно выбрать для этой модели в калькуляторе</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Integrated Heater Variant */}
              <VariantEditor 
                variant={integratedVariant}
                variantType="integrated"
                label="Встроенная печь (Zintegrowany)"
                currencySymbol={currencySymbol}
                eurRate={eurRate}
                uploadingVariant={uploadingVariant}
                onPriceChange={(price) => updateVariantPrice('integrated', price)}
                onFieldChange={(field, value) => updateVariantField('integrated', field, value)}
                onImageUpload={(e) => handleVariantImageUpload(e, 'integrated')}
                onRemoveImage={() => removeVariantImage('integrated')}
              />

              {/* External Heater Variant */}
              <VariantEditor 
                variant={externalVariant}
                variantType="external"
                label="Внешняя печь (Zewnętrzny)"
                currencySymbol={currencySymbol}
                eurRate={eurRate}
                uploadingVariant={uploadingVariant}
                onPriceChange={(price) => updateVariantPrice('external', price)}
                onFieldChange={(field, value) => updateVariantField('external', field, value)}
                onImageUpload={(e) => handleVariantImageUpload(e, 'external')}
                onRemoveImage={() => removeVariantImage('external')}
              />
            </div>
            
            {/* None Heater Variant */}
            {formData.availableHeaterTypes?.includes('none') && (
              <div className="grid grid-cols-2 gap-4">
                <VariantEditor 
                  variant={noneVariant}
                  variantType="none"
                  label="Без печи (Bez pieca)"
                  currencySymbol={currencySymbol}
                  eurRate={eurRate}
                  uploadingVariant={uploadingVariant}
                  onPriceChange={(price) => updateVariantPrice('none', price)}
                  onFieldChange={(field, value) => updateVariantField('none', field, value)}
                  onImageUpload={(e) => handleVariantImageUpload(e, 'none')}
                  onRemoveImage={() => removeVariantImage('none')}
                />
              </div>
            )}
          </div>

          {/* Bowl Types Section */}
          <div className="border rounded-lg p-4 bg-purple-50 space-y-4">
            <h3 className="font-semibold text-purple-800 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Доступные типы чаш
            </h3>
            
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.availableBowlTypes?.includes('fiberglass') ?? true}
                  onChange={(e) => {
                    const types = formData.availableBowlTypes || ['fiberglass', 'acrylic'];
                    if (e.target.checked) {
                      setFormData(prev => ({ ...prev, availableBowlTypes: [...new Set([...types, 'fiberglass'])] }));
                    } else {
                      setFormData(prev => ({ ...prev, availableBowlTypes: types.filter(t => t !== 'fiberglass') }));
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm">Стекловолокно (Fiberglass)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.availableBowlTypes?.includes('acrylic') ?? true}
                  onChange={(e) => {
                    const types = formData.availableBowlTypes || ['fiberglass', 'acrylic'];
                    if (e.target.checked) {
                      setFormData(prev => ({ ...prev, availableBowlTypes: [...new Set([...types, 'acrylic'])] }));
                    } else {
                      setFormData(prev => ({ ...prev, availableBowlTypes: types.filter(t => t !== 'acrylic') }));
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm">Акрил (Acrylic)</span>
              </label>
            </div>
            <p className="text-xs text-purple-600">Выберите, какие типы чаш доступны для этой модели</p>
          </div>

          {/* Available Colors Section - by heater type */}
          {colorCategories.length > 0 && (
            <div className="border rounded-lg p-4 bg-pink-50 space-y-4">
              <h3 className="font-semibold text-pink-800">🎨 Доступные цвета по типу печки / Dostępne kolory wg pieca</h3>
              <p className="text-xs text-gray-600 mb-2">
                Выберите, какие цвета доступны для каждого типа печки. Если не выбрано ни одного — доступны все цвета.
              </p>
              
              {/* Tabs for heater types */}
              {['integrated', 'external', 'none'].map(heaterType => {
                const heaterLabel = heaterType === 'integrated' ? '🔥 Встроенная печь (Piec zintegrowany)' : heaterType === 'none' ? '❌ Без печи (Bez pieca)' : '🏠 Внешняя печь (Piec zewnętrzny)';
                const isAvailable = formData.availableHeaterTypes?.includes(heaterType) ?? true;
                
                if (!isAvailable) return null;
                
                return (
                  <div key={heaterType} className="border-2 border-pink-200 rounded-lg p-3 bg-white">
                    <h4 className="font-medium text-pink-700 mb-3">{heaterLabel}</h4>
                    
                    {colorCategories.map(category => {
                      const heaterColors = formData.availableColorOptions?.[heaterType] || {};
                      const availableOptions = heaterColors[category.id] || [];
                      
                      return (
                        <div key={category.id} className="border rounded p-2 bg-gray-50 mb-2">
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">
                            {category.name}
                          </Label>
                          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                            {category.options?.map(option => {
                              const isSelected = availableOptions.includes(option.id);
                              
                              return (
                                <label key={option.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const currentMap = { ...(formData.availableColorOptions || {}) };
                                      const currentHeaterMap = currentMap[heaterType] || {};
                                      const currentOptions = currentHeaterMap[category.id] || [];
                                      
                                      if (e.target.checked) {
                                        currentHeaterMap[category.id] = [...new Set([...currentOptions, option.id])];
                                      } else {
                                        currentHeaterMap[category.id] = currentOptions.filter(id => id !== option.id);
                                        if (currentHeaterMap[category.id].length === 0) {
                                          delete currentHeaterMap[category.id];
                                        }
                                      }
                                      
                                      currentMap[heaterType] = currentHeaterMap;
                                      
                                      // Clean up empty heater type
                                      if (Object.keys(currentHeaterMap).length === 0) {
                                        delete currentMap[heaterType];
                                      }
                                      
                                      setFormData(prev => ({ ...prev, availableColorOptions: currentMap }));
                                    }}
                                    className="w-4 h-4 rounded border-gray-300 accent-pink-600"
                                  />
                                  <div className="flex items-center gap-1">
                                    {option.colorPreview && (
                                      <div 
                                        className="w-4 h-4 rounded border border-gray-300"
                                        style={{ backgroundColor: option.colorPreview }}
                                      />
                                    )}
                                    <span className="text-xs">{option.name}</span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                          {availableOptions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {availableOptions.map(optId => {
                                const opt = category.options?.find(o => o.id === optId);
                                return opt ? (
                                  <span key={optId} className="text-xs bg-pink-100 text-pink-800 px-2 py-0.5 rounded flex items-center gap-1">
                                    {opt.colorPreview && (
                                      <div 
                                        className="w-3 h-3 rounded border"
                                        style={{ backgroundColor: opt.colorPreview }}
                                      />
                                    )}
                                    {opt.name}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Specifications Section */}
          <div className="border rounded-lg p-4 bg-blue-50 space-y-4">
            <h3 className="font-semibold text-blue-800 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Спецификации / Specyfikacje
            </h3>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Внешний диаметр</Label>
                <Input 
                  value={formData.specs?.outerDiameter || ''} 
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    specs: { ...prev.specs, outerDiameter: e.target.value }
                  }))}
                  placeholder="200cm"
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Внутренний диаметр</Label>
                <Input 
                  value={formData.specs?.innerDiameter || ''} 
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    specs: { ...prev.specs, innerDiameter: e.target.value }
                  }))}
                  placeholder="160cm"
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Размеры (ДxШ)</Label>
                <Input 
                  value={formData.specs?.dimensions || ''} 
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    specs: { ...prev.specs, dimensions: e.target.value }
                  }))}
                  placeholder="170x200cm"
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Глубина</Label>
                <Input 
                  value={formData.specs?.depth || ''} 
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    specs: { ...prev.specs, depth: e.target.value }
                  }))}
                  placeholder="100cm"
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Объём воды</Label>
                <Input 
                  value={formData.specs?.volume || formData.specs?.waterCapacity || ''} 
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    specs: { ...prev.specs, volume: e.target.value, waterCapacity: e.target.value }
                  }))}
                  placeholder="1500L"
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Кол-во мест</Label>
                <Input 
                  type="number"
                  value={formData.specs?.seats || ''} 
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    specs: { ...prev.specs, seats: parseInt(e.target.value) || 0 }
                  }))}
                  placeholder="6"
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Высота общая</Label>
                <Input 
                  value={formData.specs?.totalHeight || ''} 
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    specs: { ...prev.specs, totalHeight: e.target.value }
                  }))}
                  placeholder="120cm"
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Мощность печи</Label>
                <Input 
                  value={formData.specs?.heaterPower || ''} 
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    specs: { ...prev.specs, heaterPower: e.target.value }
                  }))}
                  placeholder="24kW"
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Вес (пустая)</Label>
                <Input 
                  value={formData.specs?.weight || ''} 
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    specs: { ...prev.specs, weight: e.target.value }
                  }))}
                  placeholder="350kg"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{txt.cancel}</Button>
          <Button onClick={handleSave}>{txt.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

// Variant Editor Sub-component
const VariantEditor = memo(({ 
  variant, 
  variantType, 
  label, 
  currencySymbol, 
  eurRate = 4.30,
  uploadingVariant,
  onPriceChange, 
  onFieldChange, 
  onImageUpload, 
  onRemoveImage 
}) => {
  // Calculate retail price from purchase price and markup
  const calculateRetailPrice = () => {
    const purchaseEur = parseFloat(variant.purchasePriceEur) || 0;
    const markup = parseFloat(variant.markupPercent ?? 30);
    if (purchaseEur <= 0) return;
    
    const purchasePln = purchaseEur * eurRate;
    const retailPrice = Math.round(purchasePln * (1 + markup / 100));
    onPriceChange(retailPrice);
  };

  return (
    <div className="border rounded-lg p-3 bg-white space-y-3">
      <h4 className="font-medium text-sm">{label}</h4>
      
      {/* Purchase Price Section */}
      <div className="p-2 bg-amber-50 rounded border border-amber-200 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-amber-700 font-medium">Ценообразование</span>
          <span className="text-xs text-amber-600">1 EUR = {eurRate} PLN</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-amber-700">Закупка (EUR)</Label>
            <Input 
              type="number"
              step="0.01"
              value={variant.purchasePriceEur || ''} 
              onChange={(e) => onFieldChange('purchasePriceEur', parseFloat(e.target.value) || 0)}
              placeholder="300"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-amber-700">Наценка (%)</Label>
            <Input 
              type="number"
              value={variant.markupPercent ?? 30} 
              onChange={(e) => onFieldChange('markupPercent', parseFloat(e.target.value) || 0)}
              placeholder="30"
              className="h-8 text-sm"
            />
          </div>
        </div>
        {variant.purchasePriceEur > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-amber-600">
              {variant.purchasePriceEur} × {eurRate} × {(1 + (variant.markupPercent ?? 30)/100).toFixed(2)} = {Math.round(variant.purchasePriceEur * eurRate * (1 + (variant.markupPercent ?? 30)/100))} PLN
            </p>
            <Button 
              type="button" 
              size="sm" 
              variant="outline" 
              className="h-6 text-xs border-amber-400 text-amber-700 hover:bg-amber-100 px-2"
              onClick={calculateRetailPrice}
            >
              <Calculator className="h-3 w-3 mr-1" />
              Применить
            </Button>
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        <Label className="text-xs">Розничная цена ({currencySymbol})</Label>
        <Input 
          type="number"
          value={variant.price || 0} 
          onChange={(e) => onPriceChange(e.target.value)}
        />
      </div>
      
      <div className="space-y-2">
        <Label className="text-xs">Подсказка для этого варианта</Label>
        <Input 
          value={variant.hint || ''} 
          onChange={(e) => onFieldChange('hint', e.target.value)}
          placeholder="Описание модели с этой печью..."
        />
      </div>
      
      <div className="space-y-2">
        <Label className="text-xs">Фото</Label>
        {variant.imageUrl ? (
          <div className="relative">
            <img 
              src={variant.imageUrl} 
              alt={variantType} 
              className="w-full h-24 object-contain rounded border"
            />
            <Button
              variant="destructive"
              size="sm"
              className="absolute top-1 right-1 h-6 w-6 p-0"
              onClick={onRemoveImage}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <label className="block">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onImageUpload}
            />
            <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50">
              {uploadingVariant === variantType ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-orange-500" />
              ) : (
                <>
                  <Upload className="h-6 w-6 mx-auto text-gray-400" />
                  <span className="text-xs text-gray-500">Загрузить фото</span>
                </>
              )}
            </div>
          </label>
        )}
      </div>
    </div>
  );
});

ModelEditDialog.displayName = 'ModelEditDialog';
VariantEditor.displayName = 'VariantEditor';
