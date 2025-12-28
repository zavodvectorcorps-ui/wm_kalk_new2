import React from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';

/**
 * Universal component that renders an option as either dropdown or checkbox
 * based on its displayType from prices
 */
export const DynamicOption = ({ 
  optionKey, 
  label, 
  price,
  displayType, 
  value, 
  onChange,
  category,
  allOptions = [] // For dropdown: list of all options in this category
}) => {
  const { t } = useTranslation();

  if (displayType === 'checkbox') {
    // Render as checkbox
    return (
      <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
        <Checkbox
          id={optionKey}
          checked={value || false}
          onCheckedChange={(checked) => onChange(optionKey, checked)}
        />
        <Label
          htmlFor={optionKey}
          className="flex-1 cursor-pointer text-sm leading-tight"
        >
          {label}
          {price > 0 && (
            <span className="block text-xs text-muted-foreground mt-1">
              +{price}€
            </span>
          )}
        </Label>
      </div>
    );
  }

  // Render as dropdown (default)
  return (
    <div className="space-y-2">
      <Label htmlFor={optionKey} className="text-sm font-medium">
        {label}
      </Label>
      <Select 
        value={value} 
        onValueChange={(val) => onChange(optionKey, val)}
      >
        <SelectTrigger id={optionKey}>
          <SelectValue placeholder={`Выберите ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {allOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
              {option.price > 0 && (
                <span className="ml-2 text-muted-foreground">+{option.price}€</span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
