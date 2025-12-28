import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Settings, Sparkles, Palette, Box, Trees, Crown, Folder } from 'lucide-react';

// Map category IDs to icons
const categoryIcons = {
  shellModels: Box,
  woodTypes: Trees,
  shellColors: Palette,
  lidTypes: Crown,
  woodColors: Palette,
  features: Sparkles,
};

export const DynamicCategorySection = ({ 
  categoryId,
  category,
  options,
  displayTypes,
  optionLabels,
  selection,
  onSelectionChange,
  onCheckboxChange,
}) => {
  const { t, i18n } = useTranslation();

  // Get icon for category
  const Icon = categoryIcons[categoryId] || Folder;

  // Get category name based on current language
  const getCategoryName = () => {
    const lang = i18n.language;
    if (lang === 'pl' && category.namePl) {
      return category.namePl;
    }
    if (category.nameRu) {
      return category.nameRu;
    }
    // Fallback to translation key or ID
    const translated = t(categoryId);
    return translated !== categoryId ? translated : category.name || categoryId;
  };

  // Get label for an option
  const getOptionLabel = (key) => {
    // Check custom labels first
    if (optionLabels && optionLabels[key]) {
      return optionLabels[key];
    }
    // Try translation
    const translated = t(key);
    if (translated !== key) {
      return translated;
    }
    // Fallback to formatted key
    return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
  };

  // Get display type for an option
  const getDisplayType = (key) => {
    return displayTypes[key] || category.displayType || 'dropdown';
  };

  // Get all options as array
  const optionsList = Object.entries(options).map(([key, price]) => ({
    key,
    price,
    label: getOptionLabel(key),
    displayType: getDisplayType(key),
  }));

  // Separate dropdown and checkbox options
  const dropdownOptions = optionsList.filter(opt => opt.displayType === 'dropdown');
  const checkboxOptions = optionsList.filter(opt => opt.displayType === 'checkbox');

  // If category is marked as checkbox type, treat all as checkboxes
  const isCheckboxCategory = category.displayType === 'checkbox';

  if (optionsList.length === 0) {
    return null; // Don't render empty categories
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="h-5 w-5 text-primary" />
          {category.name || t(categoryId) || categoryId}
          {category.required && <span className="text-destructive">*</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Render dropdown options */}
        {!isCheckboxCategory && dropdownOptions.length > 0 && (
          <div className="space-y-2">
            <Select 
              value={selection || ''} 
              onValueChange={(value) => onSelectionChange(categoryId, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={`${t('select')} ${category.name || t(categoryId)}`} />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {dropdownOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                    {option.price > 0 && (
                      <span className="ml-2 text-muted-foreground">+{option.price}€</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Render checkbox options */}
        {(isCheckboxCategory || checkboxOptions.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(isCheckboxCategory ? optionsList : checkboxOptions).map((option) => {
              const isChecked = typeof selection === 'object' 
                ? (selection[option.key] || false)
                : selection === option.key;

              return (
                <div 
                  key={option.key} 
                  className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={`${categoryId}-${option.key}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      if (isCheckboxCategory || option.displayType === 'checkbox') {
                        onCheckboxChange(categoryId, option.key, checked);
                      } else {
                        onSelectionChange(categoryId, checked ? option.key : '');
                      }
                    }}
                  />
                  <Label
                    htmlFor={`${categoryId}-${option.key}`}
                    className="flex-1 cursor-pointer text-sm leading-tight"
                  >
                    {option.label}
                    {option.price > 0 && (
                      <span className="block text-xs text-muted-foreground mt-1">
                        +{option.price}€
                      </span>
                    )}
                  </Label>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
