import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from './constants';

/**
 * Hook for managing layout catalog selection.
 * Handles fetching layout variants and managing selection state.
 * Also supports custom layout image uploads and filtering by model variant.
 */
export const useLayoutCatalog = (selectedModelVariantId = null) => {
  const [selectedLayoutSize, setSelectedLayoutSize] = useState(null);
  const [selectedLayoutId, setSelectedLayoutId] = useState(null);
  const [allLayoutVariants, setAllLayoutVariants] = useState([]);  // All variants from API
  const [layoutLoading, setLayoutLoading] = useState(false);
  
  // Custom uploaded layout image state
  const [customLayoutImage, setCustomLayoutImage] = useState(null); // { url, file, preview }
  const [customLayoutUploading, setCustomLayoutUploading] = useState(false);

  // Load layout variants for catalog
  useEffect(() => {
    const fetchLayoutVariants = async () => {
      setLayoutLoading(true);
      try {
        // Fetch from both sources: FAQ variants and Configurator layouts
        const [faqResponse, configuratorResponse] = await Promise.allSettled([
          axios.get(`${API_URL}/api/faq/layout-variants`),
          axios.get(`${API_URL}/api/layout-configurator/published-layouts`)
        ]);
        
        // Combine results
        const faqVariants = faqResponse.status === 'fulfilled' 
          ? (faqResponse.value.data || []).map(v => ({ ...v, source: 'faq' }))
          : [];
        
        const configuratorLayouts = configuratorResponse.status === 'fulfilled'
          ? (configuratorResponse.value.data || []).map(layout => ({
              _id: layout.id,
              id: layout.id,
              variantName: layout.name,
              nameRu: layout.nameRu,
              modelSize: layout.modelSize,
              capacity: layout.capacity,
              description: layout.description,
              descriptionRu: layout.descriptionRu,
              imageUrl: layout.imageUrl,
              source: 'configurator',
              modelVariantIds: [], // Available for all variants
            }))
          : [];
        
        // Combine and sort: configurator layouts first, then FAQ
        const combined = [...configuratorLayouts, ...faqVariants];
        setAllLayoutVariants(combined);
      } catch (error) {
        console.error('Failed to load layout variants:', error);
      } finally {
        setLayoutLoading(false);
      }
    };
    fetchLayoutVariants();
  }, []);

  // Filter layout variants by selected model variant
  // If modelVariantIds is empty/null - show to all (backwards compatible)
  // If modelVariantIds has values - only show if current variant is in the list
  const layoutVariants = useMemo(() => {
    if (!selectedModelVariantId) {
      return allLayoutVariants;
    }
    
    return allLayoutVariants.filter(layout => {
      const variantIds = layout.modelVariantIds || [];
      // Empty list means compatible with all variants
      if (variantIds.length === 0) {
        return true;
      }
      // Check if current variant is in the list
      return variantIds.includes(selectedModelVariantId);
    });
  }, [allLayoutVariants, selectedModelVariantId]);

  // Clear selection when model variant changes and selected layout is no longer available
  useEffect(() => {
    if (selectedLayoutId && layoutVariants.length > 0) {
      const stillAvailable = layoutVariants.some(l => 
        l._id === selectedLayoutId || l.id === selectedLayoutId
      );
      if (!stillAvailable) {
        setSelectedLayoutId(null);
      }
    }
  }, [layoutVariants, selectedLayoutId]);

  // Handler for layout catalog selection
  const handleLayoutSelect = useCallback((size, layoutId) => {
    setSelectedLayoutSize(size);
    setSelectedLayoutId(layoutId);
    // Clear custom image when selecting a layout from catalog
    if (layoutId) {
      setCustomLayoutImage(null);
    }
  }, []);

  // Clear layout selection
  const clearLayoutSelection = useCallback(() => {
    setSelectedLayoutSize(null);
    setSelectedLayoutId(null);
    setCustomLayoutImage(null);
  }, []);

  // Upload custom layout image
  const uploadCustomLayoutImage = useCallback(async (file) => {
    if (!file) return null;
    
    setCustomLayoutUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API_URL}/api/upload/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const uploadedUrl = response.data.url;
      const preview = URL.createObjectURL(file);
      
      const customImage = {
        url: uploadedUrl,
        file: file,
        preview: preview
      };
      
      setCustomLayoutImage(customImage);
      // Clear catalog selection when uploading custom image
      setSelectedLayoutId(null);
      
      return customImage;
    } catch (error) {
      console.error('Failed to upload custom layout image:', error);
      throw error;
    } finally {
      setCustomLayoutUploading(false);
    }
  }, []);

  // Remove custom layout image
  const removeCustomLayoutImage = useCallback(() => {
    if (customLayoutImage?.preview) {
      URL.revokeObjectURL(customLayoutImage.preview);
    }
    setCustomLayoutImage(null);
  }, [customLayoutImage]);

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
    customLayoutImage,
    customLayoutUploading,
    
    // Actions
    handleLayoutSelect,
    clearLayoutSelection,
    uploadCustomLayoutImage,
    removeCustomLayoutImage,
    
    // Getters
    getSelectedLayout,
    getOtherLayoutsForSize,
    getLayoutsBySize,
  };
};

export default useLayoutCatalog;
