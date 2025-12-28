import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Receipt } from 'lucide-react';

export const OrderSummary = ({ formData, prices, total, categories = {} }) => {
  const { t, i18n } = useTranslation();

  // Get category name based on current language
  const getCategoryName = (category, categoryId) => {
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
    if (prices.optionLabels && prices.optionLabels[key]) {
      return prices.optionLabels[key];
    }
    // Try translation
    const translated = t(key);
    if (translated !== key) {
      return translated;
    }
    // Fallback to formatted key
    return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
  };

  // Get price for an option from its category
  const getPrice = (categoryId, key) => {
    if (!key || !prices[categoryId]) return 0;
    return prices[categoryId][key] || 0;
  };

  const selectedItems = [];

  // Process selections based on categories
  const selections = formData.selections || {};
  
  // Sort categories by order
  const sortedCategories = Object.entries(categories)
    .map(([id, cat]) => ({ id, ...cat }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  sortedCategories.forEach(category => {
    const categoryId = category.id;
    const selection = selections[categoryId];

    if (!selection) return;

    if (typeof selection === 'object') {
      // Checkbox category - list all selected options
      Object.entries(selection).forEach(([key, isSelected]) => {
        if (isSelected) {
          selectedItems.push({
            label: getCategoryName(category, categoryId),
            value: getOptionLabel(key),
            price: getPrice(categoryId, key),
          });
        }
      });
    } else if (selection) {
      // Dropdown category - single selection
      selectedItems.push({
        label: getCategoryName(category, categoryId),
        value: getOptionLabel(selection),
        price: getPrice(categoryId, selection),
      });
    }
  });

  // Fallback for legacy formData format (for backward compatibility)
  if (selectedItems.length === 0 && formData.shellModel) {
    if (formData.shellModel) {
      selectedItems.push({
        label: t('shellModel'),
        value: t(formData.shellModel),
        price: prices.shellModels?.[formData.shellModel] || 0,
      });
    }
    if (formData.woodType) {
      selectedItems.push({
        label: t('woodType'),
        value: t(formData.woodType),
        price: prices.woodTypes?.[formData.woodType] || 0,
      });
    }
    if (formData.shellColor) {
      selectedItems.push({
        label: t('shellColor'),
        value: t(formData.shellColor),
        price: prices.shellColors?.[formData.shellColor] || 0,
      });
    }
    if (formData.lidType) {
      selectedItems.push({
        label: t('lidType'),
        value: t(formData.lidType),
        price: prices.lidTypes?.[formData.lidType] || 0,
      });
    }
    if (formData.woodColor) {
      selectedItems.push({
        label: t('woodColor'),
        value: t(formData.woodColor),
        price: prices.woodColors?.[formData.woodColor] || 0,
      });
    }
    if (formData.sandFilter && formData.sandFilter !== 'none') {
      selectedItems.push({
        label: t('sandFilter'),
        value: t(formData.sandFilter),
        price: prices.features?.[formData.sandFilter] || 0,
      });
    }
    if (formData.features) {
      Object.entries(formData.features).forEach(([key, value]) => {
        if (value) {
          selectedItems.push({
            label: t(key),
            value: '✓',
            price: prices.features?.[key] || 0,
          });
        }
      });
    }
  }

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
