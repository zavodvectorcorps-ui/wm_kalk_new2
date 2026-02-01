/**
 * Sauna Calculator Hooks and Utilities
 * 
 * This module exports all the hooks and utilities used by the sauna calculator.
 * The main hook (useSaunaCalculator) orchestrates all the logic,
 * while the specialized hooks handle specific concerns:
 * 
 * - useLayoutCatalog: Layout selection and catalog management
 * - usePriceCalculation: All pricing logic
 * - useOptionVisibility: Option visibility based on rules
 */

// Constants and utilities
export * from './constants';

// Main hook
export { useSaunaCalculator } from './useSaunaCalculator';

// Specialized hooks (can be used independently)
export { useLayoutCatalog } from './useLayoutCatalog';
export { usePriceCalculation } from './usePriceCalculation';
export { useOptionVisibility } from './useOptionVisibility';
