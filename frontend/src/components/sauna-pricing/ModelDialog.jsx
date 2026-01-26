import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Upload, X, Loader2 } from 'lucide-react';
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
        <div>
          <Label>{txt.discount}</Label>
          <Input
            type="number"
            value={newModel.discount}
            onChange={(e) => setNewModel(prev => ({ ...prev, discount: e.target.value }))}
          />
        </div>
        
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
          <div>
            <Label>{txt.discount}</Label>
            <Input
              type="number"
              value={editingModel.discount}
              onChange={(e) => setEditingModel(prev => ({ ...prev, discount: parseInt(e.target.value) || 0 }))}
            />
          </div>
          
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
