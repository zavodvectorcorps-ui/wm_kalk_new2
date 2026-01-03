import React, { memo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Settings, Upload, X, Loader2 } from 'lucide-react';
import axios from 'axios';

export const ModelEditDialog = memo(({ 
  open, 
  onOpenChange, 
  model,
  isNew,
  currencySymbol,
  onSave,
  onDelete,
  txt,
  apiUrl
}) => {
  const [formData, setFormData] = useState(model || {});
  const [uploadingVariant, setUploadingVariant] = useState(null);

  React.useEffect(() => {
    if (model) {
      setFormData({
        ...model,
        heaterVariants: model.heaterVariants || [
          { type: 'integrated', price: model.basePrice || 0 },
          { type: 'external', price: model.basePrice || 0 }
        ]
      });
    }
  }, [model]);

  const integratedVariant = formData.heaterVariants?.find(v => v.type === 'integrated') || { type: 'integrated', price: 0 };
  const externalVariant = formData.heaterVariants?.find(v => v.type === 'external') || { type: 'external', price: 0 };

  const updateVariantField = (type, field, value) => {
    setFormData(prev => ({
      ...prev,
      heaterVariants: (prev.heaterVariants || []).map(v => 
        v.type === type ? { ...v, [field]: value } : v
      )
    }));
  };

  const updateVariantPrice = (type, value) => {
    const price = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      heaterVariants: (prev.heaterVariants || []).map(v => 
        v.type === type ? { ...v, price } : v
      )
    }));
  };

  const handleVariantImageUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingVariant(type);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const response = await axios.post(`${apiUrl}/api/upload/image`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const imageUrl = `${apiUrl}${response.data.url}`;
      updateVariantField(type, 'imageUrl', imageUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setUploadingVariant(null);
    }
  };

  const removeVariantImage = (type) => {
    updateVariantField(type, 'imageUrl', '');
  };

  const handleSave = () => {
    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? txt.newModel : txt.editModel}</DialogTitle>
          <DialogDescription>
            {isNew ? 'Добавьте новую модель' : 'Редактировать модель и варианты печей'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name fields */}
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

          {/* Hint field */}
          <div className="space-y-2">
            <Label>Описание модели / Hint</Label>
            <textarea 
              value={formData.hint || ''} 
              onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
              placeholder="Подробное описание модели..."
              className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
            />
          </div>

          {/* Heater Variants */}
          <div className="border rounded-lg p-4 bg-orange-50 space-y-4">
            <h3 className="font-semibold text-orange-800 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Варианты печки
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Integrated */}
              <VariantEditor
                variant={integratedVariant}
                type="integrated"
                label="Встроенная печь"
                currencySymbol={currencySymbol}
                uploading={uploadingVariant === 'integrated'}
                onPriceChange={(v) => updateVariantPrice('integrated', v)}
                onFieldChange={(f, v) => updateVariantField('integrated', f, v)}
                onImageUpload={(e) => handleVariantImageUpload(e, 'integrated')}
                onRemoveImage={() => removeVariantImage('integrated')}
              />
              
              {/* External */}
              <VariantEditor
                variant={externalVariant}
                type="external"
                label="Внешняя печь"
                currencySymbol={currencySymbol}
                uploading={uploadingVariant === 'external'}
                onPriceChange={(v) => updateVariantPrice('external', v)}
                onFieldChange={(f, v) => updateVariantField('external', f, v)}
                onImageUpload={(e) => handleVariantImageUpload(e, 'external')}
                onRemoveImage={() => removeVariantImage('external')}
              />
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <Switch 
              checked={formData.active !== false}
              onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
            />
            <Label>{txt.active}</Label>
          </div>
        </div>

        <DialogFooter>
          {!isNew && (
            <Button variant="destructive" onClick={onDelete}>
              {txt.delete}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {txt.cancel}
          </Button>
          <Button onClick={handleSave}>
            {txt.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

const VariantEditor = memo(({ 
  variant, 
  type, 
  label, 
  currencySymbol, 
  uploading, 
  onPriceChange, 
  onFieldChange,
  onImageUpload,
  onRemoveImage
}) => (
  <div className="border rounded-lg p-3 bg-white space-y-3">
    <h4 className="font-medium text-sm">{label}</h4>
    
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
      <Label className="text-xs">Фото</Label>
      {variant.imageUrl ? (
        <div className="relative">
          <img 
            src={variant.imageUrl} 
            alt={type} 
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
          <input type="file" accept="image/*" className="hidden" onChange={onImageUpload} />
          <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-orange-500" />
            ) : (
              <>
                <Upload className="h-6 w-6 mx-auto text-gray-400" />
                <span className="text-xs text-gray-500">Загрузить</span>
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
