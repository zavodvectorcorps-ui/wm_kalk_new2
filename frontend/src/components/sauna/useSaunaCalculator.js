import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import { API_URL, getTranslation, getImageUrl, getInitialFormData, normalizeMediaUrls } from './constants';
import { useOptionVisibility } from './useOptionVisibility';
import { useLayoutCatalog } from './useLayoutCatalog';

export const useSaunaCalculator = (editingOrder = null, onEditComplete, amocrmPrefill = null, onAmocrmPrefillUsed = null) => {
  const { t, i18n } = useTranslation();
  const { user, isAdmin } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [prices, setPrices] = useState({ models: [], categories: [] });
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [certificateDiscount, setCertificateDiscount] = useState(false);
  
  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editOrderId, setEditOrderId] = useState(null);
  const [adminGifts, setAdminGifts] = useState([]);
  const [adminDiscountApproved, setAdminDiscountApproved] = useState(false);
  
  // amoCRM integration
  const [amocrmData, setAmocrmData] = useState(null);
  
  // Manager requested discount
  const [requestedDiscount, setRequestedDiscount] = useState(0);
  const [requestedDiscountNote, setRequestedDiscountNote] = useState('');
  
  const isAdminUser = isAdmin && isAdmin();
  // Check if user can give gifts (admin or manager)
  const canGiveGifts = true; // Доступно всем пользователям
  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = getTranslation(lang);
  
  const [formData, setFormData] = useState(getInitialFormData());
  const [autoSelectedLayoutSize, setAutoSelectedLayoutSize] = useState(null);

  // Use modular hooks
  const { isOptionVisible, isCategoryVisible, isTerraceSelected } = useOptionVisibility(formData);
  const { 
    selectedLayoutSize, 
    selectedLayoutId, 
    layoutVariants, 
    layoutLoading,
    customLayoutImage,
    customLayoutUploading,
    handleLayoutSelect,
    clearLayoutSelection,
    uploadCustomLayoutImage,
    removeCustomLayoutImage,
    getSelectedLayout,
    getOtherLayoutsForSize,
    getLayoutsBySize
  } = useLayoutCatalog(formData.selectedModelVariant);

  // Handle amoCRM prefill data
  useEffect(() => {
    if (amocrmPrefill && !editingOrder) {
      setFormData(prev => ({
        ...prev,
        fullName: amocrmPrefill.fullName || prev.fullName,
        phoneNumber: amocrmPrefill.phoneNumber || prev.phoneNumber,
        fullAddress: amocrmPrefill.fullAddress || prev.fullAddress,
        email: amocrmPrefill.email || prev.email,
      }));
      
      setAmocrmData({
        amocrm_id: amocrmPrefill.amocrm_id,
        amocrm_link: amocrmPrefill.amocrm_link,
        amocrm_name: amocrmPrefill.amocrm_name || amocrmPrefill.fullName,
        crmLeadId: amocrmPrefill.crmLeadId, // From Sauna CRM
      });
      
      const sourceName = amocrmPrefill.fullName || amocrmPrefill.amocrm_name || 'CRM';
      toast.success(`Данные загружены: ${sourceName}`);
      
      // Notify parent that prefill was used
      if (onAmocrmPrefillUsed) {
        onAmocrmPrefillUsed();
      }
    }
  }, [amocrmPrefill, editingOrder, onAmocrmPrefillUsed]);

  // Fetch prices
  const fetchPrices = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sauna/prices`);
      const normalized = normalizeMediaUrls(response.data);
      setPrices(normalized);
      
      // Initialize selections for each category with default options
      const initialSelections = {};
      const initialQuantities = {};
      
      (response.data.categories || []).forEach(cat => {
        if (cat.inputType === 'checkbox') {
          // For checkboxes, find all default selected options
          const defaultSelected = {};
          (cat.options || []).forEach(opt => {
            if (opt.isDefaultSelected) {
              defaultSelected[opt.id] = true;
              // Set default quantity if option has quantity
              if (opt.hasQuantity) {
                initialQuantities[`${cat.id}_${opt.id}`] = 1;
              }
            }
          });
          initialSelections[cat.id] = defaultSelected;
        } else {
          // For radio/select, find the first default selected option
          const defaultOpt = (cat.options || []).find(opt => opt.isDefaultSelected);
          initialSelections[cat.id] = defaultOpt ? defaultOpt.id : '';
          // Set quantity if default option has quantity
          if (defaultOpt?.hasQuantity) {
            initialQuantities[`${cat.id}_${defaultOpt.id}`] = 1;
          }
        }
      });
      
      setFormData(prev => ({ 
        ...prev, 
        selections: initialSelections,
        quantities: { ...prev.quantities, ...initialQuantities }
      }));
    } catch (error) {
      console.error('Error fetching sauna prices:', error);
      toast.error(t('error'));
    } finally {
      setInitialLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Load order data when editing
  useEffect(() => {
    if (editingOrder && prices.categories?.length > 0) {
      setIsEditMode(true);
      setEditOrderId(editingOrder.id);
      
      setFormData(prev => ({
        ...prev,
        fullName: editingOrder.fullName || '',
        email: editingOrder.email || '',
        phoneNumber: editingOrder.phoneNumber || '',
        fullAddress: editingOrder.fullAddress || '',
        orderDate: editingOrder.orderDate || new Date().toISOString().split('T')[0],
        selectedModel: editingOrder.selectedModel || '',
        selectedModelVariant: editingOrder.selectedModelVariant || '',
        notes: editingOrder.notes || '',
        selections: editingOrder.selections || prev.selections,
        quantities: editingOrder.quantities || {},
        variantSelections: editingOrder.variantSelections || {},
        subSelections: editingOrder.subSelections || {}, // Legacy compatibility
      }));
      
      setRequestedDiscount(editingOrder.requestedDiscount || 0);
      setRequestedDiscountNote(editingOrder.requestedDiscountNote || '');
      
      // Rebuild selections if needed
      if ((!editingOrder.selections || Object.keys(editingOrder.selections).length === 0) && editingOrder.selectedOptions?.length > 0) {
        const rebuiltSelections = {};
        const rebuiltQuantities = {};
        const rebuiltVariantSelections = {};
        const rebuiltSubSelections = {};
        
        prices.categories.forEach(cat => {
          rebuiltSelections[cat.id] = cat.inputType === 'checkbox' ? {} : '';
        });
        
        editingOrder.selectedOptions.forEach(opt => {
          const category = prices.categories.find(c => c.id === opt.categoryId);
          if (category) {
            const optionId = opt.optionId || opt.id;
            if (category.inputType === 'checkbox') {
              rebuiltSelections[opt.categoryId] = {
                ...(rebuiltSelections[opt.categoryId] || {}),
                [optionId]: true
              };
            } else {
              rebuiltSelections[opt.categoryId] = optionId;
            }
            if (opt.quantity && opt.quantity > 1) {
              rebuiltQuantities[optionId] = opt.quantity;
            }
            // Rebuild variant selections (new system)
            if (opt.selectedVariantId) {
              rebuiltVariantSelections[optionId] = opt.selectedVariantId;
            }
            // Rebuild sub-selections (legacy system)
            if (opt.selectedSubOptions?.length > 0) {
              opt.selectedSubOptions.forEach(subOpt => {
                rebuiltSubSelections[`${optionId}_${subOpt.id}`] = true;
              });
            }
          }
        });
        
        setFormData(prev => ({ 
          ...prev, 
          selections: rebuiltSelections, 
          quantities: rebuiltQuantities,
          variantSelections: rebuiltVariantSelections,
          subSelections: rebuiltSubSelections,
          openPrices: editingOrder.openPrices || {},
          customOptions: editingOrder.customOptions || [],
        }));
      }
      
      setAppliedDiscount(editingOrder.discountPercent || 0);
      setCertificateDiscount(editingOrder.certificateDiscount || false);
      setAdminGifts(editingOrder.adminGifts || []);
      setAdminDiscountApproved(editingOrder.adminDiscountApproved || false);
      
      // Restore layout catalog selection
      if (editingOrder.selectedLayoutId) {
        handleLayoutSelect(editingOrder.selectedLayoutSize, editingOrder.selectedLayoutId);
      }
      
      // Restore amoCRM data from original order (critical for edit flow from widget)
      if (editingOrder.amocrm_id) {
        console.log('[Edit] Setting amocrmData with amocrm_id:', editingOrder.amocrm_id, 'crmLeadId:', editingOrder._crmLeadId);
        setAmocrmData({
          amocrm_id: editingOrder.amocrm_id,
          amocrm_link: editingOrder.amocrm_link || '',
          amocrm_name: editingOrder.amocrm_name || '',
          crmLeadId: editingOrder._crmLeadId || '',
        });
      } else if (editingOrder._crmLeadId) {
        console.log('[Edit] Setting amocrmData with crmLeadId only:', editingOrder._crmLeadId);
        // Even without amocrm_id, set crmLeadId for CRM link flow
        setAmocrmData(prev => ({
          ...(prev || {}),
          crmLeadId: editingOrder._crmLeadId,
        }));
      } else {
        console.log('[Edit] No amocrm_id and no _crmLeadId on editingOrder');
      }
      
      toast.info(`${txt.editingOrder}: ${editingOrder.id}`);
    }
  }, [editingOrder, prices.categories, txt.editingOrder, handleLayoutSelect]);

  // Get selected model
  const getSelectedModel = useCallback(() => {
    return prices.models?.find(m => m.id === formData.selectedModel);
  }, [prices.models, formData.selectedModel]);

  // Get selected model variant
  const getSelectedModelVariant = useCallback(() => {
    const model = getSelectedModel();
    if (!model) return null;
    
    // Get variants - either from current model or from linked model
    let variants = model.variants || [];
    
    // If current model has no variants but has linkedVariantsModelId, use variants from linked model
    if (!variants.length && model.linkedVariantsModelId) {
      const linkedModel = prices?.models?.find(m => m.id === model.linkedVariantsModelId);
      if (linkedModel?.variants?.length > 0) {
        variants = linkedModel.variants;
      }
    }
    
    if (!variants.length) return null;
    
    // If variant is selected, return it
    if (formData.selectedModelVariant) {
      return variants.find(v => v.id === formData.selectedModelVariant);
    }
    
    // Default to first variant if model has variants but none selected
    return variants[0];
  }, [getSelectedModel, formData.selectedModelVariant, prices?.models]);

  // Get effective model price (from variant or base price)
  const getModelPrice = useCallback(() => {
    const model = getSelectedModel();
    if (!model) return 0;
    
    // Base price of the model
    let totalPrice = model.basePrice;
    
    // Add variant price (variant price is additional, not replacement)
    const variant = getSelectedModelVariant();
    if (variant && variant.price) {
      totalPrice += variant.price;
    }
    
    return totalPrice;
  }, [getSelectedModel, getSelectedModelVariant]);

  // ===== Default package (per-model / per-variant preset) =====
  // Variant package overrides model package per category.
  const computeEffectivePackage = useCallback((model, variantId) => {
    if (!model) return {};
    const modelPkg = model.defaultPackage || {};
    const variant = (model.variants || []).find(v => v.id === variantId);
    const variantPkg = variant?.defaultPackage || {};
    return { ...modelPkg, ...variantPkg };
  }, []);

  // Overlay a package onto existing selections (overwrites the package's categories).
  const applyPackage = useCallback((prevSelections, prevQuantities, pkg) => {
    const selections = { ...prevSelections };
    const quantities = { ...prevQuantities };
    Object.entries(pkg || {}).forEach(([catId, optIds]) => {
      const cat = (prices.categories || []).find(c => c.id === catId);
      if (!cat || !optIds || optIds.length === 0) return;
      if (cat.inputType === 'checkbox') {
        const obj = {};
        optIds.forEach(id => {
          obj[id] = true;
          const o = (cat.options || []).find(x => x.id === id);
          if (o?.hasQuantity) quantities[id] = quantities[id] || 1;
        });
        selections[catId] = obj;
      } else {
        selections[catId] = optIds[0];
        const o = (cat.options || []).find(x => x.id === optIds[0]);
        if (o?.hasQuantity) quantities[optIds[0]] = quantities[optIds[0]] || 1;
      }
    });
    return { selections, quantities };
  }, [prices.categories]);

  // Handle model variant change
  const handleModelVariantChange = (variantId) => {
    const model = getSelectedModel();
    const pkg = computeEffectivePackage(model, variantId);
    setFormData(prev => {
      const { selections, quantities } = applyPackage(prev.selections, prev.quantities, pkg);
      return { ...prev, selectedModelVariant: variantId, selections, quantities, packageMap: pkg };
    });
  };

  // Get room sizes based on terrace selection and variant (uses isTerraceSelected from useOptionVisibility hook)
  const getRoomSizes = useCallback(() => {
    const model = getSelectedModel();
    if (!model) return { relaxRoomSize: null, steamRoomSize: null };
    
    const hasTerrace = isTerraceSelected();
    const variant = getSelectedModelVariant();
    
    // Priority: variant data > model data (with terrace variant if applicable)
    let relaxRoomSize = null;
    let steamRoomSize = null;
    
    // Check variant first
    if (variant?.relaxRoomSize) {
      relaxRoomSize = variant.relaxRoomSize;
    } else if (hasTerrace && model.relaxRoomSizeWithTerrace) {
      relaxRoomSize = model.relaxRoomSizeWithTerrace;
    } else {
      relaxRoomSize = model.relaxRoomSize;
    }
    
    if (variant?.steamRoomSize) {
      steamRoomSize = variant.steamRoomSize;
    } else if (hasTerrace && model.steamRoomSizeWithTerrace) {
      steamRoomSize = model.steamRoomSizeWithTerrace;
    } else {
      steamRoomSize = model.steamRoomSize;
    }
    
    return {
      relaxRoomSize,
      steamRoomSize,
      hasTerrace
    };
  }, [getSelectedModel, getSelectedModelVariant, isTerraceSelected]);

  // isOptionVisible is now provided by useOptionVisibility hook (imported above)

  // Get option base price considering model-specific pricing
  const getOptionBasePrice = useCallback((option) => {
    if (!option) return 0;

    // Open-price option: read whatever the manager typed in the calculator.
    if (option.isOpenPrice) {
      return parseInt(formData.openPrices?.[option.id]) || 0;
    }

    // Check if option has model-specific pricing
    const priceByModel = option.priceByModel || {};
    const selectedModelId = formData.selectedModel;
    
    // If model-specific price exists, use it
    if (selectedModelId && priceByModel[selectedModelId] !== undefined) {
      return priceByModel[selectedModelId];
    }
    
    // Otherwise use default option price
    return option.price || 0;
  }, [formData.selectedModel, formData.openPrices]);

  // Calculate options total (only visible options)
  const calculateOptionsTotal = useCallback(() => {
    let total = 0;
    const categories = prices.categories || [];
    
    categories.forEach(category => {
      // Skip fundament category - it's calculated separately in calculateFoundationPrice
      if (category.id === 'fundament') return;
      // Skip dostawa category - it's calculated separately in calculateDeliveryPrice
      if (category.id === 'dostawa') return;
      
      const selection = formData.selections[category.id];
      if (!selection) return;
      
      if (category.inputType === 'checkbox') {
        Object.entries(selection).forEach(([optId, isSelected]) => {
          if (isSelected) {
            const option = category.options?.find(o => o.id === optId);
            // Skip hidden options
            if (!option || !isOptionVisible(option)) return;
            
            // Skip if option is a gift
            if (adminGifts.includes(optId)) return;
            
            const quantity = option.hasQuantity ? (formData.quantities[optId] || 1) : 1;
            
            // Get variants (check both new 'variants' and legacy 'subOptions' fields)
            const variants = option.variants?.length > 0 ? option.variants : option.subOptions;
            
            // Get base price considering model-specific pricing
            const basePrice = getOptionBasePrice(option);
            
            // Check if variant is selected - variant price REPLACES option price
            const selectedVariantId = formData.variantSelections?.[optId];
            if (selectedVariantId && variants?.length > 0) {
              const selectedVariant = variants.find(v => v.id === selectedVariantId);
              if (selectedVariant) {
                total += selectedVariant.price * quantity;
              } else {
                // Fallback to option price if variant not found
                total += basePrice * quantity;
              }
            } else if (variants?.length > 0) {
              // Option has variants but none selected - use first variant as default price
              total += (variants[0]?.price || basePrice) * quantity;
            } else {
              // No variants - use option price (with model-specific pricing)
              total += basePrice * quantity;
            }
          }
        });
      } else {
        const option = category.options?.find(o => o.id === selection);
        // Skip hidden options
        if (!option || !isOptionVisible(option)) return;
        
        // Skip if option is a gift
        if (adminGifts.includes(selection)) return;
        
        const quantity = option.hasQuantity ? (formData.quantities[selection] || 1) : 1;
        
        // Get variants (check both new 'variants' and legacy 'subOptions' fields)
        const variants = option.variants?.length > 0 ? option.variants : option.subOptions;
        
        // Get base price considering model-specific pricing
        const basePrice = getOptionBasePrice(option);
        
        // Check if variant is selected - variant price REPLACES option price
        const selectedVariantId = formData.variantSelections?.[selection];
        if (selectedVariantId && variants?.length > 0) {
          const selectedVariant = variants.find(v => v.id === selectedVariantId);
          if (selectedVariant) {
            total += selectedVariant.price * quantity;
          } else {
            total += basePrice * quantity;
          }
        } else if (variants?.length > 0) {
          // Option has variants but none selected - use first variant as default
          total += (variants[0]?.price || basePrice) * quantity;
        } else {
          total += basePrice * quantity;
        }
      }
    });
    
    return total;
  }, [prices.categories, formData.selections, formData.quantities, formData.variantSelections, isOptionVisible, getOptionBasePrice, adminGifts]);

  // Calculate foundation price
  const calculateFoundationPrice = useCallback(() => {
    const model = getSelectedModel();
    if (!model) return 0;
    
    const foundationCat = prices.categories?.find(c => c.id === 'fundament');
    if (foundationCat) {
      const selection = formData.selections[foundationCat.id];
      if (selection && selection.includes('dodaj')) {
        // Check if foundation is a gift
        if (adminGifts.includes('fundament_gift') || adminGifts.includes(selection)) {
          return 0;
        }
        return model.foundationPrice || 0;
      }
    }
    return 0;
  }, [getSelectedModel, prices.categories, formData.selections, adminGifts]);

  // Calculate delivery price (separate from subtotal)
  const calculateDeliveryPrice = useCallback(() => {
    const deliveryCat = prices.categories?.find(c => c.id === 'dostawa');
    if (!deliveryCat) return 0;
    
    const selection = formData.selections['dostawa'];
    if (!selection) return 0;
    
    // Check if delivery is a gift
    if (adminGifts.includes(selection)) return 0;
    
    const option = deliveryCat.options?.find(o => o.id === selection);
    if (!option) return 0;
    
    // Get variants
    const variants = option.variants?.length > 0 ? option.variants : option.subOptions;
    const selectedVariantId = formData.variantSelections?.[selection];
    
    if (selectedVariantId && variants?.length > 0) {
      const selectedVariant = variants.find(v => v.id === selectedVariantId);
      if (selectedVariant) return selectedVariant.price;
    } else if (variants?.length > 0) {
      return variants[0]?.price || option.price || 0;
    }
    
    return option.price || 0;
  }, [prices.categories, formData.selections, formData.variantSelections, adminGifts]);

  // Sum of custom (free-form) options added by the manager directly in the
  // calculator. Each entry: {id, name, price, quantity?}.
  const calculateCustomOptionsTotal = useCallback(() => {
    const list = formData.customOptions || [];
    return list.reduce((s, it) => s + (parseInt(it.price) || 0) * (parseInt(it.quantity) || 1), 0);
  }, [formData.customOptions]);

  // Calculate subtotal (without delivery)
  const calculateSubtotal = useCallback(() => {
    const model = getSelectedModel();
    if (!model) return 0;
    
    // Use variant price if available, otherwise use base price
    const modelPrice = getModelPrice();
    return modelPrice + calculateOptionsTotal() + calculateFoundationPrice() + calculateCustomOptionsTotal();
  }, [getSelectedModel, getModelPrice, calculateOptionsTotal, calculateFoundationPrice, calculateCustomOptionsTotal]);

  // Calculate total (subtotal with discount, WITHOUT delivery)
  const calculateTotal = useCallback(() => {
    const subtotal = calculateSubtotal();
    const discountAmount = subtotal * (appliedDiscount / 100);
    let afterDiscount = subtotal - discountAmount;
    if (certificateDiscount) {
      const certPct = prices.certificateDiscountPercent ?? 13;
      afterDiscount = afterDiscount * (1 - certPct / 100); // configurable certificate discount
    }
    // Delivery is shown separately, NOT included in total
    return afterDiscount;
  }, [calculateSubtotal, appliedDiscount, certificateDiscount, prices.certificateDiscountPercent]);

  // Input handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDiscountChange = (e) => {
    const maxManagerDiscount = prices.maxManagerDiscount || 10;
    const maxDiscount = isAdminUser ? 100 : maxManagerDiscount;
    const value = Math.max(0, Math.min(maxDiscount, parseFloat(e.target.value) || 0));
    setAppliedDiscount(value);
  };

  // Helper to extract layout size from model name (e.g., "235x200 cm" → "2m", "235x300" → "3m")
  const extractLayoutSizeFromModelName = (modelName) => {
    if (!modelName) return null;
    
    // Look for patterns like "235x200", "235×300", "200x300 cm" etc.
    const match = modelName.match(/[\dx×](\d{3})(?:\s*cm)?/i);
    if (match) {
      const lengthCm = parseInt(match[1], 10);
      // Convert cm to meters and round to nearest 0.5m
      const lengthM = lengthCm / 100;
      const roundedM = Math.round(lengthM * 2) / 2; // Round to 0.5
      return `${roundedM}m`;
    }
    return null;
  };

  const handleModelChange = (modelId) => {
    // Reset model variant selection when changing model
    // Auto-select first variant if model has variants
    const newModel = prices.models?.find(m => m.id === modelId);
    const firstVariantId = newModel?.variants?.[0]?.id || '';
    
    const pkg = computeEffectivePackage(newModel, firstVariantId);
    setFormData(prev => {
      const { selections, quantities } = applyPackage(prev.selections, prev.quantities, pkg);
      return { ...prev, selectedModel: modelId, selectedModelVariant: firstVariantId, selections, quantities, packageMap: pkg };
    });
    setAppliedDiscount(0);
    setCertificateDiscount(false);
    
    // Auto-select layout size: use layoutSize field if set, otherwise try to extract from model name
    let layoutSize = newModel?.layoutSize;
    if (!layoutSize) {
      layoutSize = extractLayoutSizeFromModelName(newModel?.name || newModel?.namePl);
    }
    
    // Set auto-selected size to hide other sizes in catalog
    setAutoSelectedLayoutSize(layoutSize || null);
    
    if (layoutSize) {
      handleLayoutSelect(layoutSize, null);
    }
  };

  const handleApplyStandardDiscount = () => {
    const model = getSelectedModel();
    if (!model) {
      toast.error(txt.selectModelFirst);
      return;
    }
    
    const maxManagerDiscount = prices.maxManagerDiscount || 10;
    const maxDiscount = isAdminUser ? 100 : maxManagerDiscount;
    const modelDiscount = Math.min(model.discount || 0, maxDiscount);
    if (modelDiscount > 0) {
      setAppliedDiscount(modelDiscount);
      toast.success(`${txt.discountApplied}: ${modelDiscount}%`);
    } else {
      toast.error(txt.noDiscountForModel);
    }
  };

  const handleToggleCertificateDiscount = () => {
    setCertificateDiscount(prev => {
      if (!prev) {
        const certPct = prices.certificateDiscountPercent ?? 13;
        toast.success(txt.certificateApplied.replace(/\d+%/, `${certPct}%`));
      } else {
        toast.info(txt.certificateRemoved);
      }
      return !prev;
    });
  };

  const handleRadioChange = (categoryId, optionId) => {
    setFormData(prev => {
      // Clear sub-selections for the previous option in this category
      const previousOptionId = prev.selections[categoryId];
      let newSubSelections = { ...prev.subSelections };
      
      if (previousOptionId && previousOptionId !== optionId) {
        // Remove all sub-selections for the previous option
        Object.keys(newSubSelections).forEach(key => {
          if (key.startsWith(`${previousOptionId}_`)) {
            delete newSubSelections[key];
          }
        });
      }
      
      return {
        ...prev,
        selections: { ...prev.selections, [categoryId]: optionId },
        subSelections: newSubSelections,
      };
    });
  };

  const handleCheckboxChange = (categoryId, optionId, checked) => {
    setFormData(prev => ({
      ...prev,
      selections: {
        ...prev.selections,
        [categoryId]: { ...(prev.selections[categoryId] || {}), [optionId]: checked },
      },
    }));
  };

  const handleQuantityChange = (optionId, quantity) => {
    const qty = Math.max(1, parseInt(quantity) || 1);
    setFormData(prev => ({
      ...prev,
      quantities: { ...prev.quantities, [optionId]: qty },
    }));
  };
  
  // Handle variant selection (mutually exclusive - like radio button)
  const handleVariantChange = (optionId, variantId) => {
    setFormData(prev => ({
      ...prev,
      variantSelections: { ...prev.variantSelections, [optionId]: variantId },
    }));
  };
  
  // Legacy: Handle sub-option selection (checkbox style - kept for backward compatibility)
  const handleSubOptionChange = (optionId, subOptionId, checked) => {
    const key = `${optionId}_${subOptionId}`;
    setFormData(prev => ({
      ...prev,
      subSelections: { ...prev.subSelections, [key]: checked },
    }));
  };

  // Toggle gift
  const toggleGift = (optionId) => {
    setAdminGifts(prev => 
      prev.includes(optionId) ? prev.filter(id => id !== optionId) : [...prev, optionId]
    );
  };

  // Remove option from selection
  const removeOption = (categoryId, optionId, isCheckbox = false) => {
    setFormData(prev => {
      if (isCheckbox) {
        // For checkbox - just uncheck it
        return {
          ...prev,
          selections: {
            ...prev.selections,
            [categoryId]: { ...(prev.selections[categoryId] || {}), [optionId]: false },
          },
        };
      } else {
        // For radio/dropdown - clear the selection
        return {
          ...prev,
          selections: { ...prev.selections, [categoryId]: '' },
        };
      }
    });
    // Also remove from gifts if it was a gift
    setAdminGifts(prev => prev.filter(id => id !== optionId));
  };

  // Validate form
  const validateForm = () => {
    if (!formData.fullName || !formData.phoneNumber) {
      toast.error(txt.fillRequired);
      return false;
    }
    if (!formData.selectedModel) {
      toast.error(txt.selectModelFirst);
      return false;
    }
    return true;
  };

  // Get selected options for PDF (only visible options)
  const getSelectedOptions = useCallback(() => {
    const options = [];
    const categories = prices.categories || [];
    const model = getSelectedModel();
    const modelFoundationPrice = model?.foundationPrice || 0;
    
    categories.forEach(category => {
      const selection = formData.selections[category.id];
      if (!selection) return;
      
      // Check if this is the foundation/belki category
      const isBelkiCategory = category.id === 'fundament';
      
      if (category.inputType === 'checkbox') {
        Object.entries(selection).forEach(([optId, isSelected]) => {
          if (isSelected) {
            const option = category.options?.find(o => o.id === optId);
            // Skip hidden options
            if (!option || !isOptionVisible(option)) return;
            
            const quantity = option.hasQuantity ? (formData.quantities[optId] || 1) : 1;
            
            // Get variants (check both new 'variants' and legacy 'subOptions' fields)
            const variants = option.variants?.length > 0 ? option.variants : option.subOptions;
            
            // For belki "dodaj" option, use foundationPrice from model
            const isBelkiDodaj = isBelkiCategory && optId.includes('dodaj');
            
            // Determine final price and image based on selected variant
            // Use model-specific price if available
            const optionBasePrice = getOptionBasePrice(option);
            let finalPrice = isBelkiDodaj ? modelFoundationPrice : optionBasePrice;
            let finalImageUrl = option.imageUrl || null;
            let selectedVariantId = formData.variantSelections?.[optId];
            let selectedVariant = null;
            let variantName = '';
            
            if (variants?.length > 0 && !isBelkiDodaj) {
              if (selectedVariantId) {
                selectedVariant = variants.find(v => v.id === selectedVariantId);
              } else {
                // Auto-select first variant if none selected
                selectedVariant = variants[0];
                selectedVariantId = selectedVariant?.id;
              }
              
              if (selectedVariant) {
                finalPrice = selectedVariant.price;
                variantName = selectedVariant.namePl || selectedVariant.name;
                if (selectedVariant.imageUrl) {
                  finalImageUrl = selectedVariant.imageUrl;
                }
              }
            }
            
            options.push({
              categoryId: category.id,
              categoryName: category.name,
              optionId: option.id,
              inPackage: (formData.packageMap?.[category.id] || []).includes(option.id),
              optionName: variantName ? `${option.name} (${variantName})` : option.name,
              price: finalPrice,
              costPrice: option.costPrice || 0,
              variantCostPrice: selectedVariant?.costPrice ?? null,
              quantity,
              totalPrice: finalPrice * quantity,
              imageUrl: finalImageUrl,
              hintImageUrl: option.hintImageUrl || null,
              techSpecId: selectedVariant?.techSpecId || option.techSpecId || null,
              techSpecCategoryId: selectedVariant?.techSpecCategoryId || option.techSpecCategoryId || category.techSpecCategoryId || null,
              selectedVariantId,
              selectedVariant: selectedVariant ? {
                id: selectedVariant.id,
                name: selectedVariant.namePl || selectedVariant.name,
                price: selectedVariant.price,
                imageUrl: selectedVariant.imageUrl || null,
                techSpecCategoryId: selectedVariant.techSpecCategoryId || null,
                techSpecId: selectedVariant.techSpecId || null,
              } : null,
              // Legacy compatibility
              selectedSubOptions: [],
              subOptionsTotal: 0,
            });
          }
        });
      } else {
        const option = category.options?.find(o => o.id === selection);
        // Skip hidden options
        if (!option || !isOptionVisible(option)) return;
        
        const quantity = option.hasQuantity ? (formData.quantities[selection] || 1) : 1;
        
        // For belki "dodaj" option, use foundationPrice from model
        const isBelkiDodaj = isBelkiCategory && selection.includes('dodaj');
        
        // Get variants
        const variants = option.variants?.length > 0 ? option.variants : option.subOptions;
        
        // Use model-specific price if available
        const optionBasePrice = getOptionBasePrice(option);
        let finalPrice = isBelkiDodaj ? modelFoundationPrice : optionBasePrice;
        let finalImageUrl = option.imageUrl || null;
        let selectedVariantId = formData.variantSelections?.[selection];
        let selectedVariant = null;
        let variantName = '';
        
        if (variants?.length > 0 && !isBelkiDodaj) {
          if (selectedVariantId) {
            selectedVariant = variants.find(v => v.id === selectedVariantId);
          } else {
            selectedVariant = variants[0];
            selectedVariantId = selectedVariant?.id;
          }
          
          if (selectedVariant) {
            finalPrice = selectedVariant.price;
            variantName = selectedVariant.namePl || selectedVariant.name;
            if (selectedVariant.imageUrl) {
              finalImageUrl = selectedVariant.imageUrl;
            }
          }
        }
        
        options.push({
          categoryId: category.id,
          categoryName: category.name,
          optionId: option.id,
          inPackage: (formData.packageMap?.[category.id] || []).includes(option.id),
          optionName: variantName ? `${option.name} (${variantName})` : option.name,
          price: finalPrice,
          costPrice: option.costPrice || 0,
          variantCostPrice: selectedVariant?.costPrice ?? null,
          quantity,
          totalPrice: finalPrice * quantity,
          imageUrl: finalImageUrl,
          hintImageUrl: option.hintImageUrl || null,
          techSpecId: selectedVariant?.techSpecId || option.techSpecId || null,
          techSpecCategoryId: selectedVariant?.techSpecCategoryId || option.techSpecCategoryId || category.techSpecCategoryId || null,
          selectedVariantId,
          selectedVariant: selectedVariant ? {
            id: selectedVariant.id,
            name: selectedVariant.namePl || selectedVariant.name,
            price: selectedVariant.price,
            imageUrl: selectedVariant.imageUrl || null,
            techSpecCategoryId: selectedVariant.techSpecCategoryId || null,
            techSpecId: selectedVariant.techSpecId || null,
          } : null,
          selectedSubOptions: [],
          subOptionsTotal: 0,
        });
      }
    });
    
    return options;
  }, [prices.categories, formData.selections, formData.quantities, formData.variantSelections, formData.packageMap, getSelectedModel, isOptionVisible, getOptionBasePrice]);

  // Save and generate PDF
  const handleSaveAndGeneratePDF = async (forceNew = false) => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const model = getSelectedModel();
      const modelVariant = getSelectedModelVariant();
      const subtotal = calculateSubtotal();
      const selectedOptions = getSelectedOptions();
      
      // Calculate total - subtotal already excludes gifts via calculateOptionsTotal() and calculateFoundationPrice()
      // So we just apply discount to subtotal
      const discountAmount = subtotal * (appliedDiscount / 100);
      let total = subtotal - discountAmount;
      if (certificateDiscount) {
        const certPct = prices.certificateDiscountPercent ?? 13;
        total = total * (1 - certPct / 100); // configurable certificate discount
      }
      
      const orderId = (isEditMode && editOrderId && !forceNew) ? editOrderId : undefined;
      
      // Get effective price (base price + variant price)
      const baseModelPrice = model?.basePrice || 0;
      const variantPrice = modelVariant?.price || 0;
      const effectivePrice = baseModelPrice + variantPrice;
      // Get model image - priority: variant image > main model image
      const modelImage = modelVariant?.imageUrl || model?.imageUrl || '';
      // Get model name with variant
      const effectiveModelName = modelVariant 
        ? `${model?.name || ''} (${modelVariant.namePl || modelVariant.name || ''})` 
        : (model?.name || '');

      // === COST PRICE CALCULATION (admin-only field) ===
      // Sum: model.costPrice + variant.costPrice + sum(selectedOption.costPrice * qty)
      const modelCost = (model?.costPrice || 0) + (modelVariant?.costPrice || 0);
      const modelExtra = (model?.retailExtraCost || 0) + (modelVariant?.retailExtraCost || 0);
      const optionsCost = (selectedOptions || []).reduce((acc, opt) => {
        const qty = opt.quantity || 1;
        // If option has variant chosen, prefer variant cost; otherwise option's own cost
        const cp = (opt.variantCostPrice != null ? opt.variantCostPrice : opt.costPrice) || 0;
        return acc + cp * qty;
      }, 0);
      const optionsExtra = (selectedOptions || []).reduce((acc, opt) => {
        const qty = opt.quantity || 1;
        const ex = (opt.variantRetailExtraCost != null ? opt.variantRetailExtraCost : opt.retailExtraCost) || 0;
        return acc + ex * qty;
      }, 0);
      const totalCost = Math.round(modelCost + optionsCost);
      const retailExtraCost = Math.round(modelExtra + optionsExtra);
      // VAT-aware margin: retail is brutto (incl. 23% VAT), cost is netto.
      // Also subtract retailExtraCost (delivery, packaging, sales commission).
      const totalNetto = (total || 0) / 1.23;
      const margin = Math.round(totalNetto - totalCost - retailExtraCost);

      const orderData = {
        ...(orderId && { id: orderId }),
        fullName: formData.fullName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        fullAddress: formData.fullAddress || '',
        orderDate: formData.orderDate,
        selectedModel: formData.selectedModel,
        selectedModelVariant: formData.selectedModelVariant || null,
        modelVariantName: modelVariant?.namePl || modelVariant?.name || null,
        modelName: effectiveModelName,
        modelImageUrl: getImageUrl(modelImage) || '',
        basePrice: effectivePrice,
        foundationPrice: calculateFoundationPrice(),
        discountPercent: appliedDiscount,
        certificateDiscount: certificateDiscount,
        selections: formData.selections,
        quantities: formData.quantities || {},
        variantSelections: formData.variantSelections || {},
        subSelections: formData.subSelections || {}, // Legacy compatibility
        selectedOptions,
        // Manager-entered prices + free-form custom options from calculator
        openPrices: formData.openPrices || {},
        customOptions: formData.customOptions || [],
        notes: formData.notes || '',
        optionsTotal: calculateOptionsTotal(),
        subtotal,
        total,
        totalCost,
        retailExtraCost,
        margin,
        createdBy: user?.username || '',
        adminGifts,
        adminDiscountApproved: appliedDiscount > (prices.maxManagerDiscount || 10) && isAdminUser ? adminDiscountApproved : false,
        adminDiscountApprovedBy: appliedDiscount > (prices.maxManagerDiscount || 10) && adminDiscountApproved ? user?.username : '',
        adminDiscountApprovedAt: appliedDiscount > (prices.maxManagerDiscount || 10) && adminDiscountApproved ? new Date().toISOString() : '',
        requestedDiscount: !isAdminUser ? requestedDiscount : 0,
        requestedDiscountNote: !isAdminUser ? requestedDiscountNote : '',
        // Room sizes (based on terrace selection)
        ...getRoomSizes(),
        // Capacity (number of people)
        capacity: model?.capacity || null,
        // Layout catalog selection (for PDF generation)
        selectedLayoutId: selectedLayoutId || null,
        selectedLayoutSize: selectedLayoutSize || null,
        // Save layout image URL for tech spec (so it can be loaded without recalculating)
        layoutImageUrl: (() => {
          if (customLayoutImage?.url) return customLayoutImage.url;
          if (selectedLayoutId && layoutVariants.length > 0) {
            const found = layoutVariants.find(l => (l._id === selectedLayoutId || l.id === selectedLayoutId));
            if (found?.imageUrl) return found.imageUrl;
          }
          return null;
        })(),
        // Edit mode fields
        ...(isEditMode && editOrderId && !forceNew && {
          updatedBy: user?.username || 'calculator',
          updatedAt: new Date().toISOString(),
        }),
        // amoCRM integration fields - use 'calculator_amocrm' to distinguish from webhook imports
        ...(amocrmData && {
          amocrm_id: amocrmData.amocrm_id,
          amocrm_link: amocrmData.amocrm_link,
          amocrm_name: amocrmData.amocrm_name,
          source: 'calculator_amocrm',  // Different from 'amocrm' which is used for webhook imports
        }),
      };

      let finalOrderId;
      
      if (isEditMode && editOrderId && !forceNew) {
        await axios.put(`${API_URL}/api/sauna/orders/${editOrderId}`, orderData);
        finalOrderId = editOrderId;
        toast.success(txt.orderUpdated);
      } else {
        const orderResponse = await axios.post(`${API_URL}/api/sauna/orders`, orderData);
        finalOrderId = orderResponse.data?.id || '';
        toast.success(forceNew ? (txt.newKpCreated || txt.orderSaved) : txt.orderSaved);
      }

      // Generate PDF with additional page 2 data
      // Collect model variants
      const modelVariantsData = model?.variants?.map(v => ({
        id: v.id,
        name: v.name,
        namePl: v.namePl,
        price: v.price,
        imageUrl: v.imageUrl,
        hint: v.hint,
        hintPl: v.hintPl,
        // Room dimensions for comparison table
        capacity: v.capacity,
        terraceSize: v.terraceSize,
        relaxRoomSize: v.relaxRoomSize,
        steamRoomSize: v.steamRoomSize,
        entranceSide: v.entranceSide,
      })) || [];
      
      // Note: variantComparisonRows is no longer used - comparison table is now generated from variant data
      
      // Get categories that are visible only for Plus variant
      const plusOnlyCategories = (prices.categories || [])
        .filter(cat => {
          const visibleFor = cat.visibleForModelVariants || [];
          if (visibleFor.length === 0) return false;
          // Check if category is for Plus only
          return visibleFor.some(v => v.toLowerCase() === 'plus' || v.includes('plus'));
        })
        .map(cat => ({
          id: cat.id,
          name: cat.name,
          // Filter options by showInPdf flag
          options: (cat.options || [])
            .filter(opt => opt.showInPdf !== false)
            .map(opt => ({
              id: opt.id,
              name: opt.name,
              price: opt.price,
              imageUrl: opt.imageUrl,
              hint: opt.hint,
            }))
        }));
      
      // Get room dimensions from selected model variant (for WYMIARY POMIESZCZEŃ section)
      const selectedVariant = getSelectedModelVariant();
      let selectedModelVariantData = null;
      
      // Check if custom layout image was uploaded (highest priority)
      let customLayoutImageUrl = null;
      if (customLayoutImage?.url) {
        customLayoutImageUrl = customLayoutImage.url;
      }
      
      // Check if layout is selected from the Layout Catalog
      let layoutCatalogImageUrl = null;
      let selectedLayoutFromCatalog = null;
      let otherLayoutsForSize = [];
      
      // Get other layouts for the same size (for PDF page 2)
      // This should work even when custom image is uploaded
      if (selectedLayoutSize && layoutVariants.length > 0) {
        // If we have a selected layout from catalog, exclude it
        if (selectedLayoutId) {
          selectedLayoutFromCatalog = layoutVariants.find(l => 
            (l._id === selectedLayoutId || l.id === selectedLayoutId)
          );
          if (selectedLayoutFromCatalog?.imageUrl) {
            layoutCatalogImageUrl = selectedLayoutFromCatalog.imageUrl;
          }
          
          otherLayoutsForSize = layoutVariants
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
        } else {
          // No layout selected from catalog - show ALL layouts for this size
          // This happens when custom image is uploaded
          otherLayoutsForSize = layoutVariants
            .filter(l => l.modelSize === selectedLayoutSize)
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
        }
      }
      
      // Fallback: Check if there's a "Планировка" (Layout) category with selected option that has an image
      let layoutCategoryImageUrl = null;
      if (!layoutCatalogImageUrl && !customLayoutImageUrl) {
        const layoutCategory = prices.categories?.find(cat => 
          cat.name?.toLowerCase().includes('планировка') || 
          cat.name?.toLowerCase().includes('planowka') ||
          cat.name?.toLowerCase().includes('układ') ||
          cat.namePl?.toLowerCase().includes('planowka') ||
          cat.nameRu?.toLowerCase().includes('планировка')
        );
        
        if (layoutCategory) {
          const selectedLayoutOptId = formData.selections[layoutCategory.id];
          if (selectedLayoutOptId) {
            const selectedLayout = layoutCategory.options?.find(opt => opt.id === selectedLayoutOptId);
            if (selectedLayout?.imageUrl) {
              layoutCategoryImageUrl = selectedLayout.imageUrl;
            }
          }
        }
      }
      
      // Priority: Custom Uploaded Image > Layout Catalog > Layout Category > Variant image
      const finalLayoutImageUrl = customLayoutImageUrl || layoutCatalogImageUrl || layoutCategoryImageUrl;
      
      // When custom image is uploaded, still use variant data for dimensions
      // Only skip layout catalog data, but keep variant data as fallback
      if (selectedVariant && (selectedVariant.terraceSize || selectedVariant.relaxRoomSize || selectedVariant.steamRoomSize || selectedVariant.entranceSide || selectedVariant.imageUrl || selectedVariant.hint || selectedVariant.hintPl || finalLayoutImageUrl)) {
        selectedModelVariantData = {
          // For custom image: use variant name, not layout name
          name: customLayoutImageUrl ? (selectedVariant.namePl || selectedVariant.name) : (selectedLayoutFromCatalog?.variantName || selectedVariant.namePl || selectedVariant.name),
          // Use custom image first, then layout image, then variant image
          imageUrl: finalLayoutImageUrl || selectedVariant.imageUrl || null,
          // For dimensions: prefer layout catalog data, then fallback to variant data
          capacity: selectedLayoutFromCatalog?.peopleCount || selectedVariant.capacity || null,
          terraceSize: selectedLayoutFromCatalog?.terraceSize || selectedVariant.terraceSize || null,
          relaxRoomSize: selectedLayoutFromCatalog?.relaxRoomSize || selectedVariant.relaxRoomSize || null,
          steamRoomSize: selectedLayoutFromCatalog?.steamRoomSize || selectedVariant.steamRoomSize || null,
          entranceSide: selectedLayoutFromCatalog?.entranceSide || selectedVariant.entranceSide || null,
          hint: selectedLayoutFromCatalog?.description || selectedVariant.hintPl || selectedVariant.hint || null,
          isCustomImage: !!customLayoutImageUrl,
        };
      } else if (finalLayoutImageUrl || selectedLayoutFromCatalog) {
        // If no variant but layout selected or custom image uploaded, use layout data
        selectedModelVariantData = {
          name: selectedLayoutFromCatalog?.variantName || null,
          imageUrl: finalLayoutImageUrl,
          capacity: selectedLayoutFromCatalog?.peopleCount || null,
          terraceSize: selectedLayoutFromCatalog?.terraceSize || null,
          relaxRoomSize: selectedLayoutFromCatalog?.relaxRoomSize || null,
          steamRoomSize: selectedLayoutFromCatalog?.steamRoomSize || null,
          entranceSide: selectedLayoutFromCatalog?.entranceSide || null,
          hint: selectedLayoutFromCatalog?.description || null,
          isCustomImage: !!customLayoutImageUrl,
        };
      }
      
      // Get all available additional options with images (filtered by model compatibility)
      const allAvailableOptions = (prices.categories || [])
        .filter(cat => {
          // Exclude categories that are Plus-only or foundation
          const visibleFor = cat.visibleForModelVariants || [];
          if (visibleFor.length > 0) return false;
          if (cat.id === 'fundament') return false;
          return true;
        })
        .flatMap(cat => (cat.options || [])
          .filter(opt => {
            // Skip options hidden from PDF
            if (opt.showInPdf === false) return false;
            
            // Skip options incompatible with selected model
            const incompatibleModels = opt.incompatibleModels || [];
            if (incompatibleModels.length > 0 && formData.selectedModel) {
              if (incompatibleModels.includes(formData.selectedModel)) return false;
            }
            
            // Check showInPdfForModels if defined (whitelist)
            const showInPdfForModels = opt.showInPdfForModels || [];
            if (showInPdfForModels.length > 0 && formData.selectedModel) {
              if (!showInPdfForModels.includes(formData.selectedModel)) return false;
            }
            
            return true;
          })
          .map(opt => ({
            id: opt.id,
            name: opt.name,
            price: opt.price,
            imageUrl: opt.imageUrl,
            hint: opt.hint,  // Description for PDF
            categoryName: cat.name,
          })));
      
      // Get PDF Page 2 settings from prices
      const pdfPage2Settings = {
        pdfPage2Enabled: prices.pdfPage2Enabled !== false,
        pdfPage2VariantsTitle: prices.pdfPage2VariantsTitle || 'Możliwe warianty wykonania w wybranym rozmiarze',
        pdfPage2OptionsTitle: prices.pdfPage2OptionsTitle || 'Opcje, które można dodać do sauny',
        pdfPage2ShowVariants: prices.pdfPage2ShowVariants !== false,
        pdfPage2ShowComparisonTable: prices.pdfPage2ShowComparisonTable !== false,
        pdfPage2ShowPlusCategories: prices.pdfPage2ShowPlusCategories !== false,
        pdfPage2ShowAllOptions: prices.pdfPage2ShowAllOptions !== false,
      };
      
      const pdfData = { 
        ...orderData, 
        orderId: finalOrderId, 
        language: 'pl', 
        categories: prices.categories,
        // Page 2 data
        modelVariants: modelVariantsData,
        plusOnlyCategories: plusOnlyCategories,
        allAvailableOptions: allAvailableOptions,
        // Selected model variant data (for WYMIARY POMIESZCZEŃ section)
        selectedModelVariantData: selectedModelVariantData,
        // Other layouts for the same size (for page 2 - MOŻLIWE WARIANTY WYKONANIA)
        otherLayoutsForSize: otherLayoutsForSize,
        selectedLayoutSize: selectedLayoutSize,
        // Page 2 settings
        ...pdfPage2Settings,
        // Admin-configurable "What's included in our services" text shown after WYBRANE OPCJE.
        pdfIncludedServicesText: prices.pdfIncludedServicesText || '',
      };
      const response = await axios.post(`${API_URL}/api/sauna/generate-pdf`, pdfData, { responseType: 'blob' });

      const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      
      let safeName = (formData.fullName || 'Klient').replace(/\s+/g, '_').replace(/[<>:"/\\|?*]/g, '');
      if (!safeName || safeName === '_') safeName = 'Klient';
      link.setAttribute('download', `SAUNA_${safeName}_${finalOrderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(txt.pdfGenerated);

      // Determine crmLeadId from multiple sources (resilient to race conditions)
      const effectiveCrmLeadId = amocrmData?.crmLeadId 
        || editingOrder?._crmLeadId 
        || sessionStorage.getItem('pendingCrmLeadId') 
        || '';
      
      // DEBUG: Show what amocrmData we have for CRM linking
      console.log('[PDF Save] amocrmData:', JSON.stringify(amocrmData));
      console.log('[PDF Save] effectiveCrmLeadId:', effectiveCrmLeadId);
      console.log('[PDF Save] finalOrderId:', finalOrderId);

      // Upload PDF to amoCRM if this order came from amoCRM
      if (amocrmData?.amocrm_id && finalOrderId) {
        let pdfCloudinaryUrl = null;
        try {
          // Get employee name from current user
          const employeeName = user?.username || user?.name || '';
          const totalAmount = total?.toFixed(2) || '';
          
          const uploadResponse = await fetch(
            `${API_URL}/api/integrations/amocrm/upload-calculator-pdf?amocrm_id=${amocrmData.amocrm_id}&order_id=${finalOrderId}&calculator_type=sauna&client_name=${encodeURIComponent(formData.fullName || '')}&employee_name=${encodeURIComponent(employeeName)}&total_amount=${encodeURIComponent(totalAmount)}`,
            {
              method: 'POST',
              body: pdfBlob,
              headers: {
                'Content-Type': 'application/pdf'
              }
            }
          );
          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            pdfCloudinaryUrl = uploadResult.cloudinary_url || uploadResult.pdf_url || uploadResult.fallback_url;
            
            if (uploadResult.cloudinary_uploaded) {
              toast.success('PDF загружен и ссылка отправлена в amoCRM');
            } else if (uploadResult.status === 'ok' || uploadResult.status === 'partial') {
              toast.success('КП отправлено в amoCRM');
            }
          } else {
            console.error('upload-calculator-pdf returned', uploadResponse.status);
          }
        } catch (e) {
          console.error('Failed to upload PDF to amoCRM:', e);
        }
        
        // Always try to link PDF to CRM lead directly (even if amoCRM upload failed)
        if (effectiveCrmLeadId) {
          if (pdfCloudinaryUrl) {
            try {
              await axios.post(`${API_URL}/api/sauna-crm/leads/${effectiveCrmLeadId}/documents/link`, {
                url: pdfCloudinaryUrl,
                type: 'kp',
                name: `КП ${formData.fullName || ''} ${finalOrderId}`.trim(),
                filename: `KP_SAUNA_${finalOrderId}.pdf`,
                orderId: finalOrderId,
              });
              toast.success('КП добавлено в карточку CRM');
            } catch (docErr) {
              console.error('Failed to link PDF to CRM lead:', docErr);
            }
          } else {
            // amoCRM upload failed — try direct upload to CRM
            try {
              const formDataUpload = new FormData();
              formDataUpload.append('file', pdfBlob, `KP_SAUNA_${formData.fullName || 'Klient'}_${finalOrderId}.pdf`);
              formDataUpload.append('doc_type', 'kp');
              formDataUpload.append('doc_name', `КП ${formData.fullName || ''} ${finalOrderId}`.trim());
              
              const directRes = await fetch(`${API_URL}/api/sauna-crm/leads/${effectiveCrmLeadId}/documents`, {
                method: 'POST',
                body: formDataUpload,
              });
              if (directRes.ok) {
                toast.success('КП добавлено в карточку CRM');
              }
            } catch (directErr) {
              console.error('Direct CRM upload also failed:', directErr);
            }
          }
        }
      } else if (effectiveCrmLeadId && finalOrderId) {
        // No amoCRM ID but has CRM lead — upload PDF directly to CRM lead documents
        try {
          const formDataUpload = new FormData();
          formDataUpload.append('file', pdfBlob, `KP_SAUNA_${formData.fullName || 'Klient'}_${finalOrderId}.pdf`);
          formDataUpload.append('doc_type', 'kp');
          formDataUpload.append('doc_name', `КП ${formData.fullName || ''} ${finalOrderId}`.trim());
          
          const uploadRes = await fetch(`${API_URL}/api/sauna-crm/leads/${effectiveCrmLeadId}/documents`, {
            method: 'POST',
            body: formDataUpload,
          });
          if (uploadRes.ok) {
            toast.success('КП добавлено в карточку CRM');
          }
        } catch (e) {
          console.error('Failed to upload PDF to CRM lead:', e);
        }
      }

      // Save calculator data back to CRM lead if opened from Sauna CRM
      if (effectiveCrmLeadId && finalOrderId) {
        try {
          await axios.put(`${API_URL}/api/sauna-crm/leads/${effectiveCrmLeadId}/calculator-data`, {
            calculatorData: {
              orderId: finalOrderId,
              selectedModel: formData.selectedModel,
              total: total,
              createdAt: new Date().toISOString()
            }
          });
        } catch (e) {
          console.error('Failed to save calculator data to CRM lead:', e);
        }
      }

      if (isEditMode) {
        setIsEditMode(false);
        setEditOrderId(null);
        setAdminGifts([]);
        setAdminDiscountApproved(false);
        onEditComplete?.();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  // Clear form
  const handleClearForm = () => {
    const initialSelections = {};
    (prices.categories || []).forEach(cat => {
      initialSelections[cat.id] = cat.inputType === 'checkbox' ? {} : '';
    });

    setFormData({ ...getInitialFormData(), selections: initialSelections });
    setAppliedDiscount(0);
    setCertificateDiscount(false);
    setAdminGifts([]);
    setAdminDiscountApproved(false);
    setRequestedDiscount(0);
    setRequestedDiscountNote('');
    toast.success(txt.formCleared);
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditOrderId(null);
    setAdminGifts([]);
    setAdminDiscountApproved(false);
    handleClearForm();
    onEditComplete?.();
  };

  // Get category name with translation
  const getCategoryName = (category) => txt[category.name] || category.name;

  // Computed values
  const model = getSelectedModel();
  const optionsTotal = calculateOptionsTotal();
  const foundationPrice = calculateFoundationPrice();
  const deliveryPrice = calculateDeliveryPrice();
  const subtotal = calculateSubtotal();
  const discountAmount = subtotal * (appliedDiscount / 100);
  const total = calculateTotal();
  const roomSizes = getRoomSizes();

  // ── Open-price option handlers ─────────────────────────────────
  const handleOpenPriceChange = (optionId, value) => {
    const num = parseInt(value) || 0;
    setFormData(prev => ({
      ...prev,
      openPrices: { ...(prev.openPrices || {}), [optionId]: num },
    }));
  };

  // ── Custom (free-form) options handlers ────────────────────────
  const addCustomOption = (name, price, quantity = 1) => {
    if (!name || !name.trim()) return;
    const item = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      price: parseInt(price) || 0,
      quantity: parseInt(quantity) || 1,
    };
    setFormData(prev => ({
      ...prev,
      customOptions: [...(prev.customOptions || []), item],
    }));
  };

  const updateCustomOption = (id, patch) => {
    setFormData(prev => ({
      ...prev,
      customOptions: (prev.customOptions || []).map(it =>
        it.id === id ? { ...it, ...patch } : it
      ),
    }));
  };

  const removeCustomOption = (id) => {
    setFormData(prev => ({
      ...prev,
      customOptions: (prev.customOptions || []).filter(it => it.id !== id),
    }));
  };

  return {
    // State
    loading,
    initialLoading,
    prices,
    formData,
    appliedDiscount,
    certificateDiscount,
    isEditMode,
    editOrderId,
    adminGifts,
    adminDiscountApproved,
    requestedDiscount,
    requestedDiscountNote,
    isAdminUser,
    canGiveGifts,
    lang,
    txt,
    amocrmData,
    user,
    
    // Computed
    model,
    optionsTotal,
    foundationPrice,
    deliveryPrice,
    subtotal,
    discountAmount,
    total,
    roomSizes,
    maxManagerDiscount: prices.maxManagerDiscount || 10,
    modelVariant: getSelectedModelVariant(),
    modelPrice: getModelPrice(),
    
    // Layout catalog (from useLayoutCatalog hook)
    selectedLayoutSize,
    selectedLayoutId,
    layoutVariants,
    layoutLoading,
    customLayoutImage,
    customLayoutUploading,
    autoSelectedLayoutSize,
    handleLayoutSelect,
    clearLayoutSelection,
    uploadCustomLayoutImage,
    removeCustomLayoutImage,
    getSelectedLayout,
    getOtherLayoutsForSize,
    getLayoutsBySize,
    
    // Setters
    setFormData,
    setAppliedDiscount,
    setAdminDiscountApproved,
    setRequestedDiscount,
    setRequestedDiscountNote,
    
    // Handlers
    handleInputChange,
    handleDiscountChange,
    handleModelChange,
    handleModelVariantChange,
    handleApplyStandardDiscount,
    handleToggleCertificateDiscount,
    handleRadioChange,
    handleCheckboxChange,
    handleQuantityChange,
    handleVariantChange,
    handleSubOptionChange,
    toggleGift,
    removeOption,
    handleSaveAndGeneratePDF,
    handleClearForm,
    handleCancelEdit,
    getCategoryName,
    getSelectedOptions,
    isOptionVisible,
    isCategoryVisible,
    isTerraceSelected,
    getOptionBasePrice,
    handleOpenPriceChange,
    addCustomOption,
    updateCustomOption,
    removeCustomOption,
  };
};

export default useSaunaCalculator;
