import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Upload, X, Loader2 } from 'lucide-react';
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
      const fullUrl = `${API_URL}${data.url}`;
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
            <Input
              value={newOption.imageUrl}
              onChange={(e) => setNewOption(prev => ({ ...prev, imageUrl: e.target.value }))}
              placeholder={txt.imageUrlHint}
            />
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

export const EditOptionDialog = ({ open, onOpenChange, editingOption, setEditingOption, techSpecCategories, categories, models, onSave, txt }) => {
  const selectedTechSpecCategory = techSpecCategories?.find(tc => tc.id === editingOption?.techSpecCategoryId);
  const [uploadingHintImage, setUploadingHintImage] = useState(false);
  
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
      const fullUrl = `${API_URL}${data.url}`;
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
            <div>
              <Label>{txt.optionName}</Label>
              <Input
                value={editingOption.name}
                onChange={(e) => setEditingOption(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>{txt.price}</Label>
              <Input
                type="number"
                value={editingOption.price}
                onChange={(e) => setEditingOption(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
              />
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
              <Input
                value={editingOption.imageUrl || ''}
                onChange={(e) => setEditingOption(prev => ({ ...prev, imageUrl: e.target.value }))}
                placeholder={txt.imageUrlHint}
              />
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
            
            {/* Variants Section (formerly Sub-Options) */}
            <div className="border-t pt-4 mt-4">
              <Label className="text-sm font-medium text-amber-700 mb-3 block">
                🔄 Варианты исполнения / Warianty
              </Label>
              <p className="text-xs text-gray-500 mb-3">
                Варианты - это взаимоисключающие версии опции (например, "лавка без обшивки" vs "лавка с обшивкой"). 
                Цена варианта ЗАМЕНЯЕТ базовую цену опции.
              </p>
              
              {/* List of existing variants */}
              {(editingOption.variants?.length > 0 || editingOption.subOptions?.length > 0) && (
                <div className="space-y-2 mb-3">
                  {(editingOption.variants || editingOption.subOptions || []).map((variant, idx) => (
                    <div key={idx} className="p-2 bg-amber-50 rounded border border-amber-200">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <span className="font-medium text-sm">{variant.name}</span>
                          {variant.namePl && <span className="text-xs text-gray-500 ml-2">({variant.namePl})</span>}
                          <span className="text-amber-700 ml-2 font-bold">{variant.price} zł</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          onClick={() => {
                            setEditingOption(prev => ({
                              ...prev,
                              variants: (prev.variants || prev.subOptions || []).filter((_, i) => i !== idx),
                              subOptions: [] // Clear legacy field
                            }));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        {/* Image upload for variant */}
                        <label className="cursor-pointer">
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
                                const response = await fetch(`${window.API_URL || ''}/api/sauna/upload-image`, {
                                  method: 'POST',
                                  body: formData
                                });
                                const result = await response.json();
                                if (result.url) {
                                  setEditingOption(prev => ({
                                    ...prev,
                                    variants: (prev.variants || prev.subOptions || []).map((v, i) => 
                                      i === idx ? { ...v, imageUrl: result.url } : v
                                    ),
                                    subOptions: []
                                  }));
                                }
                              } catch (err) {
                                console.error('Upload error:', err);
                              }
                            }}
                          />
                          <div className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800">
                            <Upload className="h-3 w-3" />
                            {variant.imageUrl ? 'Заменить' : 'Фото'}
                          </div>
                        </label>
                      </div>
                      {variant.imageUrl && (
                        <img src={variant.imageUrl} alt={variant.name} className="w-full h-16 object-cover rounded mt-2" />
                      )}
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
