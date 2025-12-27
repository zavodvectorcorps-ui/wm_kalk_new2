import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Sparkles } from 'lucide-react';

export const FeaturesForm = ({ formData, onChange, prices }) => {
  const { t } = useTranslation();

  const features = [
    { key: 'jacuzzi', label: t('jacuzzi') },
    { key: 'airBubble', label: t('airBubble') },
    { key: 'outsideLed12', label: t('outsideLed12') },
    { key: 'insideLed', label: t('insideLed') },
    { key: 'outsideLedStripe', label: t('outsideLedStripe') },
    { key: 'insideLedMini', label: t('insideLedMini') },
    { key: 'insulation', label: t('insulation') },
    { key: 'headPillow', label: t('headPillow') },
    { key: 'v4aHeater', label: t('v4aHeater') },
    { key: 'electricityBox', label: t('electricityBox') },
    { key: 'chimneyExtension', label: t('chimneyExtension') },
    { key: 'extraChimneyProtection', label: t('extraChimneyProtection') },
    { key: 'bluetoothRadio', label: t('bluetoothRadio') },
    { key: 'electricHeater3kw', label: t('electricHeater3kw') },
    { key: 'electricThermometer', label: t('electricThermometer') },
  ];

  const sandFilterOptions = [
    { value: 'none', label: t('none') || 'None' },
    { value: 'sandFilterConnections', label: t('sandFilterConnections') },
    { value: 'sandFilterUnderStairs', label: t('sandFilterUnderStairs') },
    { value: 'sandFilterBox', label: t('sandFilterBox') },
  ];

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
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('sandFilter')}</Label>
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
                  {option.value !== 'none' && prices.features?.[option.value] && (
                    <span className="ml-2 text-muted-foreground">+{prices.features[option.value]}€</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
                {prices.features?.[feature.key] && (
                  <span className="block text-xs text-muted-foreground mt-1">
                    +{prices.features[feature.key]}€
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
