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
import { Plus, Edit2, Trash2, Save, X, LayoutGrid, List, Info, Upload, Image as ImageIcon, Video } from 'lucide-react';

export const CategoriesTab = ({
  prices,
  txt,
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
