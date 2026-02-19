import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';
import {
  Settings2, Trash2, Save, RotateCw, RotateCcw, ZoomIn, ZoomOut, Move
} from 'lucide-react';
import { ELEMENT_TYPES } from './constants';

export const PropertiesPanel = ({
  selectedObject,
  fabricRef,
  pixelsPerCm,
  handleObjectSelected,
  updateDimensionLabels,
  toggleObjectDimensions,
  rotateSelected,
  scaleSelected,
  deleteSelected,
  setShowSaveOutlineDialog,
  selectedModel,
  modelOutline,
}) => {
  return (
    <Card className="h-full overflow-auto">
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Свойства
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {selectedObject ? (
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Тип</Label>
              <div className="flex items-center gap-2 mt-1">
                <span>{ELEMENT_TYPES[selectedObject.type]?.icon}</span>
                <span className="text-sm">{ELEMENT_TYPES[selectedObject.type]?.name || selectedObject.type}</span>
              </div>
            </div>
            
            {/* Dimensions for drawn shapes - in CM with editable inputs */}
            {selectedObject.isDrawnShape && selectedObject.widthCm && selectedObject.heightCm && (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-medium">Ширина:</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={selectedObject.widthCm}
                      onChange={(e) => {
                        const obj = fabricRef.current?.getActiveObject();
                        if (obj && obj.type === 'rect') {
                          const newWidthCm = parseFloat(e.target.value) || 1;
                          const newWidthPx = newWidthCm * pixelsPerCm;
                          obj.set({ width: newWidthPx, scaleX: 1 });
                          obj.setCoords();
                          fabricRef.current.renderAll();
                          handleObjectSelected({ selected: [obj] });
                          updateDimensionLabels();
                        }
                      }}
                      className="w-20 h-7 text-xs"
                      data-testid="width-input"
                    />
                    <span className="text-xs text-muted-foreground">см</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-medium">Высота:</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={selectedObject.heightCm}
                      onChange={(e) => {
                        const obj = fabricRef.current?.getActiveObject();
                        if (obj && obj.type === 'rect') {
                          const newHeightCm = parseFloat(e.target.value) || 1;
                          const newHeightPx = newHeightCm * pixelsPerCm;
                          obj.set({ height: newHeightPx, scaleY: 1 });
                          obj.setCoords();
                          fabricRef.current.renderAll();
                          handleObjectSelected({ selected: [obj] });
                          updateDimensionLabels();
                        }
                      }}
                      className="w-20 h-7 text-xs"
                      data-testid="height-input"
                    />
                    <span className="text-xs text-muted-foreground">см</span>
                  </div>
                </div>
              </div>
            )}
            
            {selectedObject.isDrawnShape && selectedObject.lengthCm && (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-medium">Длина:</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={selectedObject.lengthCm}
                      onChange={(e) => {
                        const obj = fabricRef.current?.getActiveObject();
                        if (obj && obj.type === 'line') {
                          const newLengthCm = parseFloat(e.target.value) || 1;
                          const newLengthPx = newLengthCm * pixelsPerCm;
                          const dx = (obj.x2 || 0) - (obj.x1 || 0);
                          const dy = (obj.y2 || 0) - (obj.y1 || 0);
                          const currentLength = Math.sqrt(dx * dx + dy * dy) || 1;
                          const ratio = newLengthPx / currentLength;
                          obj.set({
                            x2: obj.x1 + dx * ratio,
                            y2: obj.y1 + dy * ratio,
                          });
                          obj.setCoords();
                          fabricRef.current.renderAll();
                          handleObjectSelected({ selected: [obj] });
                          updateDimensionLabels();
                        }
                      }}
                      className="w-20 h-7 text-xs"
                      data-testid="length-input"
                    />
                    <span className="text-xs text-muted-foreground">см</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Shape color controls */}
            {selectedObject.isDrawnShape && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Цвет:</Label>
                  <input
                    type="color"
                    value={selectedObject.stroke || '#374151'}
                    onChange={(e) => {
                      const obj = fabricRef.current?.getActiveObject();
                      if (obj) {
                        obj.set('stroke', e.target.value);
                        fabricRef.current.renderAll();
                        handleObjectSelected({ selected: [obj] });
                      }
                    }}
                    className="w-8 h-6 rounded cursor-pointer"
                    data-testid="object-color-picker"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Толщина:</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="50"
                    value={selectedObject.strokeWidthCm || 4}
                    onChange={(e) => {
                      const obj = fabricRef.current?.getActiveObject();
                      if (obj) {
                        const cmValue = parseFloat(e.target.value) || 1;
                        obj.set('strokeWidth', cmValue * pixelsPerCm);
                        obj.set('strokeWidthCm', cmValue);
                        fabricRef.current.renderAll();
                        handleObjectSelected({ selected: [obj] });
                      }
                    }}
                    className="w-16 h-7 text-xs"
                    data-testid="object-stroke-width"
                  />
                  <span className="text-xs text-muted-foreground">см</span>
                </div>
                {/* Show dimensions toggle for this object */}
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <Label className="text-xs cursor-pointer" htmlFor="show-dims-toggle">
                    Показать размеры
                  </Label>
                  <Switch
                    id="show-dims-toggle"
                    checked={selectedObject.showDimensions}
                    onCheckedChange={(checked) => toggleObjectDimensions(checked)}
                    data-testid="show-dimensions-toggle"
                  />
                </div>
              </div>
            )}
            
            {/* Distances to room walls */}
            {selectedObject.distances && (
              <div className="p-2 bg-green-50 border border-green-200 rounded text-xs space-y-1">
                <Label className="text-xs font-medium">Расстояние до стен:</Label>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  <div className="flex justify-between">
                    <span>← Лево:</span>
                    <span className="font-medium">{selectedObject.distances.leftWall} см</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Право →:</span>
                    <span className="font-medium">{selectedObject.distances.rightWall} см</span>
                  </div>
                  <div className="flex justify-between">
                    <span>↑ Верх:</span>
                    <span className="font-medium">{selectedObject.distances.topWall} см</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Низ ↓:</span>
                    <span className="font-medium">{selectedObject.distances.bottomWall} см</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">X (см)</Label>
                <Input
                  type="number"
                  value={selectedObject.xCm}
                  onChange={(e) => {
                    const obj = fabricRef.current?.getActiveObject();
                    if (obj) {
                      obj.set('left', parseFloat(e.target.value || 0) * pixelsPerCm);
                      fabricRef.current.renderAll();
                      handleObjectSelected({ selected: [obj] });
                    }
                  }}
                  className="h-7 text-xs"
                  data-testid="x-position-input"
                />
              </div>
              <div>
                <Label className="text-xs">Y (см)</Label>
                <Input
                  type="number"
                  value={selectedObject.yCm}
                  onChange={(e) => {
                    const obj = fabricRef.current?.getActiveObject();
                    if (obj) {
                      obj.set('top', parseFloat(e.target.value || 0) * pixelsPerCm);
                      fabricRef.current.renderAll();
                      handleObjectSelected({ selected: [obj] });
                    }
                  }}
                  className="h-7 text-xs"
                  data-testid="y-position-input"
                />
              </div>
            </div>
            
            <div>
              <Label className="text-xs">Поворот: {selectedObject.rotation}°</Label>
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => rotateSelected(-90)} data-testid="rotate-ccw-90">
                  <RotateCcw className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => rotateSelected(-15)} data-testid="rotate-ccw-15">
                  -15°
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => rotateSelected(15)} data-testid="rotate-cw-15">
                  +15°
                </Button>
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => rotateSelected(90)} data-testid="rotate-cw-90">
                  <RotateCw className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div>
              <Label className="text-xs">Масштаб: {(selectedObject.scale * 100).toFixed(0)}%</Label>
              <div className="flex items-center gap-2 mt-1">
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => scaleSelected(-0.1)} data-testid="scale-down">
                  <ZoomOut className="h-3 w-3" />
                </Button>
                <Slider
                  value={[selectedObject.scale * 100]}
                  min={10}
                  max={300}
                  step={5}
                  onValueChange={([val]) => {
                    const obj = fabricRef.current?.getActiveObject();
                    if (obj) {
                      obj.scale(val / 100);
                      fabricRef.current.renderAll();
                      handleObjectSelected({ selected: [obj] });
                    }
                  }}
                  className="flex-1"
                  data-testid="scale-slider"
                />
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => scaleSelected(0.1)} data-testid="scale-up">
                  <ZoomIn className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div className="pt-2 border-t space-y-2">
              {/* Save as outline button (for rectangles) */}
              {selectedObject?.isDrawnShape && selectedObject?.type === 'rect' && selectedModel && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowSaveOutlineDialog(true)}
                  data-testid="save-as-outline-button"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Сохранить как контур
                </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                className="w-full"
                onClick={deleteSelected}
                data-testid="delete-object-button"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Удалить
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <Move className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Выберите элемент</p>
          </div>
        )}
        
        {/* Model outline info */}
        {modelOutline && (
          <div className="mt-4 pt-4 border-t">
            <Label className="text-xs font-medium">Размеры сауны</Label>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Внешние:</span>
                <span>{modelOutline.outerLength} × {modelOutline.outerWidth} см</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Внутренние:</span>
                <span>{modelOutline.innerLength} × {modelOutline.innerWidth} см</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Стена:</span>
                <span>{modelOutline.wallThickness} см</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Масштаб:</span>
                <span>{modelOutline.pixelsPerCm?.toFixed(2)} px/см</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PropertiesPanel;
