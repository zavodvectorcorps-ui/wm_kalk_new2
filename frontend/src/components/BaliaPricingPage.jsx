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
  
  // Dialog states
  const [editModelDialog, setEditModelDialog] = useState({ open: false, model: null, isNew: false });
  const [editCategoryDialog, setEditCategoryDialog] = useState({ open: false, category: null, isNew: false });
  const [editOptionDialog, setEditOptionDialog] = useState({ open: false, categoryId: null, option: null, isNew: false });
  
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
                            src={getFullImageUrl(model.imageUrl)} 
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
                        <p className="text-lg font-bold text-blue-600">{model.basePrice} {prices.currencySymbol}</p>
                        <Badge variant="outline" className="mt-1">
                          {model.heaterType === 'external' ? txt.external : txt.integrated}
                        </Badge>
                      </div>
                      
                      {canEdit() && (
                        <div className="flex gap-2">
                          <label className="flex-1">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleImageUpload(e, 'model', model.id)}
                            />
                            <Button variant="outline" size="sm" className="w-full" asChild>
                              <span>
                                <Upload className="h-3 w-3 mr-1" />
                                {txt.uploadImage}
                              </span>
                            </Button>
                          </label>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setEditModelDialog({ open: true, model, isNew: false })}
                          >
                            <Edit2 className="h-3 w-3" />
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
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{txt.currency}</Label>
                  <Input 
                    value={prices.currency || 'EUR'} 
                    onChange={(e) => setPrices(prev => ({ ...prev, currency: e.target.value }))}
                    disabled={!canEdit()}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{txt.currencySymbol}</Label>
                  <Input 
                    value={prices.currencySymbol || '€'} 
                    onChange={(e) => setPrices(prev => ({ ...prev, currencySymbol: e.target.value }))}
                    disabled={!canEdit()}
                  />
                </div>
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
    </div>
  );
};

// Model Edit Dialog Component with Heater Variants
const ModelEditDialog = ({ open, model, isNew, onClose, onSave, txt, currencySymbol }) => {
  const [formData, setFormData] = useState(model || {});
  const [uploading, setUploading] = useState(false);
  const [uploadingVariant, setUploadingVariant] = useState(null);
  
  useEffect(() => {
    // Initialize heaterVariants if not present
    if (model) {
      const data = { ...model };
      if (!data.heaterVariants || data.heaterVariants.length === 0) {
        // Convert old format to new format
        data.heaterVariants = [
          { type: 'integrated', price: data.basePrice || 0, imageUrl: data.imageUrl || '' },
          { type: 'external', price: data.basePrice || 0, imageUrl: '' }
        ];
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
            Для каждой модели можно задать два варианта печки с разными ценами и фото
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
                
                <div className="space-y-2">
                  <Label className="text-xs">Цена ({currencySymbol})</Label>
                  <Input 
                    type="number"
                    value={integratedVariant.price || 0} 
                    onChange={(e) => updateVariantPrice('integrated', e.target.value)}
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
                
                <div className="space-y-2">
                  <Label className="text-xs">Цена ({currencySymbol})</Label>
                  <Input 
                    type="number"
                    value={externalVariant.price || 0} 
                    onChange={(e) => updateVariantPrice('external', e.target.value)}
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
      <DialogContent className="max-w-md">
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
          <div className="space-y-2">
            <Label>{txt.price} ({currencySymbol})</Label>
            <Input 
              type="number"
              value={formData.price || 0} 
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
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
