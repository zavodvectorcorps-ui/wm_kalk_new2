import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Undo2 } from 'lucide-react';
import { DRAWING_TOOLS } from './constants';

export const DrawingToolbar = ({
  activeTool,
  setActiveTool,
  canvasHistory,
  handleUndo,
  drawingColor,
  setDrawingColor,
  drawingStrokeWidthCm,
  setDrawingStrokeWidthCm,
  drawingFill,
  setDrawingFill,
}) => {
  return (
    <div className="flex items-center justify-center gap-4 flex-wrap">
      {/* Undo button */}
      <Button
        size="sm"
        variant="outline"
        className="h-8 px-3"
        onClick={handleUndo}
        disabled={canvasHistory.length <= 1}
        title="Отменить (Ctrl+Z)"
        data-testid="undo-button"
      >
        <Undo2 className="h-4 w-4 mr-1" />
        Отмена
      </Button>
      
      <div className="h-6 w-px bg-border" />
      
      {/* Drawing Tools */}
      <div className="flex items-center gap-1 bg-muted rounded-md p-1" data-testid="drawing-tools">
        {Object.entries(DRAWING_TOOLS).map(([toolId, tool]) => {
          const Icon = tool.icon;
          return (
            <Button
              key={toolId}
              size="sm"
              variant={activeTool === toolId ? 'default' : 'ghost'}
              className="h-8 w-8 p-0"
              onClick={() => setActiveTool(toolId)}
              title={`${tool.name} (${tool.shortcut})`}
              data-testid={`tool-${toolId}`}
            >
              <Icon className="h-4 w-4" />
            </Button>
          );
        })}
      </div>
      
      {/* Drawing options (when drawing tool is active and not ruler) */}
      {activeTool !== 'select' && activeTool !== 'ruler' && activeTool !== 'text' && (
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={drawingColor}
            onChange={(e) => setDrawingColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border"
            title="Цвет"
            data-testid="color-picker"
          />
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Толщина:</span>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              max="20"
              value={drawingStrokeWidthCm}
              onChange={(e) => setDrawingStrokeWidthCm(parseFloat(e.target.value) || 1)}
              className="w-16 h-8 text-xs"
              data-testid="stroke-width-input"
            />
            <span className="text-xs text-muted-foreground">см</span>
          </div>
          {activeTool === 'rectangle' && (
            <Button
              size="sm"
              variant={drawingFill !== 'transparent' ? 'default' : 'outline'}
              className="h-8 text-xs"
              onClick={() => setDrawingFill(drawingFill === 'transparent' ? drawingColor + '20' : 'transparent')}
              data-testid="fill-toggle"
            >
              Заливка
            </Button>
          )}
        </div>
      )}
      
      {/* Tool hints */}
      {activeTool === 'ruler' && (
        <div className="text-xs text-muted-foreground">
          Нарисуйте линию для измерения расстояния
        </div>
      )}
      
      {activeTool === 'text' && (
        <div className="text-xs text-muted-foreground">
          Кликните на холст чтобы добавить текст
        </div>
      )}
      
      <div className="h-6 w-px bg-border hidden md:block" />
      
      {/* Keyboard shortcuts hint */}
      <div className="text-xs text-muted-foreground hidden lg:block">
        Ctrl+Z: Отмена | Del: Удалить | Esc: Снять выделение
      </div>
    </div>
  );
};

export default DrawingToolbar;
