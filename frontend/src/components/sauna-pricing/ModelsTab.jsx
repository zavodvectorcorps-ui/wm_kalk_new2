import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Plus, ArrowUp, ArrowDown, Edit2, Trash2, LayoutGrid, List, Info, Upload, X, Image as ImageIcon, Video } from 'lucide-react';
import { AddModelDialog, EditModelDialog } from './ModelDialog';

export const ModelsTab = ({
  prices,
  txt,
  handleAddModel,
  handleSaveEditModel,
  handleDeleteModel,
  moveModel,
  handleModelsDisplayTypeChange,
  onUpdateModelsHint,
}) => {
  const { canEdit } = useAuth();
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const [isEditModelDialogOpen, setIsEditModelDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [showHintSection, setShowHintSection] = useState(false);
  const [newModel, setNewModel] = useState({
    name: '',
    basePrice: 0,
    foundationPrice: 0,
    discount: 0,
    imageUrl: '',
  });

  const onAddModel = async () => {
    const success = await handleAddModel(newModel);
    if (success) {
      setNewModel({ name: '', basePrice: 0, foundationPrice: 0, discount: 0, imageUrl: '' });
      setIsModelDialogOpen(false);
    }
  };

  const onEditModel = (model) => {
    setEditingModel({ ...model });
    setIsEditModelDialogOpen(true);
  };

  const onSaveEditModel = async () => {
    const success = await handleSaveEditModel(editingModel);
    if (success) {
      setIsEditModelDialogOpen(false);
      setEditingModel(null);
    }
  };

  // Handle hint image upload
  const handleHintImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      onUpdateModelsHint?.('modelsHintImageUrl', reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <CardTitle>{txt.models}</CardTitle>
        <div className="flex items-center gap-3">
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
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Global Models Hint Section */}
        {canEdit() && (
          <div className="border rounded-lg bg-amber-50/50">
            <button
              onClick={() => setShowHintSection(!showHintSection)}
              className="w-full p-3 flex items-center gap-2 text-amber-800 hover:bg-amber-100/50 transition-colors rounded-lg"
            >
              <Info className="h-4 w-4" />
              <span className="font-medium text-sm">
                {txt.globalModelsHint || 'Общая подсказка для моделей'}
              </span>
              {(prices.modelsHint || prices.modelsHintImageUrl || prices.modelsHintVideoUrl) && (
                <Badge variant="secondary" className="ml-2 text-xs">Настроено</Badge>
              )}
              <span className="ml-auto text-xs">{showHintSection ? '▲' : '▼'}</span>
            </button>
            
            {showHintSection && (
              <div className="p-4 pt-0 space-y-3 border-t border-amber-200">
                <p className="text-xs text-amber-700 mb-3">
                  {txt.globalModelsHintDescription || 'Эта подсказка будет отображаться над всеми моделями в калькуляторе'}
                </p>
                
                {/* Hint text */}
                <div className="space-y-2">
                  <Label className="text-sm">{txt.hint || 'Подсказка'}</Label>
                  <textarea 
                    value={prices.modelsHint || ''} 
                    onChange={(e) => onUpdateModelsHint?.('modelsHint', e.target.value)}
                    placeholder="Текст подсказки..."
                    rows={2}
                    className="w-full text-sm p-2 border rounded-md resize-none"
                  />
                </div>
                
                {/* Hint Image */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" />
                    {txt.hintImageUrl || 'URL изображения'}
                  </Label>
                  <div className="flex gap-2 items-start">
                    <Input 
                      value={prices.modelsHintImageUrl || ''} 
                      onChange={(e) => onUpdateModelsHint?.('modelsHintImageUrl', e.target.value)}
                      placeholder="URL или загрузите файл"
                      className="text-sm flex-1"
                    />
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleHintImageUpload}
                        className="hidden"
                      />
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span><Upload className="h-4 w-4" /></span>
                      </Button>
                    </label>
                    {prices.modelsHintImageUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateModelsHint?.('modelsHintImageUrl', '')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {prices.modelsHintImageUrl && (
                    <img 
                      src={prices.modelsHintImageUrl} 
                      alt="Hint preview" 
                      className="w-full max-h-24 object-contain rounded border bg-white"
                    />
                  )}
                </div>
                
                {/* Hint Video URL */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-1">
                    <Video className="h-3 w-3" />
                    {txt.hintVideoUrl || 'URL видео'}
                  </Label>
                  <Input 
                    value={prices.modelsHintVideoUrl || ''} 
                    onChange={(e) => onUpdateModelsHint?.('modelsHintVideoUrl', e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        )}

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
                  {canEdit() && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEditModel(model)}
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
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AddModelDialog
        open={isModelDialogOpen}
        onOpenChange={setIsModelDialogOpen}
        newModel={newModel}
        setNewModel={setNewModel}
        onAdd={onAddModel}
        txt={txt}
      />

      <EditModelDialog
        open={isEditModelDialogOpen}
        onOpenChange={setIsEditModelDialogOpen}
        editingModel={editingModel}
        setEditingModel={setEditingModel}
        onSave={onSaveEditModel}
        txt={txt}
      />
    </Card>
  );
};
