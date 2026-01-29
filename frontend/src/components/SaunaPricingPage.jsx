import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Save, Loader2, Flame, Eye, User, FileText, Settings, Percent, TrendingUp, Table, Plus, Trash2 } from 'lucide-react';
import { CustomerFieldsManager } from './CustomerFieldsManager';
import { TechSpecAdminPage } from './TechSpecAdminPage';

import { 
  useSaunaPricing, 
  ModelsTab, 
  CategoriesTab, 
  OptionsTab 
} from './sauna-pricing';

export const SaunaPricingPage = () => {
  const { canEdit } = useAuth();
  const { i18n } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  
  const {
    loading,
    saving,
    prices,
    txt,
    techSpecCategories,
    handleSaveAll,
    // Models
    handleAddModel,
    handleSaveEditModel,
    handleDeleteModel,
    moveModel,
    handleModelsDisplayTypeChange,
    handleUpdateModelsHint,
    // Categories
    handleAddCategory,
    handleSaveEditCategory,
    handleDeleteCategory,
    handleReorderCategories,
    handleCategoryDisplayTypeChange,
    // Options
    handleAddOption,
    handleDeleteOption,
    handleSaveEditOption,
    handleUpdateOptionPrice,
    handleToggleOptionQuantity,
    handleToggleOptionDefault,
    handleReorderOptions,
    // Settings
    handleUpdateMaxManagerDiscount,
    // Bulk price change
    handleBulkPriceChange,
  } = useSaunaPricing();

  // Local state for bulk price change
  const [modelsPercent, setModelsPercent] = useState('');
  const [optionsPercent, setOptionsPercent] = useState('');

  const handleApplyBulkPriceChange = async () => {
    const success = await handleBulkPriceChange(modelsPercent, optionsPercent);
    if (success) {
      setModelsPercent('');
      setOptionsPercent('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-amber-800 flex items-center gap-2">
          <Flame className="h-6 w-6" />
          {txt.saunaPricing}
          {!canEdit() && (
            <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground ml-2">
              <Eye className="h-4 w-4" />
              Только просмотр
            </span>
          )}
        </h1>
        {canEdit() && (
          <Button
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {txt.saveAll}
          </Button>
        )}
      </div>

      {/* Settings Section */}
      {canEdit() && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-4">
          {/* Max Manager Discount */}
          <div>
            <div className="flex items-center gap-2 mb-3 text-amber-800 font-medium">
              <Settings className="h-4 w-4" />
              {txt.maxManagerDiscount}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={prices.maxManagerDiscount || 10}
                  onChange={(e) => handleUpdateMaxManagerDiscount(e.target.value)}
                  className="w-20 h-9"
                />
                <Percent className="h-4 w-4 text-amber-600" />
              </div>
              <span className="text-sm text-muted-foreground">
                {txt.maxManagerDiscountDescription}
              </span>
            </div>
          </div>

          {/* Bulk Price Change */}
          <div className="pt-4 border-t border-amber-200">
            <div className="flex items-center gap-2 mb-3 text-amber-800 font-medium">
              <TrendingUp className="h-4 w-4" />
              {txt.bulkPriceChange}
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-1 block">{txt.modelsPercent}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="0"
                    value={modelsPercent}
                    onChange={(e) => setModelsPercent(e.target.value)}
                    className="w-24 h-9"
                  />
                  <Percent className="h-4 w-4 text-amber-600" />
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-1 block">{txt.optionsPercent}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="0"
                    value={optionsPercent}
                    onChange={(e) => setOptionsPercent(e.target.value)}
                    className="w-24 h-9"
                  />
                  <Percent className="h-4 w-4 text-amber-600" />
                </div>
              </div>
              <Button
                onClick={handleApplyBulkPriceChange}
                variant="outline"
                className="border-amber-400 text-amber-700 hover:bg-amber-100 h-9"
                disabled={!modelsPercent && !optionsPercent}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                {txt.applyPriceChange}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {txt.enterPercent}
            </p>
          </div>

          {/* Variant Comparison Table Editor */}
          <div className="pt-4 border-t border-amber-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-amber-800 font-medium">
                <Table className="h-4 w-4" />
                Таблица сравнения вариантов
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newRow = { option: '', optionRu: '', standard: '', plus: '' };
                  const currentRows = prices.variantComparisonRows || [];
                  handleUpdateVariantComparison([...currentRows, newRow]);
                }}
                className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100"
              >
                <Plus className="h-3 w-3 mr-1" />
                Добавить строку
              </Button>
            </div>
            
            {/* Comparison table header */}
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_40px] gap-2 mb-2 text-xs font-medium text-amber-700">
              <span>Опция (PL)</span>
              <span>Опция (RU)</span>
              <span>Standard</span>
              <span>Plus</span>
              <span></span>
            </div>
            
            {/* Comparison table rows */}
            {(prices.variantComparisonRows || []).map((row, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_1fr_1fr_40px] gap-2 mb-2">
                <Input
                  value={row.option || ''}
                  onChange={(e) => {
                    const newRows = [...(prices.variantComparisonRows || [])];
                    newRows[index] = { ...newRows[index], option: e.target.value };
                    handleUpdateVariantComparison(newRows);
                  }}
                  placeholder="Drewno"
                  className="h-8 text-sm"
                />
                <Input
                  value={row.optionRu || ''}
                  onChange={(e) => {
                    const newRows = [...(prices.variantComparisonRows || [])];
                    newRows[index] = { ...newRows[index], optionRu: e.target.value };
                    handleUpdateVariantComparison(newRows);
                  }}
                  placeholder="Древесина"
                  className="h-8 text-sm"
                />
                <Input
                  value={row.standard || ''}
                  onChange={(e) => {
                    const newRows = [...(prices.variantComparisonRows || [])];
                    newRows[index] = { ...newRows[index], standard: e.target.value };
                    handleUpdateVariantComparison(newRows);
                  }}
                  placeholder="Klasa B"
                  className="h-8 text-sm"
                />
                <Input
                  value={row.plus || ''}
                  onChange={(e) => {
                    const newRows = [...(prices.variantComparisonRows || [])];
                    newRows[index] = { ...newRows[index], plus: e.target.value };
                    handleUpdateVariantComparison(newRows);
                  }}
                  placeholder="Klasa A"
                  className="h-8 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newRows = (prices.variantComparisonRows || []).filter((_, i) => i !== index);
                    handleUpdateVariantComparison(newRows);
                  }}
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            {(!prices.variantComparisonRows || prices.variantComparisonRows.length === 0) && (
              <p className="text-xs text-gray-400 italic">Нет строк сравнения. Добавьте строки для отображения таблицы в калькуляторе.</p>
            )}
          </div>
        </div>
      )}

      <Tabs defaultValue="models" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="models">{txt.models}</TabsTrigger>
          <TabsTrigger value="categories">{txt.categories}</TabsTrigger>
          <TabsTrigger value="options">{txt.options}</TabsTrigger>
          <TabsTrigger value="techspec" className="gap-1">
            <FileText className="h-3 w-3" />
            {lang === 'ru' ? 'Спецификация' : 'Specyfikacja'}
          </TabsTrigger>
          <TabsTrigger value="customer" className="gap-1">
            <User className="h-3 w-3" />
            {lang === 'ru' ? 'Клиент' : 'Klient'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="models">
          <ModelsTab
            prices={prices}
            txt={txt}
            handleAddModel={handleAddModel}
            handleSaveEditModel={handleSaveEditModel}
            handleDeleteModel={handleDeleteModel}
            moveModel={moveModel}
            handleModelsDisplayTypeChange={handleModelsDisplayTypeChange}
            onUpdateModelsHint={handleUpdateModelsHint}
          />
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesTab
            prices={prices}
            txt={txt}
            handleAddCategory={handleAddCategory}
            handleSaveEditCategory={handleSaveEditCategory}
            handleDeleteCategory={handleDeleteCategory}
            handleReorderCategories={handleReorderCategories}
            handleCategoryDisplayTypeChange={handleCategoryDisplayTypeChange}
          />
        </TabsContent>

        <TabsContent value="options">
          <OptionsTab
            prices={prices}
            txt={txt}
            techSpecCategories={techSpecCategories}
            handleAddOption={handleAddOption}
            handleDeleteOption={handleDeleteOption}
            handleSaveEditOption={handleSaveEditOption}
            handleUpdateOptionPrice={handleUpdateOptionPrice}
            handleToggleOptionQuantity={handleToggleOptionQuantity}
            handleToggleOptionDefault={handleToggleOptionDefault}
            handleReorderOptions={handleReorderOptions}
          />
        </TabsContent>

        <TabsContent value="techspec">
          <TechSpecAdminPage projectType="sauna" />
        </TabsContent>

        <TabsContent value="customer">
          <CustomerFieldsManager calculatorType="sauna" />
        </TabsContent>
      </Tabs>
    </div>
  );
};
