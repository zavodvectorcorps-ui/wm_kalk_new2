import { useCallback, useRef } from 'react';

/**
 * Hook for copy/paste and group/ungroup functionality
 */
export const useClipboard = (fabricRef, updateDimensionLabels, saveToHistory) => {
  const clipboardRef = useRef(null);
  
  const copySelected = useCallback(() => {
    if (!fabricRef.current) return;
    const activeObject = fabricRef.current.getActiveObject();
    if (!activeObject) {
      return false;
    }
    
    // Clone the object(s) to clipboard
    activeObject.clone((cloned) => {
      clipboardRef.current = cloned;
    });
    return true;
  }, [fabricRef]);
  
  const pasteFromClipboard = useCallback(() => {
    if (!fabricRef.current || !clipboardRef.current) {
      return false;
    }
    
    clipboardRef.current.clone((clonedObj) => {
      fabricRef.current.discardActiveObject();
      
      // Offset pasted object slightly
      clonedObj.set({
        left: clonedObj.left + 20,
        top: clonedObj.top + 20,
        evented: true,
      });
      
      if (clonedObj.type === 'activeSelection') {
        // Handle group paste
        clonedObj.canvas = fabricRef.current;
        clonedObj.forEachObject((obj) => {
          obj.set({
            elementId: `pasted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            selectable: true,
            evented: true,
          });
          fabricRef.current.add(obj);
        });
        clonedObj.setCoords();
      } else {
        // Single object paste
        clonedObj.set({
          elementId: `pasted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          selectable: true,
          evented: true,
        });
        fabricRef.current.add(clonedObj);
      }
      
      // Update clipboard for next paste (offset further)
      clipboardRef.current.top += 20;
      clipboardRef.current.left += 20;
      
      fabricRef.current.setActiveObject(clonedObj);
      fabricRef.current.requestRenderAll();
      if (updateDimensionLabels) updateDimensionLabels();
      if (saveToHistory) saveToHistory();
    });
    return true;
  }, [fabricRef, updateDimensionLabels, saveToHistory]);

  const groupSelected = useCallback(() => {
    if (!fabricRef.current) return false;
    const activeObject = fabricRef.current.getActiveObject();
    
    if (!activeObject || activeObject.type !== 'activeSelection') {
      return false;
    }
    
    // Create a group from the active selection
    const group = activeObject.toGroup();
    group.set({
      elementId: `group_${Date.now()}`,
      elementType: 'group',
      isGroup: true,
      selectable: true,
      evented: true,
    });
    
    fabricRef.current.requestRenderAll();
    if (saveToHistory) saveToHistory();
    return true;
  }, [fabricRef, saveToHistory]);
  
  const ungroupSelected = useCallback(() => {
    if (!fabricRef.current) return false;
    const activeObject = fabricRef.current.getActiveObject();
    
    if (!activeObject || activeObject.type !== 'group') {
      return false;
    }
    
    // Ungroup
    activeObject.toActiveSelection();
    fabricRef.current.requestRenderAll();
    if (saveToHistory) saveToHistory();
    return true;
  }, [fabricRef, saveToHistory]);
  
  return {
    clipboardRef,
    copySelected,
    pasteFromClipboard,
    groupSelected,
    ungroupSelected,
  };
};

export default useClipboard;
