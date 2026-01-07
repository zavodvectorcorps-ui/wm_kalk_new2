import React, { memo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Settings, Upload, X, Loader2, Package } from 'lucide-react';

// Smart API URL - auto-detect on production
const getApiUrl = () => { 
  if (typeof window !== 'undefined') { 
    const o = window.location.origin; 
    if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o; 
  } 
  return process.env.REACT_APP_BACKEND_URL || ''; 
};
const API_URL = getApiUrl();

export const ModelEditDialog = memo(({ 
  open, 
  model,
  isNew,
  onClose,
  onSave,
  txt,
  currencySymbol
}) => {
  const [formData, setFormData] = useState(model || {});
  const [uploadingVariant, setUploadingVariant] = useState(null);
  
  useEffect(() => {
    if (model) {
      const data = { ...model };
      if (!data.heaterVariants || data.heaterVariants.length === 0) {
        data.heaterVariants = [
          { type: 'integrated', price: data.basePrice || 0, imageUrl: data.imageUrl || '' },
          { type: 'external', price: data.basePrice || 0, imageUrl: '' }
        ];
      }
      if (!data.specs) {
        data.specs = {};
      }
      setFormData(data);
    }
  }, [model]);

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
      const fullUrl = `${API_URL}${data.url}`;
      
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

          {/* Heater Variants Section */}
          <div className="border rounded-lg p-4 bg-orange-50 space-y-4">
            <h3 className="font-semibold text-orange-800 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Варианты печки
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Integrated Heater Variant */}
              <VariantEditor 
                variant={integratedVariant}
                variantType="integrated"
                label="Встроенная печь (Zintegrowany)"
                currencySymbol={currencySymbol}
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
                uploadingVariant={uploadingVariant}
                onPriceChange={(price) => updateVariantPrice('external', price)}
                onFieldChange={(field, value) => updateVariantField('external', field, value)}
                onImageUpload={(e) => handleVariantImageUpload(e, 'external')}
                onRemoveImage={() => removeVariantImage('external')}
              />
            </div>
          </div>

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
  uploadingVariant,
  onPriceChange, 
  onFieldChange, 
  onImageUpload, 
  onRemoveImage 
}) => (
  <div className="border rounded-lg p-3 bg-white space-y-3">
    <h4 className="font-medium text-sm">{label}</h4>
    
    {/* Purchase Price Section */}
    <div className="p-2 bg-amber-50 rounded border border-amber-200 space-y-2">
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
        <p className="text-xs text-amber-600">
          Расчёт: {variant.purchasePriceEur} EUR × курс × {1 + (variant.markupPercent ?? 30)/100}
        </p>
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
));

ModelEditDialog.displayName = 'ModelEditDialog';
VariantEditor.displayName = 'VariantEditor';
