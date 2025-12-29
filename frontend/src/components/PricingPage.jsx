import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DollarSign, Save, Loader2, Plus, Trash2, List, CheckSquare, Folder, Eye } from 'lucide-react';
import { CategoryManager, CategoryList } from './CategoryManager';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Default option labels for translation
const defaultOptionLabels = {
  shellModels: {
    round200: 'round200',
    round225: 'round225',
    square170x200: 'square170x200',
    square220x220: 'square220x220',
    square230x230: 'square230x230',
    square245x245: 'square245x245',
  },
  woodTypes: {
    spruce: 'spruce',
    thermo: 'thermo',
    wpc: 'wpc',
    redCedric: 'redCedric',
  },
  shellColors: {
    white: 'white',
    ivory: 'ivory',
    blue: 'blue',
    gray: 'gray',
    pearlRed: 'pearlRed',
    pearlBlue: 'pearlBlue',
    pearlBrown: 'pearlBrown',
    pearlGray: 'pearlGray',
    pearlWhite: 'pearlWhite',
    galaxy: 'galaxy',
    snowflake: 'snowflake',
    emerald: 'emerald',
    blackGoldGlitter: 'blackGoldGlitter',
    blackPinkGlitter: 'blackPinkGlitter',
    blackSilverGlitter: 'blackSilverGlitter',
  },
  lidTypes: {
    glassFiberLid: 'glassFiberLid',
    spaLid: 'spaLid',
  },
  woodColors: {
    akrilasWhite: 'akrilasWhite',
    akrilasGreenMarble: 'akrilasGreenMarble',
    akrilasBrownMarble: 'akrilasBrownMarble',
    akrilasBlueMarble: 'akrilasBlueMarble',
    akrilasWhiteMarble: 'akrilasWhiteMarble',
    akrilasCoffeeMarble: 'akrilasCoffeeMarble',
    akrilasBlackMarble: 'akrilasBlackMarble',
    natural: 'natural',
    painted: 'painted',
    oiled: 'oiled',
  },
  features: {
    jacuzzi: 'jacuzzi',
    airBubble: 'airBubble',
    outsideLed12: 'outsideLed12',
    insideLed: 'insideLed',
    outsideLedStripe: 'outsideLedStripe',
    insideLedMini: 'insideLedMini',
    insulation: 'insulation',
    headPillow: 'headPillow',
    sandFilterConnections: 'sandFilterConnections',
    sandFilterUnderStairs: 'sandFilterUnderStairs',
    sandFilterBox: 'sandFilterBox',
    v4aHeater: 'v4aHeater',
    electricityBox: 'electricityBox',
    chimneyExtension: 'chimneyExtension',
    extraChimneyProtection: 'extraChimneyProtection',
    bluetoothRadio: 'bluetoothRadio',
    electricHeater3kw: 'electricHeater3kw',
    electricThermometer: 'electricThermometer',
  },
};

export const PricingPage = () => {
  const { t, i18n } = useTranslation();
  const { canEdit } = useAuth();
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState({
    shellModels: {},
    woodTypes: {},
    shellColors: {},
    lidTypes: {},
    woodColors: {},
    features: {},
    displayTypes: {},
    categories: {},
    optionCategories: {},
    optionLabels: {},
  });
  const [newOption, setNewOption] = useState({ 
    key: '', 
    label: '', 
    price: 0, 
    displayType: 'dropdown',
    category: '' 
  });
  const [isAddOptionDialogOpen, setIsAddOptionDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);

  useEffect(() => {
    fetchPrices();
  }, []);

  const fetchPrices = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/prices`);
      setPrices(response.data);
    } catch (error) {
      console.error('Error fetching prices:', error);
      toast.error(t('error'));
    }
  };

  const handlePriceChange = (category, key, value) => {
    setPrices((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: parseFloat(value) || 0,
      },
    }));
  };

  const handleSavePrices = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/prices`, prices);
      toast.success(t('pricesSaved'));
    } catch (error) {
      console.error('Error saving prices:', error);
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddOption = () => {
    if (!newOption.key || !newOption.label || !newOption.category) {
      toast.error('Заполните все поля');
      return;
    }

    const category = newOption.category;

    // Check if key already exists in any category
    const allCategories = ['shellModels', 'woodTypes', 'shellColors', 'lidTypes', 'woodColors', 'features'];
    for (const cat of allCategories) {
      if (prices[cat] && prices[cat][newOption.key]) {
        toast.error(`Опция с ключом "${newOption.key}" уже существует`);
        return;
      }
    }

    setPrices((prev) => ({
      ...prev,
      [category]: {
        ...(prev[category] || {}),
        [newOption.key]: parseFloat(newOption.price) || 0,
      },
      displayTypes: {
        ...prev.displayTypes,
        [newOption.key]: newOption.displayType,
      },
      optionCategories: {
        ...prev.optionCategories,
        [newOption.key]: category,
      },
      optionLabels: {
        ...(prev.optionLabels || {}),
        [newOption.key]: newOption.label,
      },
    }));

    toast.success(`Опция "${newOption.label}" добавлена!`);
    
    setNewOption({ key: '', label: '', price: 0, displayType: 'dropdown', category: '' });
    setIsAddOptionDialogOpen(false);
  };

  const handleCreateCategory = (newCategory) => {
    setPrices((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [newCategory.id]: {
          name: newCategory.name,
          displayType: newCategory.displayType,
          required: newCategory.required,
          order: newCategory.order,
        },
      },
      [newCategory.id]: {},
    }));

    toast.success(`Категория "${newCategory.name}" создана!`);
    setIsCategoryDialogOpen(false);
  };

  const handleDeleteCategory = (categoryId) => {
    if (window.confirm(`Удалить категорию? Все опции в ней будут удалены.`)) {
      setPrices((prev) => {
        const newCategories = { ...prev.categories };
        delete newCategories[categoryId];
        
        const newPrices = { ...prev };
        delete newPrices[categoryId];
        
        // Remove optionCategories that point to this category
        const newOptionCategories = { ...prev.optionCategories };
        Object.keys(newOptionCategories).forEach(key => {
          if (newOptionCategories[key] === categoryId) {
            delete newOptionCategories[key];
          }
        });
        
        return {
          ...newPrices,
          categories: newCategories,
          optionCategories: newOptionCategories,
        };
      });
      toast.success('Категория удалена');
    }
  };

  const handleMoveCategoryUp = (categoryId) => {
    setPrices((prev) => {
      const sortedCategories = Object.entries(prev.categories)
        .map(([id, cat]) => ({ id, ...cat }))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      
      const currentIndex = sortedCategories.findIndex(c => c.id === categoryId);
      if (currentIndex <= 0) return prev;
      
      const currentOrder = sortedCategories[currentIndex].order;
      const prevOrder = sortedCategories[currentIndex - 1].order;
      
      return {
        ...prev,
        categories: {
          ...prev.categories,
          [categoryId]: { ...prev.categories[categoryId], order: prevOrder },
          [sortedCategories[currentIndex - 1].id]: { 
            ...prev.categories[sortedCategories[currentIndex - 1].id], 
            order: currentOrder 
          },
        },
      };
    });
  };

  const handleMoveCategoryDown = (categoryId) => {
    setPrices((prev) => {
      const sortedCategories = Object.entries(prev.categories)
        .map(([id, cat]) => ({ id, ...cat }))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      
      const currentIndex = sortedCategories.findIndex(c => c.id === categoryId);
      if (currentIndex >= sortedCategories.length - 1) return prev;
      
      const currentOrder = sortedCategories[currentIndex].order;
      const nextOrder = sortedCategories[currentIndex + 1].order;
      
      return {
        ...prev,
        categories: {
          ...prev.categories,
          [categoryId]: { ...prev.categories[categoryId], order: nextOrder },
          [sortedCategories[currentIndex + 1].id]: { 
            ...prev.categories[sortedCategories[currentIndex + 1].id], 
            order: currentOrder 
          },
        },
      };
    });
  };

  const handleToggleRequired = (categoryId, required) => {
    setPrices((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [categoryId]: {
          ...prev.categories[categoryId],
          required: required,
        },
      },
    }));
    toast.success(required ? 'Категория теперь обязательная' : 'Категория теперь необязательная');
  };

  const handleDeleteOption = (category, key) => {
    if (window.confirm(`Удалить опцию "${key}"?`)) {
      setPrices((prev) => {
        const newCategory = { ...prev[category] };
        delete newCategory[key];
        
        const newDisplayTypes = { ...prev.displayTypes };
        delete newDisplayTypes[key];
        
        const newOptionCategories = { ...prev.optionCategories };
        delete newOptionCategories[key];

        const newOptionLabels = { ...(prev.optionLabels || {}) };
        delete newOptionLabels[key];
        
        return {
          ...prev,
          [category]: newCategory,
          displayTypes: newDisplayTypes,
          optionCategories: newOptionCategories,
          optionLabels: newOptionLabels,
        };
      });
      toast.success('Опция удалена');
    }
  };

  const handleChangeDisplayType = (key, newType) => {
    setPrices((prev) => ({
      ...prev,
      displayTypes: {
        ...prev.displayTypes,
        [key]: newType,
      },
    }));
    toast.success(`Тип отображения изменен на ${newType === 'dropdown' ? 'выпадающий список' : 'чекбокс'}`);
  };

  const handleChangeOptionCategory = (optionKey, newCategoryId, oldCategoryId) => {
    setPrices((prev) => {
      const price = prev[oldCategoryId]?.[optionKey] || 0;
      
      // Remove from old category
      const oldCategoryOptions = { ...prev[oldCategoryId] };
      delete oldCategoryOptions[optionKey];
      
      // Add to new category
      const newCategoryOptions = {
        ...(prev[newCategoryId] || {}),
        [optionKey]: price,
      };
      
      return {
        ...prev,
        [oldCategoryId]: oldCategoryOptions,
        [newCategoryId]: newCategoryOptions,
        optionCategories: {
          ...prev.optionCategories,
          [optionKey]: newCategoryId,
        },
      };
    });
    toast.success('Опция перемещена в другую категорию');
  };

  // Get category name based on current language
  const getCategoryName = (category, categoryId) => {
    const lang = i18n.language;
    if (lang === 'pl' && category?.namePl) {
      return category.namePl;
    }
    if (category?.nameRu) {
      return category.nameRu;
    }
    // Fallback to translation key or ID
    const translated = t(categoryId);
    return translated !== categoryId ? translated : category?.name || categoryId;
  };

  // Get label for an option
  const getOptionLabel = (category, key) => {
    // Check custom labels first
    if (prices.optionLabels && prices.optionLabels[key]) {
      return prices.optionLabels[key];

    }
    // Check default labels
    if (defaultOptionLabels[category] && defaultOptionLabels[category][key]) {
      const translationKey = defaultOptionLabels[category][key];
      const translated = t(translationKey);
      return translated !== translationKey ? translated : key;
    }
    // Fallback to key formatting
    return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
  };

  // Get all category IDs for the category selector
  const getAllCategoryIds = () => {
    const defaultCategories = ['shellModels', 'woodTypes', 'shellColors', 'lidTypes', 'woodColors', 'features'];
    const customCategories = Object.keys(prices.categories || {}).filter(
      id => !defaultCategories.includes(id)
    );
    return [...defaultCategories, ...customCategories];
  };

  // Render options for a category
  const renderCategoryOptions = (categoryId, categoryName) => {
    const options = prices[categoryId] || {};
    const optionKeys = Object.keys(options);

    if (optionKeys.length === 0) {
      return (
        <p className="text-center text-muted-foreground py-4">
          Нет опций в этой категории
        </p>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {optionKeys.map((key) => {
          const displayType = prices.displayTypes?.[key] || 'dropdown';
          const label = getOptionLabel(categoryId, key);
          
          return (
            <div key={key} className="flex gap-2 items-start border rounded-lg p-3 bg-card">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-sm font-medium">
                    {label}
                  </Label>
                  {!defaultOptionLabels[categoryId]?.[key] && (
                    <span className="text-xs text-muted-foreground">(пользовательская)</span>
                  )}
                  <div className="flex-1" />
                  <Select
                    value={displayType}
                    onValueChange={(value) => handleChangeDisplayType(key, value)}
                  >
                    <SelectTrigger className="h-7 w-[130px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dropdown">
                        <div className="flex items-center gap-1.5">
                          <List className="h-3 w-3" />
                          <span>Dropdown</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="checkbox">
                        <div className="flex items-center gap-1.5">
                          <CheckSquare className="h-3 w-3" />
                          <span>Checkbox</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Category selector for option */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Категория:</Label>
                  <Select
                    value={categoryId}
                    onValueChange={(newCatId) => handleChangeOptionCategory(key, newCatId, categoryId)}
                  >
                    <SelectTrigger className="h-7 flex-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAllCategoryIds().map((catId) => (
                        <SelectItem key={catId} value={catId}>
                          {getCategoryName(prices.categories?.[catId], catId)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={options[key] || 0}
                    onChange={(e) => handlePriceChange(categoryId, key, e.target.value)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    €
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteOption(categoryId, key)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 mt-6"
                title="Удалить опцию"
                disabled={!canEdit()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  // Get sorted categories
  const getSortedCategories = () => {
    const defaultCategories = ['shellModels', 'woodTypes', 'shellColors', 'lidTypes', 'woodColors', 'features'];
    const allCategories = prices.categories || {};
    
    return Object.entries(allCategories)
      .map(([id, cat]) => ({ id, ...cat }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  const sortedCategories = getSortedCategories();

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="space-y-6">
        {/* Category Management Section */}
        <CategoryList
          categories={prices.categories || {}}
          onDelete={handleDeleteCategory}
          onMoveUp={handleMoveCategoryUp}
          onMoveDown={handleMoveCategoryDown}
          onCreateNew={() => setIsCategoryDialogOpen(true)}
          onToggleRequired={handleToggleRequired}
          canEdit={canEdit()}
        />

        {/* Add Option Dialog */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-br from-primary/5 to-accent/5">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-2xl">
                <DollarSign className="h-6 w-6 text-primary" />
                {t('pricingManagement')}
              </div>
              <Button onClick={() => setIsAddOptionDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                {t('addOption')}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            {/* Render each category */}
            {sortedCategories.map((category, index) => (
              <div key={category.id}>
                {index > 0 && <Separator className="mb-6" />}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Folder className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-lg text-foreground">
                      {getCategoryName(category, category.id)}
                    </h3>
                    {category.required && (
                      <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">
                        {t('required')}
                      </span>
                    )}
                  </div>
                  {renderCategoryOptions(category.id, category.name)}
                </div>
              </div>
            ))}

            <div className="flex justify-end pt-6">
              <Button
                onClick={handleSavePrices}
                disabled={loading}
                size="lg"
                className="min-w-[200px]"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Save className="h-5 w-5 mr-2" />
                )}
                {t('updatePrices')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Category Creation Dialog */}
        <CategoryManager
          isOpen={isCategoryDialogOpen}
          onClose={() => setIsCategoryDialogOpen(false)}
          onSave={handleCreateCategory}
          existingCategories={prices.categories || {}}
        />

        {/* Add Option Dialog */}
        <Dialog open={isAddOptionDialogOpen} onOpenChange={setIsAddOptionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить новую опцию</DialogTitle>
              <DialogDescription>
                Введите уникальный ключ (на английском, без пробелов), название и цену
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="option-category">Категория <span className="text-destructive">*</span></Label>
                <Select
                  value={newOption.category}
                  onValueChange={(value) => setNewOption({ ...newOption, category: value })}
                >
                  <SelectTrigger id="option-category">
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAllCategoryIds().map((catId) => (
                      <SelectItem key={catId} value={catId}>
                        {getCategoryName(prices.categories?.[catId], catId)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="option-key">Ключ опции (например: custom_option_1) <span className="text-destructive">*</span></Label>
                <Input
                  id="option-key"
                  value={newOption.key}
                  onChange={(e) => setNewOption({ ...newOption, key: e.target.value.replace(/\s/g, '_').toLowerCase() })}
                  placeholder="custom_option_1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="option-label">Название опции <span className="text-destructive">*</span></Label>
                <Input
                  id="option-label"
                  value={newOption.label}
                  onChange={(e) => setNewOption({ ...newOption, label: e.target.value })}
                  placeholder="Моя новая опция"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="option-price">Цена (€)</Label>
                <Input
                  id="option-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newOption.price}
                  onChange={(e) => setNewOption({ ...newOption, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display-type">Тип отображения в калькуляторе</Label>
                <Select
                  value={newOption.displayType}
                  onValueChange={(value) => setNewOption({ ...newOption, displayType: value })}
                >
                  <SelectTrigger id="display-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dropdown">
                      <div className="flex items-center gap-2">
                        <List className="h-4 w-4" />
                        <span>Выпадающий список</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="checkbox">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-4 w-4" />
                        <span>Чекбокс</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOptionDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleAddOption}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
