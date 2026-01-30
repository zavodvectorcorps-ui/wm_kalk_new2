import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Upload, X, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '../ui/dialog';
import { ImageUploader } from './ImageUploader';

// Smart API URL
const getApiUrl = () => { 
  if (typeof window !== 'undefined') { 
    const o = window.location.origin; 
    if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o; 
  } 
  return process.env.REACT_APP_BACKEND_URL || ''; 
};
const API_URL = getApiUrl();

// Model Variants Editor Component
const ModelVariantsEditor = ({ variants = [], onChange }) => {
  const [uploadingImage, setUploadingImage] = useState(null);
  
  const handleAddVariant = () => {
    const newVariant = {
      id: `variant_${Date.now()}`,
      name: '',
      nameRu: '',
      namePl: '',
      price: 0,
      imageUrl: '',
      hint: '',
      hintPl: ''
    };
    onChange([...variants, newVariant]);
  };
  
  const handleRemoveVariant = (index) => {
    const newVariants = variants.filter((_, i) => i !== index);
    onChange(newVariants);
  };
  
  const handleVariantChange = (index, field, value) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    onChange(newVariants);
  };
  
  const handleImageUpload = async (e, index) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingImage(index);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch(`${API_URL}/api/upload/image`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      const fullUrl = `${API_URL}${data.url}`;
      handleVariantChange(index, 'imageUrl', fullUrl);
    } catch (error) {
      console.error('Image upload error:', error);
    } finally {
      setUploadingImage(null);
    }
  };
  
  // Duplicate variant
  const handleDuplicateVariant = (index) => {
    const variantToDuplicate = variants[index];
    const newVariant = {
      ...variantToDuplicate,
      id: `variant-${Date.now()}`,
      name: variantToDuplicate.name ? `${variantToDuplicate.name} (копия)` : '',
      namePl: variantToDuplicate.namePl ? `${variantToDuplicate.namePl} (kopia)` : '',
      nameRu: variantToDuplicate.nameRu ? `${variantToDuplicate.nameRu} (копия)` : '',
    };
    const newVariants = [...variants];
    newVariants.splice(index + 1, 0, newVariant);
    onChange(newVariants);
  };
  
  return (
    <div className="border-t pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <Label className="text-sm font-medium text-purple-700">🏠 Варианты модели (под-модели)</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddVariant}
          className="h-7 text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
        >
          <Plus className="h-3 w-3 mr-1" />
          Добавить вариант
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Добавьте варианты модели с разной ценой и фото (например: Стандарт и Премиум)
      </p>
      
      {variants.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Нет вариантов. Будет использоваться базовая цена модели.</p>
      ) : (
        <div className="space-y-4">
          {variants.map((variant, index) => (
            <div key={variant.id || index} className="border rounded-lg p-3 bg-purple-50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-purple-800">Вариант {index + 1}</span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicateVariant(index)}
                    className="h-7 w-7 p-0 text-purple-500 hover:text-purple-700 hover:bg-purple-100"
                    title="Дублировать вариант"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveVariant(index)}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                    title="Удалить вариант"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Название (PL)</Label>
                  <Input
                    value={variant.namePl || variant.name || ''}
                    onChange={(e) => handleVariantChange(index, 'namePl', e.target.value)}
                    placeholder="Standardowy"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Название (RU)</Label>
                  <Input
                    value={variant.nameRu || ''}
                    onChange={(e) => handleVariantChange(index, 'nameRu', e.target.value)}
                    placeholder="Стандартный"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-xs">Цена (PLN)</Label>
                <Input
                  type="number"
                  value={variant.price || 0}
                  onChange={(e) => handleVariantChange(index, 'price', parseInt(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
              
              <div>
                <Label className="text-xs">Описание (PL)</Label>
                <Input
                  value={variant.hintPl || ''}
                  onChange={(e) => handleVariantChange(index, 'hintPl', e.target.value)}
                  placeholder="Opis wariantu..."
                  className="h-8 text-sm"
                />
              </div>

              {/* Room dimensions section */}
              <div className="border-t pt-3 mt-3">
                <Label className="text-xs font-medium text-amber-700 mb-2 block">📐 Размеры помещений (для PDF)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-gray-500">Liczba osób</Label>
                    <Input
                      value={variant.capacity || ''}
                      onChange={(e) => handleVariantChange(index, 'capacity', e.target.value)}
                      placeholder="4-6"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Strona wejścia</Label>
                    <Input
                      value={variant.entranceSide || ''}
                      onChange={(e) => handleVariantChange(index, 'entranceSide', e.target.value)}
                      placeholder="Prawa / Lewa"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-green-600">Taras</Label>
                    <Input
                      value={variant.terraceSize || ''}
                      onChange={(e) => handleVariantChange(index, 'terraceSize', e.target.value)}
                      placeholder="185 cm"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-blue-600">Pokój wypoczynkowy</Label>
                    <Input
                      value={variant.relaxRoomSize || ''}
                      onChange={(e) => handleVariantChange(index, 'relaxRoomSize', e.target.value)}
                      placeholder="185 cm"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-orange-600">Sauna parowa</Label>
                    <Input
                      value={variant.steamRoomSize || ''}
                      onChange={(e) => handleVariantChange(index, 'steamRoomSize', e.target.value)}
                      placeholder="200 cm"
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="text-xs">Фото варианта</Label>
                {variant.imageUrl ? (
                  <div className="relative mt-1">
                    <img 
                      src={variant.imageUrl} 
                      alt={variant.namePl || 'Variant'} 
                      className="w-full h-24 object-contain rounded border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                      onClick={() => handleVariantChange(index, 'imageUrl', '')}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="block mt-1">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, index)}
                    />
                    <div className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:bg-white">
                      {uploadingImage === index ? (
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-purple-500" />
                      ) : (
                        <>
                          <Upload className="h-5 w-5 mx-auto text-gray-400" />
                          <span className="text-xs text-gray-500">Загрузить</span>
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Gallery Images Editor Component
const GalleryImagesEditor = ({ images = [], onChange }) => {
  const [uploading, setUploading] = useState(false);
  
  const handleUploadImages = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    const newImages = [...images];
    
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await fetch(`${API_URL}/api/upload/image`, {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        const fullUrl = `${API_URL}${data.url}`;
        newImages.push(fullUrl);
      } catch (error) {
        console.error('Gallery image upload error:', error);
      }
    }
    
    onChange(newImages);
    setUploading(false);
    e.target.value = ''; // Reset input
  };
  
  const handleRemoveImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);
  };
  
  return (
    <div className="border-t pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <Label className="text-sm font-medium text-indigo-700">📸 Галерея фотографий</Label>
        <label>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleUploadImages}
            disabled={uploading}
          />
          <Button type="button" variant="outline" size="sm" asChild disabled={uploading} className="h-7 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50">
            <span>
              {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
              Добавить фото
            </span>
          </Button>
        </label>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Добавьте несколько фотографий для этого размера сауны
      </p>
      
      {images.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Нет дополнительных фотографий</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((imageUrl, index) => (
            <div key={index} className="relative group">
              <img 
                src={imageUrl} 
                alt={`Gallery ${index + 1}`} 
                className="w-full h-20 object-cover rounded border"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-1 right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemoveImage(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const AddModelDialog = ({ open, onOpenChange, newModel, setNewModel, onAdd, txt }) => {
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
      setNewModel(prev => ({ ...prev, hintImageUrl: fullUrl }));
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{txt.discount}</Label>
            <Input
              type="number"
              value={newModel.discount}
              onChange={(e) => setNewModel(prev => ({ ...prev, discount: e.target.value }))}
            />
          </div>
          <div>
            <Label>👥 Количество человек</Label>
            <Input
              value={newModel.capacity || ''}
              onChange={(e) => setNewModel(prev => ({ ...prev, capacity: e.target.value }))}
              placeholder="4-6"
            />
          </div>
        </div>
        
        {/* Model Variants Section */}
        <ModelVariantsEditor
          variants={newModel.variants || []}
          onChange={(variants) => setNewModel(prev => ({ ...prev, variants }))}
        />
        
        {/* Room Sizes Section */}
        <div className="border-t pt-4 mt-4">
          <Label className="text-sm font-medium text-blue-700 mb-2 block">📐 Размеры комнат (стандарт)</Label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Комната отдыха</Label>
              <Input
                value={newModel.relaxRoomSize || ''}
                onChange={(e) => setNewModel(prev => ({ ...prev, relaxRoomSize: e.target.value }))}
                placeholder="2.5 x 3.0 m"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Парная</Label>
              <Input
                value={newModel.steamRoomSize || ''}
                onChange={(e) => setNewModel(prev => ({ ...prev, steamRoomSize: e.target.value }))}
                placeholder="2.0 x 2.0 m"
              />
            </div>
          </div>
        </div>
        
        {/* Room Sizes with Terrace */}
        <div className="border-t pt-4 mt-2">
          <Label className="text-sm font-medium text-green-700 mb-2 block">🏡 Размеры с доп. террасой</Label>
          <p className="text-xs text-gray-500 mb-2">Эти размеры будут использоваться когда выбрана опция "Дополнительная терраса"</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Комната отдыха</Label>
              <Input
                value={newModel.relaxRoomSizeWithTerrace || ''}
                onChange={(e) => setNewModel(prev => ({ ...prev, relaxRoomSizeWithTerrace: e.target.value }))}
                placeholder="3.0 x 3.5 m"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Парная</Label>
              <Input
                value={newModel.steamRoomSizeWithTerrace || ''}
                onChange={(e) => setNewModel(prev => ({ ...prev, steamRoomSizeWithTerrace: e.target.value }))}
                placeholder="2.5 x 2.5 m"
              />
            </div>
          </div>
        </div>
        
        <div>
          <Label>{txt.hint || 'Подсказка / Описание'}</Label>
          <Textarea
            value={newModel.hint || ''}
            onChange={(e) => setNewModel(prev => ({ ...prev, hint: e.target.value }))}
            placeholder="Описание модели, характеристики, особенности..."
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
                  value={newModel.hintImageUrl || ''}
                  onChange={(e) => setNewModel(prev => ({ ...prev, hintImageUrl: e.target.value }))}
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
                {newModel.hintImageUrl && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-500 hover:text-red-700"
                    onClick={() => setNewModel(prev => ({ ...prev, hintImageUrl: '' }))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {newModel.hintImageUrl && (
                <div className="mt-2">
                  <img 
                    src={newModel.hintImageUrl} 
                    alt="Hint preview" 
                    className="w-full max-h-32 object-contain rounded border bg-muted/50"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{txt.hintVideoUrl || 'URL видео подсказки'}</Label>
              <Input
                value={newModel.hintVideoUrl || ''}
                onChange={(e) => setNewModel(prev => ({ ...prev, hintVideoUrl: e.target.value }))}
                placeholder="YouTube ссылка или прямая ссылка на видео"
              />
              <p className="text-xs text-muted-foreground mt-1">Поддерживается YouTube и прямые ссылки на видео</p>
            </div>
          </div>
        </div>
        
        <ImageUploader
          value={newModel.imageUrl}
          onChange={(url) => setNewModel(prev => ({ ...prev, imageUrl: url }))}
          label={txt.imageUrl}
          previewLabel={txt.previewImage}
          urlPlaceholder={txt.imageUrlHint}
          themeColor="amber"
        />
        
        {/* Gallery Images */}
        <GalleryImagesEditor
          images={newModel.galleryImages || []}
          onChange={(images) => setNewModel(prev => ({ ...prev, galleryImages: images }))}
        />
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

export const EditModelDialog = ({ open, onOpenChange, editingModel, setEditingModel, onSave, txt }) => {
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
      setEditingModel(prev => ({ ...prev, hintImageUrl: fullUrl }));
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
        <DialogTitle>{txt.editModel}</DialogTitle>
      </DialogHeader>
      {editingModel && (
        <div className="space-y-4">
          <div>
            <Label>{txt.modelName}</Label>
            <Input
              value={editingModel.name}
              onChange={(e) => setEditingModel(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{txt.basePrice}</Label>
              <Input
                type="number"
                value={editingModel.basePrice}
                onChange={(e) => setEditingModel(prev => ({ ...prev, basePrice: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label>{txt.foundationPrice}</Label>
              <Input
                type="number"
                value={editingModel.foundationPrice}
                onChange={(e) => setEditingModel(prev => ({ ...prev, foundationPrice: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{txt.discount}</Label>
              <Input
                type="number"
                value={editingModel.discount}
                onChange={(e) => setEditingModel(prev => ({ ...prev, discount: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label>👥 Количество человек</Label>
              <Input
                value={editingModel.capacity || ''}
                onChange={(e) => setEditingModel(prev => ({ ...prev, capacity: e.target.value }))}
                placeholder="4-6"
              />
            </div>
          </div>
          
          {/* Model Variants Section */}
          <ModelVariantsEditor
            variants={editingModel.variants || []}
            onChange={(variants) => setEditingModel(prev => ({ ...prev, variants }))}
          />
          
          {/* Room Sizes Section */}
          <div className="border-t pt-4 mt-4">
            <Label className="text-sm font-medium text-blue-700 mb-2 block">📐 Размеры комнат (стандарт)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Комната отдыха</Label>
                <Input
                  value={editingModel.relaxRoomSize || ''}
                  onChange={(e) => setEditingModel(prev => ({ ...prev, relaxRoomSize: e.target.value }))}
                  placeholder="2.5 x 3.0 m"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Парная</Label>
                <Input
                  value={editingModel.steamRoomSize || ''}
                  onChange={(e) => setEditingModel(prev => ({ ...prev, steamRoomSize: e.target.value }))}
                  placeholder="2.0 x 2.0 m"
                />
              </div>
            </div>
          </div>
          
          {/* Room Sizes with Terrace */}
          <div className="border-t pt-4 mt-2">
            <Label className="text-sm font-medium text-green-700 mb-2 block">🏡 Размеры с доп. террасой</Label>
            <p className="text-xs text-gray-500 mb-2">Эти размеры будут использоваться когда выбрана опция "Дополнительная терраса"</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Комната отдыха</Label>
                <Input
                  value={editingModel.relaxRoomSizeWithTerrace || ''}
                  onChange={(e) => setEditingModel(prev => ({ ...prev, relaxRoomSizeWithTerrace: e.target.value }))}
                  placeholder="3.0 x 3.5 m"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Парная</Label>
                <Input
                  value={editingModel.steamRoomSizeWithTerrace || ''}
                  onChange={(e) => setEditingModel(prev => ({ ...prev, steamRoomSizeWithTerrace: e.target.value }))}
                  placeholder="2.5 x 2.5 m"
                />
              </div>
            </div>
          </div>
          
          <div>
            <Label>{txt.hint || 'Подсказка / Описание'}</Label>
            <Textarea
              value={editingModel.hint || ''}
              onChange={(e) => setEditingModel(prev => ({ ...prev, hint: e.target.value }))}
              placeholder="Описание модели, характеристики, особенности..."
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
                    value={editingModel.hintImageUrl || ''}
                    onChange={(e) => setEditingModel(prev => ({ ...prev, hintImageUrl: e.target.value }))}
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
                  {editingModel.hintImageUrl && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                      onClick={() => setEditingModel(prev => ({ ...prev, hintImageUrl: '' }))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {editingModel.hintImageUrl && (
                  <div className="mt-2">
                    <img 
                      src={editingModel.hintImageUrl} 
                      alt="Hint preview" 
                      className="w-full max-h-32 object-contain rounded border bg-muted/50"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{txt.hintVideoUrl || 'URL видео подсказки'}</Label>
                <Input
                  value={editingModel.hintVideoUrl || ''}
                  onChange={(e) => setEditingModel(prev => ({ ...prev, hintVideoUrl: e.target.value }))}
                  placeholder="YouTube ссылка или прямая ссылка на видео"
                />
                <p className="text-xs text-muted-foreground mt-1">Поддерживается YouTube и прямые ссылки на видео</p>
              </div>
            </div>
          </div>
          
          <ImageUploader
            value={editingModel.imageUrl || ''}
            onChange={(url) => setEditingModel(prev => ({ ...prev, imageUrl: url }))}
            label={txt.imageUrl}
            previewLabel={txt.previewImage}
            urlPlaceholder={txt.imageUrlHint}
            themeColor="amber"
          />
          
          {/* Gallery Images */}
          <GalleryImagesEditor
            images={editingModel.galleryImages || []}
            onChange={(images) => setEditingModel(prev => ({ ...prev, galleryImages: images }))}
          />
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
