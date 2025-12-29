import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogTrigger } from '../ui/dialog';
import { Plus, ArrowUp, ArrowDown, Edit2, Trash2, LayoutGrid, List } from 'lucide-react';
import { AddModelDialog, EditModelDialog } from './ModelDialog';

export const ModelsTab = ({
  prices,
  txt,
  handleAddModel,
  handleSaveEditModel,
  handleDeleteModel,
  moveModel,
  handleModelsDisplayTypeChange,
}) => {
  const { canEdit } = useAuth();
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const [isEditModelDialogOpen, setIsEditModelDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
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
      <CardContent>
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
