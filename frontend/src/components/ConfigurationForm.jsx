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
    { value: 'akrilasWhite', label: t('akrilasWhite') },
    { value: 'akrilasGreenMarble', label: t('akrilasGreenMarble') },
    { value: 'akrilasBrownMarble', label: t('akrilasBrownMarble') },
    { value: 'akrilasBlueMarble', label: t('akrilasBlueMarble') },
    { value: 'akrilasWhiteMarble', label: t('akrilasWhiteMarble') },
    { value: 'akrilasCoffeeMarble', label: t('akrilasCoffeeMarble') },
    { value: 'akrilasBlackMarble', label: t('akrilasBlackMarble') },
    { value: 'natural', label: t('natural') },
    { value: 'painted', label: t('painted') },
    { value: 'oiled', label: t('oiled') },
  ]);

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5 text-primary" />
          {t('configuration')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="shellModel" className="text-sm font-medium">
            {t('shellModel')} <span className="text-destructive">*</span>
          </Label>
          <Select name="shellModel" value={formData.shellModel} onValueChange={(value) => onChange({ target: { name: 'shellModel', value } })}>
            <SelectTrigger>
              <SelectValue placeholder={t('selectShellModel')} />
            </SelectTrigger>
            <SelectContent>
              {shellModels.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                  {prices.shellModels?.[model.value] && (
                    <span className="ml-2 text-muted-foreground">+{prices.shellModels[model.value]}€</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="woodType" className="text-sm font-medium">
            {t('woodType')} <span className="text-destructive">*</span>
          </Label>
          <Select name="woodType" value={formData.woodType} onValueChange={(value) => onChange({ target: { name: 'woodType', value } })}>
            <SelectTrigger>
              <SelectValue placeholder={t('selectWoodType')} />
            </SelectTrigger>
            <SelectContent>
              {woodTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                  {prices.woodTypes?.[type.value] && (
                    <span className="ml-2 text-muted-foreground">+{prices.woodTypes[type.value]}€</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="shellColor" className="text-sm font-medium">
            {t('shellColor')} <span className="text-destructive">*</span>
          </Label>
          <Select name="shellColor" value={formData.shellColor} onValueChange={(value) => onChange({ target: { name: 'shellColor', value } })}>
            <SelectTrigger>
              <SelectValue placeholder={t('selectShellColor')} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {shellColors.map((color) => (
                <SelectItem key={color.value} value={color.value}>
                  {color.label}
                  {prices.shellColors?.[color.value] && (
                    <span className="ml-2 text-muted-foreground">+{prices.shellColors[color.value]}€</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lidType" className="text-sm font-medium">
            {t('lidType')} <span className="text-destructive">*</span>
          </Label>
          <Select name="lidType" value={formData.lidType} onValueChange={(value) => onChange({ target: { name: 'lidType', value } })}>
            <SelectTrigger>
              <SelectValue placeholder={t('selectLidType')} />
            </SelectTrigger>
            <SelectContent>
              {lidTypes.map((lid) => (
                <SelectItem key={lid.value} value={lid.value}>
                  {lid.label}
                  {prices.lidTypes?.[lid.value] && (
                    <span className="ml-2 text-muted-foreground">+{prices.lidTypes[lid.value]}€</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="woodColor" className="text-sm font-medium">
            {t('woodColor')} <span className="text-destructive">*</span>
          </Label>
          <Select name="woodColor" value={formData.woodColor} onValueChange={(value) => onChange({ target: { name: 'woodColor', value } })}>
            <SelectTrigger>
              <SelectValue placeholder={t('selectWoodColor')} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {woodColors.map((color) => (
                <SelectItem key={color.value} value={color.value}>
                  {color.label}
                  {prices.woodColors?.[color.value] && (
                    <span className="ml-2 text-muted-foreground">+{prices.woodColors[color.value]}€</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};
