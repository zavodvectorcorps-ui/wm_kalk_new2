import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { 
  Plus, Save, Trash2, Loader2, Image, Package, Tag,
  Flame, DoorOpen, Layers, Lightbulb, Truck, GripVertical,
  ArrowUp, ArrowDown, Edit2, X, LayoutGrid, List, Eye
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const SaunaPricingPage = () => {
  const { t, i18n } = useTranslation();
  const { canEdit } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prices, setPrices] = useState({ models: [], categories: [] });
  
  const [newModel, setNewModel] = useState({
    name: '',
    basePrice: 0,
    foundationPrice: 0,
    discount: 0,
    imageUrl: '',
  });
  
  const [newCategory, setNewCategory] = useState({
    name: '',
    inputType: 'radio',
  });
  
  const [newOption, setNewOption] = useState({
    categoryId: '',
    name: '',
    price: 0,
    imageUrl: '',
    hasQuantity: false,
  });
  
  const [editingModel, setEditingModel] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingOption, setEditingOption] = useState(null);
  
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isOptionDialogOpen, setIsOptionDialogOpen] = useState(false);

  const texts = {
    ru: {
      saunaPricing: 'Управление ценами саун',
      models: 'Модели саун',
      categories: 'Категории опций',
      options: 'Опции',
      addModel: 'Добавить модель',
      addCategory: 'Добавить категорию',
      addOption: 'Добавить опцию',
      editModel: 'Редактировать модель',
      editCategory: 'Редактировать категорию',
      editOption: 'Редактировать опцию',
      modelName: 'Название модели',
      basePrice: 'Базовая цена (PLN)',
      foundationPrice: 'Цена фундамента (PLN)',
      discount: 'Скидка (%)',
      imageUrl: 'URL изображения',
      categoryName: 'Название категории',
      inputType: 'Тип ввода',
      radio: 'Одиночный выбор',
      checkbox: 'Множественный выбор',
      optionName: 'Название опции',
      price: 'Цена (PLN)',
      save: 'Сохранить',
      cancel: 'Отмена',
      delete: 'Удалить',
      saveAll: 'Сохранить все изменения',
      saved: 'Сохранено!',
      confirmDelete: 'Удалить?',
      noModels: 'Нет моделей',
      noCategories: 'Нет категорий',
      noOptions: 'Нет опций',
      selectCategory: 'Выберите категорию',
      displayType: 'Тип отображения',
      displayTypeGrid: 'Плитка',
      displayTypeDropdown: 'Список',
      modelsDisplayType: 'Отображение моделей',
      hasQuantity: 'Поле количества',
      quantityEnabled: 'Включить количество',
    },
    pl: {
      saunaPricing: 'Zarządzanie cenami saun',
      models: 'Modele saun',
      categories: 'Kategorie opcji',
      options: 'Opcje',
      addModel: 'Dodaj model',
      addCategory: 'Dodaj kategorię',
      addOption: 'Dodaj opcję',
      editModel: 'Edytuj model',
      editCategory: 'Edytuj kategorię',
      editOption: 'Edytuj opcję',
      modelName: 'Nazwa modelu',
      basePrice: 'Cena podstawowa (PLN)',
      foundationPrice: 'Cena fundamentu (PLN)',
      discount: 'Rabat (%)',
      imageUrl: 'URL obrazu',
      categoryName: 'Nazwa kategorii',
      inputType: 'Typ wejścia',
      radio: 'Pojedynczy wybór',
      checkbox: 'Wielokrotny wybór',
      optionName: 'Nazwa opcji',
      price: 'Cena (PLN)',
      save: 'Zapisz',
      cancel: 'Anuluj',
      delete: 'Usuń',
      saveAll: 'Zapisz wszystkie zmiany',
      saved: 'Zapisano!',
      confirmDelete: 'Usunąć?',
      noModels: 'Brak modeli',
      noCategories: 'Brak kategorii',
      noOptions: 'Brak opcji',
      selectCategory: 'Wybierz kategorię',
      displayType: 'Typ wyświetlania',
      displayTypeGrid: 'Kafelki',
      displayTypeDropdown: 'Lista',
      modelsDisplayType: 'Wyświetlanie modeli',
      hasQuantity: 'Pole ilości',
      quantityEnabled: 'Włącz ilość',
    },
  };

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  useEffect(() => {
    fetchPrices();
  }, []);

  const fetchPrices = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sauna/prices`);
      setPrices(response.data);
    } catch (error) {
      console.error('Error fetching prices:', error);
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/sauna/prices`, prices);
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error saving prices:', error);
      toast.error(t('error'));
    } finally {
      setSaving(false);
    }
  };

  // ========== MODELS ==========
  const handleAddModel = async () => {
    if (!newModel.name) return;
    
    const model = {
      id: newModel.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      name: newModel.name,
      basePrice: parseInt(newModel.basePrice) || 0,
      foundationPrice: parseInt(newModel.foundationPrice) || 0,
      discount: parseInt(newModel.discount) || 0,
      imageUrl: newModel.imageUrl,
      sortOrder: (prices.models?.length || 0) + 1,
      active: true,
    };
    
    try {
      await axios.post(`${API_URL}/api/sauna/models`, model);
      setPrices(prev => ({
        ...prev,
        models: [...(prev.models || []), model],
      }));
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error adding model:', error);
      toast.error(error.response?.data?.detail || t('error'));
    }
    
    setNewModel({ name: '', basePrice: 0, foundationPrice: 0, discount: 0, imageUrl: '' });
    setIsModelDialogOpen(false);
  };

  const handleEditModel = (model) => {
    setEditingModel({ ...model });
  };

  const handleSaveEditModel = async () => {
    if (!editingModel) return;
    
    try {
      await axios.put(`${API_URL}/api/sauna/models/${editingModel.id}`, editingModel);
      setPrices(prev => ({
        ...prev,
        models: prev.models.map(m => m.id === editingModel.id ? editingModel : m),
      }));
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error updating model:', error);
      toast.error(error.response?.data?.detail || t('error'));
    }
    
    setEditingModel(null);
  };

  const handleDeleteModel = async (modelId) => {
    try {
      await axios.delete(`${API_URL}/api/sauna/models/${modelId}`);
      setPrices(prev => ({
        ...prev,
        models: prev.models.filter(m => m.id !== modelId),
      }));
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error deleting model:', error);
      toast.error(error.response?.data?.detail || t('error'));
    }
  };

  const moveModel = (index, direction) => {
    const newModels = [...prices.models];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newModels.length) return;
    
    [newModels[index], newModels[targetIndex]] = [newModels[targetIndex], newModels[index]];
    newModels.forEach((m, i) => m.sortOrder = i + 1);
    
    setPrices(prev => ({ ...prev, models: newModels }));
  };

  // ========== CATEGORIES ==========
  const handleAddCategory = async () => {
    if (!newCategory.name) return;
    
    const category = {
      id: newCategory.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      name: newCategory.name,
      inputType: newCategory.inputType,
      displayType: 'grid',
      options: [],
    };
    
    try {
      await axios.post(`${API_URL}/api/sauna/categories`, category);
      setPrices(prev => ({
        ...prev,
        categories: [...(prev.categories || []), category],
      }));
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error(error.response?.data?.detail || t('error'));
    }
    
    setNewCategory({ name: '', inputType: 'radio' });
    setIsCategoryDialogOpen(false);
  };

  const handleEditCategory = (category) => {
    setEditingCategory({ ...category });
  };

  const handleSaveEditCategory = async () => {
    if (!editingCategory) return;
    
    try {
      await axios.put(`${API_URL}/api/sauna/categories/${editingCategory.id}`, editingCategory);
      setPrices(prev => ({
        ...prev,
        categories: prev.categories.map(c => c.id === editingCategory.id ? editingCategory : c),
      }));
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error(error.response?.data?.detail || t('error'));
    }
    
    setEditingCategory(null);
  };

  const handleDeleteCategory = async (categoryId) => {
    try {
      await axios.delete(`${API_URL}/api/sauna/categories/${categoryId}`);
      setPrices(prev => ({
        ...prev,
        categories: prev.categories.filter(c => c.id !== categoryId),
      }));
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error(error.response?.data?.detail || t('error'));
    }
  };

  // ========== OPTIONS ==========
  const handleAddOption = async () => {
    if (!newOption.categoryId || !newOption.name) return;
    
    const option = {
      id: newOption.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      name: newOption.name,
      price: parseInt(newOption.price) || 0,
      inputType: 'radio',
      sortOrder: 1,
      imageUrl: newOption.imageUrl || null,
      hasQuantity: newOption.hasQuantity || false,
    };
    
    try {
      await axios.post(`${API_URL}/api/sauna/categories/${newOption.categoryId}/options`, option);
      setPrices(prev => ({
        ...prev,
        categories: prev.categories.map(cat => {
          if (cat.id === newOption.categoryId) {
            return {
              ...cat,
              options: [...(cat.options || []), option],
            };
          }
          return cat;
        }),
      }));
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error adding option:', error);
      toast.error(error.response?.data?.detail || t('error'));
    }
    
    setNewOption({ categoryId: '', name: '', price: 0, imageUrl: '', hasQuantity: false });
    setIsOptionDialogOpen(false);
  };

  const handleDeleteOption = async (categoryId, optionId) => {
    try {
      await axios.delete(`${API_URL}/api/sauna/categories/${categoryId}/options/${optionId}`);
      setPrices(prev => ({
        ...prev,
        categories: prev.categories.map(cat => {
          if (cat.id === categoryId) {
            return {
              ...cat,
              options: cat.options.filter(o => o.id !== optionId),
            };
          }
          return cat;
        }),
      }));
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error deleting option:', error);
      toast.error(error.response?.data?.detail || t('error'));
    }
  };

  const handleModelsDisplayTypeChange = (displayType) => {
    setPrices(prev => ({
      ...prev,
      modelsDisplayType: displayType,
    }));
  };

  const handleCategoryDisplayTypeChange = (categoryId, displayType) => {
    setPrices(prev => ({
      ...prev,
      categories: prev.categories.map(cat => 
        cat.id === categoryId ? { ...cat, displayType } : cat
      ),
    }));
  };

  const handleUpdateOptionPrice = (categoryId, optionId, newPrice) => {
    setPrices(prev => ({
      ...prev,
      categories: prev.categories.map(cat => {
        if (cat.id === categoryId) {
          return {
            ...cat,
            options: cat.options.map(o => 
              o.id === optionId ? { ...o, price: parseInt(newPrice) || 0 } : o
            ),
          };
        }
        return cat;
      }),
    }));
  };

  const handleToggleOptionQuantity = (categoryId, optionId, hasQuantity) => {
    setPrices(prev => ({
      ...prev,
      categories: prev.categories.map(cat => {
        if (cat.id === categoryId) {
          return {
            ...cat,
            options: cat.options.map(o => 
              o.id === optionId ? { ...o, hasQuantity } : o
            ),
          };
        }
        return cat;
      }),
    }));
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
          <Flame className="h-6 w-6" />
          {txt.saunaPricing}
          {!canEdit() && (
            <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground ml-2">
              <Eye className="h-4 w-4" />
              Только просмотр
            </span>
          )}
        </h1>
        {canEdit() && (
          <Button
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {txt.saveAll}
          </Button>
        )}
      </div>

      <Tabs defaultValue="models" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="models">{txt.models}</TabsTrigger>
          <TabsTrigger value="categories">{txt.categories}</TabsTrigger>
          <TabsTrigger value="options">{txt.options}</TabsTrigger>
        </TabsList>

        {/* MODELS TAB */}
        <TabsContent value="models">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
              <CardTitle>{txt.models}</CardTitle>
              <div className="flex items-center gap-3">
                {/* Display Type Selector for Models */}
                {canEdit() && (
                  <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
                    <span className="text-sm text-muted-foreground px-2">{txt.displayType}:</span>
                    <Button
                      size="sm"
                      variant={prices.modelsDisplayType === 'grid' ? 'default' : 'ghost'}
                      onClick={() => handleModelsDisplayTypeChange('grid')}
                      className={prices.modelsDisplayType === 'grid' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                    >
                      <LayoutGrid className="h-4 w-4 mr-1" />
                      {txt.displayTypeGrid}
                    </Button>
                    <Button
                      size="sm"
                      variant={prices.modelsDisplayType === 'dropdown' ? 'default' : 'ghost'}
                      onClick={() => handleModelsDisplayTypeChange('dropdown')}
                      className={prices.modelsDisplayType === 'dropdown' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                    >
                      <List className="h-4 w-4 mr-1" />
                      {txt.displayTypeDropdown}
                    </Button>
                  </div>
                )}
                {canEdit() && (
                  <Dialog open={isModelDialogOpen} onOpenChange={setIsModelDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                        <Plus className="h-4 w-4 mr-2" />
                        {txt.addModel}
                      </Button>
                    </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{txt.addModel}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>{txt.modelName}</Label>
                      <Input
                        value={newModel.name}
                        onChange={(e) => setNewModel(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Sauna Kwadro-Beczka 235x200 cm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>{txt.basePrice}</Label>
                        <Input
                          type="number"
                          value={newModel.basePrice}
                          onChange={(e) => setNewModel(prev => ({ ...prev, basePrice: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>{txt.foundationPrice}</Label>
                        <Input
                          type="number"
                          value={newModel.foundationPrice}
                          onChange={(e) => setNewModel(prev => ({ ...prev, foundationPrice: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>{txt.discount}</Label>
                      <Input
                        type="number"
                        value={newModel.discount}
                        onChange={(e) => setNewModel(prev => ({ ...prev, discount: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>{txt.imageUrl}</Label>
                      <Input
                        value={newModel.imageUrl}
                        onChange={(e) => setNewModel(prev => ({ ...prev, imageUrl: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">{txt.cancel}</Button>
                    </DialogClose>
                    <Button onClick={handleAddModel} className="bg-amber-600 hover:bg-amber-700">
                      {txt.save}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {prices.models?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{txt.noModels}</p>
              ) : (
                <div className="space-y-2">
                  {prices.models?.map((model, index) => (
                    <div
                      key={model.id}
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex flex-col gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => moveModel(index, 'up')}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => moveModel(index, 'down')}
                          disabled={index === prices.models.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      {model.imageUrl && (
                        <img
                          src={model.imageUrl}
                          alt={model.name}
                          className="w-16 h-12 object-cover rounded"
                        />
                      )}
                      
                      <div className="flex-1">
                        <div className="font-medium">{model.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {model.basePrice.toLocaleString('pl-PL')} PLN
                          {model.discount > 0 && (
                            <Badge variant="secondary" className="ml-2 text-green-600">
                              -{model.discount}%
                            </Badge>
                          )}
                          {model.foundationPrice > 0 && (
                            <span className="ml-2">| Fund: +{model.foundationPrice} PLN</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {editingModel?.id === model.id ? (
                          <>
                            <Input
                              type="number"
                              value={editingModel.basePrice}
                              onChange={(e) => setEditingModel(prev => ({ ...prev, basePrice: parseInt(e.target.value) || 0 }))}
                              className="w-24"
                            />
                            <Input
                              type="number"
                              value={editingModel.discount}
                              onChange={(e) => setEditingModel(prev => ({ ...prev, discount: parseInt(e.target.value) || 0 }))}
                              className="w-16"
                              placeholder="%"
                            />
                            <Button size="sm" onClick={handleSaveEditModel}>
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingModel(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {canEdit() && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditModel(model)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteModel(model.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CATEGORIES TAB */}
        <TabsContent value="categories">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{txt.categories}</CardTitle>
              <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                    <Plus className="h-4 w-4 mr-2" />
                    {txt.addCategory}
                  </Button>
                </DialogTrigger>
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
                        placeholder="Piece"
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
                        </SelectContent>
                      </Select>
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
            </CardHeader>
            <CardContent>
              {prices.categories?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{txt.noCategories}</p>
              ) : (
                <div className="space-y-2">
                  {prices.categories?.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg flex-wrap gap-2"
                    >
                      <div>
                        <div className="font-medium">{category.name}</div>
                        <div className="text-sm text-muted-foreground flex flex-wrap gap-2 items-center">
                          <Badge variant="outline" className="mr-2">
                            {category.inputType === 'checkbox' ? txt.checkbox : txt.radio}
                          </Badge>
                          {category.options?.length || 0} {txt.options.toLowerCase()}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Display Type Selector for Category */}
                        <div className="flex items-center gap-1 bg-background rounded-md border p-0.5">
                          <Button
                            size="sm"
                            variant={category.displayType === 'grid' ? 'default' : 'ghost'}
                            onClick={() => handleCategoryDisplayTypeChange(category.id, 'grid')}
                            className={`h-7 px-2 ${category.displayType === 'grid' ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                          >
                            <LayoutGrid className="h-3 w-3 mr-1" />
                            {txt.displayTypeGrid}
                          </Button>
                          <Button
                            size="sm"
                            variant={category.displayType === 'dropdown' ? 'default' : 'ghost'}
                            onClick={() => handleCategoryDisplayTypeChange(category.id, 'dropdown')}
                            className={`h-7 px-2 ${category.displayType === 'dropdown' ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                          >
                            <List className="h-3 w-3 mr-1" />
                            {txt.displayTypeDropdown}
                          </Button>
                        </div>
                        
                        {editingCategory?.id === category.id ? (
                          <>
                            <Input
                              value={editingCategory.name}
                              onChange={(e) => setEditingCategory(prev => ({ ...prev, name: e.target.value }))}
                              className="w-40"
                            />
                            <Select
                              value={editingCategory.inputType}
                              onValueChange={(value) => setEditingCategory(prev => ({ ...prev, inputType: value }))}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="radio">{txt.radio}</SelectItem>
                                <SelectItem value="checkbox">{txt.checkbox}</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="sm" onClick={handleSaveEditCategory}>
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingCategory(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditCategory(category)}
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
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* OPTIONS TAB */}
        <TabsContent value="options">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{txt.options}</CardTitle>
              <Dialog open={isOptionDialogOpen} onOpenChange={setIsOptionDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                    <Plus className="h-4 w-4 mr-2" />
                    {txt.addOption}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{txt.addOption}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>{txt.selectCategory}</Label>
                      <Select
                        value={newOption.categoryId}
                        onValueChange={(value) => setNewOption(prev => ({ ...prev, categoryId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={txt.selectCategory} />
                        </SelectTrigger>
                        <SelectContent>
                          {prices.categories?.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{txt.optionName}</Label>
                      <Input
                        value={newOption.name}
                        onChange={(e) => setNewOption(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Piec Elektryczne 9 kW"
                      />
                    </div>
                    <div>
                      <Label>{txt.price}</Label>
                      <Input
                        type="number"
                        value={newOption.price}
                        onChange={(e) => setNewOption(prev => ({ ...prev, price: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>{txt.imageUrl}</Label>
                      <Input
                        value={newOption.imageUrl}
                        onChange={(e) => setNewOption(prev => ({ ...prev, imageUrl: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="hasQuantity"
                        checked={newOption.hasQuantity}
                        onCheckedChange={(checked) => setNewOption(prev => ({ ...prev, hasQuantity: checked }))}
                      />
                      <Label htmlFor="hasQuantity" className="cursor-pointer">
                        {txt.quantityEnabled}
                      </Label>
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
            </CardHeader>
            <CardContent>
              {prices.categories?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{txt.noCategories}</p>
              ) : (
                <div className="space-y-6">
                  {prices.categories?.map((category) => (
                    <div key={category.id} className="border rounded-lg p-4">
                      <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        {category.name}
                        <Badge variant="outline" className="ml-2">
                          {category.inputType === 'checkbox' ? txt.checkbox : txt.radio}
                        </Badge>
                      </h3>
                      
                      {category.options?.length === 0 ? (
                        <p className="text-muted-foreground text-sm">{txt.noOptions}</p>
                      ) : (
                        <div className="space-y-2">
                          {category.options?.map((option) => (
                            <div
                              key={option.id}
                              className="flex items-center justify-between p-2 bg-muted/30 rounded flex-wrap gap-2"
                            >
                              <div className="flex items-center gap-3">
                                {option.imageUrl && (
                                  <img
                                    src={option.imageUrl}
                                    alt={option.name}
                                    className="w-12 h-9 object-cover rounded"
                                  />
                                )}
                                <span className="text-sm">{option.name}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Input
                                  type="number"
                                  value={option.price}
                                  onChange={(e) => handleUpdateOptionPrice(category.id, option.id, e.target.value)}
                                  className="w-24 h-8"
                                />
                                <span className="text-sm text-muted-foreground">PLN</span>
                                <div className="flex items-center gap-1 border rounded px-2 py-1">
                                  <Checkbox
                                    id={`qty-${option.id}`}
                                    checked={option.hasQuantity || false}
                                    onCheckedChange={(checked) => handleToggleOptionQuantity(category.id, option.id, checked)}
                                  />
                                  <Label htmlFor={`qty-${option.id}`} className="text-xs cursor-pointer">
                                    Кол-во
                                  </Label>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleDeleteOption(category.id, option.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
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
    </div>
  );
};
