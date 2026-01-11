import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Save, Loader2, Flame, Eye, User, FileText } from 'lucide-react';
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
    handleReorderOptions,
  } = useSaunaPricing();

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
