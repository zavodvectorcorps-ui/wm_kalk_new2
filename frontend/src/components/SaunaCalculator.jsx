import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { InputOrange } from './ui/input-orange';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { CheckboxOrange } from './ui/checkbox-orange';
import { RadioGroupOrange, RadioGroupItemOrange } from './ui/radio-group-orange';
import { SelectOrange, SelectContentOrange, SelectItemOrange, SelectTriggerOrange, SelectValueOrange } from './ui/select-orange';
import { 
  FileDown, Save, RotateCcw, Loader2, User, Phone, Calendar,
  Percent, Calculator, Tag, Mail, X, Edit, Gift, Shield, Package
} from 'lucide-react';
import { AddressAutocomplete } from './AddressAutocomplete';
import { useSaunaCalculator, categoryIcons, formatPrice } from './sauna';

export const SaunaCalculator = ({ editingOrder = null, onEditComplete, amocrmPrefill = null, onAmocrmPrefillUsed = null }) => {
  const {
    loading, initialLoading, prices, formData, appliedDiscount,
    isEditMode, editOrderId, adminGifts, adminDiscountApproved,
    requestedDiscount, requestedDiscountNote, isAdminUser, lang, txt,
    model, optionsTotal, foundationPrice, subtotal, discountAmount, total,
    amocrmData,
    setFormData, setAdminDiscountApproved, setRequestedDiscount, setRequestedDiscountNote,
    handleInputChange, handleDiscountChange, handleModelChange,
    handleApplyStandardDiscount, handleRadioChange, handleCheckboxChange,
    handleQuantityChange, handleSaveAndGeneratePDF, handleClearForm,
    handleCancelEdit, getCategoryName
  } = useSaunaCalculator(editingOrder, onEditComplete, amocrmPrefill, onAmocrmPrefillUsed);

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
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

          {/* Option Categories */}
          {prices.categories?.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              formData={formData}
              handleRadioChange={handleRadioChange}
              handleCheckboxChange={handleCheckboxChange}
              handleQuantityChange={handleQuantityChange}
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
            prices={prices}
            formData={formData}
            appliedDiscount={appliedDiscount}
            subtotal={subtotal}
            discountAmount={discountAmount}
            foundationPrice={foundationPrice}
            total={total}
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
            loading={loading}
            lang={lang}
            txt={txt}
          />
        </div>
      </div>
    </div>
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
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

const CategoryCard = ({ category, formData, handleRadioChange, handleCheckboxChange, handleQuantityChange, getCategoryName, txt }) => {
  const Icon = categoryIcons[category.name] || Package;
  const isDropdownView = category.displayType === 'dropdown';
  
  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
        <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
          <Icon className="h-5 w-5" />
          {getCategoryName(category)}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {category.inputType === 'checkbox' ? (
          <CheckboxOptions category={category} formData={formData} handleCheckboxChange={handleCheckboxChange} handleQuantityChange={handleQuantityChange} txt={txt} />
        ) : isDropdownView ? (
          <DropdownOptions category={category} formData={formData} handleRadioChange={handleRadioChange} getCategoryName={getCategoryName} txt={txt} />
        ) : (
          <RadioOptions category={category} formData={formData} handleRadioChange={handleRadioChange} handleQuantityChange={handleQuantityChange} txt={txt} />
        )}
      </CardContent>
    </Card>
  );
};

const CheckboxOptions = ({ category, formData, handleCheckboxChange, handleQuantityChange, txt }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {category.options?.map((option) => {
      const isChecked = formData.selections[category.id]?.[option.id] || false;
      const quantity = formData.quantities[option.id] || 1;
      return (
        <div key={option.id} className={`flex items-start space-x-3 p-3 rounded-lg border transition-all ${isChecked ? 'bg-amber-50 border-amber-400' : 'bg-muted/30 border-border hover:bg-muted/50'}`}>
          <CheckboxOrange id={`${category.id}-${option.id}`} checked={isChecked} onCheckedChange={(checked) => handleCheckboxChange(category.id, option.id, checked)} />
          <div className="flex-1">
            <Label htmlFor={`${category.id}-${option.id}`} className="cursor-pointer text-sm leading-tight block">{option.name}</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {option.price > 0 ? (
                <span className="text-xs text-amber-700 font-medium">
                  +{formatPrice(option.price)} PLN
                  {option.hasQuantity && quantity > 1 && ` × ${quantity} = ${formatPrice(option.price * quantity)} PLN`}
                </span>
              ) : (
                <span className="text-xs text-green-600">{option.name.toLowerCase().includes('belki') ? txt.priceDepends : txt.gratis}</span>
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
      );
    })}
  </div>
);

const DropdownOptions = ({ category, formData, handleRadioChange, getCategoryName, txt }) => (
  <SelectOrange value={formData.selections[category.id] || ''} onValueChange={(value) => handleRadioChange(category.id, value)}>
    <SelectTriggerOrange className="w-full">
      <SelectValueOrange placeholder={getCategoryName(category)} />
    </SelectTriggerOrange>
    <SelectContentOrange>
      {category.options?.map((option) => (
        <SelectItemOrange key={option.id} value={option.id}>
          <div className="flex items-center gap-2">
            {option.imageUrl && <img src={option.imageUrl} alt={option.name} className="w-8 h-6 object-cover rounded" loading="lazy" />}
            <span>{option.name}</span>
            <span className="text-amber-700 font-medium ml-2">
              {option.price > 0 ? `+${formatPrice(option.price)} PLN` : (option.name.toLowerCase().includes('belki') ? txt.priceDepends : txt.gratis)}
            </span>
          </div>
        </SelectItemOrange>
      ))}
    </SelectContentOrange>
  </SelectOrange>
);

const RadioOptions = ({ category, formData, handleRadioChange, handleQuantityChange, txt }) => (
  <RadioGroupOrange value={formData.selections[category.id] || ''} onValueChange={(value) => handleRadioChange(category.id, value)} className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {category.options?.map((option) => {
      const isSelected = formData.selections[category.id] === option.id;
      const quantity = formData.quantities[option.id] || 1;
      return (
        <div key={option.id} className={`flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${isSelected ? 'bg-amber-50 border-amber-400' : 'bg-muted/30 border-border hover:bg-muted/50'}`} onClick={() => handleRadioChange(category.id, option.id)}>
          <RadioGroupItemOrange value={option.id} id={`${category.id}-${option.id}`} />
          <div className="flex-1">
            <Label htmlFor={`${category.id}-${option.id}`} className="cursor-pointer text-sm leading-tight block">{option.name}</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {option.price > 0 ? (
                <span className="text-xs text-amber-700 font-medium">
                  +{formatPrice(option.price)} PLN
                  {option.hasQuantity && quantity > 1 && ` × ${quantity} = ${formatPrice(option.price * quantity)} PLN`}
                </span>
              ) : (
                <span className="text-xs text-green-600">{option.name.toLowerCase().includes('belki') ? txt.priceDepends : txt.gratis}</span>
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
);

const SummaryCard = ({
  model, prices, formData, appliedDiscount, subtotal, discountAmount, foundationPrice, total,
  isAdminUser, isEditMode, adminGifts, adminDiscountApproved, setAdminDiscountApproved,
  requestedDiscount, setRequestedDiscount, requestedDiscountNote, setRequestedDiscountNote,
  handleDiscountChange, handleApplyStandardDiscount, handleSaveAndGeneratePDF,
  handleClearForm, handleCancelEdit, getCategoryName, loading, lang, txt
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
          </div>

          {/* Selected Options */}
          <SelectedOptionsList prices={prices} formData={formData} getCategoryName={getCategoryName} txt={txt} />

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

const SelectedOptionsList = ({ prices, formData, getCategoryName, txt }) => (
  <>
    {prices.categories?.map((category) => {
      const selection = formData.selections[category.id];
      if (!selection) return null;
      
      if (category.inputType === 'checkbox') {
        const selectedOpts = Object.entries(selection)
          .filter(([_, isSelected]) => isSelected)
          .map(([optId]) => category.options?.find(o => o.id === optId))
          .filter(Boolean);
        
        if (selectedOpts.length === 0) return null;
        
        return (
          <div key={category.id} className="text-sm">
            <div className="text-muted-foreground font-medium">{getCategoryName(category)}</div>
            {selectedOpts.map(opt => {
              const quantity = opt.hasQuantity ? (formData.quantities[opt.id] || 1) : 1;
              const totalPrice = opt.price * quantity;
              return (
                <div key={opt.id} className="flex justify-between">
                  <span className="truncate pr-2">{opt.name}{opt.hasQuantity && quantity > 1 && ` (×${quantity})`}</span>
                  <span className="text-amber-700 whitespace-nowrap font-medium">
                    {opt.price > 0 ? `+${formatPrice(totalPrice)} PLN` : (opt.name.toLowerCase().includes('belki') ? txt.priceDepends : txt.gratis)}
                  </span>
                </div>
              );
            })}
          </div>
        );
      } else {
        const opt = category.options?.find(o => o.id === selection);
        if (!opt) return null;
        
        const quantity = opt.hasQuantity ? (formData.quantities[opt.id] || 1) : 1;
        const totalPrice = opt.price * quantity;
        
        return (
          <div key={category.id} className="text-sm">
            <div className="text-muted-foreground font-medium">{getCategoryName(category)}</div>
            <div className="flex justify-between">
              <span className="truncate pr-2">{opt.name}{opt.hasQuantity && quantity > 1 && ` (×${quantity})`}</span>
              <span className="text-amber-700 whitespace-nowrap font-medium">
                {opt.price > 0 ? `+${formatPrice(totalPrice)} PLN` : (opt.name.toLowerCase().includes('belki') ? txt.priceDepends : txt.gratis)}
              </span>
            </div>
          </div>
        );
      }
    })}
  </>
);

const DiscountSection = ({ appliedDiscount, discountAmount, isAdminUser, adminDiscountApproved, setAdminDiscountApproved, handleDiscountChange, handleApplyStandardDiscount, lang, txt }) => (
  <div className="p-3 bg-green-50 rounded-lg border border-green-200 space-y-3">
    <div className="flex items-center gap-2 text-green-700 font-medium">
      <Percent className="h-4 w-4" />
      {txt.discount}
    </div>
    <div className="flex items-center gap-2">
      <InputOrange id="discountPercent" type="number" min="0" max={isAdminUser ? 100 : 10} value={appliedDiscount} onChange={handleDiscountChange} className="w-20 h-8" />
      <span className="text-sm text-muted-foreground">% (max {isAdminUser ? '100' : '10'})</span>
    </div>
    <Button type="button" variant="outline" size="sm" onClick={handleApplyStandardDiscount} className="w-full border-green-300 text-green-700 hover:bg-green-100">
      <Tag className="h-4 w-4 mr-2" />
      {txt.applyStandardDiscount}
    </Button>
    
    {isAdminUser && appliedDiscount > 10 && (
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
