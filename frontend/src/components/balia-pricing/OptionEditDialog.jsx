import React, { memo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Upload, X, Loader2, Image as ImageIcon, Calculator } from 'lucide-react';

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

export const OptionEditDialog = memo(({ 
  open, 
  option,
  categoryId,
  isNew,
  onClose,
  onSave,
  txt,
  currencySymbol,
  eurRate = 4.30
}) => {
  const [formData, setFormData] = useState(() => option || {});
  const [uploading, setUploading] = useState(false);
  const [uploadingHintImage, setUploadingHintImage] = useState(false);

  // Calculate retail price from purchase price and markup
  const calculateRetailPrice = () => {
    const purchaseEur = parseFloat(formData.purchasePriceEur) || 0;
    const markup = parseFloat(formData.markupPercent ?? 30);
    if (purchaseEur <= 0) return;
    
    const purchasePln = purchaseEur * eurRate;
    const retailPrice = Math.round(purchasePln * (1 + markup / 100));
    setFormData(prev => ({ ...prev, price: retailPrice }));
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const response = await fetch(`${API_URL}/api/upload/image`, {
        method: 'POST',
        body: formDataUpload
      });
      const data = await response.json();
      const fullUrl = data.url.startsWith('http') ? data.url : `${API_URL}${data.url}`;
      setFormData(prev => ({ ...prev, imageUrl: fullUrl }));
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

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

  if (!option) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? txt.newOption : txt.editOption}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Image upload */}
          <div className="space-y-2">
            <Label>{txt.image}</Label>
            <div className="flex items-center gap-3">
              {formData.imageUrl ? (
                <div className="relative">
                  <img 
                    src={getFullImageUrl(formData.imageUrl)} 
                    alt="Option"
                    className="w-16 h-16 object-contain rounded border bg-gray-50"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 w-5"
                    onClick={() => setFormData({ ...formData, imageUrl: '' })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="w-16 h-16 bg-muted rounded border flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <label>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                />
                <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                  <span>
                    {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                    {txt.uploadImage}
                  </span>
                </Button>
              </label>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>{txt.nameRu}</Label>
            <Input 
              value={formData.nameRu || ''} 
              onChange={(e) => setFormData({ ...formData, nameRu: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{txt.namePl}</Label>
            <Input 
              value={formData.namePl || ''} 
              onChange={(e) => setFormData({ ...formData, namePl: e.target.value })}
            />
          </div>
          
          {/* Purchase Price Section */}
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-amber-800">Ценообразование / Kalkulacja</h4>
              <span className="text-xs text-amber-600">Курс: 1 EUR = {eurRate} PLN</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-amber-700">Закупка (EUR)</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={formData.purchasePriceEur || ''} 
                  onChange={(e) => setFormData({ ...formData, purchasePriceEur: parseFloat(e.target.value) || 0 })}
                  placeholder="50"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-amber-700">Наценка (%)</Label>
                <Input 
                  type="number"
                  value={formData.markupPercent ?? 30} 
                  onChange={(e) => setFormData({ ...formData, markupPercent: parseFloat(e.target.value) || 0 })}
                  placeholder="30"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            {formData.purchasePriceEur > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-amber-600">
                  {formData.purchasePriceEur} EUR × {eurRate} × {(1 + (formData.markupPercent ?? 30)/100).toFixed(2)} = {Math.round(formData.purchasePriceEur * eurRate * (1 + (formData.markupPercent ?? 30)/100))} PLN
                </p>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="outline" 
                  className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100"
                  onClick={calculateRetailPrice}
                >
                  <Calculator className="h-3 w-3 mr-1" />
                  Применить
                </Button>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>{txt.price} ({currencySymbol}) - Розничная</Label>
            <Input 
              type="number"
              value={formData.price || 0} 
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
            />
          </div>
          
          {/* Color Preview for color options */}
          <div className="space-y-2">
            <Label>Превью цвета (HEX)</Label>
            <div className="flex items-center gap-3">
              <Input 
                value={formData.colorPreview || ''} 
                onChange={(e) => setFormData({ ...formData, colorPreview: e.target.value })}
                placeholder="#FFFFFF"
                className="flex-1"
              />
              {formData.colorPreview && (
                <div 
                  className="w-10 h-10 rounded border-2 border-gray-300 shadow-inner"
                  style={{ backgroundColor: formData.colorPreview }}
                />
              )}
              <input
                type="color"
                value={formData.colorPreview || '#FFFFFF'}
                onChange={(e) => setFormData({ ...formData, colorPreview: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer border-0"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Подсказка (RU)</Label>
            <Textarea 
              value={formData.hint || ''} 
              onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
              placeholder="Описание опции для клиента..."
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Podpowiedź (PL)</Label>
            <Textarea 
              value={formData.hintPl || ''} 
              onChange={(e) => setFormData({ ...formData, hintPl: e.target.value })}
              placeholder="Opis opcji dla klienta..."
              rows={2}
            />
          </div>
          
          {/* Hint Media Section */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
            <h4 className="text-sm font-medium text-blue-800">Медиа для подсказки / Media podpowiedzi</h4>
            <div className="space-y-2">
              <Label className="text-xs text-blue-700">Изображение подсказки</Label>
              <div className="flex items-center gap-2">
                <Input 
                  value={formData.hintImageUrl || ''} 
                  onChange={(e) => setFormData({ ...formData, hintImageUrl: e.target.value })}
                  placeholder="URL или загрузите файл"
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
                      {uploadingHintImage ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                      Загрузить
                    </span>
                  </Button>
                </label>
                {formData.hintImageUrl && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
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
                  className="w-full max-h-32 object-contain rounded border bg-white mt-1"
                  onError={(e) => e.target.style.display = 'none'}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-blue-700">URL видео подсказки</Label>
              <Input 
                value={formData.hintVideoUrl || ''} 
                onChange={(e) => setFormData({ ...formData, hintVideoUrl: e.target.value })}
                placeholder="YouTube ссылка или прямая ссылка на видео"
              />
              <p className="text-xs text-blue-500">Поддерживается YouTube и прямые ссылки</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{txt.cancel}</Button>
          <Button onClick={() => onSave(formData, categoryId)}>{txt.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

OptionEditDialog.displayName = 'OptionEditDialog';
