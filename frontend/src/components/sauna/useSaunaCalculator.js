import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import { API_URL, getTranslation, getImageUrl, getInitialFormData } from './constants';
import { useOptionVisibility } from './useOptionVisibility';
import { useLayoutCatalog } from './useLayoutCatalog';

export const useSaunaCalculator = (editingOrder = null, onEditComplete, amocrmPrefill = null, onAmocrmPrefillUsed = null) => {
  const { t, i18n } = useTranslation();
  const { user, isAdmin } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [prices, setPrices] = useState({ models: [], categories: [] });
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  
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
  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = getTranslation(lang);
  
  const [formData, setFormData] = useState(getInitialFormData());

  // Use modular hooks
  const { isOptionVisible, isCategoryVisible, isTerraceSelected } = useOptionVisibility(formData);
  const { 
    selectedLayoutSize, 
    selectedLayoutId, 
    layoutVariants, 
    layoutLoading,
    handleLayoutSelect,
    clearLayoutSelection,
    getSelectedLayout,
    getOtherLayoutsForSize,
    getLayoutsBySize
  } = useLayoutCatalog();

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
      setPrices(response.data);
      
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

  // Load layout variants for catalog
  useEffect(() => {
    const fetchLayoutVariants = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/faq/layout-variants`);
        setLayoutVariants(response.data || []);
      } catch (error) {
        console.error('Failed to load layout variants:', error);
      }
    };
    fetchLayoutVariants();
  }, []);

  // Handler for layout catalog selection
  const handleLayoutSelect = useCallback((size, layoutId) => {
    setSelectedLayoutSize(size);
    setSelectedLayoutId(layoutId);
  }, []);

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
          subSelections: rebuiltSubSelections 
        }));
      }
      
      setAppliedDiscount(editingOrder.discountPercent || 0);
      setAdminGifts(editingOrder.adminGifts || []);
      setAdminDiscountApproved(editingOrder.adminDiscountApproved || false);
      
      // Restore amoCRM data from original order (critical for edit flow from widget)
      if (editingOrder.amocrm_id) {
        setAmocrmData({
          amocrm_id: editingOrder.amocrm_id,
          amocrm_link: editingOrder.amocrm_link || '',
          amocrm_name: editingOrder.amocrm_name || '',
        });
      }
      
      toast.info(`${txt.editingOrder}: ${editingOrder.id}`);
    }
  }, [editingOrder, prices.categories, txt.editingOrder]);

  // Get selected model
  const getSelectedModel = useCallback(() => {
    return prices.models?.find(m => m.id === formData.selectedModel);
  }, [prices.models, formData.selectedModel]);

  // Get selected model variant
  const getSelectedModelVariant = useCallback(() => {
    const model = getSelectedModel();
    if (!model || !model.variants?.length) return null;
    
    // If variant is selected, return it
    if (formData.selectedModelVariant) {
      return model.variants.find(v => v.id === formData.selectedModelVariant);
    }
    
    // Default to first variant if model has variants but none selected
    return model.variants[0];
  }, [getSelectedModel, formData.selectedModelVariant]);

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

  // Handle model variant change
  const handleModelVariantChange = (variantId) => {
    setFormData(prev => ({ ...prev, selectedModelVariant: variantId }));
  };

  // Check if terrace option is selected
  const isTerraceSelected = useCallback(() => {
    const tarasSelection = formData.selections['opcje_dodatkowe'];
    if (typeof tarasSelection === 'object') {
      // Checkbox category - check if taras_zewnetrzny is selected
      return tarasSelection['taras_zewnetrzny'] === true;
    }
    // For other input types
    return tarasSelection === 'taras_zewnetrzny';
  }, [formData.selections]);

  // Get room sizes based on terrace selection
  const getRoomSizes = useCallback(() => {
    const model = getSelectedModel();
    if (!model) return { relaxRoomSize: null, steamRoomSize: null };
    
    const hasTerrace = isTerraceSelected();
    
    return {
      relaxRoomSize: hasTerrace && model.relaxRoomSizeWithTerrace 
        ? model.relaxRoomSizeWithTerrace 
        : model.relaxRoomSize,
      steamRoomSize: hasTerrace && model.steamRoomSizeWithTerrace 
        ? model.steamRoomSizeWithTerrace 
        : model.steamRoomSize,
      hasTerrace
    };
  }, [getSelectedModel, isTerraceSelected]);

  // Check if option is visible based on incompatibility rules
  // Returns true if option should be visible/included, false if hidden
  const isOptionVisible = useCallback((option) => {
    const incompatibleModels = option.incompatibleModels || [];
    const incompatibleWithOptions = option.incompatibleWithOptions || {};
    const hasModelRules = incompatibleModels.length > 0;
    const hasOptionRules = Object.keys(incompatibleWithOptions).length > 0;
    
    // Check if current model is in incompatible list
    const modelMatches = hasModelRules && formData.selectedModel && 
      incompatibleModels.includes(formData.selectedModel);
    
    // Check if any incompatible option is selected
    let optionMatches = false;
    if (hasOptionRules) {
      for (const [dependentCategoryId, hideWhenOptionIds] of Object.entries(incompatibleWithOptions)) {
        if (hideWhenOptionIds.length === 0) continue;
        
        const selectedInDependentCategory = formData.selections[dependentCategoryId];
        
        // For radio/select - direct value
        if (typeof selectedInDependentCategory === 'string') {
          if (hideWhenOptionIds.includes(selectedInDependentCategory)) {
            optionMatches = true;
            break;
          }
        }
        // For checkbox - check if any incompatible option is selected
        else if (typeof selectedInDependentCategory === 'object') {
          const hasIncompatibleSelection = hideWhenOptionIds.some(
            optId => selectedInDependentCategory[optId] === true
          );
          if (hasIncompatibleSelection) {
            optionMatches = true;
            break;
          }
        }
      }
    }
    
    // Decision logic:
    // - If BOTH model AND option rules are set: hide only when BOTH match
    // - If ONLY model rules are set: hide when model matches
    // - If ONLY option rules are set: hide when option matches
    if (hasModelRules && hasOptionRules) {
      if (modelMatches && optionMatches) {
        return false;
      }
    } else if (hasModelRules) {
      if (modelMatches) {
        return false;
      }
    } else if (hasOptionRules) {
      if (optionMatches) {
        return false;
      }
    }
    
    // LEGACY: Support old compatibleModels/compatibleWithOptions for backward compatibility
    const compatibleModels = option.compatibleModels || [];
    if (compatibleModels.length > 0 && formData.selectedModel) {
      if (!compatibleModels.includes(formData.selectedModel)) {
        return false;
      }
    }
    
    const compatibleWithOptions = option.compatibleWithOptions || {};
    for (const [dependentCategoryId, allowedOptionIds] of Object.entries(compatibleWithOptions)) {
      if (allowedOptionIds.length === 0) continue;
      
      const selectedInDependentCategory = formData.selections[dependentCategoryId];
      
      if (typeof selectedInDependentCategory === 'string') {
        if (!allowedOptionIds.includes(selectedInDependentCategory)) {
          return false;
        }
      }
      else if (typeof selectedInDependentCategory === 'object') {
        const hasAllowedSelection = allowedOptionIds.some(
          optId => selectedInDependentCategory[optId] === true
        );
        if (!hasAllowedSelection) {
          return false;
        }
      }
      else {
        return false;
      }
    }
    
    return true;
  }, [formData.selectedModel, formData.selections]);

  // Get option base price considering model-specific pricing
  const getOptionBasePrice = useCallback((option) => {
    if (!option) return 0;
    
    // Check if option has model-specific pricing
    const priceByModel = option.priceByModel || {};
    const selectedModelId = formData.selectedModel;
    
    // If model-specific price exists, use it
    if (selectedModelId && priceByModel[selectedModelId] !== undefined) {
      return priceByModel[selectedModelId];
    }
    
    // Otherwise use default option price
    return option.price || 0;
  }, [formData.selectedModel]);

  // Calculate options total (only visible options)
  const calculateOptionsTotal = useCallback(() => {
    let total = 0;
    const categories = prices.categories || [];
    
    categories.forEach(category => {
      const selection = formData.selections[category.id];
      if (!selection) return;
      
      if (category.inputType === 'checkbox') {
        Object.entries(selection).forEach(([optId, isSelected]) => {
          if (isSelected) {
            const option = category.options?.find(o => o.id === optId);
            // Skip hidden options
            if (!option || !isOptionVisible(option)) return;
            
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
  }, [prices.categories, formData.selections, formData.quantities, formData.variantSelections, isOptionVisible, getOptionBasePrice]);

  // Calculate foundation price
  const calculateFoundationPrice = useCallback(() => {
    const model = getSelectedModel();
    if (!model) return 0;
    
    const foundationCat = prices.categories?.find(c => c.id === 'fundament');
    if (foundationCat) {
      const selection = formData.selections[foundationCat.id];
      if (selection && selection.includes('dodaj')) {
        return model.foundationPrice || 0;
      }
    }
    return 0;
  }, [getSelectedModel, prices.categories, formData.selections]);

  // Calculate subtotal
  const calculateSubtotal = useCallback(() => {
    const model = getSelectedModel();
    if (!model) return 0;
    
    // Use variant price if available, otherwise use base price
    const modelPrice = getModelPrice();
    return modelPrice + calculateOptionsTotal() + calculateFoundationPrice();
  }, [getSelectedModel, getModelPrice, calculateOptionsTotal, calculateFoundationPrice]);

  // Calculate total
  const calculateTotal = useCallback(() => {
    const subtotal = calculateSubtotal();
    const discountAmount = subtotal * (appliedDiscount / 100);
    return subtotal - discountAmount;
  }, [calculateSubtotal, appliedDiscount]);

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

  const handleModelChange = (modelId) => {
    // Reset model variant selection when changing model
    setFormData(prev => ({ ...prev, selectedModel: modelId, selectedModelVariant: '' }));
    setAppliedDiscount(0);
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
              optionName: variantName ? `${option.name} (${variantName})` : option.name,
              price: finalPrice,
              quantity,
              totalPrice: finalPrice * quantity,
              imageUrl: finalImageUrl,
              hintImageUrl: option.hintImageUrl || null,
              techSpecId: option.techSpecId || null,
              techSpecCategoryId: option.techSpecCategoryId || category.techSpecCategoryId || null,
              selectedVariantId,
              selectedVariant: selectedVariant ? {
                id: selectedVariant.id,
                name: selectedVariant.namePl || selectedVariant.name,
                price: selectedVariant.price,
                imageUrl: selectedVariant.imageUrl || null
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
          optionName: variantName ? `${option.name} (${variantName})` : option.name,
          price: finalPrice,
          quantity,
          totalPrice: finalPrice * quantity,
          imageUrl: finalImageUrl,
          hintImageUrl: option.hintImageUrl || null,
          techSpecId: option.techSpecId || null,
          techSpecCategoryId: option.techSpecCategoryId || category.techSpecCategoryId || null,
          selectedVariantId,
          selectedVariant: selectedVariant ? {
            id: selectedVariant.id,
            name: selectedVariant.namePl || selectedVariant.name,
            price: selectedVariant.price,
            imageUrl: selectedVariant.imageUrl || null
          } : null,
          selectedSubOptions: [],
          subOptionsTotal: 0,
        });
      }
    });
    
    return options;
  }, [prices.categories, formData.selections, formData.quantities, formData.variantSelections, getSelectedModel, isOptionVisible, getOptionBasePrice]);

  // Save and generate PDF
  const handleSaveAndGeneratePDF = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const model = getSelectedModel();
      const modelVariant = getSelectedModelVariant();
      const subtotal = calculateSubtotal();
      const selectedOptions = getSelectedOptions();
      
      // Calculate total considering admin gifts
      const giftsTotal = selectedOptions
        .filter(opt => adminGifts.includes(opt.optionId) || adminGifts.includes(opt.id))
        .reduce((sum, opt) => sum + (opt.totalPrice || opt.price || 0), 0);
      const discountableAmount = subtotal - giftsTotal;
      const discountAmount = discountableAmount * (appliedDiscount / 100);
      const total = discountableAmount - discountAmount;
      
      const orderId = isEditMode && editOrderId ? editOrderId : undefined;
      
      // Get effective price (base price + variant price)
      const baseModelPrice = model?.basePrice || 0;
      const variantPrice = modelVariant?.price || 0;
      const effectivePrice = baseModelPrice + variantPrice;
      // Get model image - always from main model, not variant
      const modelImage = model?.imageUrl || '';
      // Get model name with variant
      const effectiveModelName = modelVariant 
        ? `${model?.name || ''} (${modelVariant.namePl || modelVariant.name || ''})` 
        : (model?.name || '');
      
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
        selections: formData.selections,
        quantities: formData.quantities || {},
        variantSelections: formData.variantSelections || {},
        subSelections: formData.subSelections || {}, // Legacy compatibility
        selectedOptions,
        notes: formData.notes || '',
        optionsTotal: calculateOptionsTotal(),
        subtotal,
        total,
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
        // Edit mode fields
        ...(isEditMode && editOrderId && {
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
      
      if (isEditMode && editOrderId) {
        await axios.put(`${API_URL}/api/sauna/orders/${editOrderId}`, orderData);
        finalOrderId = editOrderId;
        toast.success(txt.orderUpdated);
      } else {
        const orderResponse = await axios.post(`${API_URL}/api/sauna/orders`, orderData);
        finalOrderId = orderResponse.data?.id || '';
        toast.success(txt.orderSaved);
        
        // Mark quote as created in amoCRM
        if (amocrmData?.amocrm_id && finalOrderId) {
          try {
            await axios.post(`${API_URL}/api/integrations/amocrm/mark-quote-created?amocrm_id=${amocrmData.amocrm_id}&order_id=${finalOrderId}&calculator_type=sauna`);
          } catch (e) {
            console.error('Failed to mark quote in amoCRM:', e);
          }
        }
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
      
      // Check if layout is selected from the Layout Catalog
      let layoutCatalogImageUrl = null;
      let selectedLayoutFromCatalog = null;
      let otherLayoutsForSize = [];
      
      if (selectedLayoutId && layoutVariants.length > 0) {
        selectedLayoutFromCatalog = layoutVariants.find(l => 
          (l._id === selectedLayoutId || l.id === selectedLayoutId)
        );
        if (selectedLayoutFromCatalog?.imageUrl) {
          layoutCatalogImageUrl = selectedLayoutFromCatalog.imageUrl;
        }
        
        // Get other layouts for the same size (for PDF page 2)
        if (selectedLayoutSize) {
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
        }
      }
      
      // Fallback: Check if there's a "Планировка" (Layout) category with selected option that has an image
      let layoutCategoryImageUrl = null;
      if (!layoutCatalogImageUrl) {
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
      
      // Priority: Layout Catalog > Layout Category > Variant image
      const finalLayoutImageUrl = layoutCatalogImageUrl || layoutCategoryImageUrl;
      
      if (selectedVariant && (selectedVariant.terraceSize || selectedVariant.relaxRoomSize || selectedVariant.steamRoomSize || selectedVariant.entranceSide || selectedVariant.imageUrl || selectedVariant.hint || selectedVariant.hintPl || finalLayoutImageUrl)) {
        selectedModelVariantData = {
          name: selectedLayoutFromCatalog?.variantName || selectedVariant.namePl || selectedVariant.name,
          // Use layout image if available, otherwise use variant image
          imageUrl: finalLayoutImageUrl || selectedVariant.imageUrl || null,
          capacity: selectedLayoutFromCatalog?.peopleCount || selectedVariant.capacity || null,
          terraceSize: selectedLayoutFromCatalog?.terraceSize || selectedVariant.terraceSize || null,
          relaxRoomSize: selectedLayoutFromCatalog?.relaxRoomSize || selectedVariant.relaxRoomSize || null,
          steamRoomSize: selectedLayoutFromCatalog?.steamRoomSize || selectedVariant.steamRoomSize || null,
          entranceSide: selectedLayoutFromCatalog?.entranceSide || selectedVariant.entranceSide || null,
          hint: selectedLayoutFromCatalog?.description || selectedVariant.hintPl || selectedVariant.hint || null,
        };
      } else if (finalLayoutImageUrl || selectedLayoutFromCatalog) {
        // If no variant but layout selected, use layout data
        selectedModelVariantData = {
          name: selectedLayoutFromCatalog?.variantName || null,
          imageUrl: finalLayoutImageUrl,
          capacity: selectedLayoutFromCatalog?.peopleCount || null,
          terraceSize: selectedLayoutFromCatalog?.terraceSize || null,
          relaxRoomSize: selectedLayoutFromCatalog?.relaxRoomSize || null,
          steamRoomSize: selectedLayoutFromCatalog?.steamRoomSize || null,
          entranceSide: selectedLayoutFromCatalog?.entranceSide || null,
          hint: selectedLayoutFromCatalog?.description || null,
        };
      }
      
      // Get all available additional options with images (filter by showInPdf)
      const allAvailableOptions = (prices.categories || [])
        .filter(cat => {
          // Exclude categories that are Plus-only or foundation
          const visibleFor = cat.visibleForModelVariants || [];
          if (visibleFor.length > 0) return false;
          if (cat.id === 'fundament') return false;
          return true;
        })
        .flatMap(cat => (cat.options || [])
          .filter(opt => opt.showInPdf !== false)  // Only include options with showInPdf=true or undefined
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

      // Upload PDF to amoCRM if this order came from amoCRM
      if (amocrmData?.amocrm_id && finalOrderId) {
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
          const uploadResult = await uploadResponse.json();
          if (uploadResult.pdf_uploaded) {
            toast.success('PDF загружен в amoCRM');
          }
        } catch (e) {
          console.error('Failed to upload PDF to amoCRM:', e);
        }
      }

      // Save calculator data back to CRM lead if opened from Sauna CRM
      if (amocrmData?.crmLeadId && finalOrderId) {
        try {
          await axios.put(`${API_URL}/api/sauna-crm/leads/${amocrmData.crmLeadId}/calculator-data`, {
            calculatorData: {
              orderId: finalOrderId,
              selectedModel: formData.selectedModel,
              total: total,
              createdAt: new Date().toISOString()
            },
            pdfUrl: null // PDF is stored in amoCRM, not as URL
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
  const subtotal = calculateSubtotal();
  const discountAmount = subtotal * (appliedDiscount / 100);
  const total = calculateTotal();
  const roomSizes = getRoomSizes();

  return {
    // State
    loading,
    initialLoading,
    prices,
    formData,
    appliedDiscount,
    isEditMode,
    editOrderId,
    adminGifts,
    adminDiscountApproved,
    requestedDiscount,
    requestedDiscountNote,
    isAdminUser,
    lang,
    txt,
    amocrmData,
    user,
    
    // Computed
    model,
    optionsTotal,
    foundationPrice,
    subtotal,
    discountAmount,
    total,
    roomSizes,
    maxManagerDiscount: prices.maxManagerDiscount || 10,
    modelVariant: getSelectedModelVariant(),
    modelPrice: getModelPrice(),
    
    // Layout catalog
    selectedLayoutSize,
    selectedLayoutId,
    layoutVariants,
    handleLayoutSelect,
    
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
    handleRadioChange,
    handleCheckboxChange,
    handleQuantityChange,
    handleVariantChange,
    handleSubOptionChange,
    toggleGift,
    handleSaveAndGeneratePDF,
    handleClearForm,
    handleCancelEdit,
    getCategoryName,
    getSelectedOptions,
    isOptionVisible,
    getOptionBasePrice,
  };
};

export default useSaunaCalculator;
