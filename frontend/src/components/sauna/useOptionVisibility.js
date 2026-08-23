import { useCallback } from 'react';

/**
 * Hook for option visibility logic.
 * Determines which options should be shown based on model and other selections.
 */
export const useOptionVisibility = (formData) => {
  
  // Check if option is visible based on incompatibility rules
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
        
        if (typeof selectedInDependentCategory === 'string') {
          if (hideWhenOptionIds.includes(selectedInDependentCategory)) {
            optionMatches = true;
            break;
          }
        }
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
    
    // Decision logic (independent OR): hide if ANY rule matches.
    if (modelMatches || optionMatches) {
      return false;
    }
    
    // LEGACY: Support old compatibleModels/compatibleWithOptions
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

  // Check if category is visible based on model variant restrictions
  const isCategoryVisible = useCallback((category) => {
    const visibleForModelVariants = category.visibleForModelVariants || [];
    
    if (visibleForModelVariants.length === 0) {
      return true; // No restrictions
    }
    
    // Check if current model variant matches any of the allowed variants
    const currentVariant = formData.selectedModelVariant;
    if (!currentVariant) {
      return false; // No variant selected, hide categories with restrictions
    }
    
    return visibleForModelVariants.some(v => 
      v.toLowerCase() === currentVariant.toLowerCase()
    );
  }, [formData.selectedModelVariant]);

  // Check if terrace option is selected
  const isTerraceSelected = useCallback(() => {
    const tarasSelection = formData.selections['opcje_dodatkowe'];
    if (typeof tarasSelection === 'object') {
      return tarasSelection['taras_zewnetrzny'] === true;
    }
    return tarasSelection === 'taras_zewnetrzny';
  }, [formData.selections]);

  return {
    isOptionVisible,
    isCategoryVisible,
    isTerraceSelected,
  };
};

export default useOptionVisibility;
