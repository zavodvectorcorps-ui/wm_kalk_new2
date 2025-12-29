import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '../ui/dialog';

export const AddModelDialog = ({ open, onOpenChange, newModel, setNewModel, onAdd, txt }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
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
        <div>
          <Label>{txt.imageUrl}</Label>
          <Input
            value={newModel.imageUrl}
            onChange={(e) => setNewModel(prev => ({ ...prev, imageUrl: e.target.value }))}
            placeholder={txt.imageUrlHint}
          />
          {newModel.imageUrl && (
            <div className="mt-2">
              <Label className="text-xs text-muted-foreground">{txt.previewImage}:</Label>
              <img 
                src={newModel.imageUrl} 
                alt="Preview" 
                className="mt-1 w-full max-h-32 object-contain rounded border bg-muted/50"
                onError={(e) => e.target.style.display = 'none'}
              />
            </div>
          )}
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

export const EditModelDialog = ({ open, onOpenChange, editingModel, setEditingModel, onSave, txt }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg">
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
          <div>
            <Label>{txt.imageUrl}</Label>
            <Input
              value={editingModel.imageUrl || ''}
              onChange={(e) => setEditingModel(prev => ({ ...prev, imageUrl: e.target.value }))}
              placeholder={txt.imageUrlHint}
            />
            {editingModel.imageUrl && (
              <div className="mt-2">
                <Label className="text-xs text-muted-foreground">{txt.previewImage}:</Label>
                <img 
                  src={editingModel.imageUrl} 
                  alt="Preview" 
                  className="mt-1 w-full max-h-40 object-contain rounded border bg-muted/50"
                  onError={(e) => e.target.style.display = 'none'}
                />
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
