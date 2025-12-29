import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from './ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  Loader2,
  ArrowUp,
  ArrowDown,
  Settings,
  List,
  Eye,
  Image as ImageIcon,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const TechSpecAdminPage = () => {
  const { i18n } = useTranslation();
  const { canEdit } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Dialogs
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingOption, setEditingOption] = useState(null);

  // New category form
  const [newCategory, setNewCategory] = useState({
    name: '',
    inputType: 'radio',
    layout: 'row',
    hasImages: false,
  });

  // New option form
  const [newOption, setNewOption] = useState({
    name: '',
    imageUrl: '',
    placeholder: '',
    required: false,
  });

  const texts = {
    ru: {
      title: 'Управление тех.заданием',
      categories: 'Категории',
      options: 'Опции',
      addCategory: 'Добавить категорию',
      addOption: 'Добавить опцию',
      editCategory: 'Редактировать категорию',
      editOption: 'Редактировать опцию',
      categoryName: 'Название категории',
      optionName: 'Название опции',
      inputType: 'Тип ввода',
      layout: 'Расположение',
      hasImages: 'С изображениями',
      imageUrl: 'URL изображения',
      placeholder: 'Подсказка',
      required: 'Обязательная',
      radio: 'Одиночный выбор',
      checkbox: 'Множественный выбор',
      text: 'Текстовое поле',
      textarea: 'Многострочный текст',
      mixed: 'Смешанный',
      row: 'В строку',
      column: 'В столбец',
      save: 'Сохранить',
      cancel: 'Отмена',
      delete: 'Удалить',
      saveAll: 'Сохранить всё',
      saved: 'Сохранено!',
      noCategories: 'Нет категорий',
      noOptions: 'Нет опций',
      selectCategory: 'Выберите категорию',
      viewOnly: 'Только просмотр',
    },
    pl: {
      title: 'Zarządzanie specyfikacją techniczną',
      categories: 'Kategorie',
      options: 'Opcje',
      addCategory: 'Dodaj kategorię',
      addOption: 'Dodaj opcję',
      editCategory: 'Edytuj kategorię',
      editOption: 'Edytuj opcję',
      categoryName: 'Nazwa kategorii',
      optionName: 'Nazwa opcji',
      inputType: 'Typ wejścia',
      layout: 'Układ',
      hasImages: 'Z obrazami',
      imageUrl: 'URL obrazu',
      placeholder: 'Podpowiedź',
      required: 'Wymagana',
      radio: 'Pojedynczy wybór',
      checkbox: 'Wielokrotny wybór',
      text: 'Pole tekstowe',
      textarea: 'Tekst wielowierszowy',
      mixed: 'Mieszany',
      row: 'W wierszu',
      column: 'W kolumnie',
      save: 'Zapisz',
      cancel: 'Anuluj',
      delete: 'Usuń',
      saveAll: 'Zapisz wszystko',
      saved: 'Zapisano!',
      noCategories: 'Brak kategorii',
      noOptions: 'Brak opcji',
      selectCategory: 'Wybierz kategorię',
      viewOnly: 'Tylko podgląd',
    },
  };

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tech-spec/categories`);
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Save all
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/tech-spec/categories`, { categories });
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  // Add category
  const handleAddCategory = async () => {
    if (!newCategory.name) return;

    const categoryId = newCategory.name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_а-яё]/gi, '');

    const category = {
      id: categoryId,
      name: newCategory.name,
      inputType: newCategory.inputType,
      layout: newCategory.layout,
      hasImages: newCategory.hasImages,
      sortOrder: categories.length + 1,
      options: [],
    };

    try {
      await axios.post(`${API_URL}/api/tech-spec/category`, category);
      setCategories(prev => [...prev, category]);
      setNewCategory({ name: '', inputType: 'radio', layout: 'row', hasImages: false });
      setCategoryDialogOpen(false);
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error(error.response?.data?.detail || 'Ошибка');
    }
  };

  // Edit category
  const handleSaveEditCategory = async () => {
    if (!editingCategory) return;

    try {
      await axios.put(`${API_URL}/api/tech-spec/category/${editingCategory.id}`, editingCategory);
      setCategories(prev => prev.map(c => c.id === editingCategory.id ? editingCategory : c));
      setEditingCategory(null);
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Ошибка');
    }
  };

  // Delete category
  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Удалить категорию?')) return;

    try {
      await axios.delete(`${API_URL}/api/tech-spec/category/${categoryId}`);
      setCategories(prev => prev.filter(c => c.id !== categoryId));
      if (selectedCategory?.id === categoryId) {
        setSelectedCategory(null);
      }
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Ошибка');
    }
  };

  // Move category
  const handleMoveCategory = async (categoryId, direction) => {
    try {
      await axios.post(`${API_URL}/api/tech-spec/category/${categoryId}/move?direction=${direction}`);
      fetchCategories();
    } catch (error) {
      console.error('Error moving category:', error);
    }
  };

  // Add option
  const handleAddOption = async () => {
    if (!selectedCategory || !newOption.name) return;

    const optionId = newOption.name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_а-яё]/gi, '');

    const option = {
      id: optionId,
      name: newOption.name,
      imageUrl: newOption.imageUrl || null,
      placeholder: newOption.placeholder || null,
      required: newOption.required,
    };

    try {
      await axios.post(`${API_URL}/api/tech-spec/category/${selectedCategory.id}/option`, option);
      setCategories(prev => prev.map(c => {
        if (c.id === selectedCategory.id) {
          return { ...c, options: [...(c.options || []), option] };
        }
        return c;
      }));
      setSelectedCategory(prev => ({
        ...prev,
        options: [...(prev.options || []), option],
      }));
      setNewOption({ name: '', imageUrl: '', placeholder: '', required: false });
      setOptionDialogOpen(false);
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error adding option:', error);
      toast.error(error.response?.data?.detail || 'Ошибка');
    }
  };

  // Edit option
  const handleSaveEditOption = async () => {
    if (!editingOption || !selectedCategory) return;

    try {
      await axios.put(
        `${API_URL}/api/tech-spec/category/${selectedCategory.id}/option/${editingOption.id}`,
        editingOption
      );
      setCategories(prev => prev.map(c => {
        if (c.id === selectedCategory.id) {
          return {
            ...c,
            options: c.options.map(o => o.id === editingOption.id ? editingOption : o),
          };
        }
        return c;
      }));
      setSelectedCategory(prev => ({
        ...prev,
        options: prev.options.map(o => o.id === editingOption.id ? editingOption : o),
      }));
      setEditingOption(null);
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error updating option:', error);
      toast.error('Ошибка');
    }
  };

  // Delete option
  const handleDeleteOption = async (optionId) => {
    if (!selectedCategory || !window.confirm('Удалить опцию?')) return;

    try {
      await axios.delete(`${API_URL}/api/tech-spec/category/${selectedCategory.id}/option/${optionId}`);
      setCategories(prev => prev.map(c => {
        if (c.id === selectedCategory.id) {
          return { ...c, options: c.options.filter(o => o.id !== optionId) };
        }
        return c;
      }));
      setSelectedCategory(prev => ({
        ...prev,
        options: prev.options.filter(o => o.id !== optionId),
      }));
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error deleting option:', error);
      toast.error('Ошибка');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-amber-800 flex items-center gap-2">
          <Settings className="h-6 w-6" />
          {txt.title}
          {!canEdit() && (
            <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground ml-2">
              <Eye className="h-4 w-4" />
              {txt.viewOnly}
            </span>
          )}
        </h1>
        {canEdit() && (
          <Button onClick={handleSaveAll} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {txt.saveAll}
          </Button>
        )}
      </div>

      <Tabs defaultValue="categories" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="categories">{txt.categories}</TabsTrigger>
          <TabsTrigger value="options">{txt.options}</TabsTrigger>
        </TabsList>

        {/* Categories Tab */}
        <TabsContent value="categories">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{txt.categories}</CardTitle>
              {canEdit() && (
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => setCategoryDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {txt.addCategory}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{txt.noCategories}</p>
              ) : (
                <div className="space-y-2">
                  {categories.map((category, index) => (
                    <div
                      key={category.id}
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                    >
                      {canEdit() && (
                        <div className="flex flex-col gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleMoveCategory(category.id, 'up')}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleMoveCategory(category.id, 'down')}
                            disabled={index === categories.length - 1}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      <div className="flex-1">
                        <div className="font-medium">{category.name}</div>
                        <div className="text-sm text-muted-foreground flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {category.inputType === 'radio' ? txt.radio :
                             category.inputType === 'checkbox' ? txt.checkbox :
                             category.inputType === 'text' ? txt.text :
                             category.inputType === 'textarea' ? txt.textarea : txt.mixed}
                          </Badge>
                          <Badge variant="secondary">
                            {category.layout === 'row' ? txt.row : txt.column}
                          </Badge>
                          {category.hasImages && (
                            <Badge variant="secondary">
                              <ImageIcon className="h-3 w-3 mr-1" />
                              {txt.hasImages}
                            </Badge>
                          )}
                          <span className="text-xs">{category.options?.length || 0} {txt.options.toLowerCase()}</span>
                        </div>
                      </div>

                      {canEdit() && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingCategory({ ...category })}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteCategory(category.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Options Tab */}
        <TabsContent value="options">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <CardTitle>{txt.options}</CardTitle>
                <Select
                  value={selectedCategory?.id || ''}
                  onValueChange={(value) => setSelectedCategory(categories.find(c => c.id === value))}
                >
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder={txt.selectCategory} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {canEdit() && selectedCategory && (
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => setOptionDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {txt.addOption}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!selectedCategory ? (
                <p className="text-muted-foreground text-center py-8">{txt.selectCategory}</p>
              ) : selectedCategory.options?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{txt.noOptions}</p>
              ) : (
                <div className="space-y-2">
                  {selectedCategory.options?.map((option) => (
                    <div
                      key={option.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg flex-wrap gap-2"
                    >
                      <div className="flex items-center gap-3">
                        {option.imageUrl && (
                          <img
                            src={option.imageUrl}
                            alt={option.name}
                            className="w-16 h-12 object-cover rounded"
                          />
                        )}
                        <div>
                          <div className="font-medium">{option.name}</div>
                          {option.placeholder && (
                            <div className="text-xs text-muted-foreground">
                              Placeholder: {option.placeholder}
                            </div>
                          )}
                          {option.required && (
                            <Badge variant="secondary" className="text-xs">
                              {txt.required}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {canEdit() && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingOption({ ...option })}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteOption(option.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{txt.addCategory}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{txt.categoryName}</Label>
              <Input
                value={newCategory.name}
                onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Цвет базы"
              />
            </div>
            <div>
              <Label>{txt.inputType}</Label>
              <Select
                value={newCategory.inputType}
                onValueChange={(value) => setNewCategory(prev => ({ ...prev, inputType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="radio">{txt.radio}</SelectItem>
                  <SelectItem value="checkbox">{txt.checkbox}</SelectItem>
                  <SelectItem value="text">{txt.text}</SelectItem>
                  <SelectItem value="textarea">{txt.textarea}</SelectItem>
                  <SelectItem value="mixed">{txt.mixed}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{txt.layout}</Label>
              <Select
                value={newCategory.layout}
                onValueChange={(value) => setNewCategory(prev => ({ ...prev, layout: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="row">{txt.row}</SelectItem>
                  <SelectItem value="column">{txt.column}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="hasImages"
                checked={newCategory.hasImages}
                onCheckedChange={(checked) => setNewCategory(prev => ({ ...prev, hasImages: checked }))}
              />
              <Label htmlFor="hasImages">{txt.hasImages}</Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{txt.cancel}</Button>
            </DialogClose>
            <Button onClick={handleAddCategory} className="bg-amber-600 hover:bg-amber-700">
              {txt.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{txt.editCategory}</DialogTitle>
          </DialogHeader>
          {editingCategory && (
            <div className="space-y-4">
              <div>
                <Label>{txt.categoryName}</Label>
                <Input
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>{txt.inputType}</Label>
                <Select
                  value={editingCategory.inputType}
                  onValueChange={(value) => setEditingCategory(prev => ({ ...prev, inputType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="radio">{txt.radio}</SelectItem>
                    <SelectItem value="checkbox">{txt.checkbox}</SelectItem>
                    <SelectItem value="text">{txt.text}</SelectItem>
                    <SelectItem value="textarea">{txt.textarea}</SelectItem>
                    <SelectItem value="mixed">{txt.mixed}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{txt.layout}</Label>
                <Select
                  value={editingCategory.layout}
                  onValueChange={(value) => setEditingCategory(prev => ({ ...prev, layout: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="row">{txt.row}</SelectItem>
                    <SelectItem value="column">{txt.column}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="editHasImages"
                  checked={editingCategory.hasImages}
                  onCheckedChange={(checked) => setEditingCategory(prev => ({ ...prev, hasImages: checked }))}
                />
                <Label htmlFor="editHasImages">{txt.hasImages}</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{txt.cancel}</Button>
            </DialogClose>
            <Button onClick={handleSaveEditCategory} className="bg-amber-600 hover:bg-amber-700">
              {txt.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Option Dialog */}
      <Dialog open={optionDialogOpen} onOpenChange={setOptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{txt.addOption}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{txt.optionName}</Label>
              <Input
                value={newOption.name}
                onChange={(e) => setNewOption(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Палисандр"
              />
            </div>
            {selectedCategory?.hasImages && (
              <div>
                <Label>{txt.imageUrl}</Label>
                <Input
                  value={newOption.imageUrl}
                  onChange={(e) => setNewOption(prev => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder="https://..."
                />
                {newOption.imageUrl && (
                  <img src={newOption.imageUrl} alt="Preview" className="mt-2 h-20 object-cover rounded" />
                )}
              </div>
            )}
            {(selectedCategory?.inputType === 'text' || selectedCategory?.inputType === 'textarea') && (
              <div>
                <Label>{txt.placeholder}</Label>
                <Input
                  value={newOption.placeholder}
                  onChange={(e) => setNewOption(prev => ({ ...prev, placeholder: e.target.value }))}
                  placeholder="например: 180 см"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                id="optRequired"
                checked={newOption.required}
                onCheckedChange={(checked) => setNewOption(prev => ({ ...prev, required: checked }))}
              />
              <Label htmlFor="optRequired">{txt.required}</Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{txt.cancel}</Button>
            </DialogClose>
            <Button onClick={handleAddOption} className="bg-amber-600 hover:bg-amber-700">
              {txt.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Option Dialog */}
      <Dialog open={!!editingOption} onOpenChange={() => setEditingOption(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{txt.editOption}</DialogTitle>
          </DialogHeader>
          {editingOption && (
            <div className="space-y-4">
              <div>
                <Label>{txt.optionName}</Label>
                <Input
                  value={editingOption.name}
                  onChange={(e) => setEditingOption(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>{txt.imageUrl}</Label>
                <Input
                  value={editingOption.imageUrl || ''}
                  onChange={(e) => setEditingOption(prev => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder="https://..."
                />
                {editingOption.imageUrl && (
                  <img src={editingOption.imageUrl} alt="Preview" className="mt-2 h-20 object-cover rounded" />
                )}
              </div>
              <div>
                <Label>{txt.placeholder}</Label>
                <Input
                  value={editingOption.placeholder || ''}
                  onChange={(e) => setEditingOption(prev => ({ ...prev, placeholder: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="editOptRequired"
                  checked={editingOption.required || false}
                  onCheckedChange={(checked) => setEditingOption(prev => ({ ...prev, required: checked }))}
                />
                <Label htmlFor="editOptRequired">{txt.required}</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{txt.cancel}</Button>
            </DialogClose>
            <Button onClick={handleSaveEditOption} className="bg-amber-600 hover:bg-amber-700">
              {txt.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
