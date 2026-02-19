import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Settings2, Trash2, Save, Download, Upload, ZoomIn, ZoomOut, Grid3X3, Pencil
} from 'lucide-react';

export const SettingsPanel = ({
  saunaModels,
  selectedModel,
  handleModelChange,
  selectedVariant,
  handleVariantChange,
  setUploadOutlineDialogOpen,
  gridSizeCm,
  setGridSizeCm,
  showGrid,
  setShowGrid,
  showDimensions,
  setShowDimensions,
  updateDimensionLabels,
  fabricRef,
  zoomLevel,
  handleZoom,
  resetZoom,
  clearCanvas,
  handleExportPNG,
  currentLayout,
  setSaveDialogOpen,
  setLayoutName,
}) => {
  return (
    <Card>
      <CardHeader className="py-2 px-3 border-b">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Настройки
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {/* Model selector */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Модель сауны</Label>
          <Select
            value={selectedModel?.id || ''}
            onValueChange={handleModelChange}
          >
            <SelectTrigger className="w-full h-8 text-xs" data-testid="model-selector">
              <SelectValue placeholder="Выберите модель..." />
            </SelectTrigger>
            <SelectContent>
              {saunaModels.map(model => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Variant selector */}
        {selectedModel?.variants?.length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Вариант</Label>
            <Select
              value={selectedVariant?.id || ''}
              onValueChange={handleVariantChange}
            >
              <SelectTrigger className="w-full h-8 text-xs" data-testid="variant-selector">
                <SelectValue placeholder="Вариант..." />
              </SelectTrigger>
              <SelectContent>
                {selectedModel.variants.map(variant => (
                  <SelectItem key={variant.id} value={variant.id}>
                    {variant.nameRu || variant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Outline upload button */}
        {selectedModel && (
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs"
            onClick={() => setUploadOutlineDialogOpen(true)}
            data-testid="upload-outline-button"
          >
            <Upload className="h-3 w-3 mr-1" />
            Загрузить контур
          </Button>
        )}
        
        <div className="border-t pt-3 space-y-2">
          {/* Grid controls */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">Сетка</Label>
            <div className="flex items-center gap-1">
              <Select
                value={gridSizeCm.toString()}
                onValueChange={(val) => setGridSizeCm(parseInt(val))}
              >
                <SelectTrigger className="w-16 h-7 text-xs" data-testid="grid-size-selector">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 см</SelectItem>
                  <SelectItem value="5">5 см</SelectItem>
                  <SelectItem value="10">10 см</SelectItem>
                  <SelectItem value="20">20 см</SelectItem>
                  <SelectItem value="50">50 см</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant={showGrid ? 'default' : 'outline'}
                className="h-7 w-7 p-0"
                onClick={() => setShowGrid(!showGrid)}
                title={showGrid ? 'Скрыть сетку' : 'Показать сетку'}
                data-testid="toggle-grid-button"
              >
                <Grid3X3 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          {/* Dimensions toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">Размеры</Label>
            <Button
              size="sm"
              variant={showDimensions ? 'default' : 'outline'}
              className="h-7 text-xs px-2"
              onClick={() => {
                setShowDimensions(!showDimensions);
                setTimeout(() => {
                  if (!showDimensions) {
                    updateDimensionLabels();
                  } else {
                    if (fabricRef.current) {
                      fabricRef.current.getObjects()
                        .filter(o => o.isDimensionLabel)
                        .forEach(o => fabricRef.current.remove(o));
                      fabricRef.current.renderAll();
                    }
                  }
                }, 0);
              }}
              data-testid="toggle-dimensions-button"
            >
              <Pencil className="h-3 w-3 mr-1" />
              {showDimensions ? 'Вкл' : 'Выкл'}
            </Button>
          </div>
          
          {/* Zoom controls */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">Масштаб</Label>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                onClick={() => handleZoom(-0.25)}
                data-testid="zoom-out-button"
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <span className="text-xs w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                onClick={() => handleZoom(0.25)}
                data-testid="zoom-in-button"
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-1 text-xs"
                onClick={resetZoom}
                data-testid="reset-zoom-button"
              >
                100%
              </Button>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="border-t pt-3 flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={clearCanvas} data-testid="clear-canvas-button">
            <Trash2 className="h-3 w-3 mr-1" />
            Очистить
          </Button>
          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={handleExportPNG} title="Экспорт PNG" data-testid="export-png-button">
            <Download className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={() => {
              if (selectedModel) {
                setLayoutName(currentLayout?.name || `${selectedModel.name}${selectedVariant ? ` - ${selectedVariant.nameRu || selectedVariant.name}` : ''} - Планировка`);
                setSaveDialogOpen(true);
              } else {
                import('sonner').then(({ toast }) => {
                  toast.error('Сначала выберите модель сауны');
                });
              }
            }}
            data-testid="save-layout-button"
          >
            <Save className="h-3 w-3 mr-1" />
            Сохранить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SettingsPanel;
