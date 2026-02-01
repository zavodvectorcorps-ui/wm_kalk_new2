import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from './constants';

/**
 * Hook for managing layout catalog selection.
 * Handles fetching layout variants and managing selection state.
 */
export const useLayoutCatalog = () => {
  const [selectedLayoutSize, setSelectedLayoutSize] = useState(null);
  const [selectedLayoutId, setSelectedLayoutId] = useState(null);
  const [layoutVariants, setLayoutVariants] = useState([]);
  const [layoutLoading, setLayoutLoading] = useState(false);

  // Load layout variants for catalog
  useEffect(() => {
    const fetchLayoutVariants = async () => {
      setLayoutLoading(true);
      try {
        const response = await axios.get(`${API_URL}/api/faq/layout-variants`);
        setLayoutVariants(response.data || []);
      } catch (error) {
        console.error('Failed to load layout variants:', error);
      } finally {
        setLayoutLoading(false);
      }
    };
    fetchLayoutVariants();
  }, []);

  // Handler for layout catalog selection
  const handleLayoutSelect = useCallback((size, layoutId) => {
    setSelectedLayoutSize(size);
    setSelectedLayoutId(layoutId);
  }, []);

  // Clear layout selection
  const clearLayoutSelection = useCallback(() => {
    setSelectedLayoutSize(null);
    setSelectedLayoutId(null);
  }, []);

  // Get selected layout data
  const getSelectedLayout = useCallback(() => {
    if (!selectedLayoutId || layoutVariants.length === 0) return null;
    
    return layoutVariants.find(l => 
      (l._id === selectedLayoutId || l.id === selectedLayoutId)
    );
  }, [selectedLayoutId, layoutVariants]);

  // Get other layouts for the same size (for PDF page 2)
  const getOtherLayoutsForSize = useCallback(() => {
    if (!selectedLayoutSize || layoutVariants.length === 0) return [];
    
    return layoutVariants
      .filter(l => l.modelSize === selectedLayoutSize && (l._id !== selectedLayoutId && l.id !== selectedLayoutId))
      .map(l => ({
        id: l._id || l.id,
        name: l.variantName,
        imageUrl: l.imageUrl,
        description: l.description,
        peopleCount: l.peopleCount,
        terraceSize: l.terraceSize,
        relaxRoomSize: l.relaxRoomSize,
        steamRoomSize: l.steamRoomSize,
        entranceSide: l.entranceSide,
      }));
  }, [selectedLayoutSize, selectedLayoutId, layoutVariants]);

  // Get layouts grouped by size
  const getLayoutsBySize = useCallback(() => {
    const grouped = {};
    layoutVariants.forEach(layout => {
      const size = layout.modelSize || 'Другие';
      if (!grouped[size]) {
        grouped[size] = [];
      }
      grouped[size].push(layout);
    });
    return grouped;
  }, [layoutVariants]);

  return {
    // State
    selectedLayoutSize,
    selectedLayoutId,
    layoutVariants,
    layoutLoading,
    
    // Actions
    handleLayoutSelect,
    clearLayoutSelection,
    
    // Getters
    getSelectedLayout,
    getOtherLayoutsForSize,
    getLayoutsBySize,
  };
};

export default useLayoutCatalog;
