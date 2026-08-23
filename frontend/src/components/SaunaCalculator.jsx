import React, { useState, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { InputOrange } from './ui/input-orange';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { CheckboxOrange } from './ui/checkbox-orange';
import { RadioGroupOrange, RadioGroupItemOrange } from './ui/radio-group-orange';
import { SelectOrange, SelectContentOrange, SelectItemOrange, SelectTriggerOrange, SelectValueOrange } from './ui/select-orange';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';
import { 
  FileDown, Save, RotateCcw, Loader2, User, Phone, Calendar,
  Percent, Calculator, Tag, Mail, X, Edit, Gift, Shield, Package, Info, Play, Image as ImageIcon, Check, Home, FileText, Trash2, Layout, ChevronLeft, Plus
} from 'lucide-react';
import { AddressAutocomplete } from './AddressAutocomplete';
import { useSaunaCalculator, categoryIcons, formatPrice } from './sauna';
import { LayoutCatalog } from './sauna/LayoutCatalog';
import { useAuth } from '../context/AuthContext';

// Lazy load Layout Configurator for performance
const LayoutConfiguratorPage = lazy(() => import('./LayoutConfiguratorPage'));

// Component to display hint with optional media (image/video)
const HintContent = ({ hint, hintImageUrl, hintVideoUrl, expanded = false }) => {
  const [showMedia, setShowMedia] = useState(false);
  const hasMedia = hintImageUrl || hintVideoUrl;
  
  // Check if it's a YouTube URL
  const getYouTubeEmbedUrl = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
  };
  
  const youtubeUrl = getYouTubeEmbedUrl(hintVideoUrl);
  const isDirectVideo = hintVideoUrl && !youtubeUrl;
  
  if (expanded) {
    return (
      <div className="space-y-3">
        {hint && <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{hint}</p>}
        {hintImageUrl && (
          <div className="rounded-lg overflow-hidden border">
            <img src={hintImageUrl} alt="Hint" className="w-full max-h-64 object-contain bg-gray-50" />
          </div>
        )}
        {youtubeUrl && (
          <div className="aspect-video rounded-lg overflow-hidden">
            <iframe
              src={youtubeUrl}
              title="Video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        )}
        {isDirectVideo && (
          <video controls className="w-full max-h-64 rounded-lg">
            <source src={hintVideoUrl} />
          </video>
        )}
      </div>
    );
  }
  
  // Compact tooltip view
  return (
    <div className="space-y-2">
      {hint && <p className="whitespace-pre-line">{hint}</p>}
      {hasMedia && (
        <div className="flex items-center gap-1 text-xs text-amber-300 mt-1">
          {hintImageUrl && <ImageIcon className="h-3 w-3" />}
          {hintVideoUrl && <Play className="h-3 w-3" />}
          <span>Нажмите для просмотра</span>
        </div>
      )}
    </div>
  );
};

// Wrapper component with tooltip and optional modal for media
const HintIcon = ({ hint, hintImageUrl, hintVideoUrl, size = 'sm' }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const hasMedia = hintImageUrl || hintVideoUrl;
  const hasHint = hint || hasMedia;
  
  if (!hasHint) return null;
  
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const containerSize = size === 'sm' ? 'p-0.5' : 'p-1';
  
  const handleClick = (e) => {
    e.stopPropagation();
    if (hasMedia) {
      setDialogOpen(true);
    }
  };
  
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild onClick={handleClick}>
          <div className={`absolute top-1 right-1 bg-amber-100 hover:bg-amber-200 text-amber-600 rounded-full ${containerSize} z-10 cursor-help shadow-sm flex items-center gap-0.5`}>
            <Info className={iconSize} />
            {hasMedia && (
              <span className="text-[8px] font-bold">+</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-sm bg-gray-900 text-white p-2">
          <HintContent hint={hint} hintImageUrl={hintImageUrl} hintVideoUrl={hintVideoUrl} />
        </TooltipContent>
      </Tooltip>
      
      {/* Modal for media content */}
      {hasMedia && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-amber-600" />
                Подробная информация
              </DialogTitle>
            </DialogHeader>
            <HintContent hint={hint} hintImageUrl={hintImageUrl} hintVideoUrl={hintVideoUrl} expanded />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

// Component for models section hint media
const ModelsHintMedia = ({ hintImageUrl, hintVideoUrl }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const getYouTubeEmbedUrl = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
  };
  
  return (
    <>
      <button 
        onClick={() => setDialogOpen(true)}
        className="mt-2 text-xs text-amber-600 hover:text-amber-800 dark:text-amber-300 flex items-center gap-1 underline"
      >
        {hintImageUrl && <ImageIcon className="h-3 w-3" />}
        {hintVideoUrl && <Play className="h-3 w-3" />}
        Посмотреть подробнее
      </button>
      
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-amber-600" />
              Информация о моделях
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {hintImageUrl && (
              <img src={hintImageUrl} alt="Models info" className="w-full rounded-lg" />
            )}
            {hintVideoUrl && getYouTubeEmbedUrl(hintVideoUrl) && (
              <div className="aspect-video rounded-lg overflow-hidden">
                <iframe
                  src={getYouTubeEmbedUrl(hintVideoUrl)}
                  title="Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            )}
            {hintVideoUrl && !getYouTubeEmbedUrl(hintVideoUrl) && (
              <video controls className="w-full rounded-lg">
                <source src={hintVideoUrl} />
              </video>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Component for category hint display
const CategoryHint = ({ category }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const hasHint = category.hint || category.hintImageUrl || category.hintVideoUrl;
  const hasMedia = category.hintImageUrl || category.hintVideoUrl;
  
  if (!hasHint) return null;
  
  const getYouTubeEmbedUrl = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
  };
  
  return (
    <>
      <div className="mb-3 p-2 bg-amber-50/50 rounded border border-amber-100">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            {category.hint && (
              <p className="text-sm text-gray-600 whitespace-pre-line">{category.hint}</p>
            )}
            {hasMedia && (
              <button 
                onClick={() => setDialogOpen(true)}
                className="mt-1 text-xs text-amber-600 hover:text-amber-800 dark:text-amber-300 flex items-center gap-1 underline"
              >
                {category.hintImageUrl && <ImageIcon className="h-3 w-3" />}
                {category.hintVideoUrl && <Play className="h-3 w-3" />}
                Подробнее
              </button>
            )}
          </div>
        </div>
      </div>
      
      {hasMedia && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-amber-600" />
                {category.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {category.hint && (
                <p className="text-gray-700 whitespace-pre-line">{category.hint}</p>
              )}
              {category.hintImageUrl && (
                <img src={category.hintImageUrl} alt={category.name} className="w-full rounded-lg" />
              )}
              {category.hintVideoUrl && getYouTubeEmbedUrl(category.hintVideoUrl) && (
                <div className="aspect-video rounded-lg overflow-hidden">
                  <iframe
                    src={getYouTubeEmbedUrl(category.hintVideoUrl)}
                    title="Video"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
              )}
              {category.hintVideoUrl && !getYouTubeEmbedUrl(category.hintVideoUrl) && (
                <video controls className="w-full rounded-lg">
                  <source src={category.hintVideoUrl} />
                </video>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export const SaunaCalculator = ({ editingOrder = null, onEditComplete, amocrmPrefill = null, onAmocrmPrefillUsed = null }) => {
  const {
    loading, initialLoading, prices, formData, appliedDiscount, certificateDiscount,
    isEditMode, editOrderId, adminGifts, adminDiscountApproved,
    requestedDiscount, requestedDiscountNote, isAdminUser, canGiveGifts, lang, txt,
    model, optionsTotal, foundationPrice, deliveryPrice, subtotal, discountAmount, total,
    roomSizes, amocrmData, maxManagerDiscount, modelVariant, modelPrice,
    selectedLayoutSize, selectedLayoutId, handleLayoutSelect,
    customLayoutImage, customLayoutUploading, uploadCustomLayoutImage, removeCustomLayoutImage,
    layoutVariants, layoutLoading, autoSelectedLayoutSize,
    setFormData, setAdminDiscountApproved, setRequestedDiscount, setRequestedDiscountNote,
    handleInputChange, handleDiscountChange, handleModelChange, handleModelVariantChange,
    handleApplyStandardDiscount, handleToggleCertificateDiscount, handleRadioChange, handleCheckboxChange,
    handleQuantityChange, handleVariantChange, handleSubOptionChange, toggleGift, removeOption,
    handleSaveAndGeneratePDF, handleClearForm,
    handleCancelEdit, getCategoryName, isOptionVisible, getOptionBasePrice,
    handleOpenPriceChange, addCustomOption, updateCustomOption, removeCustomOption
  } = useSaunaCalculator(editingOrder, onEditComplete, amocrmPrefill, onAmocrmPrefillUsed);

  // Auth context for admin check
  const { isAdmin } = useAuth();
  
  // Layout Configurator modal state
  const [showLayoutConfigurator, setShowLayoutConfigurator] = useState(false);

  // Get selected model
  const selectedModel = prices.models?.find(m => m.id === formData.selectedModel);

  // Function to filter options based on incompatibility settings (inverted logic)
  // Options are shown by default, hidden only when incompatibility rules match
  const filterCompatibleOptions = (category) => {
    if (!category.options) return [];
    
    return category.options.filter(option => {
      // Hidden options are switched off by admin — never show in the calculator.
      if (option.hidden) return false;
      const incompatibleModels = option.incompatibleModels || [];
      const incompatibleWithOptions = option.incompatibleWithOptions || {};
      const hasModelRules = incompatibleModels.length > 0;
      const hasOptionRules = Object.keys(incompatibleWithOptions).length > 0;
      
      // Check if current model is in incompatible list
      const modelMatches = hasModelRules && formData.selectedModel && 
        incompatibleModels.includes(formData.selectedModel);
      
      // Check if current model variant (sub-model) is in incompatible list
      const selectedVariantId = formData.selectedModelVariant || selectedModel?.variants?.[0]?.id;
      const variantMatches = hasModelRules && selectedVariantId && 
        incompatibleModels.includes(selectedVariantId);
      
      // Check if any incompatible option is selected
      let optionMatches = false;
      if (hasOptionRules) {
        for (const [dependentCategoryId, hideWhenOptionIds] of Object.entries(incompatibleWithOptions)) {
          if (hideWhenOptionIds.length === 0) continue;
          
          const selectedInDependentCategory = formData.selections[dependentCategoryId];
          
          // For radio/select - direct value
          if (typeof selectedInDependentCategory === 'string') {
            if (hideWhenOptionIds.includes(selectedInDependentCategory)) {
              optionMatches = true;
              break;
            }
          }
          // For checkbox - check if any incompatible option is selected
          else if (typeof selectedInDependentCategory === 'object') {
            const hasIncompatibleSelection = hideWhenOptionIds.some(
              optId => selectedInDependentCategory[optId] === true
            );
            if (hasIncompatibleSelection) {
              optionMatches = true;
              break;
            }
          }
        }
      }
      
      // Decision logic (independent OR): hide the option if ANY configured
      // rule matches — either the selected model/variant is in the hide list,
      // OR an incompatible option in another category is selected.
      const modelOrVariantMatches = modelMatches || variantMatches;

      if (modelOrVariantMatches || optionMatches) {
        return false;
      }
      
      // LEGACY: Support old compatibleModels/compatibleWithOptions for backward compatibility
      const compatibleModels = option.compatibleModels || [];
      if (compatibleModels.length > 0 && formData.selectedModel) {
        if (!compatibleModels.includes(formData.selectedModel)) {
          return false;
        }
      }
      
      const compatibleWithOptions = option.compatibleWithOptions || {};
      for (const [dependentCategoryId, allowedOptionIds] of Object.entries(compatibleWithOptions)) {
        if (allowedOptionIds.length === 0) continue;
        
        const selectedInDependentCategory = formData.selections[dependentCategoryId];
        
        if (typeof selectedInDependentCategory === 'string') {
          if (!allowedOptionIds.includes(selectedInDependentCategory)) {
            return false;
          }
        }
        else if (typeof selectedInDependentCategory === 'object') {
          const hasAllowedSelection = allowedOptionIds.some(
            optId => selectedInDependentCategory[optId] === true
          );
          if (!hasAllowedSelection) {
            return false;
          }
        }
        else {
          return false;
        }
      }
      
      return true;
    });
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <div className="text-center leading-none" data-testid="alicor-logo">
          <span className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#97724E]">ALICOR</span>
          <span className="block text-sm md:text-base font-semibold tracking-[0.45em] text-[#B89B7A] mt-1">SPA</span>
        </div>
      </div>
      
      {/* Edit Mode Banner */}
      {isEditMode && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Edit className="h-5 w-5 text-amber-600" />
            <span className="font-medium text-amber-800 dark:text-amber-300">
              {txt.editingOrder}: {editOrderId}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleCancelEdit}>
            <X className="h-4 w-4 mr-1" />
            {txt.cancel}
          </Button>
        </div>
      )}
      
      {/* amoCRM Banner */}
      {amocrmData && (
        <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">amo</span>
            </div>
            <div>
              <span className="font-medium text-purple-800">
                Заказ из amoCRM
              </span>
              {amocrmData.amocrm_name && (
                <span className="text-purple-600 ml-2">• {amocrmData.amocrm_name}</span>
              )}
            </div>
          </div>
          {amocrmData.amocrm_link && (
            <a 
              href={amocrmData.amocrm_link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-purple-600 hover:text-purple-800 text-sm flex items-center gap-1"
            >
              Открыть в amoCRM →
            </a>
          )}
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <CustomerInfoCard 
            formData={formData} 
            setFormData={setFormData}
            handleInputChange={handleInputChange} 
            txt={txt} 
          />

          {/* Model Selection */}
          <ModelSelectionCard 
            prices={prices}
            formData={formData}
            handleModelChange={handleModelChange}
            txt={txt}
          />

          {/* Model Variant Selection (if model has visible variants or linked variants) */}
          {(model?.variants?.some(v => !v.hidden) || (model?.linkedVariantsModelId && prices?.models?.find(m => m.id === model.linkedVariantsModelId)?.variants?.some(v => !v.hidden))) && (
            <ModelVariantSelector
              model={model}
              formData={formData}
              handleModelVariantChange={handleModelVariantChange}
              prices={prices}
              lang={lang}
              txt={txt}
            />
          )}

          {/* Option Categories */}
          {prices.categories
            ?.filter((category) => {
              // Filter categories by model/variant visibility
              const visibleFor = category.visibleForModelVariants;
              // If no visibility restriction set, show category
              if (!visibleFor || visibleFor.length === 0) return true;
              
              // Check if selected model ID matches
              if (visibleFor.includes(selectedModel?.id)) return true;
              
              // If model has variants, check variant match
              if (selectedModel?.variants?.length) {
                // Get currently selected variant ID and object (default to first variant)
                const currentVariantId = formData.selectedModelVariant || selectedModel.variants[0]?.id;
                const currentVariant = selectedModel.variants.find(v => v.id === currentVariantId);
                // Check if any of: variant ID, name, namePl (case-insensitive) matches visibleFor list
                const variantMatches = visibleFor.some(allowedVariant => {
                  const lowerAllowed = allowedVariant.toLowerCase();
                  return currentVariantId === allowedVariant ||
                         currentVariant?.name?.toLowerCase() === lowerAllowed ||
                         currentVariant?.namePl?.toLowerCase() === lowerAllowed ||
                         currentVariant?.id === allowedVariant;
                });
                if (variantMatches) return true;
              }
              
              return false;
            })
            .map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              filteredOptions={filterCompatibleOptions(category)}
              formData={formData}
              foundationPrice={foundationPrice}
              handleRadioChange={handleRadioChange}
              handleCheckboxChange={handleCheckboxChange}
              handleQuantityChange={handleQuantityChange}
              handleVariantChange={handleVariantChange}
              handleSubOptionChange={handleSubOptionChange}
              getCategoryName={getCategoryName}
              getOptionBasePrice={getOptionBasePrice}
              txt={txt}
            />
          ))}

          {/* Layout Catalog */}
          <LayoutCatalog
            selectedSize={selectedLayoutSize}
            selectedLayoutId={selectedLayoutId}
            onLayoutSelect={handleLayoutSelect}
            customLayoutImage={customLayoutImage}
            customLayoutUploading={customLayoutUploading}
            onUploadCustomImage={uploadCustomLayoutImage}
            onRemoveCustomImage={removeCustomLayoutImage}
            filteredLayouts={layoutVariants}
            layoutsLoading={layoutLoading}
            autoSelectedSize={autoSelectedLayoutSize}
            lang={lang}
          />

          {/* Open Layout Configurator Button */}
          {formData.selectedModel && (
            <Card className="shadow-md border-2 border-green-200">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Layout className="h-6 w-6 text-green-600" />
                    <div>
                      <h3 className="font-medium text-green-800">
                        {lang === 'pl' ? 'Konfigurator planowek' : 'Конфигуратор планировок'}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {lang === 'pl' 
                          ? 'Otwórz interaktywny konfigurator aby dostosować układ sauny' 
                          : 'Откройте интерактивный конфигуратор для настройки планировки сауны'}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowLayoutConfigurator(true)}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="open-layout-configurator-btn"
                  >
                    <Layout className="h-4 w-4 mr-2" />
                    {lang === 'pl' ? 'Otwórz konfigurator' : 'Открыть конфигуратор'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Open-price options entries + Custom (free-form) options */}
          <ExtraOptionsCard
            prices={prices}
            formData={formData}
            handleOpenPriceChange={handleOpenPriceChange}
            addCustomOption={addCustomOption}
            updateCustomOption={updateCustomOption}
            removeCustomOption={removeCustomOption}
            isOptionVisible={isOptionVisible}
            lang={lang}
          />

          {/* Notes */}
          <Card className="shadow-md">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-900/70 dark:to-slate-900/40 border-b border-amber-200/40 dark:border-amber-700/20">
              <CardTitle className="text-lg text-slate-800 dark:text-slate-100">{txt.notes}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder={txt.notesPlaceholder}
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <SummaryCard
            model={model}
            modelVariant={modelVariant}
            modelPrice={modelPrice}
            prices={prices}
            formData={formData}
            appliedDiscount={appliedDiscount}
            subtotal={subtotal}
            discountAmount={discountAmount}
            foundationPrice={foundationPrice}
            deliveryPrice={deliveryPrice}
            total={total}
            roomSizes={roomSizes}
            isAdminUser={isAdminUser}
            canGiveGifts={canGiveGifts}
            isEditMode={isEditMode}
            adminGifts={adminGifts}
            toggleGift={toggleGift}
            removeOption={removeOption}
            adminDiscountApproved={adminDiscountApproved}
            setAdminDiscountApproved={setAdminDiscountApproved}
            requestedDiscount={requestedDiscount}
            setRequestedDiscount={setRequestedDiscount}
            requestedDiscountNote={requestedDiscountNote}
            setRequestedDiscountNote={setRequestedDiscountNote}
            handleDiscountChange={handleDiscountChange}
            handleApplyStandardDiscount={handleApplyStandardDiscount}
            handleToggleCertificateDiscount={handleToggleCertificateDiscount}
            certificateDiscount={certificateDiscount}
            handleSaveAndGeneratePDF={handleSaveAndGeneratePDF}
            handleClearForm={handleClearForm}
            handleCancelEdit={handleCancelEdit}
            getCategoryName={getCategoryName}
            isOptionVisible={isOptionVisible}
            getOptionBasePrice={getOptionBasePrice}
            maxManagerDiscount={maxManagerDiscount}
            loading={loading}
            lang={lang}
            txt={txt}
          />
          </div>
        </div>
      </div>
    </div>
    
    {/* Layout Configurator Modal */}
    <Dialog open={showLayoutConfigurator} onOpenChange={setShowLayoutConfigurator}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Layout className="h-5 w-5 text-green-600" />
              {lang === 'pl' ? 'Konfigurator planowek' : 'Конфигуратор планировок'}
              {selectedModel && (
                <span className="text-muted-foreground text-sm">
                  — {selectedModel.name}
                </span>
              )}
            </DialogTitle>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowLayoutConfigurator(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto p-0" style={{ height: 'calc(95vh - 60px)' }}>
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <LayoutConfiguratorPage
              isAdminMode={isAdmin()}
              initialModelId={formData.selectedModel}
              initialVariantId={formData.selectedModelVariant}
              calculatorSelections={formData.selections}
              orderId={editOrderId}
              onClose={() => setShowLayoutConfigurator(false)}
              isModal={true}
              onLayoutSaved={() => {
                toast.success('Планировка сохранена в заказ');
                setShowLayoutConfigurator(false);
              }}
            />
          </Suspense>
        </div>
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  );
};

// Sub-components

const CustomerInfoCard = ({ formData, setFormData, handleInputChange, txt }) => (
  <Card className="shadow-md">
    <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-900/70 dark:to-slate-900/40 border-b border-amber-200/40 dark:border-amber-700/20">
      <CardTitle className="flex items-center gap-2 text-lg text-slate-800 dark:text-slate-100">
        <User className="h-5 w-5" />
        {txt.customerInfo}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">{txt.fullName} *</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <InputOrange id="fullName" name="fullName" value={formData.fullName} onChange={handleInputChange} className="pl-10" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{txt.email}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <InputOrange id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} className="pl-10" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phoneNumber">{txt.phoneNumber} *</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <InputOrange id="phoneNumber" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} className="pl-10" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="orderDate">{txt.orderDate}</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <InputOrange id="orderDate" name="orderDate" type="date" value={formData.orderDate} onChange={handleInputChange} className="pl-10" />
          </div>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="fullAddress">{txt.fullAddress || 'Adres'}</Label>
          <AddressAutocomplete
            value={formData.fullAddress}
            onChange={(address) => setFormData(prev => ({ ...prev, fullAddress: address }))}
            placeholder="ul. Przykładowa 123, Warszawa"
          />
        </div>
      </div>
    </CardContent>
  </Card>
);

const ModelSelectionCard = ({ prices, formData, handleModelChange, txt }) => {
  const [selectedGroup, setSelectedGroup] = React.useState(null);
  const [showingGroups, setShowingGroups] = React.useState(true);
  
  // Build groups from models (exclude hidden models from client view)
  const models = (prices.models || []).filter(m => !m.hidden);
  const hasGroups = models.some(m => m.modelGroup);
  
  const groups = React.useMemo(() => {
    if (!hasGroups) return null;
    const map = {};
    models.forEach(m => {
      const g = m.modelGroup || '__ungrouped__';
      if (!map[g]) {
        map[g] = { name: g, models: [], imageUrl: m.modelGroupImageUrl || m.imageUrl, minPrice: m.basePrice, maxDiscount: m.discount || 0 };
      }
      map[g].models.push(m);
      if (m.basePrice < map[g].minPrice) map[g].minPrice = m.basePrice;
      if ((m.discount || 0) > map[g].maxDiscount) map[g].maxDiscount = m.discount;
    });
    return map;
  }, [models, hasGroups]);

  const activeGroup = showingGroups ? null : selectedGroup;
  
  const handleGroupClick = (groupName) => {
    const groupModels = groups[groupName].models;
    setSelectedGroup(groupName);
    setShowingGroups(false);
    if (groupModels.length === 1) {
      handleModelChange(groupModels[0].id);
    }
  };

  const handleBackToGroups = () => {
    setSelectedGroup(null);
    setShowingGroups(true);
  };

  // Render a single model card
  const renderModelCard = (m) => (
    <div
      key={m.id}
      onClick={() => handleModelChange(m.id)}
      className={`relative cursor-pointer rounded-lg border-2 p-3 transition-all ${
        formData.selectedModel === m.id 
          ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200' 
          : 'border-border hover:border-amber-300 hover:bg-amber-50/50'
      }`}
      data-testid={`model-card-${m.id}`}
    >
      <HintIcon hint={m.hint} hintImageUrl={m.hintImageUrl} hintVideoUrl={m.hintVideoUrl} size="md" />
      {m.imageUrl && (
        <div className="aspect-video mb-2 rounded overflow-hidden bg-muted">
          <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        </div>
      )}
      <div className="text-sm font-medium">{m.name}</div>
      <div className="text-lg font-bold text-amber-700">{formatPrice(m.basePrice)} PLN</div>
      {m.discount > 0 && (
        <div className="flex items-center gap-1 text-xs text-green-600">
          <Tag className="h-3 w-3" />
          {txt.discount}: {m.discount}%
        </div>
      )}
      {m.foundationPrice > 0 && (
        <div className="text-xs text-muted-foreground">
          {txt.foundation}: +{m.foundationPrice} PLN
        </div>
      )}
      {m.capacity && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <span>👥</span>
          <span>{m.capacity} osób</span>
        </div>
      )}
      {(m.relaxRoomSize || m.steamRoomSize) && (
        <div className="mt-2 pt-2 border-t border-amber-200 text-xs space-y-1">
          {m.relaxRoomSize && (
            <div className="flex justify-between text-muted-foreground">
              <span>Przebieralnia:</span>
              <span className="font-medium text-amber-800 dark:text-amber-300">{m.relaxRoomSize}</span>
            </div>
          )}
          {m.steamRoomSize && (
            <div className="flex justify-between text-muted-foreground">
              <span>Pokój parowy:</span>
              <span className="font-medium text-amber-800 dark:text-amber-300">{m.steamRoomSize}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
  <Card className="shadow-md">
    <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-900/70 dark:to-slate-900/40 border-b border-amber-200/40 dark:border-amber-700/20">
      <CardTitle className="flex items-center gap-2 text-lg text-slate-800 dark:text-slate-100">
        <Calculator className="h-5 w-5" />
        {txt.model} *
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-4">
      {(prices.modelsHint || prices.modelsHintImageUrl || prices.modelsHintVideoUrl) && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900/50">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              {prices.modelsHint && (
                <p className="text-sm text-amber-800 dark:text-amber-300 whitespace-pre-line">{prices.modelsHint}</p>
              )}
              {(prices.modelsHintImageUrl || prices.modelsHintVideoUrl) && (
                <ModelsHintMedia hintImageUrl={prices.modelsHintImageUrl} hintVideoUrl={prices.modelsHintVideoUrl} />
              )}
            </div>
          </div>
        </div>
      )}
      {prices.modelsDisplayType === 'dropdown' ? (
        <SelectOrange value={formData.selectedModel} onValueChange={handleModelChange}>
          <SelectTriggerOrange className="w-full">
            <SelectValueOrange placeholder={txt.selectModel} />
          </SelectTriggerOrange>
          <SelectContentOrange>
            {hasGroups ? (
              Object.entries(groups).map(([groupName, group]) => (
                <React.Fragment key={groupName}>
                  {groupName !== '__ungrouped__' && (
                    <div className="px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-50">{groupName}</div>
                  )}
                  {group.models.map(m => (
                    <SelectItemOrange key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        {m.imageUrl && <img src={m.imageUrl} alt={m.name} className="w-8 h-6 object-cover rounded" loading="lazy" />}
                        <span>{m.name}</span>
                        <span className="text-amber-700 font-medium ml-auto">{formatPrice(m.basePrice)} PLN</span>
                        {m.discount > 0 && <span className="text-green-600 text-xs">-{m.discount}%</span>}
                      </div>
                    </SelectItemOrange>
                  ))}
                </React.Fragment>
              ))
            ) : (
              models.map((m) => (
                <SelectItemOrange key={m.id} value={m.id}>
                  <div className="flex items-center gap-2">
                    {m.imageUrl && <img src={m.imageUrl} alt={m.name} className="w-8 h-6 object-cover rounded" loading="lazy" />}
                    <span>{m.name}</span>
                    {(m.hint || m.hintImageUrl || m.hintVideoUrl) && <Info className="h-3 w-3 text-amber-500" />}
                    <span className="text-amber-700 font-medium ml-auto">{formatPrice(m.basePrice)} PLN</span>
                    {m.discount > 0 && <span className="text-green-600 text-xs">-{m.discount}%</span>}
                  </div>
                </SelectItemOrange>
              ))
            )}
          </SelectContentOrange>
        </SelectOrange>
      ) : hasGroups && !activeGroup ? (
        /* Step 1: Show group cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="model-groups-grid">
          {Object.entries(groups).filter(([k]) => k !== '__ungrouped__').map(([groupName, group]) => (
            <div
              key={groupName}
              onClick={() => handleGroupClick(groupName)}
              className="cursor-pointer rounded-lg border-2 border-border hover:border-amber-400 hover:bg-amber-50/50 p-4 transition-all text-center"
              data-testid={`model-group-${groupName}`}
            >
              {group.imageUrl && (
                <div className="aspect-video mb-3 rounded overflow-hidden bg-muted mx-auto">
                  <img src={group.imageUrl} alt={groupName} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                </div>
              )}
              <div className="text-base font-semibold text-amber-800 dark:text-amber-300">{groupName}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {group.models.length} {group.models.length === 1 ? 'rozmiar' : group.models.length < 5 ? 'rozmiary' : 'rozmiarów'}
              </div>
              <div className="text-sm font-medium text-amber-700 mt-1">
                od {formatPrice(group.minPrice)} PLN
              </div>
              {group.maxDiscount > 0 && (
                <div className="flex items-center justify-center gap-1 text-xs text-green-600 mt-1">
                  <Tag className="h-3 w-3" />
                  {txt.discount}: {group.maxDiscount}%
                </div>
              )}
            </div>
          ))}
          {/* Ungrouped models shown directly */}
          {groups['__ungrouped__']?.models.map(m => renderModelCard(m))}
        </div>
      ) : hasGroups && activeGroup ? (
        /* Step 2: Show models in selected group */
        <div>
          <button
            onClick={handleBackToGroups}
            className="flex items-center gap-2 text-sm text-amber-700 hover:text-amber-900 mb-4 transition-colors"
            data-testid="back-to-groups-btn"
          >
            <ChevronLeft className="h-4 w-4" />
            {activeGroup}
          </button>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="model-submodels-grid">
            {groups[activeGroup]?.models.map(m => renderModelCard(m))}
          </div>
        </div>
      ) : (
        /* No groups - flat list */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map(m => renderModelCard(m))}
        </div>
      )}
    </CardContent>
  </Card>
  );
};

// Model Variant Selector Component (like heater selection in hot tubs)
const ModelVariantSelector = ({ model, formData, handleModelVariantChange, prices, lang, txt }) => {
  // Get variants - either from current model or from linked model
  let variants = (model?.variants || []).filter(v => !v.hidden);
  let linkedModelName = null;
  
  // If current model has no variants but has linkedVariantsModelId, use variants from linked model
  if (variants.length === 0 && model?.linkedVariantsModelId) {
    const linkedModel = prices?.models?.find(m => m.id === model.linkedVariantsModelId);
    if (linkedModel?.variants?.length > 0) {
      variants = linkedModel.variants.filter(v => !v.hidden);
      linkedModelName = linkedModel.name;
    }
  }
  
  if (variants.length === 0) return null;
  
  // Get selected variant or default to first
  const selectedVariantId = formData.selectedModelVariant || variants[0]?.id;
  
  // Check if variants have room size data for comparison table
  const hasComparisonData = variants.some(v => 
    v.relaxRoomSize || v.steamRoomSize || v.terraceSize || v.entranceSide
  );
  
  // Group variants by category
  const groupedVariants = variants.reduce((groups, variant) => {
    const category = lang === 'pl' 
      ? (variant.categoryPl || variant.category || '')
      : (variant.category || variant.categoryPl || '');
    const groupKey = category || '__uncategorized__';
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(variant);
    return groups;
  }, {});
  
  const hasCategories = Object.keys(groupedVariants).some(k => k !== '__uncategorized__');
  
  return (
    <Card className="shadow-md border-purple-200">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
        <CardTitle className="flex items-center gap-2 text-lg text-purple-800">
          <Home className="h-5 w-5" />
          {lang === 'pl' ? 'Wybierz wariant' : 'Выберите вариант'}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {/* Comparison Table - generated from variant room sizes */}
        {hasComparisonData && variants.length > 1 && (
          <div className="mb-6 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-purple-100">
                  <th className="text-left p-2 border border-purple-200 font-medium text-purple-800">
                    {lang === 'pl' ? 'Wariant' : 'Вариант'}
                  </th>
                  <th className="text-center p-2 border border-purple-200 font-medium text-purple-800">
                    {lang === 'pl' ? 'Pokój wyp.' : 'К. отдыха'}
                  </th>
                  <th className="text-center p-2 border border-purple-200 font-medium text-purple-800">
                    {lang === 'pl' ? 'Sauna' : 'Парная'}
                  </th>
                  <th className="text-center p-2 border border-purple-200 font-medium text-purple-800">
                    {lang === 'pl' ? 'Taras' : 'Терраса'}
                  </th>
                  <th className="text-center p-2 border border-purple-200 font-medium text-purple-800">
                    {lang === 'pl' ? 'Wejście' : 'Вход'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {variants.map((variant, index) => {
                  const variantName = lang === 'pl' 
                    ? (variant.namePl || variant.name) 
                    : (variant.nameRu || variant.name);
                  const isSelected = selectedVariantId === variant.id;
                  return (
                    <tr 
                      key={variant.id} 
                      className={`${isSelected ? 'bg-purple-100' : index % 2 === 0 ? 'bg-white' : 'bg-purple-50/50'} cursor-pointer hover:bg-purple-100/70`}
                      onClick={() => handleModelVariantChange(variant.id)}
                    >
                      <td className={`p-2 border border-purple-200 font-medium ${isSelected ? 'text-purple-800' : 'text-gray-700'}`}>
                        {variantName || `Вариант ${index + 1}`}
                      </td>
                      <td className="p-2 border border-purple-200 text-center text-gray-600">
                        {variant.relaxRoomSize && variant.relaxRoomSize !== '0' ? variant.relaxRoomSize : '-'}
                      </td>
                      <td className="p-2 border border-purple-200 text-center text-gray-600">
                        {variant.steamRoomSize && variant.steamRoomSize !== '0' ? variant.steamRoomSize : '-'}
                      </td>
                      <td className="p-2 border border-purple-200 text-center text-gray-600">
                        {variant.terraceSize && variant.terraceSize !== '0' ? variant.terraceSize : '-'}
                      </td>
                      <td className="p-2 border border-purple-200 text-center text-gray-600">
                        {variant.entranceSide || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Variants grouped by category */}
        {hasCategories ? (
          <div className="space-y-6">
            {Object.entries(groupedVariants).map(([categoryName, categoryVariants]) => (
              <div key={categoryName}>
                {categoryName !== '__uncategorized__' && (
                  <h3 className="text-sm font-semibold text-purple-700 mb-3 pb-2 border-b border-purple-200">
                    {categoryName}
                  </h3>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {categoryVariants.map(variant => {
                    const isSelected = selectedVariantId === variant.id;
                    const variantName = lang === 'pl' 
                      ? (variant.namePl || variant.name) 
                      : (variant.nameRu || variant.name);
                    const variantHint = lang === 'pl' 
                      ? (variant.hintPl || variant.hint) 
                      : variant.hint;
                    
                    return (
                      <div
                        key={variant.id}
                        onClick={() => handleModelVariantChange(variant.id)}
                        className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50 shadow-lg'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <div className="bg-purple-500 text-white rounded-full p-1">
                              <Check className="h-4 w-4" />
                            </div>
                          </div>
                        )}
                        
                        {variant.imageUrl && (
                          <div className="w-full h-32 rounded-lg mb-3 bg-gray-100 overflow-hidden">
                            <img 
                              src={variant.imageUrl} 
                              alt={variantName}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}
                        
                        <h4 className={`font-semibold text-base mb-1 ${isSelected ? 'text-purple-800' : 'text-gray-800'}`}>
                          {variantName}
                        </h4>
                        
                        {variantHint && (
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                            {variantHint}
                          </p>
                        )}
                        
                        {/* Room dimensions badges */}
                        {(variant.capacity || variant.terraceSize || variant.relaxRoomSize || variant.steamRoomSize || variant.entranceSide) && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {variant.capacity && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700">
                                👥 {variant.capacity}
                              </span>
                            )}
                            {variant.terraceSize && variant.terraceSize !== '0' && variant.terraceSize !== '-' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                                🌿 {variant.terraceSize}
                              </span>
                            )}
                            {variant.relaxRoomSize && variant.relaxRoomSize !== '0' && variant.relaxRoomSize !== '-' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                                🛋️ {variant.relaxRoomSize}
                              </span>
                            )}
                            {variant.steamRoomSize && variant.steamRoomSize !== '0' && variant.steamRoomSize !== '-' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700">
                                🔥 {variant.steamRoomSize}
                              </span>
                            )}
                            {variant.entranceSide && variant.entranceSide !== '-' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">
                                🚪 {variant.entranceSide}
                              </span>
                            )}
                          </div>
                        )}
                        
                        <div className={`text-lg font-bold ${isSelected ? 'text-purple-600' : 'text-amber-600'}`}>
                          {variant.price > 0 ? `+${formatPrice(variant.price)} PLN` : (lang === 'pl' ? 'W cenie' : 'В цене')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {variants.map(variant => {
              const isSelected = selectedVariantId === variant.id;
              const variantName = lang === 'pl' 
                ? (variant.namePl || variant.name) 
                : (variant.nameRu || variant.name);
              const variantHint = lang === 'pl' 
                ? (variant.hintPl || variant.hint) 
                : variant.hint;
              
              return (
                <div
                  key={variant.id}
                  onClick={() => handleModelVariantChange(variant.id)}
                  className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50 shadow-lg'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <div className="bg-purple-500 text-white rounded-full p-1">
                        <Check className="h-4 w-4" />
                      </div>
                    </div>
                  )}
                  
                  {variant.imageUrl && (
                    <div className="w-full h-32 rounded-lg mb-3 bg-gray-100 overflow-hidden">
                      <img 
                        src={variant.imageUrl} 
                        alt={variantName}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  
                  <h4 className={`font-semibold text-base mb-1 ${isSelected ? 'text-purple-800' : 'text-gray-800'}`}>
                    {variantName}
                  </h4>
                  
                  {variantHint && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {variantHint}
                    </p>
                  )}
                  
                  {/* Room dimensions badges */}
                  {(variant.capacity || variant.terraceSize || variant.relaxRoomSize || variant.steamRoomSize || variant.entranceSide) && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {variant.capacity && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700">
                          👥 {variant.capacity}
                        </span>
                      )}
                      {variant.terraceSize && variant.terraceSize !== '0' && variant.terraceSize !== '-' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                          🌿 {variant.terraceSize}
                        </span>
                      )}
                      {variant.relaxRoomSize && variant.relaxRoomSize !== '0' && variant.relaxRoomSize !== '-' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                          🛋️ {variant.relaxRoomSize}
                        </span>
                      )}
                      {variant.steamRoomSize && variant.steamRoomSize !== '0' && variant.steamRoomSize !== '-' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700">
                          🔥 {variant.steamRoomSize}
                        </span>
                      )}
                      {variant.entranceSide && variant.entranceSide !== '-' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">
                          🚪 {variant.entranceSide}
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className={`text-lg font-bold ${isSelected ? 'text-purple-600' : 'text-amber-600'}`}>
                    {variant.price > 0 ? `+${formatPrice(variant.price)} PLN` : (lang === 'pl' ? 'W cenie' : 'В цене')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const CategoryCard = ({ category, filteredOptions, formData, foundationPrice, handleRadioChange, handleCheckboxChange, handleQuantityChange, handleVariantChange, handleSubOptionChange, getCategoryName, getOptionBasePrice, txt }) => {
  const Icon = categoryIcons[category.name] || Package;
  const isDropdownView = category.displayType === 'dropdown';
  
  // Use filtered options if provided, otherwise use category options
  const options = filteredOptions || category.options || [];
  
  // If no options available after filtering, don't render the category
  if (options.length === 0) {
    return null;
  }
  
  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-900/70 dark:to-slate-900/40 border-b border-amber-200/40 dark:border-amber-700/20">
        <CardTitle className="flex items-center gap-2 text-lg text-slate-800 dark:text-slate-100">
          <Icon className="h-5 w-5" />
          {getCategoryName(category)}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {/* Category-level hint */}
        <CategoryHint category={category} />
        
        {category.inputType === 'checkbox' ? (
          <CheckboxOptions category={category} options={options} formData={formData} foundationPrice={foundationPrice} handleCheckboxChange={handleCheckboxChange} handleQuantityChange={handleQuantityChange} handleVariantChange={handleVariantChange} handleSubOptionChange={handleSubOptionChange} getOptionBasePrice={getOptionBasePrice} txt={txt} />
        ) : isDropdownView ? (
          <DropdownOptions category={category} options={options} formData={formData} handleRadioChange={handleRadioChange} getCategoryName={getCategoryName} getOptionBasePrice={getOptionBasePrice} txt={txt} />
        ) : (
          <RadioOptions category={category} options={options} formData={formData} foundationPrice={foundationPrice} handleRadioChange={handleRadioChange} handleQuantityChange={handleQuantityChange} handleVariantChange={handleVariantChange} handleSubOptionChange={handleSubOptionChange} getOptionBasePrice={getOptionBasePrice} txt={txt} />
        )}
      </CardContent>
    </Card>
  );
};

const CheckboxOptions = ({ category, options, formData, foundationPrice, handleCheckboxChange, handleQuantityChange, handleVariantChange, handleSubOptionChange, getOptionBasePrice, txt }) => {
  // Check if this is the foundation/belki category
  const isBelkiCategory = category.id === 'fundament';
  
  return (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {options.map((option) => {
      const isChecked = formData.selections[category.id]?.[option.id] || false;
      const quantity = formData.quantities[option.id] || 1;
      // Get variants (support both new 'variants' and legacy 'subOptions' fields)
      const variants = option.variants?.length > 0 ? option.variants : option.subOptions;
      const hasVariants = variants?.length > 0;
      const selectedVariantId = formData.variantSelections?.[option.id];
      const selectedVariant = selectedVariantId ? variants?.find(v => v.id === selectedVariantId) : variants?.[0];
      
      // For belki "dodaj" option, use foundationPrice from model
      const isBelkiDodaj = isBelkiCategory && option.id.includes('dodaj');
      
      // Get base price considering model-specific pricing
      const optionBasePrice = getOptionBasePrice ? getOptionBasePrice(option) : option.price;
      
      // Calculate display price based on selected variant or belki special case
      const displayPrice = isBelkiDodaj 
        ? (foundationPrice || 0)
        : (hasVariants && selectedVariant ? selectedVariant.price : optionBasePrice);
      
      return (
        <div key={option.id} className="space-y-2">
          <div className={`relative flex items-start space-x-3 p-3 rounded-lg border transition-all ${isChecked ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700' : 'bg-muted/30 border-border hover:bg-muted/50'}`}>
            {/* Hint icon with media support */}
            <HintIcon 
              hint={option.hint} 
              hintImageUrl={option.hintImageUrl} 
              hintVideoUrl={option.hintVideoUrl}
            />
            <CheckboxOrange id={`${category.id}-${option.id}`} checked={isChecked} onCheckedChange={(checked) => handleCheckboxChange(category.id, option.id, checked)} />
            <div className="flex-1">
              <Label htmlFor={`${category.id}-${option.id}`} className="cursor-pointer text-sm leading-tight block font-medium">{option.name}</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {displayPrice > 0 ? (
                  <span className="text-xs text-amber-700 font-medium">
                    +{formatPrice(displayPrice)} PLN
                    {option.hasQuantity && quantity > 1 && ` × ${quantity} = ${formatPrice(displayPrice * quantity)} PLN`}
                  </span>
                ) : (
                  <span className="text-xs text-green-600">{txt.gratis}</span>
                )}
                {option.hasQuantity && isChecked && (
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">{txt.quantity}:</Label>
                    <InputOrange type="number" min="1" value={quantity} onChange={(e) => handleQuantityChange(option.id, e.target.value)} className="w-16 h-6 text-xs" />
                  </div>
                )}
              </div>
              {/* Plus variant details - room sizes */}
              {(option.terraceSize || option.relaxRoomSize || option.steamRoomSize || option.entranceSide) && (
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {option.terraceSize && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Taras:</span>
                      <span className="font-medium text-amber-800 dark:text-amber-300">{option.terraceSize}</span>
                    </div>
                  )}
                  {option.relaxRoomSize && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Pokój wyp.:</span>
                      <span className="font-medium text-amber-800 dark:text-amber-300">{option.relaxRoomSize}</span>
                    </div>
                  )}
                  {option.steamRoomSize && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Sauna:</span>
                      <span className="font-medium text-amber-800 dark:text-amber-300">{option.steamRoomSize}</span>
                    </div>
                  )}
                  {option.entranceSide && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Wejście:</span>
                      <span className="font-medium text-amber-800 dark:text-amber-300">{option.entranceSide}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            {option.imageUrl && <img src={option.imageUrl} alt={option.name} className="w-16 h-12 object-cover rounded" loading="lazy" decoding="async" />}
          </div>
          
          {/* Variants - show as cards like heater selection when option is checked */}
          {isChecked && hasVariants && (
            <div className="mt-2 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
              <Label className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3 block">
                Выберите вариант:
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {variants.map((variant) => {
                  const isVariantSelected = (selectedVariantId || variants[0]?.id) === variant.id;
                  
                  return (
                    <div
                      key={variant.id}
                      onClick={() => handleVariantChange(option.id, variant.id)}
                      className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        isVariantSelected
                          ? 'border-amber-500 bg-amber-100 shadow-md'
                          : 'border-amber-200 bg-white hover:border-amber-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {variant.imageUrl ? (
                          <img 
                            src={variant.imageUrl} 
                            alt={variant.namePl || variant.name}
                            className="w-20 h-20 object-cover rounded bg-white border"
                          />
                        ) : (
                          <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center border">
                            <Package className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{variant.namePl || variant.name}</span>
                            {isVariantSelected && (
                              <Check className="h-4 w-4 text-amber-600" />
                            )}
                          </div>
                          <div className="text-lg font-bold text-amber-600">
                            {formatPrice(variant.price)} PLN
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    })}
  </div>
);};

const DropdownOptions = ({ category, options, formData, handleRadioChange, getCategoryName, getOptionBasePrice, txt }) => {
  const selectedOption = options.find(o => o.id === formData.selections[category.id]);
  const hasMedia = selectedOption?.hintImageUrl || selectedOption?.hintVideoUrl;
  
  return (
    <div className="space-y-2">
      <SelectOrange value={formData.selections[category.id] || ''} onValueChange={(value) => handleRadioChange(category.id, value)}>
        <SelectTriggerOrange className="w-full">
          <SelectValueOrange placeholder={getCategoryName(category)} />
        </SelectTriggerOrange>
        <SelectContentOrange>
          {options.map((option) => {
            // Get base price considering model-specific pricing
            const optionPrice = getOptionBasePrice ? getOptionBasePrice(option) : option.price;
            
            return (
            <SelectItemOrange key={option.id} value={option.id}>
              <div className="flex items-center gap-2">
                {option.imageUrl && <img src={option.imageUrl} alt={option.name} className="w-8 h-6 object-cover rounded" loading="lazy" />}
                <span>{option.name}</span>
                {(option.hint || option.hintImageUrl || option.hintVideoUrl) && (
                  <div className="flex items-center gap-0.5">
                    <Info className="h-3 w-3 text-amber-500 flex-shrink-0" />
                    {(option.hintImageUrl || option.hintVideoUrl) && <span className="text-amber-500 text-[8px] font-bold">+</span>}
                  </div>
                )}
                <span className="text-amber-700 font-medium ml-2">
                  {optionPrice > 0 ? `+${formatPrice(optionPrice)} PLN` : (option.name.toLowerCase().includes('belki') ? txt.priceDepends : txt.gratis)}
                </span>
              </div>
            </SelectItemOrange>
          )})}
        </SelectContentOrange>
      </SelectOrange>
      {/* Show hint with media below dropdown for selected option */}
      {(selectedOption?.hint || hasMedia) && (
        <DropdownHintBox option={selectedOption} />
      )}
    </div>
  );
};

// Separate component for dropdown hint box with media modal
const DropdownHintBox = ({ option }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const hasMedia = option?.hintImageUrl || option?.hintVideoUrl;
  
  const getYouTubeEmbedUrl = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
  };
  
  return (
    <>
      <div 
        className={`flex items-start gap-1.5 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-100 dark:border-amber-900/50 ${hasMedia ? 'cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors' : ''}`}
        onClick={() => hasMedia && setDialogOpen(true)}
      >
        <Info className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
            {option.hint}
          </p>
          {hasMedia && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              {option.hintImageUrl && <ImageIcon className="h-3 w-3" />}
              {option.hintVideoUrl && <Play className="h-3 w-3" />}
              <span>Нажмите для просмотра</span>
            </p>
          )}
        </div>
      </div>
      
      {hasMedia && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-amber-600" />
                Подробная информация
              </DialogTitle>
            </DialogHeader>
            <HintContent 
              hint={option.hint} 
              hintImageUrl={option.hintImageUrl} 
              hintVideoUrl={option.hintVideoUrl} 
              expanded 
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

const RadioOptions = ({ category, options, formData, foundationPrice, handleRadioChange, handleQuantityChange, handleVariantChange, handleSubOptionChange, getOptionBasePrice, txt }) => {
  const selectedOptionId = formData.selections[category.id] || '';
  const selectedOption = options.find(o => o.id === selectedOptionId);
  // Get variants (support both new 'variants' and legacy 'subOptions' fields)
  const variants = selectedOption?.variants?.length > 0 ? selectedOption.variants : selectedOption?.subOptions;
  const hasVariants = variants?.length > 0;
  const selectedVariantId = formData.variantSelections?.[selectedOptionId];
  const selectedVariant = selectedVariantId ? variants?.find(v => v.id === selectedVariantId) : variants?.[0];
  
  // Check if this is the foundation/belki category
  const isBelkiCategory = category.id === 'fundament';
  
  return (
    <div className="space-y-3">
      <RadioGroupOrange value={selectedOptionId} onValueChange={(value) => handleRadioChange(category.id, value)} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {options.map((option) => {
          const isSelected = selectedOptionId === option.id;
          const quantity = formData.quantities[option.id] || 1;
          
          // For display: show variant price if option has variants and one is selected
          const optionVariants = option.variants?.length > 0 ? option.variants : option.subOptions;
          const optionHasVariants = optionVariants?.length > 0;
          const optionSelectedVariantId = formData.variantSelections?.[option.id];
          const optionSelectedVariant = optionSelectedVariantId ? optionVariants?.find(v => v.id === optionSelectedVariantId) : optionVariants?.[0];
          
          // For belki "dodaj" option, use foundationPrice from model
          const isBelkiDodaj = isBelkiCategory && option.id.includes('dodaj');
          
          // Get base price considering model-specific pricing
          const optionBasePrice = getOptionBasePrice ? getOptionBasePrice(option) : option.price;
          
          const displayPrice = isBelkiDodaj 
            ? (foundationPrice || 0)
            : (optionHasVariants && optionSelectedVariant ? optionSelectedVariant.price : optionBasePrice);
          
          return (
            <div key={option.id} className={`relative flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${isSelected ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700' : 'bg-muted/30 border-border hover:bg-muted/50'}`} onClick={() => handleRadioChange(category.id, option.id)}>
              {/* Hint icon with media support */}
              <HintIcon 
                hint={option.hint} 
                hintImageUrl={option.hintImageUrl} 
                hintVideoUrl={option.hintVideoUrl}
              />
              <RadioGroupItemOrange value={option.id} id={`${category.id}-${option.id}`} />
              <div className="flex-1">
                <Label htmlFor={`${category.id}-${option.id}`} className="cursor-pointer text-sm leading-tight block font-medium">{option.name}</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {displayPrice > 0 ? (
                    <span className="text-xs text-amber-700 font-medium">
                      {optionHasVariants ? '' : '+'}{formatPrice(displayPrice)} PLN
                      {option.hasQuantity && quantity > 1 && ` × ${quantity} = ${formatPrice(displayPrice * quantity)} PLN`}
                    </span>
                  ) : (
                    <span className="text-xs text-green-600">{txt.gratis}</span>
                  )}
                  {option.hasQuantity && isSelected && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Label className="text-xs text-muted-foreground">{txt.quantity}:</Label>
                      <InputOrange type="number" min="1" value={quantity} onChange={(e) => handleQuantityChange(option.id, e.target.value)} className="w-16 h-6 text-xs" />
                    </div>
                  )}
                </div>
                {/* Plus variant details - room sizes */}
                {(option.terraceSize || option.relaxRoomSize || option.steamRoomSize || option.entranceSide) && (
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {option.terraceSize && (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Taras:</span>
                        <span className="font-medium text-amber-800 dark:text-amber-300">{option.terraceSize}</span>
                      </div>
                    )}
                    {option.relaxRoomSize && (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Pokój wyp.:</span>
                        <span className="font-medium text-amber-800 dark:text-amber-300">{option.relaxRoomSize}</span>
                      </div>
                    )}
                    {option.steamRoomSize && (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Sauna:</span>
                        <span className="font-medium text-amber-800 dark:text-amber-300">{option.steamRoomSize}</span>
                      </div>
                    )}
                    {option.entranceSide && (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Wejście:</span>
                        <span className="font-medium text-amber-800 dark:text-amber-300">{option.entranceSide}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {option.imageUrl && <img src={option.imageUrl} alt={option.name} className="w-16 h-12 object-cover rounded" loading="lazy" decoding="async" />}
            </div>
          );
        })}
      </RadioGroupOrange>
      
      {/* Variants - show as cards like heater selection in hot tubs */}
      {hasVariants && (
        <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
          <Label className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3 block">
            Выберите вариант для &quot;{selectedOption.name}&quot;:
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {variants.map((variant) => {
              const isVariantSelected = (selectedVariantId || variants[0]?.id) === variant.id;
              
              return (
                <div
                  key={variant.id}
                  onClick={() => handleVariantChange(selectedOptionId, variant.id)}
                  className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    isVariantSelected
                      ? 'border-amber-500 bg-amber-100 shadow-md'
                      : 'border-amber-200 bg-white hover:border-amber-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {variant.imageUrl ? (
                      <img 
                        src={variant.imageUrl} 
                        alt={variant.namePl || variant.name}
                        className="w-20 h-20 object-cover rounded bg-white border"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center border">
                        <Package className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{variant.namePl || variant.name}</span>
                        {isVariantSelected && (
                          <Check className="h-4 w-4 text-amber-600" />
                        )}
                      </div>
                      <div className="text-lg font-bold text-amber-600">
                        {formatPrice(variant.price)} PLN
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({
  model, modelVariant, modelPrice, prices, formData, appliedDiscount, certificateDiscount, subtotal, discountAmount, foundationPrice, deliveryPrice, total,
  roomSizes, isAdminUser, canGiveGifts, isEditMode, adminGifts, toggleGift, removeOption, adminDiscountApproved, setAdminDiscountApproved,
  requestedDiscount, setRequestedDiscount, requestedDiscountNote, setRequestedDiscountNote,
  handleDiscountChange, handleApplyStandardDiscount, handleToggleCertificateDiscount, handleSaveAndGeneratePDF,
  handleClearForm, handleCancelEdit, getCategoryName, isOptionVisible, getOptionBasePrice, maxManagerDiscount, loading, lang, txt
}) => {
  // Check if foundation is a gift
  const foundationSelection = formData.selections['fundament'];
  const isFoundationGift = foundationSelection && (adminGifts.includes('fundament_gift') || adminGifts.includes(foundationSelection));
  
  // Get delivery info
  const deliverySelection = formData.selections['dostawa'];
  const isDeliveryGift = deliverySelection && adminGifts.includes(deliverySelection);
  const deliveryCat = prices.categories?.find(c => c.id === 'dostawa');
  const deliveryOption = deliveryCat?.options?.find(o => o.id === deliverySelection);
  
  return (
  <Card className="shadow-lg border-amber-200">
    <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-900/70 dark:to-slate-900/40 border-b border-amber-200/40 dark:border-amber-700/20">
      <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
        <Calculator className="h-5 w-5" />
        {txt.summary}
      </CardTitle>
    </CardHeader>
    <CardContent className="p-4">
      {model ? (
        <>
          {/* Scrollable area for model and options - fixed max height */}
          <div className="max-h-[35vh] overflow-y-auto space-y-4 pr-1 mb-4">
            {/* Selected Model */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900/50">
              <div className="text-sm text-amber-700 font-medium">{txt.model}</div>
              <div className="font-medium">{model.name}</div>
              {/* Show variant if selected */}
              {modelVariant && (
                <div className="text-sm text-purple-600 font-medium">
                  {lang === 'pl' ? (modelVariant.namePl || modelVariant.name) : (modelVariant.nameRu || modelVariant.name)}
                </div>
              )}
              <div className="text-amber-700 font-bold">{formatPrice(modelPrice)} PLN</div>
              {/* Room sizes */}
              {(roomSizes?.relaxRoomSize || roomSizes?.steamRoomSize) && (
                <div className="mt-2 pt-2 border-t border-amber-200 text-xs space-y-1">
                  {roomSizes.relaxRoomSize && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Przebieralnia:</span>
                      <span className="font-medium text-amber-800 dark:text-amber-300">{roomSizes.relaxRoomSize}</span>
                    </div>
                  )}
                  {roomSizes.steamRoomSize && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pokój parowy:</span>
                      <span className="font-medium text-amber-800 dark:text-amber-300">{roomSizes.steamRoomSize}</span>
                    </div>
                  )}
                  {roomSizes.hasTerrace && (
                    <div className="text-xs text-green-600 mt-1">
                      ✓ Z dodatkowym tarasem
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Options */}
            <SelectedOptionsList 
              prices={prices} 
              formData={formData} 
              getCategoryName={getCategoryName} 
              isOptionVisible={isOptionVisible} 
              getOptionBasePrice={getOptionBasePrice} 
              adminGifts={adminGifts}
              toggleGift={toggleGift}
              removeOption={removeOption}
              canGiveGifts={canGiveGifts}
              txt={txt} 
            />

            {/* Foundation - with gift controls */}
            {foundationSelection && foundationSelection.includes('dodaj') && (
              <div className="text-sm group">
                <div className="flex items-center justify-between gap-1">
                  <span className={isFoundationGift ? 'text-green-600' : ''}>
                    {isFoundationGift && <Gift className="h-3 w-3 inline mr-1 text-green-500" />}
                    {txt.foundationPrice}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`whitespace-nowrap font-medium ${isFoundationGift ? 'line-through text-gray-400' : 'text-amber-700'}`}>
                      +{formatPrice(model?.foundationPrice || 0)} PLN
                    </span>
                    {canGiveGifts && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                        <button
                          onClick={() => toggleGift(foundationSelection)}
                          className={`p-1 rounded hover:bg-green-100 ${isFoundationGift ? 'text-green-600' : 'text-gray-400 hover:text-green-600'}`}
                          title={isFoundationGift ? 'Убрать из подарков' : 'Сделать подарком'}
                        >
                          <Gift className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fixed bottom area - price and buttons */}
          <div className="border-t border-amber-200 pt-4 space-y-4">
            {/* Subtotal */}
            <div className="flex justify-between text-sm">
              <span className="font-medium">{txt.priceBeforeDiscount}</span>
              <span className="font-medium">{formatPrice(subtotal)} PLN</span>
            </div>

            {/* Discount Section */}
            <DiscountSection
              appliedDiscount={appliedDiscount}
              certificateDiscount={certificateDiscount}
              discountAmount={discountAmount}
              isAdminUser={isAdminUser}
              adminDiscountApproved={adminDiscountApproved}
              setAdminDiscountApproved={setAdminDiscountApproved}
              handleDiscountChange={handleDiscountChange}
              handleApplyStandardDiscount={handleApplyStandardDiscount}
              handleToggleCertificateDiscount={handleToggleCertificateDiscount}
              subtotal={subtotal}
              total={total}
              maxManagerDiscount={maxManagerDiscount}
              certificateDiscountPercent={prices?.certificateDiscountPercent ?? 13}
              lang={lang}
              txt={txt}
            />

            {/* Requested Discount for non-admins */}
            {!isAdminUser && (
              <RequestedDiscountSection
                requestedDiscount={requestedDiscount}
                setRequestedDiscount={setRequestedDiscount}
                requestedDiscountNote={requestedDiscountNote}
                setRequestedDiscountNote={setRequestedDiscountNote}
                lang={lang}
                txt={txt}
              />
            )}

            {/* Admin Gifts */}
            {canGiveGifts && isEditMode && adminGifts.length > 0 && (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <Gift className="h-4 w-4" />
                  {txt.gifts} ({adminGifts.length})
                </div>
                <div className="text-xs text-emerald-600">{txt.giftsHint}</div>
              </div>
            )}

            {/* Delivery - shown as separate line */}
            {deliverySelection && deliveryOption && (
              <div className="text-sm group border-t border-amber-200 pt-2">
                <div className="flex items-center justify-between gap-1">
                  <span className={isDeliveryGift ? 'text-green-600' : ''}>
                    {isDeliveryGift && <Gift className="h-3 w-3 inline mr-1 text-green-500" />}
                    🚚 {deliveryOption.name || 'Dostawa'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`whitespace-nowrap font-medium ${isDeliveryGift ? 'line-through text-gray-400' : 'text-blue-700'}`}>
                      +{formatPrice(deliveryPrice || deliveryOption.price || 0)} PLN
                    </span>
                    {canGiveGifts && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                        <button
                          onClick={() => toggleGift(deliverySelection)}
                          className={`p-1 rounded hover:bg-green-100 ${isDeliveryGift ? 'text-green-600' : 'text-gray-400 hover:text-green-600'}`}
                          title={isDeliveryGift ? 'Убрать из подарков' : 'Сделать подарком'}
                        >
                          <Gift className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeOption('dostawa', deliverySelection, false)}
                          className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
                          title="Удалить доставку"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Total */}
            <div className="p-3 bg-amber-600 text-white rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">{txt.total}</span>
                <span className="text-2xl font-bold">{formatPrice(Math.round(total))} PLN</span>
              </div>
              {(appliedDiscount > 0 || certificateDiscount) && (
                <div className="text-xs text-amber-100 mt-1">
                  {appliedDiscount > 0 && <span>{txt.discount}: {appliedDiscount}%</span>}
                  {appliedDiscount > 0 && certificateDiscount && <span> + </span>}
                  {certificateDiscount && <span>Certyfikat: {prices.certificateDiscountPercent ?? 13}%</span>}
                  <span> ({txt.priceBeforeDiscount}: {formatPrice(subtotal)} PLN)</span>
                </div>
              )}
              {deliveryPrice > 0 && !isDeliveryGift && (
                <div className="text-xs text-amber-200 mt-2 pt-2 border-t border-amber-500">
                  Z dostawą: <span className="font-semibold">{formatPrice(Math.round(total + deliveryPrice))} PLN</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button onClick={() => handleSaveAndGeneratePDF(false)} disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700" data-testid="save-generate-pdf-btn">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /><FileDown className="h-4 w-4 mr-2" /></>}
                {isEditMode ? txt.saveChangesAndPdf : txt.saveAndGeneratePDF}
              </Button>

              {isEditMode && (
                <Button onClick={() => handleSaveAndGeneratePDF(true)} disabled={loading} variant="outline" className="w-full border-amber-500 text-amber-700 hover:bg-amber-50" data-testid="create-new-kp-btn">
                  <Plus className="h-4 w-4 mr-2" />
                  {txt.createNewKp}
                </Button>
              )}
              
              {isEditMode ? (
                <Button onClick={handleCancelEdit} disabled={loading} variant="outline" className="w-full border-amber-300 text-amber-700 hover:bg-amber-50">
                  <X className="h-4 w-4 mr-2" />
                  {txt.cancelEdit}
                </Button>
              ) : (
                <Button onClick={handleClearForm} disabled={loading} variant="outline" className="w-full border-amber-300 text-amber-700 hover:bg-amber-50">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {txt.clearForm}
                </Button>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center text-muted-foreground py-8">{txt.selectModelFirst}</div>
      )}
    </CardContent>
  </Card>
  );
};

// ── Extra options card: open-price inputs + free-form custom options ─────
const ExtraOptionsCard = ({
  prices, formData, handleOpenPriceChange,
  addCustomOption, updateCustomOption, removeCustomOption,
  isOptionVisible, lang,
}) => {
  const t = lang === 'pl'
    ? {
        title: 'Dodatkowe pozycje',
        openPriceTitle: 'Opcje z otwartą ceną',
        customTitle: 'Opcje niestandardowe',
        addBtn: '+ Dodaj pozycję',
        name: 'Nazwa', price: 'Cena', qty: 'Ilość', remove: 'Usuń',
        namePh: 'Nazwa pozycji', pricePh: 'Cena (PLN)',
        emptyOpen: 'Brak wybranych opcji z otwartą ceną.',
        helpOpen: 'Wpisz cenę dla każdej wybranej opcji.',
      }
    : {
        title: 'Дополнительные позиции',
        openPriceTitle: 'Опции с открытой ценой',
        customTitle: 'Произвольные позиции',
        addBtn: '+ Добавить позицию',
        name: 'Название', price: 'Цена', qty: 'Кол-во', remove: 'Удалить',
        namePh: 'Название позиции', pricePh: 'Цена (PLN)',
        emptyOpen: 'Нет выбранных опций с открытой ценой.',
        helpOpen: 'Введите цену для каждой выбранной опции.',
      };

  // Find all currently SELECTED open-price options across categories.
  const selectedOpenPriceOptions = React.useMemo(() => {
    const result = [];
    (prices.categories || []).forEach(cat => {
      const sel = formData.selections?.[cat.id];
      if (!sel) return;
      const ids = Array.isArray(sel) ? sel : [sel];
      ids.forEach(id => {
        const opt = cat.options?.find(o => o.id === id);
        if (opt?.isOpenPrice && isOptionVisible(opt)) {
          result.push({ option: opt, categoryName: cat.name });
        }
      });
    });
    return result;
  }, [prices.categories, formData.selections, isOptionVisible]);

  const customOptions = formData.customOptions || [];
  if (selectedOpenPriceOptions.length === 0 && customOptions.length === 0 && !addCustomOption) return null;

  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-slate-900/70 dark:to-slate-900/40 border-b border-violet-200/40 dark:border-violet-700/20">
        <CardTitle className="text-lg text-slate-800 dark:text-slate-100">{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-5">
        {/* Open-price options */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">{t.openPriceTitle}</Label>
          {selectedOpenPriceOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">{t.emptyOpen}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t.helpOpen}</p>
              {selectedOpenPriceOptions.map(({ option, categoryName }) => (
                <div key={option.id} className="flex items-center gap-2 bg-violet-50 dark:bg-violet-900/20 rounded-md p-2 border border-violet-200" data-testid={`open-price-${option.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{option.name}</div>
                    <div className="text-[10px] text-muted-foreground">{categoryName}</div>
                  </div>
                  <InputOrange
                    type="number"
                    min="0"
                    step="1"
                    placeholder={t.pricePh}
                    value={formData.openPrices?.[option.id] ?? ''}
                    onChange={(e) => handleOpenPriceChange(option.id, e.target.value)}
                    className="w-32 h-8"
                    data-testid={`open-price-input-${option.id}`}
                  />
                  <span className="text-xs text-muted-foreground">PLN</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Custom options */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-semibold">{t.customTitle}</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addCustomOption(t.namePh, 0, 1)}
              data-testid="add-custom-option-btn"
            >
              {t.addBtn}
            </Button>
          </div>
          {customOptions.length > 0 && (
            <div className="space-y-2">
              {customOptions.map((it, idx) => (
                <div key={it.id} className="flex items-center gap-2 bg-fuchsia-50 dark:bg-fuchsia-900/20 rounded-md p-2 border border-fuchsia-200" data-testid={`custom-option-${idx}`}>
                  <InputOrange
                    type="text"
                    placeholder={t.namePh}
                    value={it.name}
                    onChange={(e) => updateCustomOption(it.id, { name: e.target.value })}
                    className="flex-1 h-8 text-sm"
                    data-testid={`custom-option-name-${idx}`}
                  />
                  <InputOrange
                    type="number"
                    min="0"
                    step="1"
                    placeholder={t.pricePh}
                    value={it.price}
                    onChange={(e) => updateCustomOption(it.id, { price: parseInt(e.target.value) || 0 })}
                    className="w-28 h-8"
                    data-testid={`custom-option-price-${idx}`}
                  />
                  <InputOrange
                    type="number"
                    min="1"
                    step="1"
                    value={it.quantity || 1}
                    onChange={(e) => updateCustomOption(it.id, { quantity: parseInt(e.target.value) || 1 })}
                    className="w-16 h-8"
                    title={t.qty}
                    data-testid={`custom-option-qty-${idx}`}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                    onClick={() => removeCustomOption(it.id)}
                    title={t.remove}
                    data-testid={`custom-option-remove-${idx}`}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};


const SelectedOptionsList = ({ prices, formData, getCategoryName, isOptionVisible, getOptionBasePrice, adminGifts = [], toggleGift, removeOption, canGiveGifts, txt }) => {
  // Helper to get variant info for an option
  const getVariantInfo = (opt, optId) => {
    const variants = opt?.variants?.length > 0 ? opt.variants : opt?.subOptions;
    if (!variants?.length) return null;
    
    const selectedVariantId = formData.variantSelections?.[optId];
    const selectedVariant = selectedVariantId 
      ? variants.find(v => v.id === selectedVariantId) 
      : variants[0]; // Default to first variant
    
    return selectedVariant ? {
      name: selectedVariant.namePl || selectedVariant.name,
      price: selectedVariant.price
    } : null;
  };

  // Render single option row with controls
  const renderOptionRow = (opt, category, isCheckbox = false) => {
    const quantity = opt.hasQuantity ? (formData.quantities[opt.id] || 1) : 1;
    const variantInfo = getVariantInfo(opt, opt.id);
    const optionBasePrice = getOptionBasePrice ? getOptionBasePrice(opt) : opt.price;
    const displayPrice = variantInfo ? variantInfo.price : optionBasePrice;
    const totalPrice = displayPrice * quantity;
    const isGift = adminGifts.includes(opt.id);

    return (
      <div key={opt.id} className="group">
        <div className="flex items-center justify-between gap-1">
          <span className={`truncate flex-1 ${isGift ? 'text-green-600' : ''}`}>
            {isGift && <Gift className="h-3 w-3 inline mr-1 text-green-500" />}
            {opt.name}
            {variantInfo && <span className="text-amber-600 text-xs"> ({variantInfo.name})</span>}
            {opt.hasQuantity && quantity > 1 && ` ×${quantity}`}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`whitespace-nowrap font-medium ${isGift ? 'line-through text-gray-400' : 'text-amber-700'}`}>
              {displayPrice > 0 ? `+${formatPrice(totalPrice)} PLN` : txt.gratis}
            </span>
            {/* Control buttons - visible on hover */}
            {canGiveGifts && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                <button
                  onClick={() => toggleGift(opt.id)}
                  className={`p-1 rounded hover:bg-green-100 ${isGift ? 'text-green-600' : 'text-gray-400 hover:text-green-600'}`}
                  title={isGift ? 'Убрать из подарков' : 'Сделать подарком'}
                >
                  <Gift className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => removeOption(category.id, opt.id, isCheckbox)}
                  className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
                  title="Удалить опцию"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <>
      {prices.categories?.map((category) => {
        // Skip fundament category - it's displayed separately as foundationPrice
        if (category.id === 'fundament') return null;
        
        const selection = formData.selections[category.id];
        if (!selection) return null;
        
        if (category.inputType === 'checkbox') {
          const selectedOpts = Object.entries(selection)
            .filter(([_, isSelected]) => isSelected)
            .map(([optId]) => category.options?.find(o => o.id === optId))
            .filter(opt => opt && isOptionVisible(opt)); // Filter out hidden options
          
          if (selectedOpts.length === 0) return null;
          
          return (
            <div key={category.id} className="text-sm">
              <div className="text-muted-foreground font-medium">{getCategoryName(category)}</div>
              {selectedOpts.map(opt => renderOptionRow(opt, category, true))}
            </div>
          );
        } else {
          const opt = category.options?.find(o => o.id === selection);
          // Skip hidden options
          if (!opt || !isOptionVisible(opt)) return null;
          
          return (
            <div key={category.id} className="text-sm">
              <div className="text-muted-foreground font-medium">{getCategoryName(category)}</div>
              {renderOptionRow(opt, category, false)}
            </div>
          );
        }
      })}

      {/* Free-form custom options added by manager in the calculator */}
      {Array.isArray(formData.customOptions) && formData.customOptions.length > 0 && (
        <div className="text-sm" data-testid="selected-custom-options">
          <div className="text-muted-foreground font-medium">Произвольные позиции / Pozycje niestandardowe</div>
          {formData.customOptions.map((it, idx) => {
            const qty = parseInt(it.quantity) || 1;
            const price = parseInt(it.price) || 0;
            const sum = price * qty;
            return (
              <div key={it.id || idx} className="flex items-center justify-between gap-1" data-testid={`selected-custom-${idx}`}>
                <span className="truncate flex-1 text-fuchsia-800 dark:text-fuchsia-300">
                  {it.name || '—'}{qty > 1 ? ` ×${qty}` : ''}
                </span>
                <span className="whitespace-nowrap font-medium text-amber-700">
                  {sum > 0 ? `+${formatPrice(sum)} PLN` : txt.gratis}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

const DiscountSection = ({ appliedDiscount, certificateDiscount, discountAmount, isAdminUser, adminDiscountApproved, setAdminDiscountApproved, handleDiscountChange, handleApplyStandardDiscount, handleToggleCertificateDiscount, subtotal, total, maxManagerDiscount, certificateDiscountPercent = 13, lang, txt }) => {
  const certSavings = certificateDiscount ? (subtotal - discountAmount) * (certificateDiscountPercent / 100) : 0;
  const totalSavings = discountAmount + certSavings;
  return (
  <div className="p-3 bg-green-50 rounded-lg border border-green-200 space-y-3">
    <div className="flex items-center gap-2 text-green-700 font-medium">
      <Percent className="h-4 w-4" />
      {txt.discount}
    </div>
    <div className="flex items-center gap-2">
      <InputOrange id="discountPercent" type="number" min="0" max={isAdminUser ? 100 : maxManagerDiscount} value={appliedDiscount} onChange={handleDiscountChange} className="w-20 h-8" />
      <span className="text-sm text-muted-foreground">% (max {isAdminUser ? '100' : maxManagerDiscount})</span>
    </div>
    <Button type="button" variant="outline" size="sm" onClick={handleApplyStandardDiscount} className="w-full border-green-300 text-green-700 hover:bg-green-100">
      <Tag className="h-4 w-4 mr-2" />
      {txt.applyStandardDiscount}
    </Button>
    <Button
      type="button"
      variant={certificateDiscount ? "default" : "outline"}
      size="sm"
      onClick={handleToggleCertificateDiscount}
      className={certificateDiscount
        ? "w-full bg-blue-600 hover:bg-blue-700 text-white"
        : "w-full border-blue-300 text-blue-700 hover:bg-blue-100"
      }
      data-testid="certificate-discount-btn"
    >
      <Tag className="h-4 w-4 mr-2" />
      {txt.certificatePayment}
    </Button>
    
    {isAdminUser && appliedDiscount > maxManagerDiscount && (
      <div className="flex items-center gap-2 pt-2 border-t border-green-200">
        <CheckboxOrange id="adminDiscountApproval" checked={adminDiscountApproved} onCheckedChange={setAdminDiscountApproved} />
        <Label htmlFor="adminDiscountApproval" className="text-sm text-green-700 cursor-pointer flex items-center gap-1">
          <Shield className="h-4 w-4" />
          {txt.adminApproveDiscount}
        </Label>
      </div>
    )}
    
    {(appliedDiscount > 0 || certificateDiscount) && (
      <div className="text-sm text-green-700 space-y-1">
        {appliedDiscount > 0 && (
          <div className="flex justify-between">
            <span>{txt.discount} ({appliedDiscount}%)</span>
            <span className="font-medium">-{formatPrice(Math.round(discountAmount))} PLN</span>
          </div>
        )}
        {certificateDiscount && (
          <div className="flex justify-between text-blue-700">
            <span>{txt.certificatePayment}</span>
            <span className="font-medium">-{formatPrice(Math.round(certSavings))} PLN</span>
          </div>
        )}
        <div className="flex justify-between pt-1 border-t border-green-200">
          <span>{txt.youSave}:</span>
          <span className="font-bold">{formatPrice(Math.round(totalSavings))} PLN</span>
        </div>
      </div>
    )}
  </div>
);
};

const RequestedDiscountSection = ({ requestedDiscount, setRequestedDiscount, requestedDiscountNote, setRequestedDiscountNote, lang, txt }) => (
  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
    <div className="flex items-center gap-2 text-amber-700 font-medium">
      <Tag className="h-4 w-4" />
      {txt.requestedDiscount}
    </div>
    <p className="text-xs text-amber-600">{txt.requestedDiscountHint}</p>
    <div className="flex items-center gap-2">
      <InputOrange
        type="number"
        min="0"
        max="100"
        value={requestedDiscount}
        onChange={(e) => setRequestedDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
        className="w-20 h-8"
        placeholder="0"
      />
      <span className="text-sm text-muted-foreground">%</span>
    </div>
    {requestedDiscount > 0 && (
      <InputOrange
        type="text"
        value={requestedDiscountNote}
        onChange={(e) => setRequestedDiscountNote(e.target.value)}
        placeholder={txt.requestComment}
        className="h-8 text-sm"
      />
    )}
  </div>
);
