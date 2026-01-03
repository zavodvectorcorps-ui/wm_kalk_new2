import React, { memo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Upload, X, Loader2 } from 'lucide-react';
import axios from 'axios';

export const OptionEditDialog = memo(({ 
  open, 
  onOpenChange, 
  option,
  isNew,
  currencySymbol,
  onSave,
  onDelete,
  txt,
  apiUrl
}) => {
  const [formData, setFormData] = useState(option || {});
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (option) {
      setFormData(option);
    }
  }, [option]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const response = await axios.post(`${apiUrl}/api/upload/image`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const imageUrl = `${apiUrl}${response.data.url}`;
      setFormData(prev => ({ ...prev, imageUrl }));
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? txt.newOption : txt.editOption}</DialogTitle>
          <DialogDescription>
            {isNew ? 'Добавьте новую опцию' : 'Редактировать опцию'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{txt.nameRu}</Label>
              <Input 
                value={formData.nameRu || ''} 
                onChange={(e) => setFormData({ ...formData, nameRu: e.target.value })}
                placeholder="Название RU"
              />
            </div>
            <div className="space-y-2">
              <Label>{txt.namePl}</Label>
              <Input 
                value={formData.namePl || ''} 
                onChange={(e) => setFormData({ ...formData, namePl: e.target.value })}
                placeholder="Nazwa PL"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{txt.price} ({currencySymbol})</Label>
            <Input 
              type="number"
              value={formData.price || 0} 
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>

          {/* Hint */}
          <div className="space-y-2">
            <Label>Подсказка / Hint</Label>
            <textarea 
              value={formData.hint || ''} 
              onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
              placeholder="Описание опции..."
              className="w-full min-h-[60px] px-3 py-2 text-sm border rounded-md"
              rows={2}
            />
          </div>

          {/* Color preview */}
          <div className="space-y-2">
            <Label>Цвет (для палитры)</Label>
            <div className="flex gap-2">
              <Input 
                type="color"
                value={formData.colorPreview || '#ffffff'} 
                onChange={(e) => setFormData({ ...formData, colorPreview: e.target.value })}
                className="w-16 h-10 p-1"
              />
              <Input 
                value={formData.colorPreview || ''} 
                onChange={(e) => setFormData({ ...formData, colorPreview: e.target.value })}
                placeholder="#ffffff"
                className="flex-1"
              />
            </div>
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <Label>{txt.image}</Label>
            {formData.imageUrl ? (
              <div className="relative inline-block">
                <img 
                  src={formData.imageUrl} 
                  alt="Preview" 
                  className="w-32 h-32 object-contain rounded border"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-1 right-1 h-6 w-6 p-0"
                  onClick={() => setFormData({ ...formData, imageUrl: '' })}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <label className="block">
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50">
                  {uploading ? (
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-gray-400" />
                      <span className="text-sm text-gray-500 mt-2 block">{txt.uploadImage}</span>
                    </>
                  )}
                </div>
              </label>
            )}
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

OptionEditDialog.displayName = 'OptionEditDialog';
