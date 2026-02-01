import { useCallback } from 'react';

/**
 * Hook for sauna price calculations.
 * Handles all pricing logic including options, variants, and discounts.
 */
export const usePriceCalculation = (prices, formData, isOptionVisible) => {
  
  // Get selected model
  const getSelectedModel = useCallback(() => {
    return prices.models?.find(m => m.id === formData.selectedModel);
  }, [prices.models, formData.selectedModel]);

  // Get selected model variant
  const getSelectedModelVariant = useCallback(() => {
    const model = getSelectedModel();
    if (!model || !model.variants?.length) return null;
    
    if (formData.selectedModelVariant) {
      return model.variants.find(v => v.id === formData.selectedModelVariant);
    }
    
    return model.variants[0];
  }, [getSelectedModel, formData.selectedModelVariant]);

  // Get effective model price (from variant or base price)
  const getModelPrice = useCallback(() => {
    const model = getSelectedModel();
    if (!model) return 0;
    
    let totalPrice = model.basePrice;
    
    const variant = getSelectedModelVariant();
    if (variant && variant.price) {
      totalPrice += variant.price;
    }
    
    return totalPrice;
  }, [getSelectedModel, getSelectedModelVariant]);

  // Get option base price considering model-specific pricing
  const getOptionBasePrice = useCallback((option) => {
    if (!option) return 0;
    
    const priceByModel = option.priceByModel || {};
    const selectedModelId = formData.selectedModel;
    
    if (selectedModelId && priceByModel[selectedModelId] !== undefined) {
      return priceByModel[selectedModelId];
    }
    
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
            if (!option || !isOptionVisible(option)) return;
            
            const quantity = option.hasQuantity ? (formData.quantities[optId] || 1) : 1;
            const variants = option.variants?.length > 0 ? option.variants : option.subOptions;
            const basePrice = getOptionBasePrice(option);
            
            const selectedVariantId = formData.variantSelections?.[optId];
            if (selectedVariantId && variants?.length > 0) {
              const selectedVariant = variants.find(v => v.id === selectedVariantId);
              if (selectedVariant) {
                total += selectedVariant.price * quantity;
              } else {
                total += basePrice * quantity;
              }
            } else if (variants?.length > 0) {
              total += (variants[0]?.price || basePrice) * quantity;
            } else {
              total += basePrice * quantity;
            }
          }
        });
      } else {
        const option = category.options?.find(o => o.id === selection);
        if (!option || !isOptionVisible(option)) return;
        
        const quantity = option.hasQuantity ? (formData.quantities[selection] || 1) : 1;
        const variants = option.variants?.length > 0 ? option.variants : option.subOptions;
        const basePrice = getOptionBasePrice(option);
        
        const selectedVariantId = formData.variantSelections?.[selection];
        if (selectedVariantId && variants?.length > 0) {
          const selectedVariant = variants.find(v => v.id === selectedVariantId);
          if (selectedVariant) {
            total += selectedVariant.price * quantity;
          } else {
            total += basePrice * quantity;
          }
        } else if (variants?.length > 0) {
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
      const selectedOption = foundationCat.options?.find(o => o.id === selection);
      
      if (selectedOption?.pricePerMeter) {
        const modelSize = parseFloat(model.name.match(/\d+/)?.[0]) || 0;
        return selectedOption.pricePerMeter * modelSize;
      }
      
      return selectedOption?.price || 0;
    }
    
    return 0;
  }, [getSelectedModel, prices.categories, formData.selections]);

  // Calculate subtotal
  const calculateSubtotal = useCallback(() => {
    const modelPrice = getModelPrice();
    const optionsTotal = calculateOptionsTotal();
    const foundationPrice = calculateFoundationPrice();
    
    return modelPrice + optionsTotal + foundationPrice;
  }, [getModelPrice, calculateOptionsTotal, calculateFoundationPrice]);

  // Calculate total with discount
  const calculateTotal = useCallback((appliedDiscount = 0, adminGifts = []) => {
    const subtotal = calculateSubtotal();
    
    // Calculate gifts total
    let giftsTotal = 0;
    const categories = prices.categories || [];
    
    categories.forEach(category => {
      const selection = formData.selections[category.id];
      if (!selection) return;
      
      if (category.inputType === 'checkbox') {
        Object.entries(selection).forEach(([optId, isSelected]) => {
          if (isSelected && adminGifts.includes(optId)) {
            const option = category.options?.find(o => o.id === optId);
            if (option) {
              const quantity = option.hasQuantity ? (formData.quantities[optId] || 1) : 1;
              giftsTotal += (option.price || 0) * quantity;
            }
          }
        });
      } else if (adminGifts.includes(selection)) {
        const option = category.options?.find(o => o.id === selection);
        if (option) {
          const quantity = option.hasQuantity ? (formData.quantities[selection] || 1) : 1;
          giftsTotal += (option.price || 0) * quantity;
        }
      }
    });
    
    const discountableAmount = subtotal - giftsTotal;
    const discountAmount = discountableAmount * (appliedDiscount / 100);
    
    return discountableAmount - discountAmount;
  }, [calculateSubtotal, prices.categories, formData.selections, formData.quantities]);

  return {
    getSelectedModel,
    getSelectedModelVariant,
    getModelPrice,
    getOptionBasePrice,
    calculateOptionsTotal,
    calculateFoundationPrice,
    calculateSubtotal,
    calculateTotal,
  };
};

export default usePriceCalculation;
