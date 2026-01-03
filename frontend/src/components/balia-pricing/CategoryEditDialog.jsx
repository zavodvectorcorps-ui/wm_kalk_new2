import React, { memo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export const CategoryEditDialog = memo(({ 
  open, 
  onOpenChange, 
  category,
  isNew,
  onSave,
  onDelete,
  txt
}) => {
  const [formData, setFormData] = useState(category || {});

  useEffect(() => {
    if (category) {
      setFormData(category);
    }
  }, [category]);

  const handleSave = () => {
    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? txt.newCategory : txt.editCategory}</DialogTitle>
          <DialogDescription>
            {isNew ? 'Создайте новую категорию' : 'Редактировать категорию'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{txt.nameRu}</Label>
              <Input 
                value={formData.nameRu || ''} 
                onChange={(e) => setFormData({ ...formData, nameRu: e.target.value })}
                placeholder="Гидромассаж"
              />
            </div>
            <div className="space-y-2">
              <Label>{txt.namePl}</Label>
              <Input 
                value={formData.namePl || ''} 
                onChange={(e) => setFormData({ ...formData, namePl: e.target.value })}
                placeholder="Hydromasaż"
              />
            </div>
          </div>

          {/* Hint */}
          <div className="space-y-2">
            <Label>Подсказка / Hint</Label>
            <textarea 
              value={formData.hint || ''} 
              onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
              placeholder="Описание категории..."
              className="w-full min-h-[60px] px-3 py-2 text-sm border rounded-md"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>{txt.inputType}</Label>
            <Select 
              value={formData.inputType || 'radio'} 
              onValueChange={(value) => setFormData({ ...formData, inputType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="radio">{txt.dropdown}</SelectItem>
                <SelectItem value="checkbox">{txt.checkbox}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{txt.displayType}</Label>
            <Select 
              value={formData.displayType || 'list'} 
              onValueChange={(value) => setFormData({ ...formData, displayType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">{txt.list}</SelectItem>
                <SelectItem value="tiles">{txt.tiles}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dependency */}
          <div className="space-y-2">
            <Label>Зависимость от (ID категории)</Label>
            <Input 
              value={formData.dependsOn || ''} 
              onChange={(e) => setFormData({ ...formData, dependsOn: e.target.value })}
              placeholder="bowl_material"
            />
          </div>
          <div className="space-y-2">
            <Label>Показывать при значении</Label>
            <Input 
              value={formData.dependsOnValue || ''} 
              onChange={(e) => setFormData({ ...formData, dependsOnValue: e.target.value })}
              placeholder="fiberglass"
            />
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

CategoryEditDialog.displayName = 'CategoryEditDialog';
