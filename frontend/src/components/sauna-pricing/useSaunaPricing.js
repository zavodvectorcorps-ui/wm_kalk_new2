import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';
import { setSyncStatus, clearSyncStatus } from '../../utils/syncStatus';

// Smart API URL - auto-detect on production
const getApiUrl = () => { 
  if (typeof window !== 'undefined') { 
    const o = window.location.origin; 
    if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o; 
  } 
  return process.env.REACT_APP_BACKEND_URL || ''; 
};
const API_URL = getApiUrl();

export const useSaunaPricing = () => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prices, setPrices] = useState({ models: [], categories: [] });
  const [techSpecCategories, setTechSpecCategories] = useState([]);
  // Auto-save: tracks the JSON snapshot of the last persisted prices, plus a
  // 4-state status the page surfaces as a badge next to the manual Save button.
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // idle | pending | saving | saved | error
  const lastSavedRef = useRef('');
  const debounceRef = useRef(null);
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);
  // Also report into the global sync registry so the header pill aggregates us.
  useEffect(() => { setSyncStatus('cennik', autoSaveStatus); }, [autoSaveStatus]);
  useEffect(() => () => { clearSyncStatus('cennik'); }, []);

  const texts = {
    ru: {
      saunaPricing: 'Управление ценами саун',
      models: 'Модели саун',
      categories: 'Категории опций',
      options: 'Опции',
      addModel: 'Добавить модель',
      addCategory: 'Добавить категорию',
      addOption: 'Добавить опцию',
      editModel: 'Редактировать модель',
      editCategory: 'Редактировать категорию',
      editOption: 'Редактировать опцию',
      modelName: 'Название модели',
      basePrice: 'Базовая цена (PLN)',
      foundationPrice: 'Цена фундамента (PLN)',
      discount: 'Скидка (%)',
      imageUrl: 'URL изображения',
      imageUrlHint: 'Вставьте ссылку на изображение (imgur, imgbb и т.д.)',
      previewImage: 'Превью',
      noImage: 'Нет изображения',
      categoryName: 'Название категории',
      inputType: 'Тип ввода',
      radio: 'Одиночный выбор',
      checkbox: 'Множественный выбор',
      optionName: 'Название опции',
      price: 'Цена (PLN)',
      hint: 'Подсказка / Описание',
      hintMedia: 'Медиа для подсказки',
      hintImageUrl: 'URL изображения подсказки',
      hintVideoUrl: 'URL видео подсказки',
      save: 'Сохранить',
      cancel: 'Отмена',
      delete: 'Удалить',
      saveAll: 'Сохранить все изменения',
      saved: 'Сохранено!',
      confirmDelete: 'Удалить?',
      noModels: 'Нет моделей',
      noCategories: 'Нет категорий',
      noOptions: 'Нет опций',
      selectCategory: 'Выберите категорию',
      displayType: 'Тип отображения',
      displayTypeGrid: 'Плитка',
      displayTypeDropdown: 'Список',
      modelsDisplayType: 'Отображение моделей',
      hasQuantity: 'Поле количества',
      quantityEnabled: 'Включить количество',
      quantityLabel: 'Кол-во',
      techSpecMapping: 'Маппинг на Тех.Задание',
      techSpecCategory: 'Категория тех.задания',
      techSpecOption: 'Опция тех.задания',
      selectTechSpecCategory: 'Выберите категорию',
      selectTechSpecOption: 'Выберите опцию',
      noMapping: '— Без маппинга —',
      globalModelsHint: 'Общая подсказка для моделей',
      globalModelsHintDescription: 'Эта подсказка будет отображаться над всеми моделями в калькуляторе',
      categoryHint: 'Подсказка категории',
      categoryHintDescription: 'Подсказка будет отображаться под названием категории в калькуляторе',
      maxManagerDiscount: 'Макс. скидка менеджера',
      maxManagerDiscountDescription: 'Максимальный % скидки, который может применить менеджер (не админ)',
      bulkPriceChange: 'Массовое изменение цен',
      modelsPercent: 'Модели',
      optionsPercent: 'Опции',
      applyPriceChange: 'Применить',
      priceChangeApplied: 'Цены изменены!',
      enterPercent: 'Введите % (например: 10 для +10%, -5 для -5%)',
    },
    pl: {
      saunaPricing: 'Zarządzanie cenami saun',
      models: 'Modele saun',
      categories: 'Kategorie opcji',
      options: 'Opcje',
      addModel: 'Dodaj model',
      addCategory: 'Dodaj kategorię',
      addOption: 'Dodaj opcję',
      editModel: 'Edytuj model',
      editCategory: 'Edytuj kategorię',
      editOption: 'Edytuj opcję',
      modelName: 'Nazwa modelu',
      basePrice: 'Cena podstawowa (PLN)',
      foundationPrice: 'Cena fundamentu (PLN)',
      discount: 'Rabat (%)',
      imageUrl: 'URL obrazu',
      imageUrlHint: 'Wklej link do obrazu (imgur, imgbb itp.)',
      previewImage: 'Podgląd',
      noImage: 'Brak obrazu',
      categoryName: 'Nazwa kategorii',
      inputType: 'Typ wejścia',
      radio: 'Pojedynczy wybór',
      checkbox: 'Wielokrotny wybór',
      optionName: 'Nazwa opcji',
      price: 'Cena (PLN)',
      hint: 'Podpowiedź / Opis',
      hintMedia: 'Media dla podpowiedzi',
      hintImageUrl: 'URL obrazu podpowiedzi',
      hintVideoUrl: 'URL wideo podpowiedzi',
      save: 'Zapisz',
      cancel: 'Anuluj',
      delete: 'Usuń',
      saveAll: 'Zapisz wszystkie zmiany',
      saved: 'Zapisano!',
      confirmDelete: 'Usunąć?',
      noModels: 'Brak modeli',
      noCategories: 'Brak kategorii',
      noOptions: 'Brak opcji',
      selectCategory: 'Wybierz kategorię',
      displayType: 'Typ wyświetlania',
      displayTypeGrid: 'Kafelki',
      displayTypeDropdown: 'Lista',
      modelsDisplayType: 'Wyświetlanie modeli',
      hasQuantity: 'Pole ilości',
      quantityEnabled: 'Włącz ilość',
      quantityLabel: 'Ilość',
      techSpecMapping: 'Mapowanie na specyfikację techniczną',
      techSpecCategory: 'Kategoria spec. tech.',
      techSpecOption: 'Opcja spec. tech.',
      selectTechSpecCategory: 'Wybierz kategorię',
      selectTechSpecOption: 'Wybierz opcję',
      noMapping: '— Bez mapowania —',
      globalModelsHint: 'Ogólna podpowiedź dla modeli',
      globalModelsHintDescription: 'Ta podpowiedź będzie wyświetlana nad wszystkimi modelami w kalkulatorze',
      categoryHint: 'Podpowiedź kategorii',
      categoryHintDescription: 'Podpowiedź będzie wyświetlana pod nazwą kategorii w kalkulatorze',
      maxManagerDiscount: 'Maks. rabat menedżera',
      maxManagerDiscountDescription: 'Maksymalny % rabatu, który może zastosować menedżer (nie admin)',
      bulkPriceChange: 'Masowa zmiana cen',
      modelsPercent: 'Modele',
      optionsPercent: 'Opcje',
      applyPriceChange: 'Zastosuj',
      priceChangeApplied: 'Ceny zmienione!',
      enterPercent: 'Wpisz % (np: 10 dla +10%, -5 dla -5%)',
    },
  };

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  useEffect(() => {
    fetchPrices();
    fetchTechSpecConfig();
  }, []);

  const fetchPrices = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sauna/prices`);
      setPrices(response.data);
      // Seed the auto-save baseline so the first edit is what triggers a save,
      // not the initial load.
      lastSavedRef.current = JSON.stringify(response.data || {});
      setAutoSaveStatus('saved');
    } catch (error) {
      console.error('Error fetching prices:', error);
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchTechSpecConfig = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tech-spec/config`);
      setTechSpecCategories(response.data.categories || []);
    } catch (error) {
      console.error('Error fetching tech spec config:', error);
    }
  };

  // Internal helper used by both the manual Save button and the silent
  // debounced auto-save. Persists the FULL prices doc and updates the saved
  // snapshot so subsequent edits are detected correctly.
  const doSavePrices = useCallback(async ({ silent } = {}) => {
    try {
      if (!silent) setSaving(true);
      else setAutoSaveStatus('saving');
      await axios.post(`${API_URL}/api/sauna/prices`, prices);
      if (!isMountedRef.current) return;
      lastSavedRef.current = JSON.stringify(prices);
      if (silent) setAutoSaveStatus('saved');
      else toast.success(txt.saved);
    } catch (error) {
      console.error('Error saving prices:', error);
      if (silent) setAutoSaveStatus('error');
      else toast.error(t('error'));
      throw error;
    } finally {
      if (!silent && isMountedRef.current) setSaving(false);
    }
  }, [prices, txt.saved, t]);

  const handleSaveAll = async () => {
    // Manual save → flush any pending debounce first, then loud save with toast.
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    try { await doSavePrices({ silent: false }); } catch (_e) { /* toast shown */ }
  };

  // Debounced auto-save: when `prices` changes, schedule a silent save in 1.5s.
  // Resets the timer on every edit so rapid typing only fires once at the end.
  useEffect(() => {
    if (loading) return;
    const snap = JSON.stringify(prices);
    if (snap === lastSavedRef.current) {
      setAutoSaveStatus('saved');
      return;
    }
    setAutoSaveStatus('pending');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (JSON.stringify(prices) !== lastSavedRef.current) {
        doSavePrices({ silent: true }).catch(() => { /* status='error' set above */ });
      }
    }, 1500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [prices, loading, doSavePrices]);

  // On unmount: if there's a pending debounced save, fire fire-and-forget so
  // user navigation away never loses last-second edits.
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        const snap = JSON.stringify(pricesRef.current);
        if (snap !== lastSavedRef.current) {
          axios.post(`${API_URL}/api/sauna/prices`, pricesRef.current).catch(() => { /* best effort */ });
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror of `prices` for the unmount handler (closure-safe).
  const pricesRef = useRef(prices);
  useEffect(() => { pricesRef.current = prices; }, [prices]);

  const handleUpdatePdfSettings = async (updates) => {
    const newPrices = { ...prices, ...updates };
    setPrices(newPrices);
    try {
      await axios.post(`${API_URL}/api/sauna/prices`, newPrices);
    } catch (error) {
      console.error('Error saving PDF settings:', error);
      toast.error(t('error'));
    }
  };

  // ========== MODELS ==========
  const handleAddModel = async (newModel) => {
    if (!newModel.name) return;
    
    const model = {
      id: newModel.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      name: newModel.name,
      basePrice: parseInt(newModel.basePrice) || 0,
      foundationPrice: parseInt(newModel.foundationPrice) || 0,
      discount: parseInt(newModel.discount) || 0,
      imageUrl: newModel.imageUrl,
      sortOrder: (prices.models?.length || 0) + 1,
      active: true,
    };
    
    try {
      await axios.post(`${API_URL}/api/sauna/models`, model);
      setPrices(prev => ({
        ...prev,
        models: [...(prev.models || []), model],
      }));
      toast.success(txt.saved);
      return true;
    } catch (error) {
      console.error('Error adding model:', error);
      toast.error(error.response?.data?.detail || t('error'));
      return false;
    }
  };

  const handleSaveEditModel = async (editingModel) => {
    if (!editingModel) return false;
    
    try {
      await axios.put(`${API_URL}/api/sauna/models/${editingModel.id}`, editingModel);
      setPrices(prev => ({
        ...prev,
        models: prev.models.map(m => m.id === editingModel.id ? editingModel : m),
      }));
      toast.success(txt.saved);
      return true;
    } catch (error) {
      console.error('Error updating model:', error);
      toast.error(error.response?.data?.detail || t('error'));
      return false;
    }
  };

  const handleDeleteModel = async (modelId) => {
    try {
      await axios.delete(`${API_URL}/api/sauna/models/${modelId}`);
      setPrices(prev => ({
        ...prev,
        models: prev.models.filter(m => m.id !== modelId),
      }));
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error deleting model:', error);
      toast.error(error.response?.data?.detail || t('error'));
    }
  };

  const moveModel = (index, direction) => {
    const newModels = [...prices.models];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newModels.length) return;
    
    [newModels[index], newModels[targetIndex]] = [newModels[targetIndex], newModels[index]];
    newModels.forEach((m, i) => m.sortOrder = i + 1);
    
    setPrices(prev => ({ ...prev, models: newModels }));
  };

  const handleModelsDisplayTypeChange = (displayType) => {
    setPrices(prev => ({
      ...prev,
      modelsDisplayType: displayType,
    }));
  };

  // Update global models hint
  const handleUpdateModelsHint = (field, value) => {
    setPrices(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // ========== CATEGORIES ==========
  const handleAddCategory = async (newCategory) => {
    if (!newCategory.name) return false;
    
    const category = {
      id: newCategory.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      name: newCategory.name,
      inputType: newCategory.inputType,
      displayType: 'grid',
      options: [],
    };
    
    try {
      await axios.post(`${API_URL}/api/sauna/categories`, category);
      setPrices(prev => ({
        ...prev,
        categories: [...(prev.categories || []), category],
      }));
      toast.success(txt.saved);
      return true;
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error(error.response?.data?.detail || t('error'));
      return false;
    }
  };

  const handleSaveEditCategory = async (editingCategory) => {
    if (!editingCategory) return false;
    
    try {
      await axios.put(`${API_URL}/api/sauna/categories/${editingCategory.id}`, editingCategory);
      setPrices(prev => ({
        ...prev,
        categories: prev.categories.map(c => c.id === editingCategory.id ? editingCategory : c),
      }));
      toast.success(txt.saved);
      return true;
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error(error.response?.data?.detail || t('error'));
      return false;
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    try {
      await axios.delete(`${API_URL}/api/sauna/categories/${categoryId}`);
      setPrices(prev => ({
        ...prev,
        categories: prev.categories.filter(c => c.id !== categoryId),
      }));
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error(error.response?.data?.detail || t('error'));
    }
  };

  const handleMoveCategoryUp = async (categoryId) => {
    const categories = [...prices.categories];
    const index = categories.findIndex(c => c.id === categoryId);
    if (index <= 0) return;
    
    [categories[index - 1], categories[index]] = [categories[index], categories[index - 1]];
    categories.forEach((c, i) => c.sortOrder = i + 1);
    
    setPrices(prev => ({ ...prev, categories }));
    
    try {
      await axios.post(`${API_URL}/api/sauna/prices`, { ...prices, categories });
    } catch (error) {
      console.error('Error moving category:', error);
    }
  };

  const handleMoveCategoryDown = async (categoryId) => {
    const categories = [...prices.categories];
    const index = categories.findIndex(c => c.id === categoryId);
    if (index < 0 || index >= categories.length - 1) return;
    
    [categories[index], categories[index + 1]] = [categories[index + 1], categories[index]];
    categories.forEach((c, i) => c.sortOrder = i + 1);
    
    setPrices(prev => ({ ...prev, categories }));
    
    try {
      await axios.post(`${API_URL}/api/sauna/prices`, { ...prices, categories });
    } catch (error) {
      console.error('Error moving category:', error);
    }
  };

  // Drag-and-drop reorder for categories
  const handleReorderCategories = (newCategories) => {
    setPrices(prev => ({ ...prev, categories: newCategories }));
  };

  const handleCategoryDisplayTypeChange = (categoryId, displayType) => {
    setPrices(prev => ({
      ...prev,
      categories: prev.categories.map(cat => 
        cat.id === categoryId ? { ...cat, displayType } : cat
      ),
    }));
  };

  // ========== OPTIONS ==========
  
  // Drag-and-drop reorder for options within a category
  const handleReorderOptions = (categoryId, newOptions) => {
    setPrices(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === categoryId ? { ...cat, options: newOptions } : cat
      )
    }));
  };

  const handleAddOption = async (newOption) => {
    if (!newOption.categoryId || !newOption.name) return false;
    
    const option = {
      id: newOption.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      name: newOption.name,
      price: parseInt(newOption.price) || 0,
      inputType: 'radio',
      sortOrder: 1,
      imageUrl: newOption.imageUrl || null,
      hasQuantity: newOption.hasQuantity || false,
      techSpecId: newOption.techSpecId || null,
      techSpecCategoryId: newOption.techSpecCategoryId || null,
    };
    
    try {
      await axios.post(`${API_URL}/api/sauna/categories/${newOption.categoryId}/options`, option);
      setPrices(prev => ({
        ...prev,
        categories: prev.categories.map(cat => {
          if (cat.id === newOption.categoryId) {
            return {
              ...cat,
              options: [...(cat.options || []), option],
            };
          }
          return cat;
        }),
      }));
      toast.success(txt.saved);
      return true;
    } catch (error) {
      console.error('Error adding option:', error);
      toast.error(error.response?.data?.detail || t('error'));
      return false;
    }
  };

  const handleDeleteOption = async (categoryId, optionId) => {
    try {
      await axios.delete(`${API_URL}/api/sauna/categories/${categoryId}/options/${optionId}`);
      setPrices(prev => ({
        ...prev,
        categories: prev.categories.map(cat => {
          if (cat.id === categoryId) {
            return {
              ...cat,
              options: cat.options.filter(o => o.id !== optionId),
            };
          }
          return cat;
        }),
      }));
      toast.success(txt.saved);
    } catch (error) {
      console.error('Error deleting option:', error);
      toast.error(error.response?.data?.detail || t('error'));
    }
  };

  const handleSaveEditOption = async (editingOption) => {
    if (!editingOption) return false;
    
    const { categoryId, newCategoryId, ...optionData } = editingOption;
    const targetCategoryId = newCategoryId && newCategoryId !== categoryId ? newCategoryId : categoryId;
    
    try {
      // If moving to a different category
      if (newCategoryId && newCategoryId !== categoryId) {
        // Delete from old category
        await axios.delete(`${API_URL}/api/sauna/categories/${categoryId}/options/${editingOption.id}`);
        // Add to new category
        await axios.post(`${API_URL}/api/sauna/categories/${newCategoryId}/options`, { ...optionData, id: editingOption.id });
        
        // Update local state - remove from old, add to new
        setPrices(prev => ({
          ...prev,
          categories: prev.categories.map(cat => {
            if (cat.id === categoryId) {
              return {
                ...cat,
                options: cat.options.filter(o => o.id !== editingOption.id),
              };
            }
            if (cat.id === newCategoryId) {
              return {
                ...cat,
                options: [...(cat.options || []), optionData],
              };
            }
            return cat;
          }),
        }));
        toast.success('Опция перемещена в другую категорию');
      } else {
        // Just update in same category
        await axios.put(`${API_URL}/api/sauna/categories/${categoryId}/options/${editingOption.id}`, optionData);
        setPrices(prev => ({
          ...prev,
          categories: prev.categories.map(cat => {
            if (cat.id === categoryId) {
              return {
                ...cat,
                options: cat.options.map(o => o.id === editingOption.id ? optionData : o),
              };
            }
            return cat;
          }),
        }));
        toast.success(txt.saved);
      }
      return true;
    } catch (error) {
      console.error('Error updating option:', error);
      toast.error(error.response?.data?.detail || t('error'));
      return false;
    }
  };

  const handleUpdateOptionPrice = (categoryId, optionId, newPrice) => {
    setPrices(prev => ({
      ...prev,
      categories: prev.categories.map(cat => {
        if (cat.id === categoryId) {
          return {
            ...cat,
            options: cat.options.map(o => 
              o.id === optionId ? { ...o, price: parseInt(newPrice) || 0 } : o
            ),
          };
        }
        return cat;
      }),
    }));
  };

  const handleToggleOptionQuantity = (categoryId, optionId, hasQuantity) => {
    setPrices(prev => ({
      ...prev,
      categories: prev.categories.map(cat => {
        if (cat.id === categoryId) {
          return {
            ...cat,
            options: cat.options.map(o => 
              o.id === optionId ? { ...o, hasQuantity } : o
            ),
          };
        }
        return cat;
      }),
    }));
  };

  const handleToggleOptionDefault = (categoryId, optionId, isDefaultSelected) => {
    setPrices(prev => ({
      ...prev,
      categories: prev.categories.map(cat => {
        if (cat.id === categoryId) {
          return {
            ...cat,
            options: cat.options.map(o => 
              o.id === optionId ? { ...o, isDefaultSelected } : o
            ),
          };
        }
        return cat;
      }),
    }));
  };

  // ========== SETTINGS ==========
  const handleUpdateMaxManagerDiscount = (value) => {
    const numValue = Math.max(0, Math.min(100, parseInt(value) || 10));
    setPrices(prev => ({ ...prev, maxManagerDiscount: numValue }));
  };

  // ========== BULK PRICE CHANGE ==========
  const handleBulkPriceChange = async (modelsPercent, optionsPercent) => {
    const modelsChange = parseFloat(modelsPercent) || 0;
    const optionsChange = parseFloat(optionsPercent) || 0;
    
    if (modelsChange === 0 && optionsChange === 0) {
      return false;
    }

    setPrices(prev => {
      const newPrices = { ...prev };
      
      // Update models basePrice and foundationPrice
      if (modelsChange !== 0 && newPrices.models) {
        newPrices.models = newPrices.models.map(model => ({
          ...model,
          basePrice: Math.round(model.basePrice * (1 + modelsChange / 100)),
          foundationPrice: model.foundationPrice ? Math.round(model.foundationPrice * (1 + modelsChange / 100)) : 0,
        }));
      }
      
      // Update options prices (including variant prices)
      if (optionsChange !== 0 && newPrices.categories) {
        newPrices.categories = newPrices.categories.map(category => ({
          ...category,
          options: (category.options || []).map(option => ({
            ...option,
            price: Math.round(option.price * (1 + optionsChange / 100)),
            // Also update variant prices if they exist
            variants: (option.variants || []).map(variant => ({
              ...variant,
              price: Math.round(variant.price * (1 + optionsChange / 100)),
            })),
            // Legacy: update subOptions prices if they exist
            subOptions: (option.subOptions || []).map(subOpt => ({
              ...subOpt,
              price: Math.round(subOpt.price * (1 + optionsChange / 100)),
            })),
          })),
        }));
      }
      
      return newPrices;
    });
    
    toast.success(txt.priceChangeApplied);
    return true;
  };

  // Update variant comparison table
  const handleUpdateVariantComparison = (rows) => {
    setPrices(prev => ({ ...prev, variantComparisonRows: rows }));
  };

  return {
    loading,
    saving,
    prices,
    txt,
    techSpecCategories,
    handleSaveAll,
    autoSaveStatus,
    // Models
    handleAddModel,
    handleSaveEditModel,
    handleDeleteModel,
    moveModel,
    handleModelsDisplayTypeChange,
    handleUpdateModelsHint,
    // Categories
    handleAddCategory,
    handleSaveEditCategory,
    handleDeleteCategory,
    handleMoveCategoryUp,
    handleMoveCategoryDown,
    handleReorderCategories,
    handleCategoryDisplayTypeChange,
    // Options
    handleAddOption,
    handleDeleteOption,
    handleSaveEditOption,
    handleUpdateOptionPrice,
    handleToggleOptionQuantity,
    handleToggleOptionDefault,
    handleReorderOptions,
    // Settings
    handleUpdateMaxManagerDiscount,
    // Bulk price change
    handleBulkPriceChange,
    // Variant comparison
    handleUpdateVariantComparison,
    // PDF settings
    handleUpdatePdfSettings,
  };
};
