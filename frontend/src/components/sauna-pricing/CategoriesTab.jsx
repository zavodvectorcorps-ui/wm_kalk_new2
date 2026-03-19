import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '../ui/dialog';
import { Label } from '../ui/label';
import { SortableList } from '../ui/sortable-list';
import { Plus, Edit2, Trash2, Save, X, LayoutGrid, List, Info, Upload, Image as ImageIcon, Video, Wrench } from 'lucide-react';

export const CategoriesTab = ({
  prices,
  txt,
  techSpecCategories,
  handleAddCategory,
  handleSaveEditCategory,
  handleDeleteCategory,
  handleReorderCategories,
  handleCategoryDisplayTypeChange,
}) => {
  const { canEdit } = useAuth();
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isEditCategoryDialogOpen, setIsEditCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategory, setNewCategory] = useState({
    name: '',
    inputType: 'radio',
  });

  const onAddCategory = async () => {
    const success = await handleAddCategory(newCategory);
    if (success) {
      setNewCategory({ name: '', inputType: 'radio' });
      setIsCategoryDialogOpen(false);
    }
  };

  const onEditCategory = (category) => {
    setEditingCategory({ ...category });
    setIsEditCategoryDialogOpen(true);
  };

  const onSaveEditCategory = async () => {
    const success = await handleSaveEditCategory(editingCategory);
    if (success) {
      setEditingCategory(null);
      setIsEditCategoryDialogOpen(false);
    }
  };

  // Handle image upload for category hint
  const handleHintImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      setEditingCategory(prev => ({ ...prev, hintImageUrl: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{txt.categories}</CardTitle>
        {canEdit() && (
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
                <Button onClick={onAddCategory} className="bg-amber-600 hover:bg-amber-700">
                  {txt.save}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {prices.categories?.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{txt.noCategories}</p>
        ) : (
          <SortableList
            items={prices.categories || []}
            onReorder={handleReorderCategories}
            disabled={!canEdit()}
            renderItem={(category, index) => (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg flex-wrap gap-2">
                <div className="flex-1 min-w-[150px]">
                  <div className="font-medium flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">#{index + 1}</span>
                    {category.name}
                    {(category.hint || category.hintImageUrl || category.hintVideoUrl) && (
                      <Info className="h-3 w-3 text-amber-500" title="Есть подсказка" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground flex flex-wrap gap-2 items-center">
                    <Badge variant="outline" className="mr-2">
                      {category.inputType === 'checkbox' ? txt.checkbox : txt.radio}
                    </Badge>
                    {category.options?.length || 0} {txt.options.toLowerCase()}
                    {category.techSpecCategoryId && (
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                        <Wrench className="h-3 w-3 mr-1" />
                        ТЗ: {(techSpecCategories || []).find(tc => tc.id === category.techSpecCategoryId)?.name || category.techSpecCategoryId}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  {canEdit() && (
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
                  )}
                  
                  {canEdit() && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEditCategory(category)}
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
            )}
          />
        )}
      </CardContent>

      {/* Edit Category Dialog */}
      <Dialog open={isEditCategoryDialogOpen} onOpenChange={setIsEditCategoryDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{txt.editCategory}</DialogTitle>
          </DialogHeader>
          {editingCategory && (
            <div className="space-y-4">
              <div>
                <Label>{txt.categoryName}</Label>
                <Input
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>{txt.inputType}</Label>
                <Select
                  value={editingCategory.inputType}
                  onValueChange={(value) => setEditingCategory(prev => ({ ...prev, inputType: value }))}
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

              {/* Category Hint Section */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="h-4 w-4 text-amber-500" />
                  <Label className="font-semibold">{txt.categoryHint || 'Подсказка категории'}</Label>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {txt.categoryHintDescription || 'Подсказка будет отображаться под названием категории в калькуляторе'}
                </p>
                
                <div className="space-y-3">
                  {/* Hint text */}
                  <div className="space-y-2">
                    <Label className="text-sm">{txt.hint || 'Подсказка'}</Label>
                    <Textarea 
                      value={editingCategory.hint || ''} 
                      onChange={(e) => setEditingCategory(prev => ({ ...prev, hint: e.target.value }))}
                      placeholder="Текст подсказки..."
                      rows={2}
                      className="text-sm"
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
                        value={editingCategory.hintImageUrl || ''} 
                        onChange={(e) => setEditingCategory(prev => ({ ...prev, hintImageUrl: e.target.value }))}
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
                      {editingCategory.hintImageUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingCategory(prev => ({ ...prev, hintImageUrl: '' }))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {editingCategory.hintImageUrl && (
                      <img 
                        src={editingCategory.hintImageUrl} 
                        alt="Hint preview" 
                        className="w-full max-h-24 object-contain rounded border bg-gray-50"
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
                      value={editingCategory.hintVideoUrl || ''} 
                      onChange={(e) => setEditingCategory(prev => ({ ...prev, hintVideoUrl: e.target.value }))}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Tech Spec Category Mapping */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="h-4 w-4 text-amber-600" />
                  <Label className="font-semibold">Маппинг в тех. задание</Label>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Выбранная опция из этой категории калькулятора будет перенесена текстом в выбранную категорию тех. задания. Не нужно настраивать связь для каждой опции отдельно.
                </p>
                <Select
                  value={editingCategory.techSpecCategoryId || '_none'}
                  onValueChange={(value) => setEditingCategory(prev => ({
                    ...prev,
                    techSpecCategoryId: value === '_none' ? null : value
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Не привязано" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Не привязано —</SelectItem>
                    {(techSpecCategories || []).map(tc => (
                      <SelectItem key={tc.id} value={tc.id}>{tc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editingCategory.techSpecCategoryId && (
                  <p className="text-xs text-green-600 mt-2">
                    Выбранная опция будет перенесена как текст в "{(techSpecCategories || []).find(tc => tc.id === editingCategory.techSpecCategoryId)?.name}"
                  </p>
                )}
              </div>

              {/* Visibility for Model Variants */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <LayoutGrid className="h-4 w-4 text-purple-500" />
                  <Label className="font-semibold">Видимость для моделей и вариантов</Label>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Выберите модели и/или варианты (под-модели), для которых эта категория будет видна. Оставьте пустым для показа всегда.
                </p>
                <div className="space-y-3 max-h-60 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                  {/* Models */}
                  <div>
                    <Label className="text-xs text-amber-700 font-medium mb-2 block">📦 Модели</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {prices.models?.map(model => (
                        <label key={`model-${model.id}`} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-amber-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={(editingCategory.visibleForModelVariants || []).includes(model.id)}
                            onChange={(e) => {
                              const current = editingCategory.visibleForModelVariants || [];
                              if (e.target.checked) {
                                setEditingCategory(prev => ({ ...prev, visibleForModelVariants: [...current, model.id] }));
                              } else {
                                setEditingCategory(prev => ({ ...prev, visibleForModelVariants: current.filter(v => v !== model.id) }));
                              }
                            }}
                            className="rounded border-amber-300"
                          />
                          <span className="truncate">{model.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  {/* Model Variants (sub-models) */}
                  {prices.models?.some(m => m.variants?.length > 0) && (
                    <div className="border-t pt-3">
                      <Label className="text-xs text-purple-700 font-medium mb-2 block">🏠 Под-модели (варианты)</Label>
                      {prices.models?.map(model => (
                        model.variants?.length > 0 && (
                          <div key={`variants-${model.id}`} className="mb-3">
                            <span className="text-xs text-gray-500 font-medium">{model.name}:</span>
                            <div className="grid grid-cols-2 gap-1 mt-1 ml-2">
                              {model.variants.map(variant => (
                                <label key={`variant-${variant.id}`} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-purple-50 p-1 rounded">
                                  <input
                                    type="checkbox"
                                    checked={(editingCategory.visibleForModelVariants || []).includes(variant.id)}
                                    onChange={(e) => {
                                      const current = editingCategory.visibleForModelVariants || [];
                                      if (e.target.checked) {
                                        setEditingCategory(prev => ({ ...prev, visibleForModelVariants: [...current, variant.id] }));
                                      } else {
                                        setEditingCategory(prev => ({ ...prev, visibleForModelVariants: current.filter(v => v !== variant.id) }));
                                      }
                                    }}
                                    className="rounded border-purple-300"
                                  />
                                  <span className="truncate text-xs">{variant.namePl || variant.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Selected items display */}
                {(editingCategory.visibleForModelVariants || []).length > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    <span className="font-medium">Выбрано:</span> {(editingCategory.visibleForModelVariants || []).join(', ')}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditCategoryDialogOpen(false)}>{txt.cancel}</Button>
            <Button onClick={onSaveEditCategory} className="bg-amber-600 hover:bg-amber-700">
              {txt.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
