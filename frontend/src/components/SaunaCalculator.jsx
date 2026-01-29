import React, { useState } from 'react';
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
import { 
  FileDown, Save, RotateCcw, Loader2, User, Phone, Calendar,
  Percent, Calculator, Tag, Mail, X, Edit, Gift, Shield, Package, Info, Play, Image as ImageIcon, Check, Home
} from 'lucide-react';
import { AddressAutocomplete } from './AddressAutocomplete';
import { useSaunaCalculator, categoryIcons, formatPrice } from './sauna';

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
        className="mt-2 text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 underline"
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
                className="mt-1 text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 underline"
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
    loading, initialLoading, prices, formData, appliedDiscount,
    isEditMode, editOrderId, adminGifts, adminDiscountApproved,
    requestedDiscount, requestedDiscountNote, isAdminUser, lang, txt,
    model, optionsTotal, foundationPrice, subtotal, discountAmount, total,
    roomSizes, amocrmData, maxManagerDiscount, modelVariant, modelPrice,
    setFormData, setAdminDiscountApproved, setRequestedDiscount, setRequestedDiscountNote,
    handleInputChange, handleDiscountChange, handleModelChange, handleModelVariantChange,
    handleApplyStandardDiscount, handleRadioChange, handleCheckboxChange,
    handleQuantityChange, handleVariantChange, handleSubOptionChange, handleSaveAndGeneratePDF, handleClearForm,
    handleCancelEdit, getCategoryName, isOptionVisible
  } = useSaunaCalculator(editingOrder, onEditComplete, amocrmPrefill, onAmocrmPrefillUsed);

  // Get selected model
  const selectedModel = prices.models?.find(m => m.id === formData.selectedModel);

  // Function to filter options based on incompatibility settings (inverted logic)
  // Options are shown by default, hidden only when incompatibility rules match
  const filterCompatibleOptions = (category) => {
    if (!category.options) return [];
    
    return category.options.filter(option => {
      const incompatibleModels = option.incompatibleModels || [];
      const incompatibleWithOptions = option.incompatibleWithOptions || {};
      const hasModelRules = incompatibleModels.length > 0;
      const hasOptionRules = Object.keys(incompatibleWithOptions).length > 0;
      
      // Check if current model is in incompatible list
      const modelMatches = hasModelRules && formData.selectedModel && 
        incompatibleModels.includes(formData.selectedModel);
      
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
      
      // Decision logic:
      // - If BOTH model AND option rules are set: hide only when BOTH match
      // - If ONLY model rules are set: hide when model matches
      // - If ONLY option rules are set: hide when option matches
      if (hasModelRules && hasOptionRules) {
        // Both conditions must be true to hide
        if (modelMatches && optionMatches) {
          return false;
        }
      } else if (hasModelRules) {
        // Only model rule - hide if model matches
        if (modelMatches) {
          return false;
        }
      } else if (hasOptionRules) {
        // Only option rule - hide if option matches
        if (optionMatches) {
          return false;
        }
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
        <img 
          src="/logo-wm-sauna.svg" 
          alt="WM Sauna" 
          className="h-16 md:h-20"
        />
      </div>
      
      {/* Edit Mode Banner */}
      {isEditMode && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Edit className="h-5 w-5 text-amber-600" />
            <span className="font-medium text-amber-800">
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

          {/* Model Variant Selection (if model has variants) */}
          {model?.variants?.length > 0 && (
            <ModelVariantSelector
              model={model}
              formData={formData}
              handleModelVariantChange={handleModelVariantChange}
              lang={lang}
              txt={txt}
            />
          )}

          {/* Option Categories */}
          {prices.categories?.map((category) => (
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
              txt={txt}
            />
          ))}

          {/* Notes */}
          <Card className="shadow-md">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
              <CardTitle className="text-lg text-amber-800">{txt.notes}</CardTitle>
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
            total={total}
            roomSizes={roomSizes}
            isAdminUser={isAdminUser}
            isEditMode={isEditMode}
            adminGifts={adminGifts}
            adminDiscountApproved={adminDiscountApproved}
            setAdminDiscountApproved={setAdminDiscountApproved}
            requestedDiscount={requestedDiscount}
            setRequestedDiscount={setRequestedDiscount}
            requestedDiscountNote={requestedDiscountNote}
            setRequestedDiscountNote={setRequestedDiscountNote}
            handleDiscountChange={handleDiscountChange}
            handleApplyStandardDiscount={handleApplyStandardDiscount}
            handleSaveAndGeneratePDF={handleSaveAndGeneratePDF}
            handleClearForm={handleClearForm}
            handleCancelEdit={handleCancelEdit}
            getCategoryName={getCategoryName}
            isOptionVisible={isOptionVisible}
            maxManagerDiscount={maxManagerDiscount}
            loading={loading}
            lang={lang}
            txt={txt}
          />
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
};

// Sub-components

const CustomerInfoCard = ({ formData, setFormData, handleInputChange, txt }) => (
  <Card className="shadow-md">
    <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
      <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
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

const ModelSelectionCard = ({ prices, formData, handleModelChange, txt }) => (
  <Card className="shadow-md">
    <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
      <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
        <Calculator className="h-5 w-5" />
        {txt.model} *
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-4">
      {/* Models section general hint */}
      {(prices.modelsHint || prices.modelsHintImageUrl || prices.modelsHintVideoUrl) && (
        <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              {prices.modelsHint && (
                <p className="text-sm text-amber-800 whitespace-pre-line">{prices.modelsHint}</p>
              )}
              {(prices.modelsHintImageUrl || prices.modelsHintVideoUrl) && (
                <ModelsHintMedia 
                  hintImageUrl={prices.modelsHintImageUrl} 
                  hintVideoUrl={prices.modelsHintVideoUrl} 
                />
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
            {prices.models?.map((m) => (
              <SelectItemOrange key={m.id} value={m.id}>
                <div className="flex items-center gap-2">
                  {m.imageUrl && <img src={m.imageUrl} alt={m.name} className="w-8 h-6 object-cover rounded" loading="lazy" />}
                  <span>{m.name}</span>
                  {(m.hint || m.hintImageUrl || m.hintVideoUrl) && <Info className="h-3 w-3 text-amber-500" />}
                  <span className="text-amber-700 font-medium ml-auto">{formatPrice(m.basePrice)} PLN</span>
                  {m.discount > 0 && <span className="text-green-600 text-xs">-{m.discount}%</span>}
                </div>
              </SelectItemOrange>
            ))}
          </SelectContentOrange>
        </SelectOrange>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {prices.models?.map((m) => (
            <div
              key={m.id}
              onClick={() => handleModelChange(m.id)}
              className={`relative cursor-pointer rounded-lg border-2 p-3 transition-all ${
                formData.selectedModel === m.id 
                  ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200' 
                  : 'border-border hover:border-amber-300 hover:bg-amber-50/50'
              }`}
            >
              {/* Hint icon for model with media support */}
              <HintIcon 
                hint={m.hint} 
                hintImageUrl={m.hintImageUrl} 
                hintVideoUrl={m.hintVideoUrl}
                size="md"
              />
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
              {/* Capacity display */}
              {m.capacity && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <span>👥</span>
                  <span>{m.capacity} osób</span>
                </div>
              )}
              {/* Room sizes display */}
              {(m.relaxRoomSize || m.steamRoomSize) && (
                <div className="mt-2 pt-2 border-t border-amber-200 text-xs space-y-1">
                  {m.relaxRoomSize && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Przebieralnia:</span>
                      <span className="font-medium text-amber-800">{m.relaxRoomSize}</span>
                    </div>
                  )}
                  {m.steamRoomSize && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Łaźnia:</span>
                      <span className="font-medium text-amber-800">{m.steamRoomSize}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

// Model Variant Selector Component (like heater selection in hot tubs)
const ModelVariantSelector = ({ model, formData, handleModelVariantChange, lang, txt }) => {
  const variants = model?.variants || [];
  if (variants.length === 0) return null;
  
  // Get selected variant or default to first
  const selectedVariantId = formData.selectedModelVariant || variants[0]?.id;
  
  return (
    <Card className="shadow-md border-purple-200">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
        <CardTitle className="flex items-center gap-2 text-lg text-purple-800">
          <Home className="h-5 w-5" />
          {lang === 'pl' ? 'Wybierz wariant' : 'Выберите вариант'}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
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
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <div className="bg-purple-500 text-white rounded-full p-1">
                      <Check className="h-4 w-4" />
                    </div>
                  </div>
                )}
                
                {/* Variant image */}
                {variant.imageUrl && (
                  <div className="w-full h-32 rounded-lg mb-3 bg-gray-100 overflow-hidden">
                    <img 
                      src={variant.imageUrl} 
                      alt={variantName}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                
                {/* Variant name */}
                <h4 className={`font-semibold text-base mb-1 ${isSelected ? 'text-purple-800' : 'text-gray-800'}`}>
                  {variantName}
                </h4>
                
                {/* Variant hint/description */}
                {variantHint && (
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                    {variantHint}
                  </p>
                )}
                
                {/* Variant price */}
                <div className={`text-lg font-bold ${isSelected ? 'text-purple-600' : 'text-amber-600'}`}>
                  {formatPrice(variant.price)} PLN
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

const CategoryCard = ({ category, filteredOptions, formData, foundationPrice, handleRadioChange, handleCheckboxChange, handleQuantityChange, handleVariantChange, handleSubOptionChange, getCategoryName, txt }) => {
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
      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
        <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
          <Icon className="h-5 w-5" />
          {getCategoryName(category)}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {/* Category-level hint */}
        <CategoryHint category={category} />
        
        {category.inputType === 'checkbox' ? (
          <CheckboxOptions category={category} options={options} formData={formData} foundationPrice={foundationPrice} handleCheckboxChange={handleCheckboxChange} handleQuantityChange={handleQuantityChange} handleVariantChange={handleVariantChange} handleSubOptionChange={handleSubOptionChange} txt={txt} />
        ) : isDropdownView ? (
          <DropdownOptions category={category} options={options} formData={formData} handleRadioChange={handleRadioChange} getCategoryName={getCategoryName} txt={txt} />
        ) : (
          <RadioOptions category={category} options={options} formData={formData} foundationPrice={foundationPrice} handleRadioChange={handleRadioChange} handleQuantityChange={handleQuantityChange} handleVariantChange={handleVariantChange} handleSubOptionChange={handleSubOptionChange} txt={txt} />
        )}
      </CardContent>
    </Card>
  );
};

const CheckboxOptions = ({ category, options, formData, foundationPrice, handleCheckboxChange, handleQuantityChange, handleVariantChange, handleSubOptionChange, txt }) => {
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
      
      // Calculate display price based on selected variant or belki special case
      const displayPrice = isBelkiDodaj 
        ? (foundationPrice || 0)
        : (hasVariants && selectedVariant ? selectedVariant.price : option.price);
      
      return (
        <div key={option.id} className="space-y-2">
          <div className={`relative flex items-start space-x-3 p-3 rounded-lg border transition-all ${isChecked ? 'bg-amber-50 border-amber-400' : 'bg-muted/30 border-border hover:bg-muted/50'}`}>
            {/* Hint icon with media support */}
            <HintIcon 
              hint={option.hint} 
              hintImageUrl={option.hintImageUrl} 
              hintVideoUrl={option.hintVideoUrl}
            />
            <CheckboxOrange id={`${category.id}-${option.id}`} checked={isChecked} onCheckedChange={(checked) => handleCheckboxChange(category.id, option.id, checked)} />
            <div className="flex-1">
              <Label htmlFor={`${category.id}-${option.id}`} className="cursor-pointer text-sm leading-tight block">{option.name}</Label>
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
            </div>
            {option.imageUrl && <img src={option.imageUrl} alt={option.name} className="w-16 h-12 object-cover rounded" loading="lazy" decoding="async" />}
          </div>
          
          {/* Variants - show as cards like heater selection when option is checked */}
          {isChecked && hasVariants && (
            <div className="mt-2 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
              <Label className="text-sm font-semibold text-amber-800 mb-3 block">
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

const DropdownOptions = ({ category, options, formData, handleRadioChange, getCategoryName, txt }) => {
  const selectedOption = options.find(o => o.id === formData.selections[category.id]);
  const hasMedia = selectedOption?.hintImageUrl || selectedOption?.hintVideoUrl;
  
  return (
    <div className="space-y-2">
      <SelectOrange value={formData.selections[category.id] || ''} onValueChange={(value) => handleRadioChange(category.id, value)}>
        <SelectTriggerOrange className="w-full">
          <SelectValueOrange placeholder={getCategoryName(category)} />
        </SelectTriggerOrange>
        <SelectContentOrange>
          {options.map((option) => (
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
                  {option.price > 0 ? `+${formatPrice(option.price)} PLN` : (option.name.toLowerCase().includes('belki') ? txt.priceDepends : txt.gratis)}
                </span>
              </div>
            </SelectItemOrange>
          ))}
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
        className={`flex items-start gap-1.5 p-2 bg-amber-50 rounded-md border border-amber-100 ${hasMedia ? 'cursor-pointer hover:bg-amber-100 transition-colors' : ''}`}
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

const RadioOptions = ({ category, options, formData, foundationPrice, handleRadioChange, handleQuantityChange, handleVariantChange, handleSubOptionChange, txt }) => {
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
          const displayPrice = isBelkiDodaj 
            ? (foundationPrice || 0)
            : (optionHasVariants && optionSelectedVariant ? optionSelectedVariant.price : option.price);
          
          return (
            <div key={option.id} className={`relative flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${isSelected ? 'bg-amber-50 border-amber-400' : 'bg-muted/30 border-border hover:bg-muted/50'}`} onClick={() => handleRadioChange(category.id, option.id)}>
              {/* Hint icon with media support */}
              <HintIcon 
                hint={option.hint} 
                hintImageUrl={option.hintImageUrl} 
                hintVideoUrl={option.hintVideoUrl}
              />
              <RadioGroupItemOrange value={option.id} id={`${category.id}-${option.id}`} />
              <div className="flex-1">
                <Label htmlFor={`${category.id}-${option.id}`} className="cursor-pointer text-sm leading-tight block">{option.name}</Label>
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
              </div>
              {option.imageUrl && <img src={option.imageUrl} alt={option.name} className="w-16 h-12 object-cover rounded" loading="lazy" decoding="async" />}
            </div>
          );
        })}
      </RadioGroupOrange>
      
      {/* Variants - show as cards like heater selection in hot tubs */}
      {hasVariants && (
        <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
          <Label className="text-sm font-semibold text-amber-800 mb-3 block">
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
  model, prices, formData, appliedDiscount, subtotal, discountAmount, foundationPrice, total,
  roomSizes, isAdminUser, isEditMode, adminGifts, adminDiscountApproved, setAdminDiscountApproved,
  requestedDiscount, setRequestedDiscount, requestedDiscountNote, setRequestedDiscountNote,
  handleDiscountChange, handleApplyStandardDiscount, handleSaveAndGeneratePDF,
  handleClearForm, handleCancelEdit, getCategoryName, isOptionVisible, maxManagerDiscount, loading, lang, txt
}) => (
  <Card className="shadow-lg sticky top-4 border-amber-200">
    <CardHeader className="bg-gradient-to-r from-amber-100 to-orange-100">
      <CardTitle className="flex items-center gap-2 text-amber-800">
        <Calculator className="h-5 w-5" />
        {txt.summary}
      </CardTitle>
    </CardHeader>
    <CardContent className="p-4 space-y-4">
      {model ? (
        <>
          {/* Selected Model */}
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <div className="text-sm text-amber-700 font-medium">{txt.model}</div>
            <div className="font-medium">{model.name}</div>
            <div className="text-amber-700 font-bold">{formatPrice(model.basePrice)} PLN</div>
            {/* Room sizes */}
            {(roomSizes?.relaxRoomSize || roomSizes?.steamRoomSize) && (
              <div className="mt-2 pt-2 border-t border-amber-200 text-xs space-y-1">
                {roomSizes.relaxRoomSize && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Przebieralnia:</span>
                    <span className="font-medium text-amber-800">{roomSizes.relaxRoomSize}</span>
                  </div>
                )}
                {roomSizes.steamRoomSize && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Łaźnia:</span>
                    <span className="font-medium text-amber-800">{roomSizes.steamRoomSize}</span>
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
          <SelectedOptionsList prices={prices} formData={formData} getCategoryName={getCategoryName} isOptionVisible={isOptionVisible} txt={txt} />

          {/* Foundation */}
          {foundationPrice > 0 && (
            <div className="text-sm">
              <div className="flex justify-between">
                <span>{txt.foundationPrice}</span>
                <span className="text-amber-700 font-medium">+{formatPrice(foundationPrice)} PLN</span>
              </div>
            </div>
          )}

          <div className="border-t border-amber-200 my-2" />

          {/* Subtotal */}
          <div className="flex justify-between text-sm">
            <span className="font-medium">{txt.priceBeforeDiscount}</span>
            <span className="font-medium">{formatPrice(subtotal)} PLN</span>
          </div>

          {/* Discount Section */}
          <DiscountSection
            appliedDiscount={appliedDiscount}
            discountAmount={discountAmount}
            isAdminUser={isAdminUser}
            adminDiscountApproved={adminDiscountApproved}
            setAdminDiscountApproved={setAdminDiscountApproved}
            handleDiscountChange={handleDiscountChange}
            handleApplyStandardDiscount={handleApplyStandardDiscount}
            maxManagerDiscount={maxManagerDiscount}
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
          {isAdminUser && isEditMode && adminGifts.length > 0 && (
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 font-medium">
                <Gift className="h-4 w-4" />
                {txt.gifts} ({adminGifts.length})
              </div>
              <div className="text-xs text-emerald-600">{txt.giftsHint}</div>
            </div>
          )}

          {/* Total */}
          <div className="p-3 bg-amber-600 text-white rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">{txt.total}</span>
              <span className="text-2xl font-bold">{formatPrice(Math.round(total))} PLN</span>
            </div>
            {appliedDiscount > 0 && (
              <div className="text-xs text-amber-100 mt-1">
                {txt.discount}: {appliedDiscount}% ({txt.priceBeforeDiscount}: {formatPrice(subtotal)} PLN)
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <Button onClick={handleSaveAndGeneratePDF} disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /><FileDown className="h-4 w-4 mr-2" /></>}
              {isEditMode ? txt.saveChangesAndPdf : txt.saveAndGeneratePDF}
            </Button>
            
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
        </>
      ) : (
        <div className="text-center text-muted-foreground py-8">{txt.selectModelFirst}</div>
      )}
    </CardContent>
  </Card>
);

const SelectedOptionsList = ({ prices, formData, getCategoryName, isOptionVisible, txt }) => {
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
              {selectedOpts.map(opt => {
                const quantity = opt.hasQuantity ? (formData.quantities[opt.id] || 1) : 1;
                const variantInfo = getVariantInfo(opt, opt.id);
                const displayPrice = variantInfo ? variantInfo.price : opt.price;
                const totalPrice = displayPrice * quantity;
                
                return (
                  <div key={opt.id}>
                    <div className="flex justify-between">
                      <span className="truncate pr-2">
                        {opt.name}
                        {variantInfo && <span className="text-amber-600"> ({variantInfo.name})</span>}
                        {opt.hasQuantity && quantity > 1 && ` ×${quantity}`}
                      </span>
                      <span className="text-amber-700 whitespace-nowrap font-medium">
                        {displayPrice > 0 ? `+${formatPrice(totalPrice)} PLN` : txt.gratis}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        } else {
          const opt = category.options?.find(o => o.id === selection);
          // Skip hidden options
          if (!opt || !isOptionVisible(opt)) return null;
          
          const quantity = opt.hasQuantity ? (formData.quantities[opt.id] || 1) : 1;
          const variantInfo = getVariantInfo(opt, selection);
          const displayPrice = variantInfo ? variantInfo.price : opt.price;
          const totalPrice = displayPrice * quantity;
          
          return (
            <div key={category.id} className="text-sm">
              <div className="text-muted-foreground font-medium">{getCategoryName(category)}</div>
              <div className="flex justify-between">
                <span className="truncate pr-2">
                  {opt.name}
                  {variantInfo && <span className="text-amber-600"> ({variantInfo.name})</span>}
                  {opt.hasQuantity && quantity > 1 && ` ×${quantity}`}
                </span>
                <span className="text-amber-700 whitespace-nowrap font-medium">
                  {displayPrice > 0 ? `+${formatPrice(totalPrice)} PLN` : txt.gratis}
                </span>
              </div>
            </div>
          );
        }
      })}
    </>
  );
};

const DiscountSection = ({ appliedDiscount, discountAmount, isAdminUser, adminDiscountApproved, setAdminDiscountApproved, handleDiscountChange, handleApplyStandardDiscount, maxManagerDiscount, lang, txt }) => (
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
    
    {isAdminUser && appliedDiscount > maxManagerDiscount && (
      <div className="flex items-center gap-2 pt-2 border-t border-green-200">
        <CheckboxOrange id="adminDiscountApproval" checked={adminDiscountApproved} onCheckedChange={setAdminDiscountApproved} />
        <Label htmlFor="adminDiscountApproval" className="text-sm text-green-700 cursor-pointer flex items-center gap-1">
          <Shield className="h-4 w-4" />
          {txt.adminApproveDiscount}
        </Label>
      </div>
    )}
    
    {appliedDiscount > 0 && (
      <div className="text-sm text-green-700">
        <div className="flex justify-between">
          <span>{txt.discount} ({appliedDiscount}%)</span>
          <span className="font-medium">-{formatPrice(Math.round(discountAmount))} PLN</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>{txt.youSave}:</span>
          <span className="font-bold">{formatPrice(Math.round(discountAmount))} PLN</span>
        </div>
      </div>
    )}
  </div>
);

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
