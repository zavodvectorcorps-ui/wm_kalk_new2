import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Save, Loader2, Flame, Eye, User, FileText, Settings, Percent, TrendingUp, Table, Plus, Trash2, Package, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { CustomerFieldsManager } from './CustomerFieldsManager';
import { TechSpecAdminPage } from './TechSpecAdminPage';
import { WizardStepsAdmin } from './sauna-pricing/WizardStepsAdmin';
import PriceImportExport from './sauna-pricing/PriceImportExport';

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
    autoSaveStatus,
    // Models
    handleAddModel,
    handleSaveEditModel,
    handleDeleteModel,
    moveModel,
    handleModelsDisplayTypeChange,
    handleUpdateModelsHint,
    handleUpdatePricingSetting,
    handleToggleModelHidden,
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
    handleToggleOptionHidden,
    handleCloneOption,
    handleReorderOptions,
    // Settings
    handleUpdateMaxManagerDiscount,
    // Bulk price change
    handleBulkPriceChange,
    // Variant comparison
    handleUpdateVariantComparison,
    // PDF settings
    handleUpdatePdfSettings,
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
          <div className="flex items-center gap-2 flex-wrap">
            <AutoSavePill status={autoSaveStatus} />
            <PriceImportExport onImported={() => window.location.reload()} />
            <Button
              onClick={handleSaveAll}
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="cennik-save-all"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {txt.saveAll}
            </Button>
          </div>
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

          {/* Info about comparison table */}
          <div className="pt-4 border-t border-amber-200">
            <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
              <Table className="h-4 w-4" />
              Таблица сравнения вариантов
            </div>
            <p className="text-xs text-muted-foreground bg-amber-50 p-3 rounded-lg">
              📊 Таблица сравнения вариантов теперь генерируется автоматически из данных под-моделей. 
              Добавьте размеры помещений (Taras, Pokój wypoczynkowy, Pokój parowy, Strona wejścia) 
              в каждый вариант модели на вкладке "Modele".
            </p>
          </div>
        </div>
      )}

      {/* PDF Page 2 Settings */}
      <div className="bg-white rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-amber-800">📄 Настройки PDF (Страница 2)</h3>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="pdfPage2Enabled"
              checked={prices.pdfPage2Enabled !== false}
              onCheckedChange={(checked) => {
                handleUpdatePdfSettings({ pdfPage2Enabled: checked });
              }}
            />
            <Label htmlFor="pdfPage2Enabled" className="text-sm">Включить страницу 2</Label>
          </div>
        </div>
        
        {prices.pdfPage2Enabled !== false && (
          <div className="space-y-4 pt-2 border-t">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Заголовок секции вариантов</Label>
                <Input
                  value={prices.pdfPage2VariantsTitle || 'Możliwe warianty wykonania w wybranym rozmiarze'}
                  onChange={(e) => {
                    handleUpdatePdfSettings({ pdfPage2VariantsTitle: e.target.value });
                  }}
                  placeholder="Możliwe warianty wykonania..."
                />
              </div>
              <div>
                <Label className="text-xs">Заголовок секции опций</Label>
                <Input
                  value={prices.pdfPage2OptionsTitle || 'Opcje, które można dodać do sauny'}
                  onChange={(e) => {
                    handleUpdatePdfSettings({ pdfPage2OptionsTitle: e.target.value });
                  }}
                  placeholder="Opcje, które można dodać..."
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="pdfPage2ShowVariants"
                    checked={prices.pdfPage2ShowVariants !== false}
                    onCheckedChange={(checked) => {
                      handleUpdatePdfSettings({ pdfPage2ShowVariants: checked });
                    }}
                  />
                  <Label htmlFor="pdfPage2ShowVariants" className="text-sm">Показывать варианты модели</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="pdfPage2ShowComparisonTable"
                    checked={prices.pdfPage2ShowComparisonTable !== false}
                    onCheckedChange={(checked) => {
                      handleUpdatePdfSettings({ pdfPage2ShowComparisonTable: checked });
                    }}
                  />
                  <Label htmlFor="pdfPage2ShowComparisonTable" className="text-sm">Показывать таблицу сравнения</Label>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="pdfPage2ShowPlusCategories"
                    checked={prices.pdfPage2ShowPlusCategories !== false}
                    onCheckedChange={(checked) => {
                      handleUpdatePdfSettings({ pdfPage2ShowPlusCategories: checked });
                    }}
                  />
                  <Label htmlFor="pdfPage2ShowPlusCategories" className="text-sm">Показывать Plus-категории</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="pdfPage2ShowAllOptions"
                    checked={prices.pdfPage2ShowAllOptions !== false}
                    onCheckedChange={(checked) => {
                      handleUpdatePdfSettings({ pdfPage2ShowAllOptions: checked });
                    }}
                  />
                  <Label htmlFor="pdfPage2ShowAllOptions" className="text-sm">Показывать каталог опций</Label>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              💡 Для управления отображением отдельных опций в PDF, используйте галочку "Показывать в PDF" в настройках каждой опции.
            </p>
          </div>
        )}
      </div>

      <Tabs defaultValue="models" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 max-w-3xl">
          <TabsTrigger value="models">{txt.models}</TabsTrigger>
          <TabsTrigger value="categories">{txt.categories}</TabsTrigger>
          <TabsTrigger value="options">{txt.options}</TabsTrigger>
          <TabsTrigger value="wizard" className="gap-1">
            <Package className="h-3 w-3" />
            Wizard
          </TabsTrigger>
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
            handleToggleModelHidden={handleToggleModelHidden}
            onUpdateModelsHint={handleUpdateModelsHint}
            onUpdatePricingSetting={handleUpdatePricingSetting}
          />
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesTab
            prices={prices}
            txt={txt}
            techSpecCategories={techSpecCategories}
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
            handleToggleOptionHidden={handleToggleOptionHidden}
            handleCloneOption={handleCloneOption}
            handleReorderOptions={handleReorderOptions}
          />
        </TabsContent>

        <TabsContent value="wizard">
          <WizardStepsAdmin lang={lang} />
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

/**
 * Compact pill that surfaces the debounced auto-save state next to the
 * manual "Zapisz cennik" button. Same visual language as the TechCardEditor
 * badge for consistency.
 */
function AutoSavePill({ status }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-amber-100 text-amber-800 border border-amber-300" data-testid="cennik-autosave-pending">
        <RefreshCw className="h-3 w-3" /> Не сохранено
      </span>
    );
  }
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-blue-100 text-blue-800 border border-blue-300" data-testid="cennik-autosave-saving">
        <Loader2 className="h-3 w-3 animate-spin" /> Сохранение
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300" data-testid="cennik-autosave-saved">
        <Cloud className="h-3 w-3" /> Авто-сохранено
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-red-100 text-red-800 border border-red-300" data-testid="cennik-autosave-error">
        <CloudOff className="h-3 w-3" /> Ошибка
      </span>
    );
  }
  return null;
}

