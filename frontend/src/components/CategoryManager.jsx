import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Plus, FolderPlus, List, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';

export const CategoryManager = ({ isOpen, onClose, onSave, existingCategories = {} }) => {
  const { t } = useTranslation();
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [displayType, setDisplayType] = useState('dropdown');
  const [required, setRequired] = useState(false);

  const handleSave = () => {
    if (!categoryId || !categoryName) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    // Check if category already exists
    if (existingCategories[categoryId]) {
      toast.error('Категория с таким ID уже существует');
      return;
    }

    const newCategory = {
      id: categoryId,
      name: categoryName,
      displayType,
      required,
      order: Object.keys(existingCategories).length + 1,
    };

    onSave(newCategory);
    
    // Reset form
    setCategoryId('');
    setCategoryName('');
    setDisplayType('dropdown');
    setRequired(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-primary" />
            Создать новую категорию
          </DialogTitle>
          <DialogDescription>
            Создайте категорию для группировки связанных опций
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="category-id">
              ID категории <span className="text-destructive">*</span>
            </Label>
            <Input
              id="category-id"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value.replace(/\s/g, '_').toLowerCase())}
              placeholder="custom_category_1"
            />
            <p className="text-xs text-muted-foreground">
              Уникальный идентификатор (только английские буквы и подчеркивания)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-name">
              Название категории <span className="text-destructive">*</span>
            </Label>
            <Input
              id="category-name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Моя категория"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="display-type">Тип отображения по умолчанию</Label>
            <Select value={displayType} onValueChange={setDisplayType}>
              <SelectTrigger id="display-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dropdown">
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4" />
                    <span>Выпадающий список</span>
                  </div>
                </SelectItem>
                <SelectItem value="checkbox">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    <span>Чекбоксы</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Этот тип будет применяться ко всем опциям в категории
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="required"
              checked={required}
              onCheckedChange={setRequired}
            />
            <Label htmlFor="required" className="cursor-pointer">
              Обязательная категория (требует выбора опции)
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSave}>
            <Plus className="h-4 w-4 mr-2" />
            Создать категорию
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
