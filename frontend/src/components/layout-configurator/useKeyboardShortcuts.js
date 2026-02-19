import { useEffect, useCallback } from 'react';

/**
 * Hook for keyboard shortcuts in the layout configurator
 */
export const useKeyboardShortcuts = ({
  fabricRef,
  setActiveTool,
  setSelectedObject,
  handleUndo,
  deleteSelected,
  copySelected,
  pasteFromClipboard,
  groupSelected,
  ungroupSelected,
}) => {
  const handleKeyDown = useCallback((e) => {
    // Don't trigger shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    // Ctrl+Z - Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      handleUndo?.();
      return;
    }
    
    // Ctrl+C - Copy
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      copySelected?.();
      return;
    }
    
    // Ctrl+V - Paste
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault();
      pasteFromClipboard?.();
      return;
    }
    
    // Ctrl+G - Group
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'g') {
      e.preventDefault();
      groupSelected?.();
      return;
    }
    
    // Ctrl+Shift+G - Ungroup
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
      e.preventDefault();
      ungroupSelected?.();
      return;
    }
    
    // Delete or Backspace - Delete selected object
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelected?.();
      return;
    }
    
    // Escape - Deselect / Switch to select tool
    if (e.key === 'Escape') {
      e.preventDefault();
      setActiveTool?.('select');
      if (fabricRef?.current) {
        fabricRef.current.discardActiveObject();
        fabricRef.current.renderAll();
      }
      setSelectedObject?.(null);
      return;
    }
    
    // Tool shortcuts (only when not using Ctrl/Cmd)
    if (!e.ctrlKey && !e.metaKey) {
      const keyLower = e.key.toLowerCase();
      if (keyLower === 'v') {
        setActiveTool?.('select');
      } else if (keyLower === 'r') {
        setActiveTool?.('rectangle');
      } else if (keyLower === 'l') {
        setActiveTool?.('wall');
      } else if (keyLower === 'm') {
        setActiveTool?.('ruler');
      } else if (keyLower === 't') {
        setActiveTool?.('text');
      } else if (keyLower === 'g') {
        // G without Ctrl - just group
        groupSelected?.();
      }
    }
  }, [
    fabricRef,
    setActiveTool,
    setSelectedObject,
    handleUndo,
    deleteSelected,
    copySelected,
    pasteFromClipboard,
    groupSelected,
    ungroupSelected,
  ]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

export default useKeyboardShortcuts;
