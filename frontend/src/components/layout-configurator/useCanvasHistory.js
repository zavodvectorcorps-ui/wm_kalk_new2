import { useState, useRef, useCallback } from 'react';

const MAX_HISTORY = 30;

/**
 * Hook for managing canvas undo/redo history
 */
export const useCanvasHistory = (fabricRef) => {
  const [canvasHistory, setCanvasHistory] = useState([]);
  const isRestoringRef = useRef(false);
  
  const saveToHistory = useCallback(() => {
    if (!fabricRef.current || isRestoringRef.current) return;
    
    const json = JSON.stringify(fabricRef.current.toJSON([
      'elementId', 'elementType', 'isDrawnShape', 'isRuler', 'isModelOutline',
      'showDimensions', 'strokeWidthCm', 'isGridLine', 'isDimensionLabel',
      'rulerLength', 'rulerLengthCm', 'isGroup'
    ]));
    
    setCanvasHistory(prev => {
      const newHistory = [...prev, json];
      // Keep only last MAX_HISTORY states
      if (newHistory.length > MAX_HISTORY) {
        return newHistory.slice(-MAX_HISTORY);
      }
      return newHistory;
    });
  }, [fabricRef]);
  
  const handleUndo = useCallback(() => {
    if (!fabricRef.current || canvasHistory.length <= 1) return;
    
    isRestoringRef.current = true;
    
    // Get previous state (not current)
    const newHistory = [...canvasHistory];
    newHistory.pop(); // Remove current state
    const previousState = newHistory[newHistory.length - 1];
    
    if (previousState) {
      // Clear canvas except grid
      const canvas = fabricRef.current;
      const gridLines = canvas.getObjects().filter(o => o.isGridLine);
      canvas.clear();
      gridLines.forEach(line => canvas.add(line));
      
      // Load previous state
      canvas.loadFromJSON(previousState, () => {
        canvas.renderAll();
        setCanvasHistory(newHistory);
        isRestoringRef.current = false;
      });
    } else {
      isRestoringRef.current = false;
    }
  }, [canvasHistory, fabricRef]);
  
  const clearHistory = useCallback(() => {
    setCanvasHistory([]);
  }, []);
  
  return {
    canvasHistory,
    saveToHistory,
    handleUndo,
    clearHistory,
    isRestoringRef,
  };
};

export default useCanvasHistory;
