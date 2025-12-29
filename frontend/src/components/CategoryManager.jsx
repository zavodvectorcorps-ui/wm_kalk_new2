import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Plus, FolderPlus, List, CheckSquare, Trash2, Folder, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

export const CategoryManager = ({ 
  isOpen, 
  onClose, 
  onSave, 
  existingCategories = {},
  onDelete,
  onReorder 
}) => {
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

    const maxOrder = Math.max(0, ...Object.values(existingCategories).map(c => c.order || 0));

    const newCategory = {
      id: categoryId,
      name: categoryName,
      displayType,
      required,
      order: maxOrder + 1,
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

// Component for managing/listing categories with reordering
export const CategoryList = ({ 
  categories = {}, 
  onDelete, 
  onMoveUp, 
  onMoveDown,
  onCreateNew,
  onToggleRequired,
  canEdit = true
}) => {
  const { t, i18n } = useTranslation();

  const sortedCategories = Object.entries(categories)
    .map(([id, cat]) => ({ id, ...cat }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const isDefaultCategory = (id) => {
    return ['shellModels', 'woodTypes', 'shellColors', 'lidTypes', 'woodColors', 'features'].includes(id);
  };

  // Get category name based on current language
  const getCategoryName = (category) => {
    const lang = i18n.language;
    if (lang === 'pl' && category.namePl) {
      return category.namePl;
    }
    if (category.nameRu) {
      return category.nameRu;
    }
    return category.name || category.id;
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-primary" />
            {t('categoryManagement')}
          </div>
          {canEdit && (
            <Button onClick={onCreateNew} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              {t('newCategory')}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedCategories.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {t('none')}
          </p>
        ) : (
          <div className="space-y-2">
            {sortedCategories.map((category, index) => (
              <div 
                key={category.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={index === 0}
                    onClick={() => onMoveUp(category.id)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={index === sortedCategories.length - 1}
                    onClick={() => onMoveDown(category.id)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    {getCategoryName(category)}
                    {isDefaultCategory(category.id) && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        {t('system')}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-4 flex-wrap">
                    <span>ID: {category.id}</span>
                    <span className="flex items-center gap-1">
                      {category.displayType === 'dropdown' ? (
                        <><List className="h-3 w-3" /> {t('dropdown')}</>
                      ) : (
                        <><CheckSquare className="h-3 w-3" /> {t('checkbox')}</>
                      )}
                    </span>
                    <span>{t('order')}: {category.order}</span>
                  </div>
                </div>
                
                {/* Required Toggle */}
                <div className="flex items-center gap-2">
                  <Label htmlFor={`required-${category.id}`} className="text-xs text-muted-foreground cursor-pointer">
                    {t('required')}
                  </Label>
                  <Switch
                    id={`required-${category.id}`}
                    checked={category.required || false}
                    onCheckedChange={(checked) => onToggleRequired(category.id, checked)}
                    disabled={!canEdit}
                  />
                </div>
                
                {!isDefaultCategory(category.id) && canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(category.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
