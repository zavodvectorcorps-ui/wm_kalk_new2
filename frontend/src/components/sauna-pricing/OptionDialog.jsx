import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Upload, X, Loader2, Wrench } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '../ui/dialog';

// Smart API URL
const getApiUrl = () => { 
  if (typeof window !== 'undefined') { 
    const o = window.location.origin; 
    if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o; 
  } 
  return process.env.REACT_APP_BACKEND_URL || ''; 
};
const API_URL = getApiUrl();

export const AddOptionDialog = ({ open, onOpenChange, newOption, setNewOption, categories, techSpecCategories, onAdd, txt }) => {
  const selectedTechSpecCategory = techSpecCategories?.find(tc => tc.id === newOption.techSpecCategoryId);
  const [uploadingHintImage, setUploadingHintImage] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/api/upload/image`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      const fullUrl = data.url.startsWith('http') ? data.url : `${API_URL}${data.url}`;
      setNewOption(prev => ({ ...prev, imageUrl: fullUrl }));
    } catch (error) {
      console.error('Image upload error:', error);
    } finally {
      setUploadingImage(false);
    }
  };
  
  const handleHintImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingHintImage(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/api/upload/image`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      const fullUrl = data.url.startsWith('http') ? data.url : `${API_URL}${data.url}`;
      setNewOption(prev => ({ ...prev, hintImageUrl: fullUrl }));
    } catch (error) {
      console.error('Hint image upload error:', error);
    } finally {
      setUploadingHintImage(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                {categories?.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{txt.optionName} (PL)</Label>
              <Input
                value={newOption.name}
                onChange={(e) => setNewOption(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Piec Elektryczne 9 kW"
              />
            </div>
            <div>
              <Label>Название (RU) — для производства</Label>
              <Input
                value={newOption.nameRu || ''}
                onChange={(e) => setNewOption(prev => ({ ...prev, nameRu: e.target.value }))}
                placeholder="Печь электрическая 9 кВт"
                data-testid="new-option-nameru"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{txt.price}</Label>
              <Input
                type="number"
                value={newOption.price}
                onChange={(e) => setNewOption(prev => ({ ...prev, price: e.target.value }))}
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5">
                Себестоимость (PLN)
                <span className="text-[9px] uppercase tracking-wider text-amber-600 dark:text-amber-400">admin</span>
              </Label>
              <Input
                type="number"
                data-testid="new-option-cost-price"
                value={newOption.costPrice || 0}
                onChange={(e) => setNewOption(prev => ({ ...prev, costPrice: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div>
            <Label>{txt.hint || 'Подсказка / Описание'}</Label>
            <Textarea
              value={newOption.hint || ''}
              onChange={(e) => setNewOption(prev => ({ ...prev, hint: e.target.value }))}
              placeholder="Описание опции, преимущества, технические детали..."
              rows={3}
            />
          </div>
          
          {/* Hint media fields */}
          <div className="border-t pt-4 mt-4">
            <Label className="text-sm font-medium text-amber-700 mb-2 block">{txt.hintMedia || 'Медиа для подсказки'}</Label>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">{txt.hintImageUrl || 'Изображение подсказки'}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={newOption.hintImageUrl || ''}
                    onChange={(e) => setNewOption(prev => ({ ...prev, hintImageUrl: e.target.value }))}
                    placeholder="URL или загрузите файл"
                    className="flex-1"
                  />
                  <label>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleHintImageUpload}
                      disabled={uploadingHintImage}
                    />
                    <Button type="button" variant="outline" size="sm" asChild disabled={uploadingHintImage}>
                      <span>
                        {uploadingHintImage ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                        Загрузить
                      </span>
                    </Button>
                  </label>
                  {newOption.hintImageUrl && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                      onClick={() => setNewOption(prev => ({ ...prev, hintImageUrl: '' }))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {newOption.hintImageUrl && (
                  <div className="mt-2">
                    <img 
                      src={newOption.hintImageUrl} 
                      alt="Hint preview" 
                      className="w-full max-h-24 object-contain rounded border bg-muted/50"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{txt.hintVideoUrl || 'URL видео подсказки'}</Label>
                <Input
                  value={newOption.hintVideoUrl || ''}
                  onChange={(e) => setNewOption(prev => ({ ...prev, hintVideoUrl: e.target.value }))}
                  placeholder="YouTube ссылка или прямая ссылка на видео"
                />
                <p className="text-xs text-muted-foreground mt-1">Поддерживается YouTube и прямые ссылки на видео</p>
              </div>
            </div>
          </div>
          
          <div>
            <Label>{txt.imageUrl}</Label>
            <div className="flex items-center gap-2">
              <Input
                value={newOption.imageUrl}
                onChange={(e) => setNewOption(prev => ({ ...prev, imageUrl: e.target.value }))}
                placeholder={txt.imageUrlHint}
                className="flex-1"
              />
              <label>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                />
                <Button type="button" variant="outline" size="sm" asChild disabled={uploadingImage}>
                  <span>
                    {uploadingImage ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                    Загрузить
                  </span>
                </Button>
              </label>
              {newOption.imageUrl && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-red-500 hover:text-red-700"
                  onClick={() => setNewOption(prev => ({ ...prev, imageUrl: '' }))}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {newOption.imageUrl && (
              <div className="mt-2">
                <Label className="text-xs text-muted-foreground">{txt.previewImage}:</Label>
                <img 
                  src={newOption.imageUrl} 
                  alt="Preview" 
                  className="mt-1 w-full max-h-32 object-contain rounded border bg-muted/50"
                  onError={(e) => e.target.style.display = 'none'}
                />
              </div>
            )}
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
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isDefaultSelected"
              checked={newOption.isDefaultSelected}
              onCheckedChange={(checked) => setNewOption(prev => ({ ...prev, isDefaultSelected: checked }))}
            />
            <Label htmlFor="isDefaultSelected" className="cursor-pointer">
              {txt.defaultSelected || 'Выбрано по умолчанию'}
            </Label>
          </div>
          <div className="flex items-center space-x-2" data-testid="add-option-open-price">
            <Checkbox
              id="isOpenPrice"
              checked={newOption.isOpenPrice || false}
              onCheckedChange={(checked) => setNewOption(prev => ({ ...prev, isOpenPrice: checked }))}
            />
            <Label htmlFor="isOpenPrice" className="cursor-pointer">
              Открытая цена (менеджер вводит при продаже)
            </Label>
          </div>
          
          {/* Tech Spec Mapping Section */}
          <div className="border-t pt-4 mt-4">
            <Label className="text-sm font-medium text-amber-700">{txt.techSpecMapping || 'Маппинг на Тех.Задание'}</Label>
            <div className="space-y-3 mt-2">
              <div>
                <Label className="text-xs text-muted-foreground">{txt.techSpecCategory || 'Категория тех.задания'}</Label>
                <Select
                  value={newOption.techSpecCategoryId || '_none'}
                  onValueChange={(value) => setNewOption(prev => ({ 
                    ...prev, 
                    techSpecCategoryId: value === '_none' ? null : value,
                    techSpecId: null // Reset option when category changes
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={txt.selectTechSpecCategory || 'Выберите категорию'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{txt.noMapping || '— Без маппинга —'}</SelectItem>
                    {techSpecCategories?.map(tc => (
                      <SelectItem key={tc.id} value={tc.id}>{tc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedTechSpecCategory && (
                <div>
                  <Label className="text-xs text-muted-foreground">{txt.techSpecOption || 'Опция тех.задания'}</Label>
                  <Select
                    value={newOption.techSpecId || '_none'}
                    onValueChange={(value) => setNewOption(prev => ({ 
                      ...prev, 
                      techSpecId: value === '_none' ? null : value 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={txt.selectTechSpecOption || 'Выберите опцию'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">{txt.noMapping || '— Без маппинга —'}</SelectItem>
                      {selectedTechSpecCategory.options?.map(opt => (
                        <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{txt.cancel}</Button>
          </DialogClose>
          <Button onClick={onAdd} className="bg-amber-600 hover:bg-amber-700">
            {txt.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const EditOptionDialog = ({ open, onOpenChange, editingOption, setEditingOption, techSpecCategories, categories, models, onSave, onRestrictToOption, txt }) => {
  const selectedTechSpecCategory = techSpecCategories?.find(tc => tc.id === editingOption?.techSpecCategoryId);
  const [uploadingHintImage, setUploadingHintImage] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [restrictSel, setRestrictSel] = useState([]);
  const [applyingRestrict, setApplyingRestrict] = useState(false);

  const toggleRestrict = (id) => {
    setRestrictSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const applyRestrict = async () => {
    if (!onRestrictToOption || restrictSel.length === 0 || !editingOption) return;
    setApplyingRestrict(true);
    try {
      const res = await onRestrictToOption(editingOption.categoryId, editingOption.id, restrictSel);
      setEditingOption(prev => ({ ...prev, incompatibleModels: res?.keepIncompatibleModels || (prev.incompatibleModels || []).filter(id => !restrictSel.includes(id)) }));
      setRestrictSel([]);
    } finally {
      setApplyingRestrict(false);
    }
  };

  
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/api/upload/image`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      const fullUrl = data.url.startsWith('http') ? data.url : `${API_URL}${data.url}`;
      setEditingOption(prev => ({ ...prev, imageUrl: fullUrl }));
    } catch (error) {
      console.error('Image upload error:', error);
    } finally {
      setUploadingImage(false);
    }
  };
  
  // Get incompatible models list (NEW - inverted logic)
  const incompatibleModels = editingOption?.incompatibleModels || [];
  // Get incompatible options map (NEW - inverted logic)
  const incompatibleWithOptions = editingOption?.incompatibleWithOptions || {};
  
  // Legacy: Get compatible models list
  const compatibleModels = editingOption?.compatibleModels || [];
  // Legacy: Get compatible options map
  const compatibleWithOptions = editingOption?.compatibleWithOptions || {};
  
  const toggleIncompatibleModel = (modelId) => {
    setEditingOption(prev => {
      const currentModels = prev.incompatibleModels || [];
      if (currentModels.includes(modelId)) {
        return { ...prev, incompatibleModels: currentModels.filter(id => id !== modelId) };
      } else {
        return { ...prev, incompatibleModels: [...currentModels, modelId] };
      }
    });
  };
  
  const toggleIncompatibleOption = (categoryId, optionId) => {
    setEditingOption(prev => {
      const currentMap = { ...(prev.incompatibleWithOptions || {}) };
      const currentOptions = currentMap[categoryId] || [];
      
      if (currentOptions.includes(optionId)) {
        currentMap[categoryId] = currentOptions.filter(id => id !== optionId);
        if (currentMap[categoryId].length === 0) {
          delete currentMap[categoryId];
        }
      } else {
        currentMap[categoryId] = [...currentOptions, optionId];
      }
      
      return { ...prev, incompatibleWithOptions: currentMap };
    });
  };
  
  // Legacy toggle functions (kept for backward compatibility)
  const toggleCompatibleModel = (modelId) => {
    setEditingOption(prev => {
      const currentModels = prev.compatibleModels || [];
      if (currentModels.includes(modelId)) {
        return { ...prev, compatibleModels: currentModels.filter(id => id !== modelId) };
      } else {
        return { ...prev, compatibleModels: [...currentModels, modelId] };
      }
    });
  };
  
  const toggleCompatibleOption = (categoryId, optionId) => {
    setEditingOption(prev => {
      const currentMap = { ...(prev.compatibleWithOptions || {}) };
      const currentOptions = currentMap[categoryId] || [];
      
      if (currentOptions.includes(optionId)) {
        currentMap[categoryId] = currentOptions.filter(id => id !== optionId);
        if (currentMap[categoryId].length === 0) {
          delete currentMap[categoryId];
        }
      } else {
        currentMap[categoryId] = [...currentOptions, optionId];
      }
      
      return { ...prev, compatibleWithOptions: currentMap };
    });
  };
  
  const handleHintImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingHintImage(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/api/upload/image`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      const fullUrl = data.url.startsWith('http') ? data.url : `${API_URL}${data.url}`;
      setEditingOption(prev => ({ ...prev, hintImageUrl: fullUrl }));
    } catch (error) {
      console.error('Hint image upload error:', error);
    } finally {
      setUploadingHintImage(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{txt.editOption}</DialogTitle>
        </DialogHeader>
        {editingOption && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{txt.optionName} (PL)</Label>
                <Input
                  value={editingOption.name}
                  onChange={(e) => setEditingOption(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Название (RU) — для производства</Label>
                <Input
                  value={editingOption.nameRu || ''}
                  onChange={(e) => setEditingOption(prev => ({ ...prev, nameRu: e.target.value }))}
                  placeholder="Печь электрическая 9 кВт"
                  data-testid="edit-option-nameru"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{txt.price}</Label>
                <Input
                  type="number"
                  value={editingOption.price}
                  onChange={(e) => setEditingOption(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label className="flex items-center gap-1.5">
                  Себестоимость (PLN)
                  <span className="text-[9px] uppercase tracking-wider text-amber-600 dark:text-amber-400">admin</span>
                </Label>
                <Input
                  type="number"
                  data-testid="edit-option-cost-price"
                  value={editingOption.costPrice || 0}
                  onChange={(e) => setEditingOption(prev => ({ ...prev, costPrice: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div>
              <Label>{txt.hint || 'Подсказка / Описание'}</Label>
              <Textarea
                value={editingOption.hint || ''}
                onChange={(e) => setEditingOption(prev => ({ ...prev, hint: e.target.value }))}
                placeholder="Описание опции, преимущества, технические детали..."
                rows={3}
              />
            </div>

            {/* Change Category */}
            {categories && categories.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <Label className="text-sm font-medium text-indigo-700 mb-2 block">📁 Переместить в другую категорию</Label>
                <Select
                  value={editingOption.categoryId || ''}
                  onValueChange={(value) => setEditingOption(prev => ({ ...prev, newCategoryId: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name} {cat.id === editingOption.categoryId && '(текущая)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editingOption.newCategoryId && editingOption.newCategoryId !== editingOption.categoryId && (
                  <p className="text-xs text-indigo-600 mt-1">
                    ✓ Опция будет перемещена в категорию "{categories.find(c => c.id === editingOption.newCategoryId)?.name}"
                  </p>
                )}
              </div>
            )}
            
            {/* Hint media fields */}
            <div className="border-t pt-4 mt-4">
              <Label className="text-sm font-medium text-amber-700 mb-2 block">{txt.hintMedia || 'Медиа для подсказки'}</Label>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">{txt.hintImageUrl || 'Изображение подсказки'}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingOption.hintImageUrl || ''}
                      onChange={(e) => setEditingOption(prev => ({ ...prev, hintImageUrl: e.target.value }))}
                      placeholder="URL или загрузите файл"
                      className="flex-1"
                    />
                    <label>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleHintImageUpload}
                        disabled={uploadingHintImage}
                      />
                      <Button type="button" variant="outline" size="sm" asChild disabled={uploadingHintImage}>
                        <span>
                          {uploadingHintImage ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                          Загрузить
                        </span>
                      </Button>
                    </label>
                    {editingOption.hintImageUrl && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                        onClick={() => setEditingOption(prev => ({ ...prev, hintImageUrl: '' }))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {editingOption.hintImageUrl && (
                    <div className="mt-2">
                      <img 
                        src={editingOption.hintImageUrl} 
                        alt="Hint preview" 
                        className="w-full max-h-24 object-contain rounded border bg-muted/50"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{txt.hintVideoUrl || 'URL видео подсказки'}</Label>
                  <Input
                    value={editingOption.hintVideoUrl || ''}
                    onChange={(e) => setEditingOption(prev => ({ ...prev, hintVideoUrl: e.target.value }))}
                    placeholder="YouTube ссылка или прямая ссылка на видео"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Поддерживается YouTube и прямые ссылки на видео</p>
                </div>
              </div>
            </div>
            
            <div>
              <Label>{txt.imageUrl}</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={editingOption.imageUrl || ''}
                  onChange={(e) => setEditingOption(prev => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder={txt.imageUrlHint}
                  className="flex-1"
                />
                <label>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                  />
                  <Button type="button" variant="outline" size="sm" asChild disabled={uploadingImage}>
                    <span>
                      {uploadingImage ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                      Загрузить
                    </span>
                  </Button>
                </label>
                {editingOption.imageUrl && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-500 hover:text-red-700"
                    onClick={() => setEditingOption(prev => ({ ...prev, imageUrl: '' }))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {editingOption.imageUrl && (
                <div className="mt-2">
                  <Label className="text-xs text-muted-foreground">{txt.previewImage}:</Label>
                  <img 
                    src={editingOption.imageUrl} 
                    alt="Preview" 
                    className="mt-1 w-full max-h-40 object-contain rounded border bg-muted/50"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-hasQuantity"
                checked={editingOption.hasQuantity || false}
                onCheckedChange={(checked) => setEditingOption(prev => ({ ...prev, hasQuantity: checked }))}
              />
              <Label htmlFor="edit-hasQuantity">{txt.quantityEnabled}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-isDefaultSelected"
                checked={editingOption.isDefaultSelected || false}
                onCheckedChange={(checked) => setEditingOption(prev => ({ ...prev, isDefaultSelected: checked }))}
              />
              <Label htmlFor="edit-isDefaultSelected">{txt.defaultSelected || 'Выбрано по умолчанию'}</Label>
            </div>
            <div className="flex items-center space-x-2" data-testid="edit-option-open-price">
              <Checkbox
                id="edit-isOpenPrice"
                checked={editingOption.isOpenPrice || false}
                onCheckedChange={(checked) => setEditingOption(prev => ({ ...prev, isOpenPrice: checked }))}
              />
              <Label htmlFor="edit-isOpenPrice">Открытая цена (менеджер вводит при продаже)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-showInPdf"
                checked={editingOption.showInPdf !== false}
                onCheckedChange={(checked) => setEditingOption(prev => ({ ...prev, showInPdf: checked }))}
              />
              <Label htmlFor="edit-showInPdf">{txt.showInPdf || 'Показывать в PDF (каталог опций)'}</Label>
            </div>
            
            {/* Show in PDF for specific models */}
            {editingOption.showInPdf !== false && models && models.length > 0 && (
              <div className="border rounded p-3 bg-purple-50 mt-2">
                <Label className="text-sm font-medium text-purple-700 mb-2 block">
                  📄 Показывать в PDF только для моделей:
                </Label>
                <p className="text-xs text-gray-500 mb-2">
                  Если ничего не выбрано — опция показывается для всех моделей. Если выбраны модели — только для них.
                </p>
                <div className="flex flex-wrap gap-2">
                  {models.map(model => {
                    const showInPdfForModels = editingOption.showInPdfForModels || [];
                    const isSelected = showInPdfForModels.includes(model.id);
                    return (
                      <Badge
                        key={model.id}
                        variant={isSelected ? "default" : "outline"}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-purple-600 hover:bg-purple-700' : 'hover:bg-purple-100'}`}
                        onClick={() => {
                          setEditingOption(prev => {
                            const current = prev.showInPdfForModels || [];
                            if (isSelected) {
                              return { ...prev, showInPdfForModels: current.filter(id => id !== model.id) };
                            } else {
                              return { ...prev, showInPdfForModels: [...current, model.id] };
                            }
                          });
                        }}
                      >
                        {model.name}
                      </Badge>
                    );
                  })}
                </div>
                {(editingOption.showInPdfForModels || []).length > 0 && (
                  <p className="text-xs text-purple-600 mt-2">
                    Выбрано: {(editingOption.showInPdfForModels || []).length} моделей
                  </p>
                )}
              </div>
            )}
            
            {/* Price by Model Section */}
            {models && models.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <Label className="text-sm font-medium text-blue-700 mb-3 block">
                  💰 Цена в зависимости от модели
                </Label>
                <p className="text-xs text-gray-500 mb-3">
                  Укажите разные цены для разных моделей саун. Если цена не указана — используется базовая цена опции ({editingOption.price || 0} PLN).
                </p>
                
                <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-2 bg-blue-50">
                  {models.map(model => {
                    const priceByModel = editingOption.priceByModel || {};
                    const modelPrice = priceByModel[model.id];
                    const hasCustomPrice = modelPrice !== undefined && modelPrice !== null && modelPrice !== '';
                    
                    return (
                      <div key={model.id} className="flex items-center gap-2 p-2 bg-white rounded border">
                        <span className="text-sm flex-1 truncate" title={model.name}>{model.name}</span>
                        <Input
                          type="number"
                          placeholder={`${editingOption.price || 0}`}
                          value={hasCustomPrice ? modelPrice : ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setEditingOption(prev => {
                              const newPriceByModel = { ...(prev.priceByModel || {}) };
                              if (value === '' || value === null) {
                                delete newPriceByModel[model.id];
                              } else {
                                newPriceByModel[model.id] = parseInt(value) || 0;
                              }
                              return { ...prev, priceByModel: newPriceByModel };
                            });
                          }}
                          className="w-28 h-8 text-sm"
                        />
                        <span className="text-xs text-gray-500">PLN</span>
                      </div>
                    );
                  })}
                </div>
                
                {/* Show configured prices */}
                {editingOption.priceByModel && Object.keys(editingOption.priceByModel).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(editingOption.priceByModel).map(([modelId, price]) => {
                      const model = models.find(m => m.id === modelId);
                      return model ? (
                        <span key={modelId} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          {model.name}: {price} PLN
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            )}
            
            {/* Plus variant card details */}
            <div className="border-t pt-4 mt-4">
              <Label className="text-sm font-medium text-purple-700 mb-3 block">
                🏠 Детали карточки (для Plus-категорий)
              </Label>
              <p className="text-xs text-gray-500 mb-3">
                Эти поля отображаются на карточке опции в калькуляторе для категорий Plus-версии.
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600">Rozmiar Tarasu (Размер террасы)</Label>
                  <Input
                    placeholder="np. 2.0 x 1.5 m"
                    value={editingOption.terraceSize || ''}
                    onChange={(e) => setEditingOption(prev => ({ ...prev, terraceSize: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Rozmiar Pokoju wypoczynkowego (Комната отдыха)</Label>
                  <Input
                    placeholder="np. 2.5 x 2.0 m"
                    value={editingOption.relaxRoomSize || ''}
                    onChange={(e) => setEditingOption(prev => ({ ...prev, relaxRoomSize: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Rozmiar Sauny parowej (Размер парной)</Label>
                  <Input
                    placeholder="np. 2.0 x 2.0 m"
                    value={editingOption.steamRoomSize || ''}
                    onChange={(e) => setEditingOption(prev => ({ ...prev, steamRoomSize: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Strona Wejścia (Сторона входа)</Label>
                  <Input
                    placeholder="np. Lewa / Prawa"
                    value={editingOption.entranceSide || ''}
                    onChange={(e) => setEditingOption(prev => ({ ...prev, entranceSide: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
            
            {/* Variants Section (formerly Sub-Options) */}
            <div className="border-t pt-4 mt-4">
              <Label className="text-sm font-medium text-amber-700 mb-3 block">
                🔄 Варианты исполнения / Warianty
              </Label>
              <p className="text-xs text-gray-500 mb-3">
                Варианты - это взаимоисключающие версии опции (например, "лавка без обшивки" vs "лавка с обшивкой"). 
                Цена варианта ЗАМЕНЯЕТ базовую цену опции. Фото варианта будет использовано в PDF.
              </p>
              
              {/* List of existing variants - card style like heaters */}
              {(editingOption.variants?.length > 0 || editingOption.subOptions?.length > 0) && (
                <div className="grid grid-cols-1 gap-3 mb-4">
                  {(editingOption.variants || editingOption.subOptions || []).map((variant, idx) => (
                    <div key={idx} className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border-2 border-amber-200 hover:border-amber-400 transition-colors">
                      <div className="flex items-start gap-3">
                        {/* Variant Image */}
                        <div className="relative">
                          {variant.imageUrl ? (
                            <img 
                              src={variant.imageUrl} 
                              alt={variant.name} 
                              className="w-24 h-24 object-cover rounded-lg border-2 border-amber-300"
                            />
                          ) : (
                            <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                              <span className="text-xs text-gray-400 text-center px-1">Нет фото</span>
                            </div>
                          )}
                          {/* Upload button overlay */}
                          <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer rounded-lg">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                
                                const formData = new FormData();
                                formData.append('file', file);
                                
                                try {
                                  const response = await fetch(`${API_URL}/api/upload/image`, {
                                    method: 'POST',
                                    body: formData
                                  });
                                  const result = await response.json();
                                  if (result.url) {
                                    // Construct full URL for the image
                                    const fullUrl = result.url.startsWith('http') ? result.url : `${API_URL}${result.url}`;
                                    setEditingOption(prev => ({
                                      ...prev,
                                      variants: (prev.variants || prev.subOptions || []).map((v, i) => 
                                        i === idx ? { ...v, imageUrl: fullUrl } : v
                                      ),
                                      subOptions: []
                                    }));
                                  }
                                } catch (err) {
                                  console.error('Upload error:', err);
                                }
                              }}
                            />
                            <div className="flex flex-col items-center text-white">
                              <Upload className="h-5 w-5 mb-1" />
                              <span className="text-xs">{variant.imageUrl ? 'Заменить' : 'Загрузить'}</span>
                            </div>
                          </label>
                        </div>
                        
                        {/* Variant Info */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 mr-2">
                              <Input
                                value={variant.name || ''}
                                onChange={(e) => {
                                  setEditingOption(prev => ({
                                    ...prev,
                                    variants: (prev.variants || prev.subOptions || []).map((v, i) =>
                                      i === idx ? { ...v, name: e.target.value, nameRu: e.target.value } : v
                                    ),
                                    subOptions: []
                                  }));
                                }}
                                className="h-7 text-sm font-semibold text-amber-800 border-transparent hover:border-gray-300 focus:border-amber-500 px-1"
                                placeholder="Название"
                              />
                              <Input
                                value={variant.namePl || ''}
                                onChange={(e) => {
                                  setEditingOption(prev => ({
                                    ...prev,
                                    variants: (prev.variants || prev.subOptions || []).map((v, i) =>
                                      i === idx ? { ...v, namePl: e.target.value } : v
                                    ),
                                    subOptions: []
                                  }));
                                }}
                                className="h-6 text-xs text-gray-500 border-transparent hover:border-gray-300 focus:border-amber-500 px-1 mt-0.5"
                                placeholder="Nazwa (PL)"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setEditingOption(prev => ({
                                  ...prev,
                                  variants: (prev.variants || prev.subOptions || []).filter((_, i) => i !== idx),
                                  subOptions: []
                                }));
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <Input
                              type="number"
                              value={variant.price || 0}
                              onChange={(e) => {
                                setEditingOption(prev => ({
                                  ...prev,
                                  variants: (prev.variants || prev.subOptions || []).map((v, i) =>
                                    i === idx ? { ...v, price: parseInt(e.target.value) || 0 } : v
                                  ),
                                  subOptions: []
                                }));
                              }}
                              className="h-8 w-28 text-lg font-bold text-amber-600 border-transparent hover:border-gray-300 focus:border-amber-500 px-1"
                              data-testid={`variant-price-${idx}`}
                            />
                            <span className="text-lg font-bold text-amber-600">zł</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 mr-1">с/с</span>
                            <Input
                              type="number"
                              value={variant.costPrice || 0}
                              onChange={(e) => {
                                setEditingOption(prev => ({
                                  ...prev,
                                  variants: (prev.variants || prev.subOptions || []).map((v, i) =>
                                    i === idx ? { ...v, costPrice: parseInt(e.target.value) || 0 } : v
                                  ),
                                  subOptions: []
                                }));
                              }}
                              className="h-7 w-24 text-sm text-slate-600 dark:text-slate-300 border-amber-200 dark:border-amber-700/40 focus:border-amber-500 px-1"
                              data-testid={`variant-cost-price-${idx}`}
                              placeholder="0"
                            />
                            <span className="text-xs text-slate-500">zł</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {variant.imageUrl ? '✓ Фото загружено' : '⚠ Добавьте фото для PDF'}
                          </p>
                          {/* Variant Tech Spec Mapping */}
                          <div className="mt-2 flex items-center gap-2">
                            <Wrench className="h-3 w-3 text-amber-600 flex-shrink-0" />
                            <Select
                              value={variant.techSpecCategoryId || '_none'}
                              onValueChange={(val) => {
                                setEditingOption(prev => ({
                                  ...prev,
                                  variants: (prev.variants || prev.subOptions || []).map((v, i) =>
                                    i === idx ? { ...v, techSpecCategoryId: val === '_none' ? null : val } : v
                                  ),
                                  subOptions: []
                                }));
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs flex-1">
                                <SelectValue placeholder="ТЗ категория" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none">— Не привязано —</SelectItem>
                                {(techSpecCategories || []).map(tc => (
                                  <SelectItem key={tc.id} value={tc.id}>{tc.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {variant.techSpecCategoryId && (() => {
                              const tsCat = (techSpecCategories || []).find(tc => tc.id === variant.techSpecCategoryId);
                              if (!tsCat?.options?.length) return null;
                              return (
                                <Select
                                  value={variant.techSpecId || '_none'}
                                  onValueChange={(val) => {
                                    setEditingOption(prev => ({
                                      ...prev,
                                      variants: (prev.variants || prev.subOptions || []).map((v, i) =>
                                        i === idx ? { ...v, techSpecId: val === '_none' ? null : val } : v
                                      ),
                                      subOptions: []
                                    }));
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-xs flex-1">
                                    <SelectValue placeholder="ТЗ опция" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="_none">Текстом</SelectItem>
                                    {tsCat.options.map(to => (
                                      <SelectItem key={to.id} value={to.id}>{to.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            
            {/* Add new variant */}
              <div className="space-y-2 p-3 bg-gray-50 rounded border">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Название (RU)</Label>
                    <Input
                      id="new-variant-name"
                      placeholder="С зашивкой"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Название (PL)</Label>
                    <Input
                      id="new-variant-namePl"
                      placeholder="Z zabudową"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Цена варианта (zł)</Label>
                    <Input
                      id="new-variant-price"
                      type="number"
                      placeholder="2480"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700"
                      onClick={() => {
                        const nameInput = document.getElementById('new-variant-name');
                        const namePlInput = document.getElementById('new-variant-namePl');
                        const priceInput = document.getElementById('new-variant-price');
                        
                        const name = nameInput?.value?.trim();
                        const namePl = namePlInput?.value?.trim();
                        const price = parseInt(priceInput?.value) || 0;
                        
                        if (!name) return;
                        
                        const newVariant = {
                          id: `var-${Date.now()}`,
                          name: name,
                          nameRu: name,
                          namePl: namePl || name,
                          price: price
                        };
                        
                        setEditingOption(prev => ({
                          ...prev,
                          variants: [...(prev.variants || prev.subOptions || []), newVariant],
                          subOptions: [] // Clear legacy field
                        }));
                        
                        // Clear inputs
                        if (nameInput) nameInput.value = '';
                        if (namePlInput) namePlInput.value = '';
                        if (priceInput) priceInput.value = '';
                      }}
                    >
                      Добавить вариант
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Tech Spec Mapping Section */}
            <div className="border-t pt-4 mt-4">
              <Label className="text-sm font-medium text-amber-700">{txt.techSpecMapping || 'Маппинг на Тех.Задание'}</Label>
              <div className="space-y-3 mt-2">
                <div>
                  <Label className="text-xs text-muted-foreground">{txt.techSpecCategory || 'Категория тех.задания'}</Label>
                  <Select
                    value={editingOption.techSpecCategoryId || '_none'}
                    onValueChange={(value) => setEditingOption(prev => ({ 
                      ...prev, 
                      techSpecCategoryId: value === '_none' ? null : value,
                      techSpecId: value === '_none' ? null : prev.techSpecId // Keep techSpecId if same category
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={txt.selectTechSpecCategory || 'Выберите категорию'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">{txt.noMapping || '— Без маппинга —'}</SelectItem>
                      {techSpecCategories?.map(tc => (
                        <SelectItem key={tc.id} value={tc.id}>{tc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedTechSpecCategory && (
                  <div>
                    <Label className="text-xs text-muted-foreground">{txt.techSpecOption || 'Опция тех.задания'}</Label>
                    <Select
                      value={editingOption.techSpecId || '_none'}
                      onValueChange={(value) => setEditingOption(prev => ({ 
                        ...prev, 
                        techSpecId: value === '_none' ? null : value 
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={txt.selectTechSpecOption || 'Выберите опцию'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">{txt.noMapping || '— Без маппинга —'}</SelectItem>
                        {selectedTechSpecCategory.options?.map(opt => (
                          <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
            
            {/* Incompatibility Settings Section (NEW - inverted logic) */}
            <div className="border-t pt-4 mt-4">
              <Label className="text-sm font-medium text-red-700 mb-3 block">
                🚫 Несовместимость опции
              </Label>
              <p className="text-xs text-gray-500 mb-3">
                Укажите, когда эта опция должна быть <strong>скрыта</strong>. Во всех остальных случаях она будет доступна.
              </p>

              {/* Keep ONLY this option for selected models (hide all others in category) */}
              {onRestrictToOption && models && models.length > 0 && (
                <div className="mb-4 border border-emerald-300 rounded-lg p-3 bg-emerald-50" data-testid="restrict-to-option-block">
                  <Label className="text-sm font-medium text-emerald-800 mb-1 block">
                    ✅ Оставить только эту опцию для выбранных моделей
                  </Label>
                  <p className="text-xs text-emerald-700 mb-2">
                    Отметьте модели/варианты — у всех <strong>остальных</strong> опций этой категории будет включено «скрыть при выборе этих моделей». В категории останется только текущая опция.
                  </p>
                  <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1 bg-white">
                    {models.map(model => (
                      <div key={`restrict-${model.id}`}>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-emerald-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={restrictSel.includes(model.id)}
                            onChange={() => toggleRestrict(model.id)}
                            className="w-4 h-4 rounded border-gray-300 accent-emerald-600"
                            data-testid={`restrict-model-${model.id}`}
                          />
                          <span className="text-sm font-medium">{model.name}</span>
                        </label>
                        {model.variants?.length > 0 && (
                          <div className="ml-6 space-y-0.5">
                            {model.variants.map(variant => (
                              <label key={`restrict-${variant.id}`} className="flex items-center gap-2 cursor-pointer hover:bg-emerald-50 p-0.5 rounded">
                                <input
                                  type="checkbox"
                                  checked={restrictSel.includes(variant.id)}
                                  onChange={() => toggleRestrict(variant.id)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 accent-emerald-500"
                                  data-testid={`restrict-variant-${variant.id}`}
                                />
                                <span className="text-xs text-gray-600">{variant.namePl || variant.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={applyRestrict}
                    disabled={restrictSel.length === 0 || applyingRestrict}
                    className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    data-testid="apply-restrict-btn"
                  >
                    {applyingRestrict ? 'Применяю…' : `Применить (${restrictSel.length})`}
                  </Button>
                </div>
              )}
              
              {/* Incompatible Models */}
              {models && models.length > 0 && (
                <div className="mb-4">
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Скрыть опцию при выборе этих моделей:
                  </Label>
                  <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1 bg-red-50">
                    {models.map(model => (
                      <label key={model.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded">
                        <input
                          type="checkbox"
                          checked={incompatibleModels.includes(model.id)}
                          onChange={() => toggleIncompatibleModel(model.id)}
                          className="w-4 h-4 rounded border-gray-300 accent-red-600"
                        />
                        <span className="text-sm">{model.name}</span>
                      </label>
                    ))}
                  </div>
                  {incompatibleModels.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {incompatibleModels.map(modelId => {
                        const model = models.find(m => m.id === modelId);
                        return model ? (
                          <span key={modelId} className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                            ❌ {model.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              )}
              
              {/* Incompatible Model Variants (sub-models) */}
              {models && models.some(m => m.variants?.length > 0) && (
                <div className="mb-4">
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Скрыть опцию при выборе этих под-моделей (вариантов):
                  </Label>
                  <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-2 bg-purple-50">
                    {models.filter(m => m.variants?.length > 0).map(model => (
                      <div key={`variants-${model.id}`}>
                        <span className="text-xs font-medium text-gray-600">{model.name}:</span>
                        <div className="ml-2 mt-1 space-y-1">
                          {model.variants.map(variant => (
                            <label key={variant.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded">
                              <input
                                type="checkbox"
                                checked={incompatibleModels.includes(variant.id)}
                                onChange={() => toggleIncompatibleModel(variant.id)}
                                className="w-4 h-4 rounded border-gray-300 accent-purple-600"
                              />
                              <span className="text-sm">{variant.namePl || variant.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {incompatibleModels.filter(id => models.some(m => m.variants?.some(v => v.id === id))).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {incompatibleModels.map(variantId => {
                        for (const model of models) {
                          const variant = model.variants?.find(v => v.id === variantId);
                          if (variant) {
                            return (
                              <span key={variantId} className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                                ❌ {variant.namePl || variant.name}
                              </span>
                            );
                          }
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>
              )}
              
              {/* Incompatible with other options */}
              {categories && categories.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Скрыть опцию при выборе в других категориях:
                  </Label>
                  <div className="space-y-3">
                    {categories
                      .filter(cat => cat.id !== editingOption.categoryId) // Exclude current category
                      .map(category => (
                        <div key={category.id} className="border rounded p-2 bg-red-50">
                          <Label className="text-xs font-medium text-gray-700 mb-1 block">
                            {category.name}
                          </Label>
                          <div className="max-h-24 overflow-y-auto space-y-1">
                            {category.options?.map(option => {
                              const isSelected = (incompatibleWithOptions[category.id] || []).includes(option.id);
                              return (
                                <label key={option.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleIncompatibleOption(category.id, option.id)}
                                    className="w-4 h-4 rounded border-gray-300 accent-red-600"
                                  />
                                  <span className="text-xs">{option.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                  {Object.keys(incompatibleWithOptions).length > 0 && (
                    <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                      <p className="text-xs text-red-800 font-medium">Опция будет скрыта при:</p>
                      {Object.entries(incompatibleWithOptions).map(([catId, optIds]) => {
                        const category = categories.find(c => c.id === catId);
                        const optionNames = optIds.map(optId => category?.options?.find(o => o.id === optId)?.name).filter(Boolean);
                        return category && optionNames.length > 0 ? (
                          <p key={catId} className="text-xs text-red-700 mt-1">
                            {category.name}: {optionNames.join(' / ')}
                          </p>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{txt.cancel}</Button>
          </DialogClose>
          <Button onClick={onSave} className="bg-amber-600 hover:bg-amber-700">
            {txt.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
