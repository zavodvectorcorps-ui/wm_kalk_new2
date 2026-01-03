import React, { memo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export const CategoryEditDialog = memo(({ 
  open, 
  category,
  isNew,
  onClose,
  onSave,
  txt
}) => {
  const [formData, setFormData] = useState(() => category || {});

  if (!category) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
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
