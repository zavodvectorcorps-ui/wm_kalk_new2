import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { DynamicOption } from './DynamicOption';

/**
 * Universal section component that renders options dynamically
 * based on their display types
 */
export const DynamicOptionsSection = ({ 
  title, 
  icon: Icon,
  category,
  options, // Array of {key, label, price, displayType}
  values, // Current form values for this category
  onChange,
}) => {
  const { t } = useTranslation();

  // Group options by display type
  const dropdownOptions = options.filter(opt => opt.displayType === 'dropdown');
  const checkboxOptions = options.filter(opt => opt.displayType === 'checkbox');

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {Icon && <Icon className="h-5 w-5 text-primary" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Render dropdown options */}
        {dropdownOptions.map((option) => (
          <DynamicOption
            key={option.key}
            optionKey={option.key}
            label={option.label}
            price={option.price}
            displayType="dropdown"
            value={values[option.key] || ''}
            onChange={(key, value) => onChange({ target: { name: key, value } })}
            category={category}
            allOptions={dropdownOptions.map(opt => ({
              value: opt.key,
              label: opt.label,
              price: opt.price,
            }))}
          />
        ))}

        {/* Render checkbox options in a grid */}
        {checkboxOptions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {checkboxOptions.map((option) => (
              <DynamicOption
                key={option.key}
                optionKey={option.key}
                label={option.label}
                price={option.price}
                displayType="checkbox"
                value={values[option.key] || false}
                onChange={(key, checked) => {
                  // For checkboxes in a category, we update the values object
                  const newValues = { ...values, [key]: checked };
                  onChange({ target: { name: category, value: newValues } });
                }}
                category={category}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
