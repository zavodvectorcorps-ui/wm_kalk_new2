import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Sparkles } from 'lucide-react';

export const FeaturesForm = ({ formData, onChange, prices }) => {
  const { t } = useTranslation();

  // Get display type for an option
  const getDisplayType = (key) => {
    return prices.displayTypes?.[key] || 'checkbox';
  };

  // Generate features dynamically from prices, excluding sand filter options
  const sandFilterKeys = ['sandFilterConnections', 'sandFilterUnderStairs', 'sandFilterBox'];
  
  const getFeaturesList = () => {
    const staticFeatures = [
      { key: 'jacuzzi', label: t('jacuzzi'), price: prices.features?.jacuzzi || 0 },
      { key: 'airBubble', label: t('airBubble'), price: prices.features?.airBubble || 0 },
      { key: 'outsideLed12', label: t('outsideLed12'), price: prices.features?.outsideLed12 || 0 },
      { key: 'insideLed', label: t('insideLed'), price: prices.features?.insideLed || 0 },
      { key: 'outsideLedStripe', label: t('outsideLedStripe'), price: prices.features?.outsideLedStripe || 0 },
      { key: 'insideLedMini', label: t('insideLedMini'), price: prices.features?.insideLedMini || 0 },
      { key: 'insulation', label: t('insulation'), price: prices.features?.insulation || 0 },
      { key: 'headPillow', label: t('headPillow'), price: prices.features?.headPillow || 0 },
      { key: 'v4aHeater', label: t('v4aHeater'), price: prices.features?.v4aHeater || 0 },
      { key: 'electricityBox', label: t('electricityBox'), price: prices.features?.electricityBox || 0 },
      { key: 'chimneyExtension', label: t('chimneyExtension'), price: prices.features?.chimneyExtension || 0 },
      { key: 'extraChimneyProtection', label: t('extraChimneyProtection'), price: prices.features?.extraChimneyProtection || 0 },
      { key: 'bluetoothRadio', label: t('bluetoothRadio'), price: prices.features?.bluetoothRadio || 0 },
      { key: 'electricHeater3kw', label: t('electricHeater3kw'), price: prices.features?.electricHeater3kw || 0 },
      { key: 'electricThermometer', label: t('electricThermometer'), price: prices.features?.electricThermometer || 0 },
    ];

    // Add display types
    const featuresWithTypes = staticFeatures.map(f => ({
      ...f,
      displayType: getDisplayType(f.key),
    }));

    // Add dynamic features from prices (excluding sand filters)
    if (prices.features) {
      const dynamicFeatures = Object.keys(prices.features)
        .filter(key => !sandFilterKeys.includes(key))
        .filter(key => !staticFeatures.find(f => f.key === key))
        .map(key => {
          const translationKey = key;
          const label = t(translationKey) !== translationKey ? t(translationKey) : key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
          return { 
            key, 
            label,
            price: prices.features[key] || 0,
            displayType: getDisplayType(key),
          };
        });
      
      return [...featuresWithTypes, ...dynamicFeatures];
    }

    return featuresWithTypes;
  };

  const features = getFeaturesList();

  // Get sand filter options with display types
  const getSandFilterOptions = () => {
    return [
      { 
        value: 'none', 
        label: t('none') || 'None',
        displayType: 'dropdown', // Always dropdown for "none"
      },
      { 
        value: 'sandFilterConnections', 
        label: t('sandFilterConnections'),
        price: prices.features?.sandFilterConnections || 0,
        displayType: getDisplayType('sandFilterConnections'),
      },
      { 
        value: 'sandFilterUnderStairs', 
        label: t('sandFilterUnderStairs'),
        price: prices.features?.sandFilterUnderStairs || 0,
        displayType: getDisplayType('sandFilterUnderStairs'),
      },
      { 
        value: 'sandFilterBox', 
        label: t('sandFilterBox'),
        price: prices.features?.sandFilterBox || 0,
        displayType: getDisplayType('sandFilterBox'),
      },
    ];
  };

  const sandFilterOptions = getSandFilterOptions();
  
  // Check if sand filters should be rendered as checkboxes
  const sandFilterAsCheckbox = sandFilterOptions.slice(1).every(opt => opt.displayType === 'checkbox');

  const handleCheckboxChange = (key, checked) => {
    onChange({
      target: {
        name: 'features',
        value: {
          ...formData.features,
          [key]: checked,
        },
      },
    });
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          {t('features')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sand Filter Section - render based on displayType */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('sandFilter')}</Label>
          
          {!sandFilterAsCheckbox ? (
            // Render as dropdown (default behavior)
            <Select 
              name="sandFilter" 
              value={formData.sandFilter} 
              onValueChange={(value) => onChange({ target: { name: 'sandFilter', value } })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('selectSandFilter') || 'Select sand filter'} />
              </SelectTrigger>
              <SelectContent>
                {sandFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                    {option.value !== 'none' && option.price > 0 && (
                      <span className="ml-2 text-muted-foreground">+{option.price}€</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            // Render as checkboxes (when all set to checkbox)
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sandFilterOptions.filter(opt => opt.value !== 'none').map((option) => (
                <div key={option.value} className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <Checkbox
                    id={option.value}
                    checked={formData.sandFilter === option.value}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onChange({ target: { name: 'sandFilter', value: option.value } });
                      } else {
                        onChange({ target: { name: 'sandFilter', value: 'none' } });
                      }
                    }}
                  />
                  <Label htmlFor={option.value} className="flex-1 cursor-pointer text-sm leading-tight">
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
          )}
        </div>

        {/* Other Features - render based on their individual displayTypes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {features.map((feature) => (
            <div key={feature.key} className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
              <Checkbox
                id={feature.key}
                checked={formData.features[feature.key] || false}
                onCheckedChange={(checked) => handleCheckboxChange(feature.key, checked)}
              />
              <Label
                htmlFor={feature.key}
                className="flex-1 cursor-pointer text-sm leading-tight"
              >
                {feature.label}
                {feature.price > 0 && (
                  <span className="block text-xs text-muted-foreground mt-1">
                    +{feature.price}€
                  </span>
                )}
              </Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
