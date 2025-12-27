import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Receipt } from 'lucide-react';

export const OrderSummary = ({ formData, prices, total }) => {
  const { t } = useTranslation();

  const getPrice = (category, value) => {
    if (!value || !prices[category]) return 0;
    return prices[category][value] || 0;
  };

  const selectedItems = [];

  // Add configuration items
  if (formData.shellModel) {
    selectedItems.push({
      label: t('shellModel'),
      value: t(formData.shellModel),
      price: getPrice('shellModels', formData.shellModel),
    });
  }

  if (formData.woodType) {
    selectedItems.push({
      label: t('woodType'),
      value: t(formData.woodType),
      price: getPrice('woodTypes', formData.woodType),
    });
  }

  if (formData.shellColor) {
    selectedItems.push({
      label: t('shellColor'),
      value: t(formData.shellColor),
      price: getPrice('shellColors', formData.shellColor),
    });
  }

  if (formData.lidType) {
    selectedItems.push({
      label: t('lidType'),
      value: t(formData.lidType),
      price: getPrice('lidTypes', formData.lidType),
    });
  }

  if (formData.woodColor) {
    selectedItems.push({
      label: t('woodColor'),
      value: t(formData.woodColor),
      price: getPrice('woodColors', formData.woodColor),
    });
  }

  // Add sand filter if not none
  if (formData.sandFilter && formData.sandFilter !== 'none') {
    selectedItems.push({
      label: t('sandFilter'),
      value: t(formData.sandFilter),
      price: getPrice('features', formData.sandFilter),
    });
  }

  // Add selected features
  Object.entries(formData.features).forEach(([key, value]) => {
    if (value) {
      selectedItems.push({
        label: t(key),
        value: '✓',
        price: getPrice('features', key),
      });
    }
  });

  return (
    <Card className="shadow-lg sticky top-20">
      <CardHeader className="bg-gradient-to-br from-primary/5 to-accent/5">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Receipt className="h-5 w-5 text-primary" />
          {t('summary')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {selectedItems.length > 0 ? (
          <div className="space-y-3">
            {selectedItems.map((item, index) => (
              <div key={index} className="flex justify-between items-start text-sm">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.value}</p>
                </div>
                {item.price > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {item.price}€
                  </Badge>
                )}
              </div>
            ))}
            
            <Separator className="my-4" />
            
            <div className="flex justify-between items-center pt-2">
              <span className="text-base font-semibold">{t('total')}</span>
              <span className="text-2xl font-bold text-primary">
                {total.toFixed(2)}€
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">
              {t('selectOptions') || 'Выберите опции для расчета стоимости'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
