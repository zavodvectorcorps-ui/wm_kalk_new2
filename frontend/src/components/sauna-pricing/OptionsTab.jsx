import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Dialog, DialogTrigger } from '../ui/dialog';
import { SortableList } from '../ui/sortable-list';
import { Plus, Edit2, Trash2, Package, Link2, CheckCircle2 } from 'lucide-react';
import { AddOptionDialog, EditOptionDialog } from './OptionDialog';

export const OptionsTab = ({
  prices,
  txt,
  techSpecCategories,
  handleAddOption,
  handleDeleteOption,
  handleSaveEditOption,
  handleUpdateOptionPrice,
  handleToggleOptionQuantity,
  handleToggleOptionDefault,
  handleReorderOptions,
}) => {
  const { canEdit } = useAuth();
  const [isOptionDialogOpen, setIsOptionDialogOpen] = useState(false);
  const [isEditOptionDialogOpen, setIsEditOptionDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState(null);
  const [newOption, setNewOption] = useState({
    categoryId: '',
    name: '',
    price: 0,
    imageUrl: '',
    hasQuantity: false,
    isDefaultSelected: false,
    techSpecId: null,
    techSpecCategoryId: null,
  });

  const onAddOption = async () => {
    const success = await handleAddOption(newOption);
    if (success) {
      setNewOption({ categoryId: '', name: '', price: 0, imageUrl: '', hasQuantity: false, isDefaultSelected: false, techSpecId: null, techSpecCategoryId: null });
      setIsOptionDialogOpen(false);
    }
  };

  const onEditOption = (categoryId, option) => {
    setEditingOption({ ...option, categoryId });
    setIsEditOptionDialogOpen(true);
  };

  const onSaveEditOption = async () => {
    const success = await handleSaveEditOption(editingOption);
    if (success) {
      setIsEditOptionDialogOpen(false);
      setEditingOption(null);
    }
  };

  // Helper to get tech spec mapping display
  const getTechSpecMappingBadge = (option) => {
    if (!option.techSpecCategoryId || !option.techSpecId) return null;
    const category = techSpecCategories?.find(c => c.id === option.techSpecCategoryId);
    const techOption = category?.options?.find(o => o.id === option.techSpecId);
    if (!category || !techOption) return null;
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs flex items-center gap-1">
        <Link2 className="h-3 w-3" />
        {category.name} → {techOption.name}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{txt.options}</CardTitle>
        {canEdit() && (
          <Dialog open={isOptionDialogOpen} onOpenChange={setIsOptionDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                <Plus className="h-4 w-4 mr-2" />
                {txt.addOption}
              </Button>
            </DialogTrigger>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {prices.categories?.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{txt.noCategories}</p>
        ) : (
          <div className="space-y-6">
            {prices.categories?.map((category) => (
              <div key={category.id} className="border rounded-lg p-4">
                <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {category.name}
                  <Badge variant="outline" className="ml-2">
                    {category.inputType === 'checkbox' ? txt.checkbox : txt.radio}
                  </Badge>
                </h3>
                
                {category.options?.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{txt.noOptions}</p>
                ) : (
                  <SortableList
                    items={category.options || []}
                    onReorder={(newOptions) => handleReorderOptions(category.id, newOptions)}
                    disabled={!canEdit()}
                    renderItem={(option) => (
                      <div className="flex items-center justify-between p-2 bg-muted/30 rounded flex-wrap gap-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          {option.imageUrl && (
                            <img
                              src={option.imageUrl}
                              alt={option.name}
                              className="w-12 h-9 object-cover rounded"
                            />
                          )}
                          <span className="text-sm">{option.name}</span>
                          {getTechSpecMappingBadge(option)}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Input
                            type="number"
                            value={option.price}
                            onChange={(e) => handleUpdateOptionPrice(category.id, option.id, e.target.value)}
                            className="w-24 h-8"
                            disabled={!canEdit()}
                          />
                          <span className="text-sm text-muted-foreground">PLN</span>
                          {canEdit() && (
                            <>
                              <div className="flex items-center gap-1 border rounded px-2 py-1">
                                <Checkbox
                                  id={`qty-${option.id}`}
                                  checked={option.hasQuantity || false}
                                  onCheckedChange={(checked) => handleToggleOptionQuantity(category.id, option.id, checked)}
                                />
                                <Label htmlFor={`qty-${option.id}`} className="text-xs cursor-pointer">
                                  {txt.quantityLabel}
                                </Label>
                              </div>
                              <div className="flex items-center gap-1 border rounded px-2 py-1 border-green-300 bg-green-50">
                                <Checkbox
                                  id={`default-${option.id}`}
                                  checked={option.isDefaultSelected || false}
                                  onCheckedChange={(checked) => handleToggleOptionDefault(category.id, option.id, checked)}
                                />
                                <Label htmlFor={`default-${option.id}`} className="text-xs cursor-pointer text-green-700">
                                  {txt.defaultLabel || 'Domyślnie'}
                                </Label>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => onEditOption(category.id, option)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDeleteOption(category.id, option.id)}
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
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AddOptionDialog
        open={isOptionDialogOpen}
        onOpenChange={setIsOptionDialogOpen}
        newOption={newOption}
        setNewOption={setNewOption}
        categories={prices.categories}
        techSpecCategories={techSpecCategories}
        onAdd={onAddOption}
        txt={txt}
      />

      <EditOptionDialog
        open={isEditOptionDialogOpen}
        onOpenChange={setIsEditOptionDialogOpen}
        editingOption={editingOption}
        setEditingOption={setEditingOption}
        techSpecCategories={techSpecCategories}
        onSave={onSaveEditOption}
        txt={txt}
      />
    </Card>
  );
};
