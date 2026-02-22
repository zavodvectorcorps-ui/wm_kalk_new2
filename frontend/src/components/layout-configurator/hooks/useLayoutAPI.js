import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { API_URL, DEFAULT_UPLOAD_FORM } from '../constants';

/**
 * Custom hook for layout configurator API calls
 */
export const useLayoutAPI = () => {
  const [saunaModels, setSaunaModels] = useState([]);
  const [assets, setAssets] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch sauna models
  const fetchSaunaModels = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/layout-configurator/sauna-models`);
      const data = await res.json();
      setSaunaModels(data.models || []);
    } catch (error) {
      console.error('Error fetching sauna models:', error);
    }
  }, []);

  // Fetch assets
  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/layout-configurator/assets`);
      const data = await res.json();
      setAssets(data.assets || []);
    } catch (error) {
      console.error('Error fetching assets:', error);
    }
  }, []);

  // Fetch layouts
  const fetchLayouts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/layout-configurator/layouts`);
      const data = await res.json();
      setLayouts(data.layouts || []);
    } catch (error) {
      console.error('Error fetching layouts:', error);
    }
  }, []);

  // Fetch outline for model
  const fetchOutline = useCallback(async (modelId, variantId = null) => {
    try {
      let url = `${API_URL}/api/layout-configurator/outlines/${modelId}`;
      if (variantId) {
        url += `?variant_id=${variantId}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (error) {
      console.error('Error fetching outline:', error);
      return null;
    }
  }, []);

  // Upload asset
  const uploadAsset = useCallback(async (uploadForm) => {
    if (!uploadForm.file || !uploadForm.name || !uploadForm.type) {
      toast.error('Заполните все обязательные поля');
      return false;
    }
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('name', uploadForm.name);
      formData.append('nameRu', uploadForm.name);
      formData.append('type', uploadForm.type);
      if (uploadForm.modelId) {
        formData.append('modelId', uploadForm.modelId);
      }
      if (uploadForm.widthCm) {
        formData.append('widthCm', uploadForm.widthCm);
      }
      if (uploadForm.heightCm) {
        formData.append('heightCm', uploadForm.heightCm);
      }
      if (uploadForm.fixedHeight) {
        formData.append('fixedHeight', 'true');
      }
      
      const res = await fetch(`${API_URL}/api/layout-configurator/assets`, {
        method: 'POST',
        body: formData,
      });
      
      if (res.ok) {
        toast.success('Элемент загружен!');
        await fetchAssets();
        setLoading(false);
        return true;
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Ошибка загрузки');
        setLoading(false);
        return false;
      }
    } catch (error) {
      toast.error('Ошибка при загрузке');
      setLoading(false);
      return false;
    }
  }, [fetchAssets]);

  // Delete asset
  const deleteAsset = useCallback(async (assetId) => {
    try {
      const res = await fetch(`${API_URL}/api/layout-configurator/assets/${assetId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Элемент удалён');
        await fetchAssets();
        return true;
      }
      return false;
    } catch (error) {
      toast.error('Ошибка при удалении');
      return false;
    }
  }, [fetchAssets]);

  // Save layout
  const saveLayout = useCallback(async (layoutData) => {
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(layoutData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
        }
      });
      
      const res = await fetch(`${API_URL}/api/layout-configurator/layouts`, {
        method: 'POST',
        body: formData,
      });
      
      if (res.ok) {
        const saved = await res.json();
        toast.success('Планировка сохранена!');
        await fetchLayouts();
        setLoading(false);
        return saved;
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Ошибка сохранения');
        setLoading(false);
        return null;
      }
    } catch (error) {
      toast.error('Ошибка при сохранении');
      setLoading(false);
      return null;
    }
  }, [fetchLayouts]);

  // Delete layout
  const deleteLayout = useCallback(async (layoutId) => {
    try {
      const res = await fetch(`${API_URL}/api/layout-configurator/layouts/${layoutId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Планировка удалена');
        await fetchLayouts();
        return true;
      }
      return false;
    } catch (error) {
      toast.error('Ошибка при удалении');
      return false;
    }
  }, [fetchLayouts]);

  return {
    saunaModels,
    assets,
    layouts,
    loading,
    setLoading,
    fetchSaunaModels,
    fetchAssets,
    fetchLayouts,
    fetchOutline,
    uploadAsset,
    deleteAsset,
    saveLayout,
    deleteLayout,
  };
};

export default useLayoutAPI;
