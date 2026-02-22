import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

const AddRoomDialog = ({ 
  open, 
  onOpenChange, 
  roomForm, 
  setRoomForm, 
  onAddRoom, 
  onAddPartition 
}) => {
  const innerWidth = roomForm.outerWidthCm - roomForm.wallLeftCm - roomForm.wallRightCm;
  const innerHeight = roomForm.outerHeightCm - roomForm.wallTopCm - roomForm.wallBottomCm;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {roomForm.isPartition ? 'Добавить перегородку' : 'Добавить комнату'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Toggle between room and partition */}
          <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
            <Button
              variant={!roomForm.isPartition ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRoomForm({ ...roomForm, isPartition: false })}
              className="flex-1"
            >
              Новая комната
            </Button>
            <Button
              variant={roomForm.isPartition ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRoomForm({ ...roomForm, isPartition: true })}
              className="flex-1"
            >
              Перегородка
            </Button>
          </div>
          
          {!roomForm.isPartition ? (
            /* Room dimensions with wall thickness */
            <>
              <div>
                <Label className="font-medium">Внешние размеры (см)</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Ширина</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="20"
                      value={roomForm.outerWidthCm}
                      onChange={(e) => setRoomForm({ ...roomForm, outerWidthCm: parseFloat(e.target.value) || 0 })}
                      placeholder="200"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Высота</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="20"
                      value={roomForm.outerHeightCm}
                      onChange={(e) => setRoomForm({ ...roomForm, outerHeightCm: parseFloat(e.target.value) || 0 })}
                      placeholder="150"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="font-medium">Толщина стен (см)</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Левая</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="50"
                      value={roomForm.wallLeftCm}
                      onChange={(e) => setRoomForm({ ...roomForm, wallLeftCm: parseFloat(e.target.value) || 4.4 })}
                      placeholder="4.4"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Правая</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="50"
                      value={roomForm.wallRightCm}
                      onChange={(e) => setRoomForm({ ...roomForm, wallRightCm: parseFloat(e.target.value) || 4.4 })}
                      placeholder="4.4"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Верхняя</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="50"
                      value={roomForm.wallTopCm}
                      onChange={(e) => setRoomForm({ ...roomForm, wallTopCm: parseFloat(e.target.value) || 4.4 })}
                      placeholder="4.4"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Нижняя</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="50"
                      value={roomForm.wallBottomCm}
                      onChange={(e) => setRoomForm({ ...roomForm, wallBottomCm: parseFloat(e.target.value) || 4.4 })}
                      placeholder="4.4"
                    />
                  </div>
                </div>
              </div>
              
              {/* Show calculated inner dimensions */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Label className="text-xs font-medium text-blue-700">Внутренние размеры (авто):</Label>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-sm font-bold text-blue-900">
                    {innerWidth.toFixed(1)} × {innerHeight.toFixed(1)} см
                  </span>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                На холсте будут показаны внешний и внутренний размеры комнаты
              </p>
            </>
          ) : (
            /* Partition settings */
            <>
              <div>
                <Label>Направление перегородки</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    variant={roomForm.partitionPosition === 'vertical' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRoomForm({ ...roomForm, partitionPosition: 'vertical' })}
                    className="flex-1"
                  >
                    │ Вертикальная
                  </Button>
                  <Button
                    variant={roomForm.partitionPosition === 'horizontal' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRoomForm({ ...roomForm, partitionPosition: 'horizontal' })}
                    className="flex-1"
                  >
                    ─ Горизонтальная
                  </Button>
                </div>
              </div>
              <div>
                <Label>
                  Отступ от {roomForm.partitionPosition === 'vertical' ? 'левого края' : 'верха'} (см)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  value={roomForm.partitionOffset}
                  onChange={(e) => setRoomForm({ ...roomForm, partitionOffset: parseFloat(e.target.value) || 0 })}
                  placeholder="50"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Перегородка разделит основную комнату на две части. 
                {roomForm.partitionPosition === 'vertical' 
                  ? ` Левая часть: ${roomForm.partitionOffset} см` 
                  : ` Верхняя часть: ${roomForm.partitionOffset} см`}
              </p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={roomForm.isPartition ? onAddPartition : onAddRoom}>
            Добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddRoomDialog;
