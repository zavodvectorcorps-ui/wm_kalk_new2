import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Settings } from 'lucide-react';

export const ConfigurationForm = ({ formData, onChange, prices }) => {
  const { t } = useTranslation();

  // Get display type for an option
  const getDisplayType = (key) => {
    return prices.displayTypes?.[key] || 'dropdown';
  };

  // Generate options with display types from prices
  const getOptionsFromPrices = (category, fallbackOptions) => {
    if (prices[category] && Object.keys(prices[category]).length > 0) {
      return Object.keys(prices[category]).map(key => {
        const translationKey = key;
        const label = t(translationKey) !== translationKey ? t(translationKey) : key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
        return { 
          key,
          value: key, 
          label,
          price: prices[category][key],
          displayType: getDisplayType(key),
        };
      });
    }
    return fallbackOptions;
  };

  const shellModels = getOptionsFromPrices('shellModels', [
    { value: 'round200', label: t('round200') },
    { value: 'round225', label: t('round225') },
    { value: 'square170x200', label: t('square170x200') },
    { value: 'square220x220', label: t('square220x220') },
    { value: 'square230x230', label: t('square230x230') },
    { value: 'square245x245', label: t('square245x245') },
  ]);

  const woodTypes = getOptionsFromPrices('woodTypes', [
    { value: 'spruce', label: t('spruce') },
    { value: 'thermo', label: t('thermo') },
    { value: 'wpc', label: t('wpc') },
    { value: 'redCedric', label: t('redCedric') },
  ]);

  const shellColors = getOptionsFromPrices('shellColors', [
    { value: 'white', label: t('white') },
    { value: 'ivory', label: t('ivory') },
    { value: 'blue', label: t('blue') },
    { value: 'gray', label: t('gray') },
    { value: 'pearlRed', label: t('pearlRed') },
    { value: 'pearlBlue', label: t('pearlBlue') },
    { value: 'pearlBrown', label: t('pearlBrown') },
    { value: 'pearlGray', label: t('pearlGray') },
    { value: 'pearlWhite', label: t('pearlWhite') },
    { value: 'galaxy', label: t('galaxy') },
    { value: 'snowflake', label: t('snowflake') },
    { value: 'emerald', label: t('emerald') },
    { value: 'blackGoldGlitter', label: t('blackGoldGlitter') },
    { value: 'blackPinkGlitter', label: t('blackPinkGlitter') },
    { value: 'blackSilverGlitter', label: t('blackSilverGlitter') },
  ]);

  const lidTypes = getOptionsFromPrices('lidTypes', [
    { value: 'glassFiberLid', label: t('glassFiberLid') },
    { value: 'spaLid', label: t('spaLid') },
  ]);

  const woodColors = getOptionsFromPrices('woodColors', [
    { key: 'akrilasWhite', value: 'akrilasWhite', label: t('akrilasWhite') },
    { key: 'akrilasGreenMarble', value: 'akrilasGreenMarble', label: t('akrilasGreenMarble') },
    { key: 'akrilasBrownMarble', value: 'akrilasBrownMarble', label: t('akrilasBrownMarble') },
    { key: 'akrilasBlueMarble', value: 'akrilasBlueMarble', label: t('akrilasBlueMarble') },
    { key: 'akrilasWhiteMarble', value: 'akrilasWhiteMarble', label: t('akrilasWhiteMarble') },
    { key: 'akrilasCoffeeMarble', value: 'akrilasCoffeeMarble', label: t('akrilasCoffeeMarble') },
    { key: 'akrilasBlackMarble', value: 'akrilasBlackMarble', label: t('akrilasBlackMarble') },
    { key: 'natural', value: 'natural', label: t('natural') },
    { key: 'painted', value: 'painted', label: t('painted') },
    { key: 'oiled', value: 'oiled', label: t('oiled') },
  ]);

  // Render option based on its display type
  const renderOption = (fieldName, labelKey, options, required = true) => {
    // Group by display type
    const dropdowns = options.filter(opt => opt.displayType === 'dropdown');
    const checkboxes = options.filter(opt => opt.displayType === 'checkbox');

    return (
      <div className="space-y-4">
        {/* Render dropdowns */}
        {dropdowns.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor={fieldName} className="text-sm font-medium">
              {t(labelKey)} {required && <span className="text-destructive">*</span>}
            </Label>
            <Select 
              name={fieldName} 
              value={formData[fieldName]} 
              onValueChange={(value) => onChange({ target: { name: fieldName, value } })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t(`select${labelKey.charAt(0).toUpperCase() + labelKey.slice(1)}`) || `Выберите ${t(labelKey)}`} />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {dropdowns.map((option) => (
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
        )}

        {/* Render checkboxes */}
        {checkboxes.length > 0 && (
          <div className="space-y-2">
            {dropdowns.length === 0 && (
              <Label className="text-sm font-medium">{t(labelKey)}</Label>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {checkboxes.map((option) => (
                <div key={option.key} className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <Checkbox
                    id={option.key}
                    checked={formData[fieldName] === option.key}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onChange({ target: { name: fieldName, value: option.key } });
                      }
                    }}
                  />
                  <Label htmlFor={option.key} className="flex-1 cursor-pointer text-sm leading-tight">
                    {option.label}
                    {option.price > 0 && (
                      <span className="block text-xs text-muted-foreground mt-1">
                        +{option.price}€
                      </span>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5 text-primary" />
          {t('configuration')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderOption('shellModel', 'shellModel', shellModels, true)}
        {renderOption('woodType', 'woodType', woodTypes, true)}
        {renderOption('shellColor', 'shellColor', shellColors, true)}
        {renderOption('lidType', 'lidType', lidTypes, true)}
        {renderOption('woodColor', 'woodColor', woodColors, true)}
      </CardContent>
    </Card>
  );
};
