import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '../ui/dialog';
import { Label } from '../ui/label';
import { SortableList } from '../ui/sortable-list';
import { Plus, Edit2, Trash2, Save, X, LayoutGrid, List } from 'lucide-react';

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
  };

  const onSaveEditCategory = async () => {
    const success = await handleSaveEditCategory(editingCategory);
    if (success) {
      setEditingCategory(null);
    }
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
                  
                  {editingCategory?.id === category.id ? (
                    <>
                      <Input
                        value={editingCategory.name}
                        onChange={(e) => setEditingCategory(prev => ({ ...prev, name: e.target.value }))}
                        className="w-40"
                      />
                      <Select
                        value={editingCategory.inputType}
                        onValueChange={(value) => setEditingCategory(prev => ({ ...prev, inputType: value }))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="radio">{txt.radio}</SelectItem>
                          <SelectItem value="checkbox">{txt.checkbox}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={onSaveEditCategory}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingCategory(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : canEdit() ? (
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
                  ) : null}
                </div>
              </div>
            )}
          />
        )}
      </CardContent>
    </Card>
  );
};
