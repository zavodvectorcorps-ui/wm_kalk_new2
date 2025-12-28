import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DollarSign, Save, Loader2, Plus, Trash2, Edit, List, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const PricingPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState({
    shellModels: {},
    woodTypes: {},
    shellColors: {},
    lidTypes: {},
    woodColors: {},
    features: {},
    displayTypes: {}, // New: stores display type for each option
  });
  const [newOption, setNewOption] = useState({ key: '', label: '', price: 0, displayType: 'dropdown' });
  const [editingCategory, setEditingCategory] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
    if (!newOption.key || !newOption.label) {
      toast.error(t('fillRequired') || 'Заполните все поля');
      return;
    }

    setPrices((prev) => ({
      ...prev,
      [editingCategory]: {
        ...prev[editingCategory],
        [newOption.key]: parseFloat(newOption.price) || 0,
      },
    }));

    // Save to translations (simplified - in production would update translation files)
    toast.success(`Опция "${newOption.label}" добавлена!`);
    
    setNewOption({ key: '', label: '', price: 0 });
    setIsDialogOpen(false);
  };

  const handleDeleteOption = (category, key) => {
    if (window.confirm(`Удалить опцию "${key}"?`)) {
      setPrices((prev) => {
        const newCategory = { ...prev[category] };
        delete newCategory[key];
        return {
          ...prev,
          [category]: newCategory,
        };
      });
      toast.success('Опция удалена');
    }
  };

  const renderPriceSection = (title, category, items) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg text-foreground">{title}</h3>
        <Dialog open={isDialogOpen && editingCategory === category} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (open) setEditingCategory(category);
        }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Добавить опцию
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить новую опцию в "{title}"</DialogTitle>
              <DialogDescription>
                Введите уникальный ключ (на английском, без пробелов), название и цену
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="option-key">Ключ опции (например: custom_option_1)</Label>
                <Input
                  id="option-key"
                  value={newOption.key}
                  onChange={(e) => setNewOption({ ...newOption, key: e.target.value.replace(/\s/g, '_').toLowerCase() })}
                  placeholder="custom_option_1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="option-label">Название опции</Label>
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.key} className="flex gap-2 items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor={`${category}-${item.key}`} className="text-sm">
                {item.label}
              </Label>
              <div className="relative">
                <Input
                  id={`${category}-${item.key}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={prices[category][item.key] || 0}
                  onChange={(e) => handlePriceChange(category, item.key, e.target.value)}
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
              onClick={() => handleDeleteOption(category, item.key)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Удалить опцию"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {/* Show dynamically added options */}
        {Object.keys(prices[category] || {})
          .filter(key => !items.find(item => item.key === key))
          .map((key) => (
            <div key={key} className="flex gap-2 items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor={`${category}-${key}`} className="text-sm flex items-center gap-2">
                  {key}
                  <span className="text-xs text-muted-foreground">(пользовательская)</span>
                </Label>
                <div className="relative">
                  <Input
                    id={`${category}-${key}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={prices[category][key] || 0}
                    onChange={(e) => handlePriceChange(category, key, e.target.value)}
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
                onClick={() => handleDeleteOption(category, key)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Удалить опцию"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Card className="shadow-lg">
        <CardHeader className="bg-gradient-to-br from-primary/5 to-accent/5">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <DollarSign className="h-6 w-6 text-primary" />
            {t('pricingManagement')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-8">
          {renderPriceSection(
            t('shellModel'),
            'shellModels',
            [
              { key: 'round200', label: t('round200') },
              { key: 'round225', label: t('round225') },
              { key: 'square170x200', label: t('square170x200') },
              { key: 'square220x220', label: t('square220x220') },
              { key: 'square230x230', label: t('square230x230') },
              { key: 'square245x245', label: t('square245x245') },
            ]
          )}

          <Separator />

          {renderPriceSection(
            t('woodType'),
            'woodTypes',
            [
              { key: 'spruce', label: t('spruce') },
              { key: 'thermo', label: t('thermo') },
              { key: 'wpc', label: t('wpc') },
              { key: 'redCedric', label: t('redCedric') },
            ]
          )}

          <Separator />

          {renderPriceSection(
            t('shellColor'),
            'shellColors',
            [
              { key: 'white', label: t('white') },
              { key: 'ivory', label: t('ivory') },
              { key: 'blue', label: t('blue') },
              { key: 'gray', label: t('gray') },
              { key: 'pearlRed', label: t('pearlRed') },
              { key: 'pearlBlue', label: t('pearlBlue') },
              { key: 'pearlBrown', label: t('pearlBrown') },
              { key: 'pearlGray', label: t('pearlGray') },
              { key: 'pearlWhite', label: t('pearlWhite') },
              { key: 'galaxy', label: t('galaxy') },
              { key: 'snowflake', label: t('snowflake') },
              { key: 'emerald', label: t('emerald') },
              { key: 'blackGoldGlitter', label: t('blackGoldGlitter') },
              { key: 'blackPinkGlitter', label: t('blackPinkGlitter') },
              { key: 'blackSilverGlitter', label: t('blackSilverGlitter') },
            ]
          )}

          <Separator />

          {renderPriceSection(
            t('lidType'),
            'lidTypes',
            [
              { key: 'glassFiberLid', label: t('glassFiberLid') },
              { key: 'spaLid', label: t('spaLid') },
            ]
          )}

          <Separator />

          {renderPriceSection(
            t('woodColor'),
            'woodColors',
            [
              { key: 'akrilasWhite', label: t('akrilasWhite') },
              { key: 'akrilasGreenMarble', label: t('akrilasGreenMarble') },
              { key: 'akrilasBrownMarble', label: t('akrilasBrownMarble') },
              { key: 'akrilasBlueMarble', label: t('akrilasBlueMarble') },
              { key: 'akrilasWhiteMarble', label: t('akrilasWhiteMarble') },
              { key: 'akrilasCoffeeMarble', label: t('akrilasCoffeeMarble') },
              { key: 'akrilasBlackMarble', label: t('akrilasBlackMarble') },
              { key: 'natural', label: t('natural') },
              { key: 'painted', label: t('painted') },
              { key: 'oiled', label: t('oiled') },
            ]
          )}

          <Separator />

          {renderPriceSection(
            t('features'),
            'features',
            [
              { key: 'jacuzzi', label: t('jacuzzi') },
              { key: 'airBubble', label: t('airBubble') },
              { key: 'outsideLed12', label: t('outsideLed12') },
              { key: 'insideLed', label: t('insideLed') },
              { key: 'outsideLedStripe', label: t('outsideLedStripe') },
              { key: 'insideLedMini', label: t('insideLedMini') },
              { key: 'insulation', label: t('insulation') },
              { key: 'headPillow', label: t('headPillow') },
              { key: 'sandFilterConnections', label: t('sandFilterConnections') },
              { key: 'sandFilterUnderStairs', label: t('sandFilterUnderStairs') },
              { key: 'sandFilterBox', label: t('sandFilterBox') },
              { key: 'v4aHeater', label: t('v4aHeater') },
              { key: 'electricityBox', label: t('electricityBox') },
              { key: 'chimneyExtension', label: t('chimneyExtension') },
              { key: 'extraChimneyProtection', label: t('extraChimneyProtection') },
              { key: 'bluetoothRadio', label: t('bluetoothRadio') },
              { key: 'electricHeater3kw', label: t('electricHeater3kw') },
              { key: 'electricThermometer', label: t('electricThermometer') },
            ]
          )}

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
    </div>
  );
};
