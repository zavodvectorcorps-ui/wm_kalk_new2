import React, { memo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Info, Upload, X, Image as ImageIcon, Video } from 'lucide-react';

// Smart API URL - auto-detect on production
const getApiUrl = () => { 
  if (typeof window !== 'undefined') { 
    const o = window.location.origin; 
    if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o; 
  } 
  return process.env.REACT_APP_BACKEND_URL || ''; 
};
const API_URL = getApiUrl();

export const CategoryEditDialog = memo(({ 
  open, 
  category,
  isNew,
  onClose,
  onSave,
  txt
}) => {
  const [formData, setFormData] = useState(() => category || {});
  const [uploadingImage, setUploadingImage] = useState(false);

  if (!category) return null;

  // Handle image upload for hint
  const handleHintImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Convert to base64 for storage
    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({ ...prev, hintImageUrl: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? txt.newCategory : txt.editCategory}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
          
          {/* Without labels for "not selected" display */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
            <div className="space-y-2">
              <Label className="text-xs">Bez ... (PL)</Label>
              <Input 
                value={formData.withoutLabelPl || ''} 
                onChange={(e) => setFormData({ ...formData, withoutLabelPl: e.target.value })}
                placeholder="np. Bez hydromasażu"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Без ... (RU)</Label>
              <Input 
                value={formData.withoutLabelRu || ''} 
                onChange={(e) => setFormData({ ...formData, withoutLabelRu: e.target.value })}
                placeholder="напр. Без гидромассажа"
                className="text-sm"
              />
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">
              Текст для отображения когда опция не выбрана в заказе
            </p>
          </div>
          
          <div className="space-y-2">
            <Label>{txt.inputType}</Label>
            <Select 
              value={formData.inputType || 'radio'} 
              onValueChange={(v) => setFormData({ ...formData, inputType: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="radio">Один выбор (radio)</SelectItem>
                <SelectItem value="checkbox">Несколько (checkbox)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Radio — можно выбрать только один вариант, Checkbox — несколько
            </p>
          </div>
          <div className="space-y-2">
            <Label>{txt.displayType || 'Тип отображения'}</Label>
            <Select 
              value={formData.displayType || 'list'} 
              onValueChange={(v) => setFormData({ ...formData, displayType: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">{txt.list || 'Список'}</SelectItem>
                <SelectItem value="tiles">{txt.tiles || 'Плитки'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category Hint Section */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-4 w-4 text-blue-500" />
              <Label className="font-semibold">Подсказка категории</Label>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Подсказка будет отображаться под названием категории в калькуляторе
            </p>
            
            <div className="space-y-3">
              {/* Hint text RU */}
              <div className="space-y-2">
                <Label className="text-xs">Подсказка (RU)</Label>
                <Textarea 
                  value={formData.hint || ''} 
                  onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
                  placeholder="Текст подсказки на русском..."
                  rows={2}
                  className="text-sm"
                />
              </div>
              
              {/* Hint text PL */}
              <div className="space-y-2">
                <Label className="text-xs">Podpowiedź (PL)</Label>
                <Textarea 
                  value={formData.hintPl || ''} 
                  onChange={(e) => setFormData({ ...formData, hintPl: e.target.value })}
                  placeholder="Tekst podpowiedzi po polsku..."
                  rows={2}
                  className="text-sm"
                />
              </div>
              
              {/* Hint Image */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" />
                  Изображение подсказки
                </Label>
                <div className="flex gap-2 items-start">
                  <Input 
                    value={formData.hintImageUrl || ''} 
                    onChange={(e) => setFormData({ ...formData, hintImageUrl: e.target.value })}
                    placeholder="URL изображения или загрузите файл"
                    className="text-sm flex-1"
                  />
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleHintImageUpload}
                      className="hidden"
                    />
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span><Upload className="h-4 w-4" /></span>
                    </Button>
                  </label>
                  {formData.hintImageUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({ ...formData, hintImageUrl: '' })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {formData.hintImageUrl && (
                  <img 
                    src={formData.hintImageUrl.startsWith('data:') ? formData.hintImageUrl : (formData.hintImageUrl.startsWith('http') ? formData.hintImageUrl : `${API_URL}${formData.hintImageUrl}`)} 
                    alt="Hint preview" 
                    className="w-full max-h-32 object-contain rounded border bg-gray-50"
                  />
                )}
              </div>
              
              {/* Hint Video URL */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Video className="h-3 w-3" />
                  URL видео (YouTube)
                </Label>
                <Input 
                  value={formData.hintVideoUrl || ''} 
                  onChange={(e) => setFormData({ ...formData, hintVideoUrl: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{txt.cancel}</Button>
          <Button onClick={() => onSave(formData)}>{txt.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

CategoryEditDialog.displayName = 'CategoryEditDialog';
