import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { MAX_HISTORY, CANVAS_SERIALIZE_PROPS } from '../constants';

/**
 * Custom hook for canvas undo/redo functionality
 */
export const useCanvasHistory = (fabricRef, drawGrid) => {
  const [canvasHistory, setCanvasHistory] = useState([]);
  const isUndoing = useRef(false);

  // Save current canvas state to history
  const saveToHistory = useCallback(() => {
    if (!fabricRef.current || isUndoing.current) return;
    
    const canvas = fabricRef.current;
    
    // Get only user-created objects (exclude grid and labels)
    const userObjects = canvas.getObjects().filter(obj => 
      !obj.isGridLine && !obj.isGridLabel && !obj.isDimensionLabel
    );
    
    // Create a temporary canvas state with only user objects
    const tempCanvas = {
      version: '5.3.0',
      objects: userObjects.map(obj => obj.toObject(CANVAS_SERIALIZE_PROPS)),
      background: canvas.backgroundColor,
    };
    
    const stateStr = JSON.stringify(tempCanvas);
    
    setCanvasHistory(prev => {
      // Don't save duplicate states
      if (prev.length > 0 && prev[prev.length - 1] === stateStr) {
        return prev;
      }
      const newHistory = [...prev, stateStr];
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
      }
      return newHistory;
    });
  }, [fabricRef]);
  
  // Undo last action
  const handleUndo = useCallback(() => {
    if (canvasHistory.length <= 1 || !fabricRef.current) {
      toast.info('Нечего отменять');
      return;
    }
    
    isUndoing.current = true;
    const canvas = fabricRef.current;
    
    // Get previous state (second to last)
    const newHistory = canvasHistory.slice(0, -1);
    const previousStateStr = newHistory[newHistory.length - 1];
    
    if (previousStateStr) {
      const previousState = JSON.parse(previousStateStr);
      
      // Clear entire canvas
      canvas.clear();
      canvas.backgroundColor = '#f8fafc';
      
      // Load objects from previous state
      canvas.loadFromJSON(previousState, () => {
        // Redraw grid
        if (drawGrid) drawGrid();
        
        // Re-apply interactivity settings
        canvas.getObjects().forEach(obj => {
          if (obj.isGridLine || obj.isGridLabel || obj.isDimensionLabel) {
            obj.selectable = false;
            obj.evented = false;
          } else {
            obj.selectable = true;
            obj.evented = true;
            obj.hoverCursor = 'move';
          }
        });
        
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        
        isUndoing.current = false;
        toast.success('Действие отменено');
      });
    } else {
      isUndoing.current = false;
    }
    
    setCanvasHistory(newHistory);
  }, [canvasHistory, fabricRef, drawGrid]);

  return {
    canvasHistory,
    saveToHistory,
    handleUndo,
    isUndoing,
  };
};

export default useCanvasHistory;
