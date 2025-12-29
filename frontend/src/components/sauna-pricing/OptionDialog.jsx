import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '../ui/dialog';

export const AddOptionDialog = ({ open, onOpenChange, newOption, setNewOption, categories, onAdd, txt }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
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

export const EditOptionDialog = ({ open, onOpenChange, editingOption, setEditingOption, onSave, txt }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg">
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
