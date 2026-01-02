import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { 
  DollarSign, Save, Loader2, Plus, Trash2, Edit2, 
  Image as ImageIcon, Upload, X, Eye, Droplets, Package, Settings, User, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { CustomerFieldsManager } from './CustomerFieldsManager';
import { BaliaImageUploader } from './BaliaImageUploader';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Helper to get full image URL - handles both full URLs and legacy relative paths
const getFullImageUrl = (url) => {
  if (!url) return '';
  // If it's already a full URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Legacy: convert relative path to full URL
  if (url.startsWith('/api/')) {
    return `${API_URL}${url}`;
  }
  return url;
};

export const BaliaPricingPage = () => {
  const { t, i18n } = useTranslation();
  const { canEdit } = useAuth();
  const lang = i18n.language === 'pl' ? 'pl' : 'ru';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prices, setPrices] = useState({ models: [], categories: [], currency: 'EUR', currencySymbol: '€' });
  const [nbpRate, setNbpRate] = useState(null);
  
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

  useEffect(() => {
    fetchPrices();
    fetchNbpRate();
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

  const fetchNbpRate = async () => {
    try {
      const response = await fetch('https://api.nbp.pl/api/exchangerates/rates/a/eur/?format=json');
      const data = await response.json();
      if (data.rates && data.rates[0]) {
        setNbpRate({
          rate: data.rates[0].mid,
          date: data.rates[0].effectiveDate
        });
      }
    } catch (error) {
      console.error('Error fetching NBP rate:', error);
    }
  };

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

  const handleImageUpload = async (e, type, targetId, categoryId = null) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('Uploading image to:', `${API_URL}/api/upload/image`);
      
      const response = await axios.post(`${API_URL}/api/upload/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000 // 30 second timeout
      });
      
      console.log('Upload response:', response.data);
      
      const relativeUrl = response.data.url;
      
      if (!relativeUrl || !relativeUrl.startsWith('/api/uploads/')) {
        throw new Error('Invalid URL returned from server');
      }
      
      // Save FULL URL with domain (like in Sauna)
      const imageUrl = `${API_URL}${relativeUrl}`;
      console.log('Saving full URL:', imageUrl);
      
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
  };

  const removeImage = (type, targetId, categoryId = null) => {
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
  };

  // Model CRUD
  const handleSaveModel = (modelData) => {
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
  };

  const handleDeleteModel = (modelId) => {
    if (window.confirm(txt.confirmDelete)) {
      setPrices(prev => ({
        ...prev,
        models: prev.models.filter(m => m.id !== modelId)
      }));
    }
  };

  // Bulk price edit
  const handleBulkPriceEdit = ({ changeType, value, applyTo }) => {
    setPrices(prev => ({
      ...prev,
      models: prev.models.map(model => {
        if (!model.heaterVariants || model.heaterVariants.length === 0) {
          // Legacy model with basePrice
          if (applyTo === 'all' || applyTo === 'external') {
            const newPrice = changeType === 'percent' 
              ? model.basePrice * (1 + value / 100)
              : model.basePrice + value;
            return { ...model, basePrice: Math.round(newPrice * 100) / 100 };
          }
          return model;
        }
        
        // Model with heaterVariants
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
  };

  // Category CRUD
  const handleSaveCategory = (categoryData) => {
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
  };

  const handleDeleteCategory = (categoryId) => {
    if (window.confirm(txt.confirmDelete)) {
      setPrices(prev => ({
        ...prev,
        categories: prev.categories.filter(c => c.id !== categoryId)
      }));
    }
  };

  // Option CRUD
  const handleSaveOption = (optionData, categoryId) => {
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
  };

  const handleDeleteOption = (categoryId, optionId) => {
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
  };

  const getName = (item) => {
    return item[`name${lang === 'pl' ? 'Pl' : 'Ru'}`] || item.name || '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="models" className="gap-2">
            <Droplets className="h-4 w-4" />
            {txt.models}
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <Package className="h-4 w-4" />
            {txt.categories}
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {prices.models?.map(model => (
                    <div key={model.id} className="border rounded-lg p-4 space-y-3">
                      {model.imageUrl ? (
                        <div className="relative">
                          <img 
                            src={getFullImageUrl(model.heaterVariants?.[0]?.imageUrl || model.imageUrl)} 
                            alt={getName(model)} 
                            className="w-full h-32 object-contain rounded bg-gray-50"
                          />
                          {canEdit() && (
                            <Button
                              size="icon"
                              variant="destructive"
                              className="absolute top-2 right-2 h-6 w-6"
                              onClick={() => removeImage('model', model.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-32 bg-muted rounded flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      
                      <div>
                        <h3 className="font-semibold">{getName(model)}</h3>
                        {/* Show both heater variant prices if available */}
                        {model.heaterVariants?.length > 0 ? (
                          <div className="space-y-1 mt-1">
                            {model.heaterVariants.map(v => (
                              <div key={v.type} className="flex items-center gap-2 text-sm">
                                <Badge variant={v.type === 'integrated' ? 'default' : 'outline'} className="text-xs">
                                  {v.type === 'integrated' ? 'Встр.' : 'Внеш.'}
                                </Badge>
                                <span className="font-bold text-blue-600">{v.price} {prices.currencySymbol}</span>
                                {v.imageUrl && <CheckCircle className="h-3 w-3 text-green-500" />}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            <p className="text-lg font-bold text-blue-600">{model.basePrice} {prices.currencySymbol}</p>
                            <Badge variant="outline" className="mt-1">
                              {model.heaterType === 'external' ? txt.external : txt.integrated}
                            </Badge>
                          </>
                        )}
                        
                        {/* Show key specs */}
                        {model.specs && (
                          <div className="mt-2 pt-2 border-t text-xs text-muted-foreground space-y-0.5">
                            {(model.specs.outerDiameter || model.specs.dimensions) && (
                              <p>📐 {model.specs.dimensions || `Ø ${model.specs.outerDiameter}`}</p>
                            )}
                            {model.specs.depth && <p>📏 Глубина: {model.specs.depth}</p>}
                            {model.specs.volume && <p>💧 Объём: {model.specs.volume}</p>}
                            {model.specs.seats > 0 && <p>👥 Мест: {model.specs.seats}</p>}
                          </div>
                        )}
                      </div>
                      
                      {canEdit() && (
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setEditModelDialog({ open: true, model, isNew: false })}
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Редактировать
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleDeleteModel(model.id)}
                          >
                            <Trash2 className="h-3 w-3" />
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
                prices.categories?.map(category => (
                  <div key={category.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {category.imageUrl && (
                          <img 
                            src={getFullImageUrl(category.imageUrl)} 
                            alt={getName(category)}
                            className="w-12 h-12 object-contain rounded"
                          />
                        )}
                        <div>
                          <h3 className="font-semibold">{getName(category)}</h3>
                          <Badge variant="outline" className="text-xs">
                            {category.inputType === 'checkbox' ? txt.checkbox : txt.dropdown}
                          </Badge>
                        </div>
                      </div>
                      
                      {canEdit() && (
                        <div className="flex gap-2">
                          <label>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleImageUpload(e, 'category', category.id)}
                            />
                            <Button variant="outline" size="sm" asChild>
                              <span><Upload className="h-3 w-3" /></span>
                            </Button>
                          </label>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setEditCategoryDialog({ open: true, category, isNew: false })}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleDeleteCategory(category.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <Separator />
                    
                    {/* Options list */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-muted-foreground">{txt.options}</h4>
                        {canEdit() && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditOptionDialog({ 
                              open: true, 
                              categoryId: category.id, 
                              option: { name: '', nameRu: '', namePl: '', price: 0, imageUrl: '' }, 
                              isNew: true 
                            })}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {txt.addOption}
                          </Button>
                        )}
                      </div>
                      
                      {category.options?.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">{txt.noOptions}</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {category.options?.map(option => (
                            <div key={option.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                              <div className="flex items-center gap-2">
                                {option.imageUrl && (
                                  <img 
                                    src={getFullImageUrl(option.imageUrl)} 
                                    alt={getName(option)}
                                    className="w-8 h-8 object-contain rounded"
                                  />
                                )}
                                <span className="text-sm">{getName(option)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-blue-600">
                                  {option.price > 0 ? `+${option.price} ${prices.currencySymbol}` : '-'}
                                </span>
                                {canEdit() && (
                                  <>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => setEditOptionDialog({ 
                                        open: true, 
                                        categoryId: category.id, 
                                        option, 
                                        isNew: false 
                                      })}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="h-6 w-6 text-destructive"
                                      onClick={() => handleDeleteOption(category.id, option.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customer Fields Tab */}
        <TabsContent value="customer">
          <CustomerFieldsManager calculatorType="balia" />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>{txt.settings}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
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
                        📊 NBP ({nbpRate.date}): <b>{nbpRate.rate.toFixed(4)}</b> PLN
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
                      onClick={() => {
                        // Recalculate all retail prices based on purchase prices
                        const rate = prices.eurRate || 4.30;
                        const defaultMarkup = prices.defaultMarkupPercent || 30;
                        
                        setPrices(prev => ({
                          ...prev,
                          // Recalculate model prices
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
                          // Recalculate option prices
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
                      }}
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
        </TabsContent>
      </Tabs>

      {/* Edit Model Dialog */}
      <ModelEditDialog 
        open={editModelDialog.open}
        model={editModelDialog.model}
        isNew={editModelDialog.isNew}
        onClose={() => setEditModelDialog({ open: false, model: null, isNew: false })}
        onSave={handleSaveModel}
        txt={txt}
        currencySymbol={prices.currencySymbol}
      />

      {/* Edit Category Dialog */}
      <CategoryEditDialog
        open={editCategoryDialog.open}
        category={editCategoryDialog.category}
        isNew={editCategoryDialog.isNew}
        onClose={() => setEditCategoryDialog({ open: false, category: null, isNew: false })}
        onSave={handleSaveCategory}
        txt={txt}
      />

      {/* Edit Option Dialog */}
      <OptionEditDialog
        open={editOptionDialog.open}
        option={editOptionDialog.option}
        categoryId={editOptionDialog.categoryId}
        isNew={editOptionDialog.isNew}
        onClose={() => setEditOptionDialog({ open: false, categoryId: null, option: null, isNew: false })}
        onSave={handleSaveOption}
        txt={txt}
        currencySymbol={prices.currencySymbol}
      />

      {/* Bulk Price Edit Dialog */}
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

// Model Edit Dialog Component with Heater Variants
const ModelEditDialog = ({ open, model, isNew, onClose, onSave, txt, currencySymbol }) => {
  const [formData, setFormData] = useState(model || {});
  const [uploading, setUploading] = useState(false);
  const [uploadingVariant, setUploadingVariant] = useState(null);
  
  useEffect(() => {
    // Initialize heaterVariants and specs if not present
    if (model) {
      const data = { ...model };
      if (!data.heaterVariants || data.heaterVariants.length === 0) {
        // Convert old format to new format
        data.heaterVariants = [
          { type: 'integrated', price: data.basePrice || 0, imageUrl: data.imageUrl || '' },
          { type: 'external', price: data.basePrice || 0, imageUrl: '' }
        ];
      }
      // Initialize specs if not present
      if (!data.specs) {
        data.specs = {};
      }
      setFormData(data);
    }
  }, [model]);

  const handleVariantImageUpload = async (e, variantType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingVariant(variantType);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || '';
      const response = await fetch(`${API_URL}/api/upload/image`, {
        method: 'POST',
        body: formDataUpload
      });
      const data = await response.json();
      const fullUrl = `${API_URL}${data.url}`;
      
      setFormData(prev => ({
        ...prev,
        heaterVariants: prev.heaterVariants.map(v => 
          v.type === variantType ? { ...v, imageUrl: fullUrl } : v
        )
      }));
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploadingVariant(null);
    }
  };

  const updateVariantPrice = (variantType, price) => {
    setFormData(prev => ({
      ...prev,
      heaterVariants: prev.heaterVariants.map(v => 
        v.type === variantType ? { ...v, price: parseFloat(price) || 0 } : v
      )
    }));
  };

  const updateVariantField = (variantType, field, value) => {
    setFormData(prev => ({
      ...prev,
      heaterVariants: prev.heaterVariants.map(v => 
        v.type === variantType ? { ...v, [field]: value } : v
      )
    }));
  };

  const removeVariantImage = (variantType) => {
    setFormData(prev => ({
      ...prev,
      heaterVariants: prev.heaterVariants.map(v => 
        v.type === variantType ? { ...v, imageUrl: '' } : v
      )
    }));
  };

  if (!model) return null;

  const integratedVariant = formData.heaterVariants?.find(v => v.type === 'integrated') || { type: 'integrated', price: 0, imageUrl: '' };
  const externalVariant = formData.heaterVariants?.find(v => v.type === 'external') || { type: 'external', price: 0, imageUrl: '' };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? txt.newModel : txt.editModel}</DialogTitle>
          <DialogDescription>
            Настройка вариантов печки, цен и технических характеристик модели
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Basic Model Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{txt.nameRu}</Label>
              <Input 
                value={formData.nameRu || ''} 
                onChange={(e) => setFormData({ ...formData, nameRu: e.target.value })}
                placeholder="Круглая 200см"
              />
            </div>
            <div className="space-y-2">
              <Label>{txt.namePl}</Label>
              <Input 
                value={formData.namePl || ''} 
                onChange={(e) => setFormData({ ...formData, namePl: e.target.value })}
                placeholder="Okrągła 200cm"
              />
            </div>
          </div>

          {/* Hint field */}
          <div className="space-y-2">
            <Label>Подсказка / Hint</Label>
            <Input 
              value={formData.hint || ''} 
              onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
              placeholder="Дополнительная информация о модели"
            />
          </div>

          {/* Heater Variants Section */}
          <div className="border rounded-lg p-4 bg-orange-50 space-y-4">
            <h3 className="font-semibold text-orange-800 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Варианты печки
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Integrated Heater Variant */}
              <div className="border rounded-lg p-3 bg-white space-y-3">
                <h4 className="font-medium text-sm">Встроенная печь (Zintegrowany)</h4>
                
                {/* Purchase Price Section */}
                <div className="p-2 bg-amber-50 rounded border border-amber-200 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-amber-700">Закупка (EUR)</Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={integratedVariant.purchasePriceEur || ''} 
                        onChange={(e) => updateVariantField('integrated', 'purchasePriceEur', parseFloat(e.target.value) || 0)}
                        placeholder="300"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-amber-700">Наценка (%)</Label>
                      <Input 
                        type="number"
                        value={integratedVariant.markupPercent ?? 30} 
                        onChange={(e) => updateVariantField('integrated', 'markupPercent', parseFloat(e.target.value) || 0)}
                        placeholder="30"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  {integratedVariant.purchasePriceEur > 0 && (
                    <p className="text-xs text-amber-600">
                      Расчёт: {integratedVariant.purchasePriceEur} EUR × курс × {1 + (integratedVariant.markupPercent ?? 30)/100}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs">Розничная цена ({currencySymbol})</Label>
                  <Input 
                    type="number"
                    value={integratedVariant.price || 0} 
                    onChange={(e) => updateVariantPrice('integrated', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs">Подсказка для этого варианта</Label>
                  <Input 
                    value={integratedVariant.hint || ''} 
                    onChange={(e) => updateVariantField('integrated', 'hint', e.target.value)}
                    placeholder="Описание модели со встроенной печью..."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs">Фото</Label>
                  {integratedVariant.imageUrl ? (
                    <div className="relative">
                      <img 
                        src={integratedVariant.imageUrl} 
                        alt="Integrated" 
                        className="w-full h-24 object-contain rounded border"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0"
                        onClick={() => removeVariantImage('integrated')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleVariantImageUpload(e, 'integrated')}
                      />
                      <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50">
                        {uploadingVariant === 'integrated' ? (
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-orange-500" />
                        ) : (
                          <>
                            <Upload className="h-6 w-6 mx-auto text-gray-400" />
                            <span className="text-xs text-gray-500">Загрузить фото</span>
                          </>
                        )}
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* External Heater Variant */}
              <div className="border rounded-lg p-3 bg-white space-y-3">
                <h4 className="font-medium text-sm">Внешняя печь (Zewnętrzny)</h4>
                
                {/* Purchase Price Section */}
                <div className="p-2 bg-amber-50 rounded border border-amber-200 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-amber-700">Закупка (EUR)</Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={externalVariant.purchasePriceEur || ''} 
                        onChange={(e) => updateVariantField('external', 'purchasePriceEur', parseFloat(e.target.value) || 0)}
                        placeholder="280"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-amber-700">Наценка (%)</Label>
                      <Input 
                        type="number"
                        value={externalVariant.markupPercent ?? 30} 
                        onChange={(e) => updateVariantField('external', 'markupPercent', parseFloat(e.target.value) || 0)}
                        placeholder="30"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  {externalVariant.purchasePriceEur > 0 && (
                    <p className="text-xs text-amber-600">
                      Расчёт: {externalVariant.purchasePriceEur} EUR × курс × {1 + (externalVariant.markupPercent ?? 30)/100}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs">Розничная цена ({currencySymbol})</Label>
                  <Input 
                    type="number"
                    value={externalVariant.price || 0} 
                    onChange={(e) => updateVariantPrice('external', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs">Подсказка для этого варианта</Label>
                  <Input 
                    value={externalVariant.hint || ''} 
                    onChange={(e) => updateVariantField('external', 'hint', e.target.value)}
                    placeholder="Описание модели с внешней печью..."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs">Фото</Label>
                  {externalVariant.imageUrl ? (
                    <div className="relative">
                      <img 
                        src={externalVariant.imageUrl} 
                        alt="External" 
                        className="w-full h-24 object-contain rounded border"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0"
                        onClick={() => removeVariantImage('external')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleVariantImageUpload(e, 'external')}
                      />
                      <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50">
                        {uploadingVariant === 'external' ? (
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-orange-500" />
                        ) : (
                          <>
                            <Upload className="h-6 w-6 mx-auto text-gray-400" />
                            <span className="text-xs text-gray-500">Загрузить фото</span>
                          </>
                        )}
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Specifications Section */}
          <div className="border rounded-lg p-4 bg-blue-50 space-y-4">
            <h3 className="font-semibold text-blue-800 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Спецификации / Specyfikacje
            </h3>
            
            <div className="grid grid-cols-3 gap-3">
              {/* Dimensions for round tubs */}
              <div className="space-y-1">
                <Label className="text-xs">Внешний диаметр</Label>
                <Input 
                  value={formData.specs?.outerDiameter || ''} 
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    specs: { ...prev.specs, outerDiameter: e.target.value }
                  }))}
                  placeholder="200cm"
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Внутренний диаметр</Label>
                <Input 
                  value={formData.specs?.innerDiameter || ''} 
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    specs: { ...prev.specs, innerDiameter: e.target.value }
                  }))}
                  placeholder="160cm"
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Размеры (ДxШ)</Label>
                <Input 
                  value={formData.specs?.dimensions || ''} 
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    specs: { ...prev.specs, dimensions: e.target.value }
                  }))}
                  placeholder="170x200cm"
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Глубина</Label>
                <Input 
                  value={formData.specs?.depth || ''} 
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    specs: { ...prev.specs, depth: e.target.value }
                  }))}
                  placeholder="100cm"
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Объём воды</Label>
                <Input 
                  value={formData.specs?.volume || formData.specs?.waterCapacity || ''} 
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    specs: { ...prev.specs, volume: e.target.value, waterCapacity: e.target.value }
                  }))}
                  placeholder="1500L"
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Кол-во мест</Label>
                <Input 
                  type="number"
                  value={formData.specs?.seats || ''} 
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    specs: { ...prev.specs, seats: parseInt(e.target.value) || 0 }
                  }))}
                  placeholder="6"
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Высота общая</Label>
                <Input 
                  value={formData.specs?.totalHeight || ''} 
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    specs: { ...prev.specs, totalHeight: e.target.value }
                  }))}
                  placeholder="120cm"
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Мощность печи</Label>
                <Input 
                  value={formData.specs?.heaterPower || ''} 
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    specs: { ...prev.specs, heaterPower: e.target.value }
                  }))}
                  placeholder="24kW"
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Вес (пустая)</Label>
                <Input 
                  value={formData.specs?.weight || ''} 
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    specs: { ...prev.specs, weight: e.target.value }
                  }))}
                  placeholder="350kg"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{txt.cancel}</Button>
          <Button onClick={() => {
            // Set basePrice to first variant price for backwards compatibility
            const updatedData = {
              ...formData,
              basePrice: integratedVariant.price,
              imageUrl: integratedVariant.imageUrl || externalVariant.imageUrl
            };
            onSave(updatedData);
          }}>{txt.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Category Edit Dialog Component
const CategoryEditDialog = ({ open, category, isNew, onClose, onSave, txt }) => {
  const [formData, setFormData] = useState(category || {});
  
  useEffect(() => {
    setFormData(category || {});
  }, [category]);

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
                <SelectItem value="radio">{txt.dropdown}</SelectItem>
                <SelectItem value="checkbox">{txt.checkbox}</SelectItem>
              </SelectContent>
            </Select>
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
};

// Option Edit Dialog Component
const OptionEditDialog = ({ open, option, categoryId, isNew, onClose, onSave, txt, currencySymbol }) => {
  const [formData, setFormData] = useState(option || {});
  const [uploading, setUploading] = useState(false);
  
  useEffect(() => {
    setFormData(option || {});
  }, [option]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || '';
      const response = await fetch(`${API_URL}/api/upload/image`, {
        method: 'POST',
        body: formDataUpload
      });
      const data = await response.json();
      // Save FULL URL with domain (like in Sauna)
      const fullUrl = `${API_URL}${data.url}`;
      setFormData(prev => ({ ...prev, imageUrl: fullUrl }));
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  if (!option) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? txt.newOption : txt.editOption}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Image upload */}
          <div className="space-y-2">
            <Label>{txt.image}</Label>
            <div className="flex items-center gap-3">
              {formData.imageUrl ? (
                <div className="relative">
                  <img 
                    src={getFullImageUrl(formData.imageUrl)} 
                    alt="Option"
                    className="w-16 h-16 object-contain rounded border bg-gray-50"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 w-5"
                    onClick={() => setFormData({ ...formData, imageUrl: '' })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="w-16 h-16 bg-muted rounded border flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <label>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                />
                <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                  <span>
                    {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                    {txt.uploadImage}
                  </span>
                </Button>
              </label>
            </div>
          </div>
          
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
          
          {/* Purchase Price Section */}
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
            <h4 className="text-sm font-medium text-amber-800">Ценообразование / Kalkulacja</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-amber-700">Закупка (EUR)</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={formData.purchasePriceEur || ''} 
                  onChange={(e) => setFormData({ ...formData, purchasePriceEur: parseFloat(e.target.value) || 0 })}
                  placeholder="50"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-amber-700">Наценка (%)</Label>
                <Input 
                  type="number"
                  value={formData.markupPercent ?? 30} 
                  onChange={(e) => setFormData({ ...formData, markupPercent: parseFloat(e.target.value) || 0 })}
                  placeholder="30"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            {formData.purchasePriceEur > 0 && (
              <p className="text-xs text-amber-600">
                Расчёт: {formData.purchasePriceEur} EUR × курс × {(1 + (formData.markupPercent ?? 30)/100).toFixed(2)}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>{txt.price} ({currencySymbol}) - Розничная</Label>
            <Input 
              type="number"
              value={formData.price || 0} 
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
            />
          </div>
          
          {/* Color Preview for color options */}
          <div className="space-y-2">
            <Label>Превью цвета (HEX)</Label>
            <div className="flex items-center gap-3">
              <Input 
                value={formData.colorPreview || ''} 
                onChange={(e) => setFormData({ ...formData, colorPreview: e.target.value })}
                placeholder="#FFFFFF"
                className="flex-1"
              />
              {formData.colorPreview && (
                <div 
                  className="w-10 h-10 rounded border-2 border-gray-300 shadow-inner"
                  style={{ backgroundColor: formData.colorPreview }}
                />
              )}
              <input
                type="color"
                value={formData.colorPreview || '#FFFFFF'}
                onChange={(e) => setFormData({ ...formData, colorPreview: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer border-0"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Подсказка (RU)</Label>
            <Input 
              value={formData.hint || ''} 
              onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
              placeholder="Описание опции для клиента..."
            />
          </div>
          <div className="space-y-2">
            <Label>Podpowiedź (PL)</Label>
            <Input 
              value={formData.hintPl || ''} 
              onChange={(e) => setFormData({ ...formData, hintPl: e.target.value })}
              placeholder="Opis opcji dla klienta..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{txt.cancel}</Button>
          <Button onClick={() => onSave(formData, categoryId)}>{txt.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Bulk Price Edit Dialog Component
const BulkPriceEditDialog = ({ open, onClose, onApply, currencySymbol, modelsCount, lang }) => {
  const [changeType, setChangeType] = useState('percent'); // 'percent' | 'absolute'
  const [value, setValue] = useState(0);
  const [applyTo, setApplyTo] = useState('all'); // 'all' | 'integrated' | 'external'

  const handleApply = () => {
    if (value === 0) {
      return;
    }
    onApply({ changeType, value: parseFloat(value), applyTo });
  };

  const getPreviewText = () => {
    if (value === 0) return '';
    const sign = value > 0 ? '+' : '';
    if (changeType === 'percent') {
      return `${sign}${value}%`;
    }
    return `${sign}${value} ${currencySymbol}`;
  };

  const txt = {
    title: lang === 'ru' ? 'Массовое изменение цен' : 'Zmiana cen hurtowo',
    description: lang === 'ru' 
      ? `Применить изменение ко всем ${modelsCount} моделям` 
      : `Zastosuj zmianę do wszystkich ${modelsCount} modeli`,
    changeType: lang === 'ru' ? 'Тип изменения' : 'Typ zmiany',
    percent: lang === 'ru' ? 'Процент (%)' : 'Procent (%)',
    absolute: lang === 'ru' ? `Сумма (${currencySymbol})` : `Kwota (${currencySymbol})`,
    value: lang === 'ru' ? 'Значение' : 'Wartość',
    applyTo: lang === 'ru' ? 'Применить к' : 'Zastosuj do',
    all: lang === 'ru' ? 'Все варианты' : 'Wszystkie warianty',
    integrated: lang === 'ru' ? 'Только встроенная печь' : 'Tylko zintegrowany',
    external: lang === 'ru' ? 'Только внешняя печь' : 'Tylko zewnętrzny',
    preview: lang === 'ru' ? 'Предпросмотр' : 'Podgląd',
    example: lang === 'ru' ? 'Пример: 1000 → ' : 'Przykład: 1000 → ',
    cancel: lang === 'ru' ? 'Отмена' : 'Anuluj',
    apply: lang === 'ru' ? 'Применить' : 'Zastosuj',
    warning: lang === 'ru' 
      ? 'Изменения будут применены после нажатия "Сохранить всё"' 
      : 'Zmiany zostaną zastosowane po kliknięciu "Zapisz wszystko"',
  };

  const calculateExample = () => {
    const base = 1000;
    if (changeType === 'percent') {
      return Math.round(base * (1 + value / 100) * 100) / 100;
    }
    return base + parseFloat(value || 0);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-orange-500" />
            {txt.title}
          </DialogTitle>
          <DialogDescription>{txt.description}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Change Type */}
          <div className="space-y-2">
            <Label>{txt.changeType}</Label>
            <Select value={changeType} onValueChange={setChangeType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">{txt.percent}</SelectItem>
                <SelectItem value="absolute">{txt.absolute}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Value */}
          <div className="space-y-2">
            <Label>{txt.value}</Label>
            <div className="flex items-center gap-2">
              <Input 
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={changeType === 'percent' ? '10' : '100'}
                className="flex-1"
              />
              <span className="text-muted-foreground font-medium w-12">
                {changeType === 'percent' ? '%' : currencySymbol}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {lang === 'ru' ? 'Используйте отрицательные значения для уменьшения' : 'Użyj ujemnych wartości, aby zmniejszyć'}
            </p>
          </div>

          {/* Apply To */}
          <div className="space-y-2">
            <Label>{txt.applyTo}</Label>
            <Select value={applyTo} onValueChange={setApplyTo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{txt.all}</SelectItem>
                <SelectItem value="integrated">{txt.integrated}</SelectItem>
                <SelectItem value="external">{txt.external}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {value !== 0 && value !== '' && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-800">{txt.preview}</p>
              <p className="text-lg font-bold text-blue-600">
                {txt.example}{calculateExample()} {currencySymbol}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                ({getPreviewText()})
              </p>
            </div>
          )}

          {/* Warning */}
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs text-amber-700">
              ⚠️ {txt.warning}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{txt.cancel}</Button>
          <Button 
            onClick={handleApply} 
            disabled={value === 0 || value === ''}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {txt.apply}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

