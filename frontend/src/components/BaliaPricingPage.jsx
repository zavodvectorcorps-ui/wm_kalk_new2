import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { SortableList } from './ui/sortable-list';
import { 
  DollarSign, Save, Loader2, Plus, 
  Eye, Droplets, Package, Settings, User,
  Download, FileSpreadsheet, Upload
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { CustomerFieldsManager } from './CustomerFieldsManager';
import { 
  ModelCard, 
  CategoryCard, 
  ModelEditDialog, 
  CategoryEditDialog, 
  OptionEditDialog, 
  BulkPriceEditDialog 
} from './balia-pricing';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const BaliaPricingPage = () => {
  const { t, i18n } = useTranslation();
  const { canEdit } = useAuth();
  const lang = i18n.language === 'pl' ? 'pl' : 'ru';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prices, setPrices] = useState({ models: [], categories: [], currency: 'EUR', currencySymbol: '€' });
  const [nbpRate, setNbpRate] = useState(null);
  const [excelTemplate, setExcelTemplate] = useState(null);
  
  // Dialog states
  const [editModelDialog, setEditModelDialog] = useState({ open: false, model: null, isNew: false });
  const [editCategoryDialog, setEditCategoryDialog] = useState({ open: false, category: null, isNew: false });
  const [editOptionDialog, setEditOptionDialog] = useState({ open: false, categoryId: null, option: null, isNew: false });
  const [bulkEditDialog, setBulkEditDialog] = useState({ open: false });
  
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Use i18n translations
  const txt = {
    title: t('baliaPricing.title'),
    models: t('baliaPricing.models'),
    categories: t('baliaPricing.categories'),
    settings: t('baliaPricing.settings'),
    addModel: t('baliaPricing.addModel'),
    addCategory: t('baliaPricing.addCategory'),
    addOption: t('baliaPricing.addOption'),
    editModel: t('baliaPricing.editModel'),
    editCategory: t('baliaPricing.editCategory'),
    editOption: t('baliaPricing.editOption'),
    newModel: t('baliaPricing.newModel'),
    newCategory: t('baliaPricing.newCategory'),
    newOption: t('baliaPricing.newOption'),
    name: t('baliaPricing.name'),
    nameRu: t('baliaPricing.nameRu'),
    namePl: t('baliaPricing.namePl'),
    price: t('baliaPricing.price'),
    basePrice: t('baliaPricing.basePrice'),
    image: t('baliaPricing.image'),
    uploadImage: t('baliaPricing.uploadImage'),
    removeImage: t('baliaPricing.removeImage'),
    inputType: t('baliaPricing.inputType'),
    dropdown: t('baliaPricing.dropdown'),
    checkbox: t('baliaPricing.checkbox'),
    save: t('baliaPricing.save'),
    cancel: t('baliaPricing.cancel'),
    delete: t('baliaPricing.delete'),
    saveAll: t('baliaPricing.saveAll'),
    saved: t('baliaPricing.saved'),
    error: t('baliaPricing.error'),
    viewOnly: t('baliaPricing.viewOnly'),
    active: t('baliaPricing.active'),
    currency: t('baliaPricing.currency'),
    currencySymbol: t('baliaPricing.currencySymbol'),
    options: t('baliaPricing.options'),
    heaterType: t('baliaPricing.heaterType'),
    external: t('baliaPricing.external'),
    integrated: t('baliaPricing.integrated'),
    confirmDelete: t('baliaPricing.confirmDelete'),
    noModels: t('baliaPricing.noModels'),
    noCategories: t('baliaPricing.noCategories'),
    noOptions: t('baliaPricing.noOptions'),
    displayType: t('baliaPricing.displayType'),
    list: t('baliaPricing.list'),
    tiles: t('baliaPricing.tiles'),
  };

  // Data fetching
  useEffect(() => {
    fetchPrices();
    fetchNbpRate();
    fetchExcelTemplate();
  }, []);

  const fetchPrices = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/prices`);
      setPrices(response.data);
    } catch (error) {
      console.error('Error fetching prices:', error);
      toast.error(txt.error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExcelTemplate = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/excel-template-structure`);
      setExcelTemplate(response.data);
    } catch (error) {
      console.error('Error fetching Excel template:', error);
    }
  };

  const fetchNbpRate = async () => {
    try {
      const response = await fetch('https://api.nbp.pl/api/exchangerates/rates/a/eur/?format=json');
      const data = await response.json();
      if (data.rates && data.rates[0]) {
        setNbpRate({ rate: data.rates[0].mid, date: data.rates[0].effectiveDate });
      }
    } catch (error) {
      console.error('Error fetching NBP rate:', error);
    }
  };

  // Save all changes
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/prices`, prices);
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error saving prices:', error);
      toast.error(txt.error);
    } finally {
      setSaving(false);
    }
  };

  // Export/Import handlers
  const handleExport = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/prices/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cennik_balia_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(lang === 'ru' ? 'Прайс-лист экспортирован' : 'Cennik wyeksportowany');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(lang === 'ru' ? 'Ошибка экспорта' : 'Błąd eksportu');
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await axios.post(`${API_URL}/api/prices/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(
        lang === 'ru' 
          ? `Импортировано: ${response.data.updated_models} моделей, ${response.data.updated_options} опций` 
          : `Zaimportowano: ${response.data.updated_models} modeli, ${response.data.updated_options} opcji`
      );
      fetchPrices();
    } catch (error) {
      console.error('Import error:', error);
      toast.error(lang === 'ru' ? 'Ошибка импорта' : 'Błąd importu');
    }
    e.target.value = '';
  };

  // Image upload handler
  const handleImageUpload = useCallback(async (e, type, targetId, categoryId = null) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/api/upload/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000
      });
      
      const imageUrl = `${API_URL}${response.data.url}`;
      
      if (type === 'model') {
        setPrices(prev => ({
          ...prev,
          models: prev.models.map(m => m.id === targetId ? { ...m, imageUrl } : m)
        }));
      } else if (type === 'category') {
        setPrices(prev => ({
          ...prev,
          categories: prev.categories.map(c => c.id === targetId ? { ...c, imageUrl } : c)
        }));
      } else if (type === 'option') {
        setPrices(prev => ({
          ...prev,
          categories: prev.categories.map(c => 
            c.id === categoryId 
              ? { ...c, options: c.options.map(o => o.id === targetId ? { ...o, imageUrl } : o) }
              : c
          )
        }));
      }
      
      toast.success('Изображение загружено');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(`Ошибка загрузки: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const removeImage = useCallback((type, targetId, categoryId = null) => {
    if (type === 'model') {
      setPrices(prev => ({
        ...prev,
        models: prev.models.map(m => m.id === targetId ? { ...m, imageUrl: '' } : m)
      }));
    } else if (type === 'category') {
      setPrices(prev => ({
        ...prev,
        categories: prev.categories.map(c => c.id === targetId ? { ...c, imageUrl: '' } : c)
      }));
    } else if (type === 'option') {
      setPrices(prev => ({
        ...prev,
        categories: prev.categories.map(c => 
          c.id === categoryId 
            ? { ...c, options: c.options.map(o => o.id === targetId ? { ...o, imageUrl: '' } : o) }
            : c
        )
      }));
    }
  }, []);

  // Model CRUD
  const handleSaveModel = useCallback((modelData) => {
    if (editModelDialog.isNew) {
      const newModel = {
        ...modelData,
        id: `model_${Date.now()}`,
        sortOrder: prices.models.length + 1,
        active: true,
        currency: 'EUR'
      };
      setPrices(prev => ({ ...prev, models: [...prev.models, newModel] }));
    } else {
      setPrices(prev => ({
        ...prev,
        models: prev.models.map(m => m.id === modelData.id ? modelData : m)
      }));
    }
    setEditModelDialog({ open: false, model: null, isNew: false });
  }, [editModelDialog.isNew, prices.models.length]);

  const handleDeleteModel = useCallback((modelId) => {
    if (window.confirm(txt.confirmDelete)) {
      setPrices(prev => ({
        ...prev,
        models: prev.models.filter(m => m.id !== modelId)
      }));
    }
  }, [txt.confirmDelete]);

  // Category CRUD
  const handleSaveCategory = useCallback((categoryData) => {
    if (editCategoryDialog.isNew) {
      const newCategory = {
        ...categoryData,
        id: `cat_${Date.now()}`,
        sortOrder: prices.categories.length + 1,
        options: []
      };
      setPrices(prev => ({ ...prev, categories: [...prev.categories, newCategory] }));
    } else {
      setPrices(prev => ({
        ...prev,
        categories: prev.categories.map(c => c.id === categoryData.id ? { ...c, ...categoryData } : c)
      }));
    }
    setEditCategoryDialog({ open: false, category: null, isNew: false });
  }, [editCategoryDialog.isNew, prices.categories.length]);

  const handleDeleteCategory = useCallback((categoryId) => {
    if (window.confirm(txt.confirmDelete)) {
      setPrices(prev => ({
        ...prev,
        categories: prev.categories.filter(c => c.id !== categoryId)
      }));
    }
  }, [txt.confirmDelete]);

  // Option CRUD
  const handleSaveOption = useCallback((optionData, categoryId) => {
    if (editOptionDialog.isNew) {
      const newOption = {
        ...optionData,
        id: `opt_${Date.now()}`,
        sortOrder: (prices.categories.find(c => c.id === categoryId)?.options?.length || 0) + 1
      };
      setPrices(prev => ({
        ...prev,
        categories: prev.categories.map(c => 
          c.id === categoryId 
            ? { ...c, options: [...(c.options || []), newOption] }
            : c
        )
      }));
    } else {
      setPrices(prev => ({
        ...prev,
        categories: prev.categories.map(c => 
          c.id === categoryId 
            ? { ...c, options: c.options.map(o => o.id === optionData.id ? optionData : o) }
            : c
        )
      }));
    }
    setEditOptionDialog({ open: false, categoryId: null, option: null, isNew: false });
  }, [editOptionDialog.isNew, prices.categories]);

  const handleDeleteOption = useCallback((categoryId, optionId) => {
    if (window.confirm(txt.confirmDelete)) {
      setPrices(prev => ({
        ...prev,
        categories: prev.categories.map(c => 
          c.id === categoryId 
            ? { ...c, options: c.options.filter(o => o.id !== optionId) }
            : c
        )
      }));
    }
  }, [txt.confirmDelete]);

  // Reorder handlers
  const handleReorderModels = useCallback((newModels) => {
    const modelsWithOrder = newModels.map((model, index) => ({
      ...model,
      sortOrder: index + 1
    }));
    setPrices(prev => ({ ...prev, models: modelsWithOrder }));
  }, []);

  const handleReorderCategories = useCallback((newCategories) => {
    setPrices(prev => ({ ...prev, categories: newCategories }));
  }, []);

  const handleReorderOptions = useCallback((categoryId, newOptions) => {
    setPrices(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === categoryId ? { ...cat, options: newOptions } : cat
      )
    }));
  }, []);

  // Bulk price edit
  const handleBulkPriceEdit = useCallback(({ changeType, value, applyTo }) => {
    setPrices(prev => ({
      ...prev,
      models: prev.models.map(model => {
        if (!model.heaterVariants || model.heaterVariants.length === 0) {
          if (applyTo === 'all' || applyTo === 'external') {
            const newPrice = changeType === 'percent' 
              ? model.basePrice * (1 + value / 100)
              : model.basePrice + value;
            return { ...model, basePrice: Math.round(newPrice * 100) / 100 };
          }
          return model;
        }
        
        const newVariants = model.heaterVariants.map(v => {
          if (applyTo === 'all' || applyTo === v.type) {
            const newPrice = changeType === 'percent'
              ? v.price * (1 + value / 100)
              : v.price + value;
            return { ...v, price: Math.round(newPrice * 100) / 100 };
          }
          return v;
        });
        
        return { 
          ...model, 
          heaterVariants: newVariants,
          basePrice: newVariants[0]?.price || model.basePrice
        };
      })
    }));
    setBulkEditDialog({ open: false });
    toast.success(lang === 'ru' ? 'Цены обновлены' : 'Ceny zaktualizowane');
  }, [lang]);

  // Excel mapping handlers
  const handleUpdateModelExcelCell = useCallback((modelId, excelCell) => {
    setPrices(prev => ({
      ...prev,
      models: prev.models.map(m => m.id === modelId ? { ...m, excelCell } : m)
    }));
  }, []);

  const handleUpdateHeaterVariantExcelCell = useCallback((modelId, variantIndex, excelCell) => {
    setPrices(prev => ({
      ...prev,
      models: prev.models.map(m => {
        if (m.id !== modelId) return m;
        const variants = [...(m.heaterVariants || [])];
        if (variants[variantIndex]) {
          variants[variantIndex] = { ...variants[variantIndex], excelCell };
        }
        return { ...m, heaterVariants: variants };
      })
    }));
  }, []);

  const handleUpdateHeaterVariantId = useCallback((modelId, variantIndex, newId) => {
    setPrices(prev => ({
      ...prev,
      models: prev.models.map(m => {
        if (m.id !== modelId) return m;
        const variants = [...(m.heaterVariants || [])];
        if (variants[variantIndex]) {
          variants[variantIndex] = { ...variants[variantIndex], id: newId };
        }
        return { ...m, heaterVariants: variants };
      })
    }));
  }, []);

  const handleUpdateOptionExcelCell = useCallback((categoryId, optionId, excelCell) => {
    setPrices(prev => ({
      ...prev,
      categories: prev.categories.map(cat => {
        if (cat.id !== categoryId) return cat;
        return {
          ...cat,
          options: cat.options.map(opt =>
            opt.id === optionId ? { ...opt, excelCell } : opt
          )
        };
      })
    }));
  }, []);

  const handleUpdateModelId = useCallback((oldId, newId) => {
    if (!newId || newId === oldId) return;
    if (prices.models.some(m => m.id === newId)) {
      toast.error(lang === 'ru' ? 'ID уже используется' : 'ID już istnieje');
      return;
    }
    setPrices(prev => ({
      ...prev,
      models: prev.models.map(m => m.id === oldId ? { ...m, id: newId } : m)
    }));
  }, [prices.models, lang]);

  const handleUpdateOptionId = useCallback((categoryId, oldId, newId) => {
    if (!newId || newId === oldId) return;
    const allOptionIds = prices.categories.flatMap(c => c.options?.map(o => o.id) || []);
    if (allOptionIds.includes(newId)) {
      toast.error(lang === 'ru' ? 'ID уже используется' : 'ID już istnieje');
      return;
    }
    setPrices(prev => ({
      ...prev,
      categories: prev.categories.map(cat => {
        if (cat.id !== categoryId) return cat;
        return {
          ...cat,
          options: cat.options.map(opt => opt.id === oldId ? { ...opt, id: newId } : opt)
        };
      })
    }));
  }, [prices.categories, lang]);

  // Recalculate prices based on EUR rates
  const recalculateAllPrices = useCallback(() => {
    const rate = prices.eurRate || 4.30;
    const defaultMarkup = prices.defaultMarkupPercent || 30;
    
    setPrices(prev => ({
      ...prev,
      models: prev.models.map(model => {
        const updatedVariants = model.heaterVariants?.map(v => {
          if (v.purchasePriceEur && v.purchasePriceEur > 0) {
            const costPln = v.purchasePriceEur * rate;
            const markup = v.markupPercent ?? defaultMarkup;
            const retailPrice = Math.round(costPln * (1 + markup / 100));
            return { ...v, price: retailPrice };
          }
          return v;
        }) || [];
        
        return {
          ...model,
          heaterVariants: updatedVariants,
          basePrice: updatedVariants[0]?.price || model.basePrice
        };
      }),
      categories: prev.categories.map(cat => ({
        ...cat,
        options: cat.options?.map(opt => {
          if (opt.purchasePriceEur && opt.purchasePriceEur > 0) {
            const costPln = opt.purchasePriceEur * rate;
            const markup = opt.markupPercent ?? defaultMarkup;
            const retailPrice = Math.round(costPln * (1 + markup / 100));
            return { ...opt, price: retailPrice };
          }
          return opt;
        }) || []
      }))
    }));
    toast.success(lang === 'ru' ? 'Цены пересчитаны' : 'Ceny przeliczone');
  }, [prices.eurRate, prices.defaultMarkupPercent, lang]);

  const getName = useCallback((item) => {
    return item[`name${lang === 'pl' ? 'Pl' : 'Ru'}`] || item.name || '';
  }, [lang]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-blue-800 flex items-center gap-2">
          <DollarSign className="h-6 w-6" />
          {txt.title}
          {!canEdit() && (
            <Badge variant="outline" className="ml-2">
              <Eye className="h-3 w-3 mr-1" />
              {txt.viewOnly}
            </Badge>
          )}
        </h1>
        
        {canEdit() && (
          <Button onClick={handleSaveAll} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {txt.saveAll}
          </Button>
        )}
      </div>

      <Tabs defaultValue="models" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="models" className="gap-2">
            <Droplets className="h-4 w-4" />
            {txt.models}
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <Package className="h-4 w-4" />
            {txt.categories}
          </TabsTrigger>
          <TabsTrigger value="excel" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </TabsTrigger>
          <TabsTrigger value="customer" className="gap-2">
            <User className="h-4 w-4" />
            {lang === 'ru' ? 'Данные клиента' : 'Dane klienta'}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            {txt.settings}
          </TabsTrigger>
        </TabsList>

        {/* Models Tab */}
        <TabsContent value="models">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{txt.models}</CardTitle>
              {canEdit() && (
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setBulkEditDialog({ open: true })}
                    className="text-orange-600 border-orange-300 hover:bg-orange-50"
                  >
                    <DollarSign className="h-4 w-4 mr-1" />
                    {lang === 'ru' ? 'Массовое изменение цен' : 'Zmiana cen hurtowo'}
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => setEditModelDialog({ open: true, model: {
                      name: '', nameRu: '', namePl: '', basePrice: 0, imageUrl: '',
                      heaterType: 'external', type: 'fiberglass', shape: 'round', size: '',
                      specs: {}
                    }, isNew: true })}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {txt.addModel}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {prices.models?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{txt.noModels}</p>
              ) : (
                <SortableList
                  items={prices.models?.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) || []}
                  onReorder={handleReorderModels}
                  disabled={!canEdit()}
                  renderItem={(model, modelIndex) => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      modelIndex={modelIndex}
                      currencySymbol={prices.currencySymbol}
                      canEdit={canEdit()}
                      getName={getName}
                      txt={txt}
                      onEdit={() => setEditModelDialog({ open: true, model, isNew: false })}
                      onDelete={() => handleDeleteModel(model.id)}
                      onRemoveImage={() => removeImage('model', model.id)}
                    />
                  )}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{txt.categories}</CardTitle>
              {canEdit() && (
                <Button 
                  size="sm" 
                  onClick={() => setEditCategoryDialog({ open: true, category: {
                    name: '', nameRu: '', namePl: '', imageUrl: '', inputType: 'radio'
                  }, isNew: true })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {txt.addCategory}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {prices.categories?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{txt.noCategories}</p>
              ) : (
                <SortableList
                  items={prices.categories || []}
                  onReorder={handleReorderCategories}
                  disabled={!canEdit()}
                  renderItem={(category, catIndex) => (
                    <CategoryCard
                      key={category.id}
                      category={category}
                      catIndex={catIndex}
                      currencySymbol={prices.currencySymbol}
                      canEdit={canEdit()}
                      getName={getName}
                      txt={txt}
                      onEditCategory={() => setEditCategoryDialog({ open: true, category, isNew: false })}
                      onDeleteCategory={() => handleDeleteCategory(category.id)}
                      onAddOption={() => setEditOptionDialog({ 
                        open: true, 
                        categoryId: category.id, 
                        option: { name: '', nameRu: '', namePl: '', price: 0, imageUrl: '' }, 
                        isNew: true 
                      })}
                      onEditOption={(option) => setEditOptionDialog({ 
                        open: true, 
                        categoryId: category.id, 
                        option, 
                        isNew: false 
                      })}
                      onDeleteOption={(optionId) => handleDeleteOption(category.id, optionId)}
                      onReorderOptions={(newOptions) => handleReorderOptions(category.id, newOptions)}
                      onImageUpload={(e) => handleImageUpload(e, 'category', category.id)}
                    />
                  )}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Excel Mapping Tab */}
        <TabsContent value="excel">
          <ExcelMappingTab 
            prices={prices}
            excelTemplate={excelTemplate}
            lang={lang}
            canEdit={canEdit}
            getName={getName}
            onUpdateModelId={handleUpdateModelId}
            onUpdateModelExcelCell={handleUpdateModelExcelCell}
            onUpdateHeaterVariantId={handleUpdateHeaterVariantId}
            onUpdateHeaterVariantExcelCell={handleUpdateHeaterVariantExcelCell}
            onUpdateOptionId={handleUpdateOptionId}
            onUpdateOptionExcelCell={handleUpdateOptionExcelCell}
          />
        </TabsContent>

        {/* Customer Fields Tab */}
        <TabsContent value="customer">
          <CustomerFieldsManager calculatorType="balia" />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <SettingsTab 
            prices={prices}
            setPrices={setPrices}
            nbpRate={nbpRate}
            lang={lang}
            canEdit={canEdit}
            txt={txt}
            onExport={handleExport}
            onImport={handleImport}
            onRecalculate={recalculateAllPrices}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ModelEditDialog 
        open={editModelDialog.open}
        model={editModelDialog.model}
        isNew={editModelDialog.isNew}
        onClose={() => setEditModelDialog({ open: false, model: null, isNew: false })}
        onSave={handleSaveModel}
        txt={txt}
        currencySymbol={prices.currencySymbol}
      />

      <CategoryEditDialog
        key={editCategoryDialog.category?.id || 'new-category'}
        open={editCategoryDialog.open}
        category={editCategoryDialog.category}
        isNew={editCategoryDialog.isNew}
        onClose={() => setEditCategoryDialog({ open: false, category: null, isNew: false })}
        onSave={handleSaveCategory}
        txt={txt}
      />

      <OptionEditDialog
        key={editOptionDialog.option?.id || 'new-option'}
        open={editOptionDialog.open}
        option={editOptionDialog.option}
        categoryId={editOptionDialog.categoryId}
        isNew={editOptionDialog.isNew}
        onClose={() => setEditOptionDialog({ open: false, categoryId: null, option: null, isNew: false })}
        onSave={handleSaveOption}
        txt={txt}
        currencySymbol={prices.currencySymbol}
      />

      <BulkPriceEditDialog
        open={bulkEditDialog.open}
        onClose={() => setBulkEditDialog({ open: false })}
        onApply={handleBulkPriceEdit}
        currencySymbol={prices.currencySymbol}
        modelsCount={prices.models?.length || 0}
        lang={lang}
      />
    </div>
  );
};

// Excel Mapping Tab Component
const ExcelMappingTab = ({ 
  prices, excelTemplate, lang, canEdit, getName,
  onUpdateModelId, onUpdateModelExcelCell, 
  onUpdateHeaterVariantId, onUpdateHeaterVariantExcelCell,
  onUpdateOptionId, onUpdateOptionExcelCell
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5" />
        {lang === 'ru' ? 'Маппинг Excel' : 'Mapowanie Excel'}
      </CardTitle>
      <p className="text-sm text-muted-foreground">
        {lang === 'ru' 
          ? 'Настройте соответствие между ID моделей/опций и ячейками Excel для технического задания'
          : 'Skonfiguruj mapowanie ID modeli/opcji do komórek Excel dla specyfikacji technicznej'}
      </p>
    </CardHeader>
    <CardContent className="space-y-6">
      {excelTemplate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <p className="font-medium text-blue-800">
            {lang === 'ru' ? 'Шаблон Excel' : 'Szablon Excel'}: {excelTemplate.maxRow} {lang === 'ru' ? 'строк' : 'wierszy'}, {excelTemplate.maxCol} {lang === 'ru' ? 'столбцов' : 'kolumn'}
          </p>
        </div>
      )}

      {/* Models Mapping */}
      <div className="space-y-3">
        <h3 className="font-semibold text-lg border-b pb-2">
          {lang === 'ru' ? 'Модели купелей' : 'Modele bali'}
        </h3>
        <div className="space-y-2">
          {prices.models?.map(model => (
            <div key={model.id} className="border rounded-lg p-3 bg-muted/30">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <span className="font-medium">{getName(model)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">ID:</Label>
                  <Input
                    value={model.id || ''}
                    onChange={(e) => onUpdateModelId(model.id, e.target.value)}
                    className="w-32 h-8 text-xs font-mono"
                    disabled={!canEdit()}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">{lang === 'ru' ? 'Ячейка:' : 'Komórka:'}</Label>
                  <Input
                    value={model.excelCell || ''}
                    onChange={(e) => onUpdateModelExcelCell(model.id, e.target.value.toUpperCase())}
                    className="w-20 h-8 text-xs font-mono text-center"
                    placeholder="np. Y16"
                    disabled={!canEdit()}
                  />
                </div>
              </div>
              
              {model.heaterVariants?.length > 0 && (
                <div className="mt-3 pl-4 border-l-2 border-amber-300 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">
                    {lang === 'ru' ? 'Варианты печи:' : 'Warianty pieca:'}
                  </p>
                  {model.heaterVariants.map((hv, idx) => (
                    <div key={idx} className="flex items-center gap-4 flex-wrap bg-amber-50 p-2 rounded">
                      <span className="text-sm">{hv.type === 'integrated' ? (lang === 'ru' ? 'Встроенная' : 'Zintegrowany') : (lang === 'ru' ? 'Внешняя' : 'Zewnętrzny')}</span>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">ID:</Label>
                        <Input
                          value={hv.id || `${model.id}_${hv.type}`}
                          onChange={(e) => onUpdateHeaterVariantId(model.id, idx, e.target.value)}
                          className="w-40 h-7 text-xs font-mono"
                          disabled={!canEdit()}
                          placeholder={`${model.id}_${hv.type}`}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">{lang === 'ru' ? 'Ячейка:' : 'Komórka:'}</Label>
                        <Input
                          value={hv.excelCell || ''}
                          onChange={(e) => onUpdateHeaterVariantExcelCell(model.id, idx, e.target.value.toUpperCase())}
                          className="w-20 h-7 text-xs font-mono text-center"
                          placeholder="np. B10"
                          disabled={!canEdit()}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Options Mapping */}
      <div className="space-y-3">
        <h3 className="font-semibold text-lg border-b pb-2">
          {lang === 'ru' ? 'Опции по категориям' : 'Opcje wg kategorii'}
        </h3>
        {prices.categories?.map(category => (
          <div key={category.id} className="border rounded-lg p-3">
            <h4 className="font-medium text-sm mb-2 text-primary">{getName(category)}</h4>
            <div className="space-y-1">
              {category.options?.map(option => (
                <div key={option.id} className="flex items-center gap-4 flex-wrap py-1 px-2 bg-muted/30 rounded">
                  <span className="flex-1 min-w-[150px] text-sm">{getName(option)}</span>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">ID:</Label>
                    <Input
                      value={option.id || ''}
                      onChange={(e) => onUpdateOptionId(category.id, option.id, e.target.value)}
                      className="w-32 h-7 text-xs font-mono"
                      disabled={!canEdit()}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">{lang === 'ru' ? 'Ячейка:' : 'Komórka:'}</Label>
                    <Input
                      value={option.excelCell || ''}
                      onChange={(e) => onUpdateOptionExcelCell(category.id, option.id, e.target.value.toUpperCase())}
                      className="w-20 h-7 text-xs font-mono text-center"
                      placeholder="np. D10"
                      disabled={!canEdit()}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

// Settings Tab Component
const SettingsTab = ({ prices, setPrices, nbpRate, lang, canEdit, txt, onExport, onImport, onRecalculate }) => (
  <Card>
    <CardHeader>
      <CardTitle>{txt.settings}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      {/* Export/Import Section */}
      <div className="border rounded-lg p-4 bg-green-50 space-y-4">
        <h3 className="font-semibold text-green-800 flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          {lang === 'ru' ? 'Экспорт / Импорт прайс-листа' : 'Eksport / Import cennika'}
        </h3>
        
        <div className="flex gap-4">
          <Button 
            variant="outline" 
            onClick={onExport}
            className="flex-1 border-green-300 text-green-700 hover:bg-green-100"
          >
            <Download className="h-4 w-4 mr-2" />
            {lang === 'ru' ? 'Экспорт в Excel' : 'Eksport do Excel'}
          </Button>
          
          <label className="flex-1">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={onImport}
              className="hidden"
              disabled={!canEdit()}
            />
            <Button 
              variant="outline" 
              className="w-full border-green-300 text-green-700 hover:bg-green-100"
              disabled={!canEdit()}
              asChild
            >
              <span>
                <Upload className="h-4 w-4 mr-2" />
                {lang === 'ru' ? 'Импорт из Excel' : 'Import z Excel'}
              </span>
            </Button>
          </label>
        </div>
        
        <p className="text-xs text-green-700">
          {lang === 'ru' 
            ? 'Экспортируйте прайс-лист для редактирования в Excel. После изменений импортируйте обратно.' 
            : 'Wyeksportuj cennik do edycji w Excel. Po zmianach zaimportuj z powrotem.'}
        </p>
      </div>
      
      <Separator />
      
      {/* Currency Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{txt.currency}</Label>
          <Input 
            value={prices.currency || 'PLN'} 
            onChange={(e) => setPrices(prev => ({ ...prev, currency: e.target.value }))}
            disabled={!canEdit()}
          />
        </div>
        <div className="space-y-2">
          <Label>{txt.currencySymbol}</Label>
          <Input 
            value={prices.currencySymbol || 'zł'} 
            onChange={(e) => setPrices(prev => ({ ...prev, currencySymbol: e.target.value }))}
            disabled={!canEdit()}
          />
        </div>
      </div>

      {/* EUR Exchange Rate Section */}
      <Separator />
      <div className="border rounded-lg p-4 bg-amber-50 space-y-4">
        <h3 className="font-semibold text-amber-800 flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          {lang === 'ru' ? 'Расчёт цен (закупка в EUR)' : 'Kalkulacja cen (zakup w EUR)'}
        </h3>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{lang === 'ru' ? 'Курс EUR → PLN' : 'Kurs EUR → PLN'}</Label>
            <Input 
              type="number"
              step="0.01"
              value={prices.eurRate || 4.30} 
              onChange={(e) => setPrices(prev => ({ ...prev, eurRate: parseFloat(e.target.value) || 4.30 }))}
              disabled={!canEdit()}
              placeholder="4.30"
            />
            <p className="text-xs text-muted-foreground">1 EUR = {prices.eurRate || 4.30} PLN</p>
            {nbpRate && (
              <p className="text-xs text-blue-600">
                NBP ({nbpRate.date}): <b>{nbpRate.rate.toFixed(4)}</b> PLN
                {canEdit() && (
                  <button 
                    onClick={() => setPrices(prev => ({ ...prev, eurRate: nbpRate.rate }))}
                    className="ml-2 text-blue-700 underline hover:no-underline"
                  >
                    {lang === 'ru' ? 'применить' : 'zastosuj'}
                  </button>
                )}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{lang === 'ru' ? 'Наценка по умолч. (%)' : 'Domyślna marża (%)'}</Label>
            <Input 
              type="number"
              value={prices.defaultMarkupPercent || 30} 
              onChange={(e) => setPrices(prev => ({ ...prev, defaultMarkupPercent: parseFloat(e.target.value) || 30 }))}
              disabled={!canEdit()}
              placeholder="30"
            />
          </div>
          <div className="flex items-end">
            <Button 
              variant="outline" 
              onClick={onRecalculate}
              disabled={!canEdit()}
              className="w-full"
            >
              {lang === 'ru' ? 'Пересчитать все цены' : 'Przelicz wszystkie ceny'}
            </Button>
          </div>
        </div>
        
        <p className="text-xs text-amber-700">
          {lang === 'ru' 
            ? 'Формула: Закупка (EUR) × Курс × (1 + Наценка%) = Розничная цена (PLN)' 
            : 'Formuła: Zakup (EUR) × Kurs × (1 + Marża%) = Cena detaliczna (PLN)'}
        </p>
      </div>
    </CardContent>
  </Card>
);
