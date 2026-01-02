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
  Eye,
  Image as ImageIcon,
  FolderOpen,
  Columns,
  Square,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const TechSpecAdminPage = ({ projectType = 'sauna' }) => {
  const { i18n } = useTranslation();
  const { canEdit } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [masterCategories, setMasterCategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedMasterCategory, setSelectedMasterCategory] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // API base path depends on project type
  const apiBasePath = projectType === 'balia' ? '/api/balia-tech-spec' : '/api/tech-spec';

  // Dialogs
  const [masterDialogOpen, setMasterDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [editingMaster, setEditingMaster] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingOption, setEditingOption] = useState(null);

  // New forms
  const [newMaster, setNewMaster] = useState({ name: '' });
  const [newCategory, setNewCategory] = useState({
    name: '',
    masterCategoryId: '',
    inputType: 'radio',
    layout: 'row',
    displayWidth: 'half',
    hasImages: false,
  });
  const [newOption, setNewOption] = useState({
    name: '',
    imageUrl: '',
    placeholder: '',
    required: false,
  });

  const txt = {
    title: 'Управление тех.заданием',
    masterCategories: 'Главные категории',
    categories: 'Подкатегории',
    options: 'Опции',
    addMaster: 'Добавить главную категорию',
    addCategory: 'Добавить подкатегорию',
    addOption: 'Добавить опцию',
    editMaster: 'Редактировать главную категорию',
    editCategory: 'Редактировать подкатегорию',
    editOption: 'Редактировать опцию',
    masterName: 'Название главной категории',
    categoryName: 'Название подкатегории',
    optionName: 'Название опции',
    selectMaster: 'Главная категория',
    inputType: 'Тип ввода',
    layout: 'Расположение опций',
    displayWidth: 'Ширина в модальном окне',
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
    full: 'На всю ширину',
    half: 'Половина (2 колонки)',
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    saveAll: 'Сохранить всё',
    saved: 'Сохранено!',
    noMasters: 'Нет главных категорий',
    noCategories: 'Нет подкатегорий',
    noOptions: 'Нет опций',
    selectCategory: 'Выберите подкатегорию',
    viewOnly: 'Только просмотр',
    noCategoryAssigned: 'Без категории',
  };

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setSelectedMasterCategory(null);
    setSelectedCategory(null);
    try {
      const response = await axios.get(`${API_URL}${apiBasePath}/categories`);
      setMasterCategories(response.data.masterCategories || []);
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      // For balia, if no data exists yet, initialize with empty arrays
      if (projectType === 'balia') {
        setMasterCategories([]);
        setCategories([]);
      } else {
        toast.error('Ошибка загрузки');
      }
    } finally {
      setLoading(false);
    }
  }, [apiBasePath, projectType]);

  useEffect(() => {
    fetchData();
  }, [fetchData, projectType]);

  // Save all
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_URL}${apiBasePath}/categories`, { masterCategories, categories });
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  // ========== MASTER CATEGORY HANDLERS ==========
  const handleAddMaster = async () => {
    if (!newMaster.name) return;

    const masterId = 'master_' + newMaster.name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_а-яё]/gi, '');

    const master = {
      id: masterId,
      name: newMaster.name,
      sortOrder: masterCategories.length + 1,
    };

    try {
      await axios.post(`${API_URL}${apiBasePath}/master-category`, master);
      setMasterCategories(prev => [...prev, master]);
      setNewMaster({ name: '' });
      setMasterDialogOpen(false);
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error adding master:', error);
      toast.error(error.response?.data?.detail || 'Ошибка');
    }
  };

  const handleSaveEditMaster = async () => {
    if (!editingMaster) return;

    try {
      await axios.put(`${API_URL}${apiBasePath}/master-category/${editingMaster.id}`, editingMaster);
      setMasterCategories(prev => prev.map(m => m.id === editingMaster.id ? editingMaster : m));
      setEditingMaster(null);
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error updating master:', error);
      toast.error('Ошибка');
    }
  };

  const handleDeleteMaster = async (masterId) => {
    if (!window.confirm('Удалить главную категорию? Подкатегории будут отвязаны.')) return;

    try {
      await axios.delete(`${API_URL}${apiBasePath}/master-category/${masterId}`);
      setMasterCategories(prev => prev.filter(m => m.id !== masterId));
      setCategories(prev => prev.map(c => 
        c.masterCategoryId === masterId ? { ...c, masterCategoryId: null } : c
      ));
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error deleting master:', error);
      toast.error('Ошибка');
    }
  };

  const handleMoveMaster = async (masterId, direction) => {
    try {
      await axios.post(`${API_URL}${apiBasePath}/master-category/${masterId}/move?direction=${direction}`);
      fetchData();
    } catch (error) {
      console.error('Error moving master:', error);
    }
  };

  // ========== CATEGORY HANDLERS ==========
  const handleAddCategory = async () => {
    if (!newCategory.name) return;

    const categoryId = newCategory.name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_а-яё]/gi, '');

    const category = {
      id: categoryId,
      name: newCategory.name,
      masterCategoryId: newCategory.masterCategoryId || null,
      inputType: newCategory.inputType,
      layout: newCategory.layout,
      displayWidth: newCategory.displayWidth,
      hasImages: newCategory.hasImages,
      sortOrder: categories.length + 1,
      options: [],
    };

    try {
      await axios.post(`${API_URL}${apiBasePath}/category`, category);
      setCategories(prev => [...prev, category]);
      setNewCategory({ name: '', masterCategoryId: '', inputType: 'radio', layout: 'row', displayWidth: 'half', hasImages: false });
      setCategoryDialogOpen(false);
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error(error.response?.data?.detail || 'Ошибка');
    }
  };

  const handleSaveEditCategory = async () => {
    if (!editingCategory) return;

    try {
      await axios.put(`${API_URL}${apiBasePath}/category/${editingCategory.id}`, editingCategory);
      setCategories(prev => prev.map(c => c.id === editingCategory.id ? editingCategory : c));
      setEditingCategory(null);
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Ошибка');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Удалить подкатегорию?')) return;

    try {
      await axios.delete(`${API_URL}${apiBasePath}/category/${categoryId}`);
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

  const handleMoveCategory = async (categoryId, direction) => {
    try {
      await axios.post(`${API_URL}${apiBasePath}/category/${categoryId}/move?direction=${direction}`);
      fetchData();
    } catch (error) {
      console.error('Error moving category:', error);
    }
  };

  // ========== OPTION HANDLERS ==========
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
      await axios.post(`${API_URL}${apiBasePath}/category/${selectedCategory.id}/option`, option);
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

  const handleSaveEditOption = async () => {
    if (!editingOption || !selectedCategory) return;

    try {
      await axios.put(
        `${API_URL}${apiBasePath}/category/${selectedCategory.id}/option/${editingOption.id}`,
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

  const handleDeleteOption = async (optionId) => {
    if (!selectedCategory || !window.confirm('Удалить опцию?')) return;

    try {
      await axios.delete(`${API_URL}${apiBasePath}/category/${selectedCategory.id}/option/${optionId}`);
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

  // Get categories for selected master
  const filteredCategories = selectedMasterCategory
    ? categories.filter(c => c.masterCategoryId === selectedMasterCategory.id)
    : categories;

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

      <Tabs defaultValue="masters" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="masters">{txt.masterCategories}</TabsTrigger>
          <TabsTrigger value="categories">{txt.categories}</TabsTrigger>
          <TabsTrigger value="options">{txt.options}</TabsTrigger>
        </TabsList>

        {/* Master Categories Tab */}
        <TabsContent value="masters">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                {txt.masterCategories}
              </CardTitle>
              {canEdit() && (
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => setMasterDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {txt.addMaster}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {masterCategories.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{txt.noMasters}</p>
              ) : (
                <div className="space-y-2">
                  {masterCategories.map((master, index) => (
                    <div key={master.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      {canEdit() && (
                        <div className="flex flex-col gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleMoveMaster(master.id, 'up')} disabled={index === 0}>
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleMoveMaster(master.id, 'down')} disabled={index === masterCategories.length - 1}>
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{master.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {categories.filter(c => c.masterCategoryId === master.id).length} подкатегорий
                        </div>
                      </div>
                      {canEdit() && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditingMaster({ ...master })}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteMaster(master.id)}>
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

        {/* Categories Tab */}
        <TabsContent value="categories">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <CardTitle>{txt.categories}</CardTitle>
                <Select
                  value={selectedMasterCategory?.id || 'all'}
                  onValueChange={(value) => setSelectedMasterCategory(value === 'all' ? null : masterCategories.find(m => m.id === value))}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Все категории" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все категории</SelectItem>
                    {masterCategories.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {canEdit() && (
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => setCategoryDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {txt.addCategory}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {filteredCategories.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{txt.noCategories}</p>
              ) : (
                <div className="space-y-2">
                  {filteredCategories.map((category, index) => (
                    <div key={category.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      {canEdit() && (
                        <div className="flex flex-col gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleMoveCategory(category.id, 'up')} disabled={index === 0}>
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleMoveCategory(category.id, 'down')} disabled={index === filteredCategories.length - 1}>
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{category.name}</div>
                        <div className="text-sm text-muted-foreground flex flex-wrap gap-2 items-center">
                          <Badge variant="outline" className="text-xs">
                            {masterCategories.find(m => m.id === category.masterCategoryId)?.name || txt.noCategoryAssigned}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {category.inputType === 'radio' ? txt.radio :
                             category.inputType === 'checkbox' ? txt.checkbox :
                             category.inputType === 'text' ? txt.text :
                             category.inputType === 'textarea' ? txt.textarea : txt.mixed}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {category.displayWidth === 'full' ? <><Square className="h-3 w-3 mr-1" />{txt.full}</> : <><Columns className="h-3 w-3 mr-1" />{txt.half}</>}
                          </Badge>
                          {category.hasImages && <Badge variant="secondary" className="text-xs"><ImageIcon className="h-3 w-3 mr-1" />Изображения</Badge>}
                          <span className="text-xs">{category.options?.length || 0} опций</span>
                        </div>
                      </div>
                      {canEdit() && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditingCategory({ ...category })}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteCategory(category.id)}>
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
                    <div key={option.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        {option.imageUrl && <img src={option.imageUrl} alt={option.name} className="w-16 h-12 object-cover rounded" />}
                        <div>
                          <div className="font-medium">{option.name}</div>
                          {option.placeholder && <div className="text-xs text-muted-foreground">Подсказка: {option.placeholder}</div>}
                          {option.required && <Badge variant="secondary" className="text-xs">{txt.required}</Badge>}
                        </div>
                      </div>
                      {canEdit() && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditingOption({ ...option })}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteOption(option.id)}>
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

      {/* Add Master Category Dialog */}
      <Dialog open={masterDialogOpen} onOpenChange={setMasterDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{txt.addMaster}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{txt.masterName}</Label>
              <Input value={newMaster.name} onChange={(e) => setNewMaster({ name: e.target.value })} placeholder="Мастер 1 - Цвета" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{txt.cancel}</Button></DialogClose>
            <Button onClick={handleAddMaster} className="bg-amber-600 hover:bg-amber-700">{txt.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Master Category Dialog */}
      <Dialog open={!!editingMaster} onOpenChange={() => setEditingMaster(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{txt.editMaster}</DialogTitle></DialogHeader>
          {editingMaster && (
            <div className="space-y-4">
              <div>
                <Label>{txt.masterName}</Label>
                <Input value={editingMaster.name} onChange={(e) => setEditingMaster(prev => ({ ...prev, name: e.target.value }))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{txt.cancel}</Button></DialogClose>
            <Button onClick={handleSaveEditMaster} className="bg-amber-600 hover:bg-amber-700">{txt.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{txt.addCategory}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{txt.categoryName}</Label>
              <Input value={newCategory.name} onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))} placeholder="Цвет базы" />
            </div>
            <div>
              <Label>{txt.selectMaster}</Label>
              <Select value={newCategory.masterCategoryId} onValueChange={(value) => setNewCategory(prev => ({ ...prev, masterCategoryId: value }))}>
                <SelectTrigger><SelectValue placeholder="Выберите главную категорию" /></SelectTrigger>
                <SelectContent>
                  {masterCategories.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{txt.inputType}</Label>
                <Select value={newCategory.inputType} onValueChange={(value) => setNewCategory(prev => ({ ...prev, inputType: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Select value={newCategory.layout} onValueChange={(value) => setNewCategory(prev => ({ ...prev, layout: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="row">{txt.row}</SelectItem>
                    <SelectItem value="column">{txt.column}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{txt.displayWidth}</Label>
              <Select value={newCategory.displayWidth} onValueChange={(value) => setNewCategory(prev => ({ ...prev, displayWidth: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="half">{txt.half}</SelectItem>
                  <SelectItem value="full">{txt.full}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="hasImages" checked={newCategory.hasImages} onCheckedChange={(checked) => setNewCategory(prev => ({ ...prev, hasImages: checked }))} />
              <Label htmlFor="hasImages">{txt.hasImages}</Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{txt.cancel}</Button></DialogClose>
            <Button onClick={handleAddCategory} className="bg-amber-600 hover:bg-amber-700">{txt.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{txt.editCategory}</DialogTitle></DialogHeader>
          {editingCategory && (
            <div className="space-y-4">
              <div>
                <Label>{txt.categoryName}</Label>
                <Input value={editingCategory.name} onChange={(e) => setEditingCategory(prev => ({ ...prev, name: e.target.value }))} />
              </div>
              <div>
                <Label>{txt.selectMaster}</Label>
                <Select value={editingCategory.masterCategoryId || ''} onValueChange={(value) => setEditingCategory(prev => ({ ...prev, masterCategoryId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Выберите главную категорию" /></SelectTrigger>
                  <SelectContent>
                    {masterCategories.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{txt.inputType}</Label>
                  <Select value={editingCategory.inputType} onValueChange={(value) => setEditingCategory(prev => ({ ...prev, inputType: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <Select value={editingCategory.layout} onValueChange={(value) => setEditingCategory(prev => ({ ...prev, layout: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="row">{txt.row}</SelectItem>
                      <SelectItem value="column">{txt.column}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>{txt.displayWidth}</Label>
                <Select value={editingCategory.displayWidth || 'half'} onValueChange={(value) => setEditingCategory(prev => ({ ...prev, displayWidth: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="half">{txt.half}</SelectItem>
                    <SelectItem value="full">{txt.full}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="editHasImages" checked={editingCategory.hasImages} onCheckedChange={(checked) => setEditingCategory(prev => ({ ...prev, hasImages: checked }))} />
                <Label htmlFor="editHasImages">{txt.hasImages}</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{txt.cancel}</Button></DialogClose>
            <Button onClick={handleSaveEditCategory} className="bg-amber-600 hover:bg-amber-700">{txt.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Option Dialog */}
      <Dialog open={optionDialogOpen} onOpenChange={setOptionDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{txt.addOption}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{txt.optionName}</Label>
              <Input value={newOption.name} onChange={(e) => setNewOption(prev => ({ ...prev, name: e.target.value }))} placeholder="Палисандр" />
            </div>
            {selectedCategory?.hasImages && (
              <div>
                <Label>{txt.imageUrl}</Label>
                <Input value={newOption.imageUrl} onChange={(e) => setNewOption(prev => ({ ...prev, imageUrl: e.target.value }))} placeholder="https://..." />
                {newOption.imageUrl && <img src={newOption.imageUrl} alt="Preview" className="mt-2 h-20 object-cover rounded" />}
              </div>
            )}
            {(selectedCategory?.inputType === 'text' || selectedCategory?.inputType === 'textarea') && (
              <div>
                <Label>{txt.placeholder}</Label>
                <Input value={newOption.placeholder} onChange={(e) => setNewOption(prev => ({ ...prev, placeholder: e.target.value }))} placeholder="например: 180 см" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox id="optRequired" checked={newOption.required} onCheckedChange={(checked) => setNewOption(prev => ({ ...prev, required: checked }))} />
              <Label htmlFor="optRequired">{txt.required}</Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{txt.cancel}</Button></DialogClose>
            <Button onClick={handleAddOption} className="bg-amber-600 hover:bg-amber-700">{txt.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Option Dialog */}
      <Dialog open={!!editingOption} onOpenChange={() => setEditingOption(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{txt.editOption}</DialogTitle></DialogHeader>
          {editingOption && (
            <div className="space-y-4">
              <div>
                <Label>{txt.optionName}</Label>
                <Input value={editingOption.name} onChange={(e) => setEditingOption(prev => ({ ...prev, name: e.target.value }))} />
              </div>
              <div>
                <Label>{txt.imageUrl}</Label>
                <Input value={editingOption.imageUrl || ''} onChange={(e) => setEditingOption(prev => ({ ...prev, imageUrl: e.target.value }))} placeholder="https://..." />
                {editingOption.imageUrl && <img src={editingOption.imageUrl} alt="Preview" className="mt-2 h-20 object-cover rounded" />}
              </div>
              <div>
                <Label>{txt.placeholder}</Label>
                <Input value={editingOption.placeholder || ''} onChange={(e) => setEditingOption(prev => ({ ...prev, placeholder: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="editOptRequired" checked={editingOption.required || false} onCheckedChange={(checked) => setEditingOption(prev => ({ ...prev, required: checked }))} />
                <Label htmlFor="editOptRequired">{txt.required}</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{txt.cancel}</Button></DialogClose>
            <Button onClick={handleSaveEditOption} className="bg-amber-600 hover:bg-amber-700">{txt.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
