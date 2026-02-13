import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { toast, Toaster } from 'sonner';
import { 
  Send, Check, Loader2, ChevronRight, Phone, User, MessageSquare,
  Info, ShoppingCart, HelpCircle
} from 'lucide-react';
import axios from 'axios';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

// Smart API URL - auto-detect on production
const getApiUrl = () => { 
  if (typeof window !== 'undefined') { 
    const o = window.location.origin; 
    if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o; 
  } 
  return process.env.REACT_APP_BACKEND_URL || ''; 
};
const API_URL = getApiUrl();

// Helper to get full image URL
const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/api/')) {
    return `${API_URL}${url}`;
  }
  return url;
};

export const EmbedBaliaCalculator = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [prices, setPrices] = useState({ models: [], categories: [] });
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [submittedOrderId, setSubmittedOrderId] = useState('');
  
  // Discount state
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  
  // Form state
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedHeaterVariant, setSelectedHeaterVariant] = useState(null);
  const [selections, setSelections] = useState({});
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    comment: ''
  });

  // Get max discount for manager
  const maxManagerDiscount = prices.maxManagerDiscount || 10;
  
  // Calculate total
  const calculateTotal = () => {
    let total = selectedHeaterVariant?.price || 0;
    
    prices.categories?.forEach(cat => {
      const selection = selections[cat.id];
      if (!selection) return;
      
      if (cat.inputType === 'checkbox' && typeof selection === 'object') {
        Object.entries(selection).forEach(([optId, isSelected]) => {
          if (isSelected) {
            const opt = cat.options?.find(o => o.id === optId);
            if (opt) total += opt.price || 0;
          }
        });
      } else if (typeof selection === 'string') {
        const opt = cat.options?.find(o => o.id === selection);
        if (opt) total += opt.price || 0;
      }
    });
    
    return total;
  };
  
  // Calculate discounted total
  const subtotal = calculateTotal();
  const discountAmount = Math.round(subtotal * appliedDiscount / 100);
  const totalWithDiscount = subtotal - discountAmount;

  // Handle discount change
  const handleDiscountChange = (value) => {
    const numValue = parseInt(value) || 0;
    const maxAllowed = maxManagerDiscount;
    setAppliedDiscount(Math.min(Math.max(0, numValue), maxAllowed));
  };

  // Fetch prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/public/prices`);
        setPrices(response.data);
      } catch (error) {
        console.error('Error fetching prices:', error);
        toast.error('Błąd ładowania danych');
      } finally {
        setLoading(false);
      }
    };
    fetchPrices();
  }, []);

  // Get name based on language (Polish for embed)
  const getName = (item) => item?.namePl || item?.name || '';

  // Handle model selection
  const handleSelectModel = (model) => {
    setSelectedModel(model);
    // Auto-select first heater variant
    if (model.heaterVariants?.length > 0) {
      setSelectedHeaterVariant(model.heaterVariants[0]);
    }
  };

  // Handle selection change
  const handleSelectionChange = (categoryId, value) => {
    setSelections(prev => ({
      ...prev,
      [categoryId]: value
    }));
  };

  // Handle checkbox change
  const handleCheckboxChange = (categoryId, optionId, checked) => {
    setSelections(prev => ({
      ...prev,
      [categoryId]: {
        ...(prev[categoryId] || {}),
        [optionId]: checked
      }
    }));
  };

  // Check if category should be visible (dependent categories)
  const isCategoryVisible = (category) => {
    if (!category.dependsOn) return true;
    const parentValue = selections[category.dependsOn];
    return parentValue === category.dependsOnValue;
  };

  // Get selected options for order
  const getSelectedOptions = () => {
    const options = [];
    prices.categories?.forEach(cat => {
      if (!isCategoryVisible(cat)) return;
      
      const selection = selections[cat.id];
      if (!selection) return;
      
      if (cat.inputType === 'checkbox' && typeof selection === 'object') {
        Object.entries(selection).forEach(([optId, isSelected]) => {
          if (isSelected) {
            const opt = cat.options?.find(o => o.id === optId);
            if (opt) {
              options.push({
                id: opt.id,
                name: getName(opt),
                price: opt.price || 0,
                categoryId: cat.id,
                categoryName: getName(cat)
              });
            }
          }
        });
      } else if (typeof selection === 'string') {
        const opt = cat.options?.find(o => o.id === selection);
        if (opt) {
          options.push({
            id: opt.id,
            name: getName(opt),
            price: opt.price || 0,
            categoryId: cat.id,
            categoryName: getName(cat)
          });
        }
      }
    });
    return options;
  };

  // Submit order
  const handleSubmit = async () => {
    // Validation
    if (!selectedModel) {
      toast.error('Wybierz model kupeli');
      return;
    }
    if (!customerData.name.trim()) {
      toast.error('Podaj swoje imię');
      return;
    }
    if (!customerData.phone.trim()) {
      toast.error('Podaj numer telefonu');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const orderData = {
        customerName: customerData.name.trim(),
        customerPhone: customerData.phone.trim(),
        customerComment: customerData.comment.trim(),
        modelId: selectedModel.id,
        modelName: getName(selectedModel),
        modelPrice: selectedHeaterVariant?.price || 0,
        modelImageUrl: selectedHeaterVariant?.imageUrl || selectedModel.imageUrl || '',
        heaterVariantType: selectedHeaterVariant?.type || 'external',
        selections: selections,
        selectedOptions: getSelectedOptions(),
        subtotal: subtotal,
        discount: appliedDiscount,
        discountAmount: discountAmount,
        total: totalWithDiscount,
        currency: prices.currencySymbol || 'zł'
      };
      
      const response = await axios.post(`${API_URL}/api/public/web-order`, orderData);
      
      if (response.data.success) {
        setSubmittedOrderId(response.data.orderId);
        setShowSuccessDialog(true);
        // Reset form
        setSelectedModel(null);
        setSelectedHeaterVariant(null);
        setSelections({});
        setCustomerData({ name: '', phone: '', comment: '' });
        setAppliedDiscount(0);
      }
    } catch (error) {
      console.error('Error submitting order:', error);
      toast.error('Błąd podczas wysyłania zamówienia. Spróbuj ponownie.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const total = totalWithDiscount;
  const currencySymbol = prices.currencySymbol || 'zł';

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 md:p-6">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 text-center">
          Konfigurator Kupeli
        </h1>
        <p className="text-gray-600 text-center mt-2">
          Wybierz model i opcje, aby zobaczyć cenę
        </p>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Step 1: Model Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Badge variant="secondary" className="h-6 w-6 rounded-full flex items-center justify-center p-0">1</Badge>
              Wybierz model
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {prices.models?.filter(m => m.active !== false).map(model => (
                <div
                  key={model.id}
                  onClick={() => handleSelectModel(model)}
                  className={`
                    relative p-3 rounded-lg border-2 cursor-pointer transition-all
                    ${selectedModel?.id === model.id 
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }
                  `}
                >
                  {/* Hint icon - prefer Polish hint */}
                  {(model.hintPl || model.hint) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <div className="absolute top-1 right-1 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full p-1 z-10 cursor-help">
                            <Info className="h-3 w-3" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs bg-gray-900 text-white p-2">
                          {model.hintPl || model.hint}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {model.imageUrl && (
                    <img 
                      src={getImageUrl(model.imageUrl)} 
                      alt={getName(model)}
                      className="w-full h-24 object-contain mb-2"
                    />
                  )}
                  <p className="font-medium text-sm text-center">{getName(model)}</p>
                  {/* Specs preview */}
                  {model.specs && (
                    <div className="mt-1 text-xs text-muted-foreground text-center space-y-0.5">
                      {(model.specs.outerDiameter || model.specs.dimensions) && (
                        <p>📐 {model.specs.dimensions || `Ø ${model.specs.outerDiameter}`}</p>
                      )}
                      {model.specs.volume && <p>💧 {model.specs.volume}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Heater Variant Selection */}
        {selectedModel && selectedModel.heaterVariants?.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Badge variant="secondary" className="h-6 w-6 rounded-full flex items-center justify-center p-0">2</Badge>
                Wybierz typ pieca
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {selectedModel.heaterVariants.map((variant, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedHeaterVariant(variant)}
                    className={`
                      p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${selectedHeaterVariant?.type === variant.type 
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                        : 'border-gray-200 hover:border-blue-300'
                      }
                    `}
                  >
                    {variant.imageUrl && (
                      <img 
                        src={getImageUrl(variant.imageUrl)} 
                        alt={variant.type}
                        className="w-full h-20 object-contain mb-2"
                      />
                    )}
                    <p className="font-medium text-center">
                      {variant.type === 'integrated' ? 'Piec zintegrowany' : 'Piec zewnętrzny'}
                    </p>
                    <p className="text-blue-600 font-bold text-center mt-1">
                      {variant.price?.toLocaleString()} {currencySymbol}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selected Model Details with Specs and Hint */}
        {selectedModel && selectedHeaterVariant && (
          <Card className="border-blue-200 bg-blue-50/30">
            <CardContent className="pt-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Image */}
                <div className="md:w-1/3">
                  {(selectedHeaterVariant?.imageUrl || selectedModel.imageUrl) && (
                    <img 
                      src={getImageUrl(selectedHeaterVariant?.imageUrl || selectedModel.imageUrl)} 
                      alt={getName(selectedModel)}
                      className="w-full h-32 object-contain rounded-lg bg-white p-2"
                    />
                  )}
                </div>
                
                {/* Details */}
                <div className="md:w-2/3 space-y-2">
                  <h3 className="font-semibold text-lg">{getName(selectedModel)}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedHeaterVariant?.type === 'integrated' ? 'Piec zintegrowany' : 'Piec zewnętrzny'}
                  </p>
                  
                  {/* Hint/Description - prefer Polish */}
                  {(selectedModel.hintPl || selectedModel.hint) && (
                    <p className="text-sm text-gray-600 bg-white p-2 rounded border-l-2 border-blue-400">
                      {selectedModel.hintPl || selectedModel.hint}
                    </p>
                  )}
                  
                  {/* Specifications */}
                  {selectedModel.specs && (
                    <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                      {!!(selectedModel.specs.outerDiameter && selectedModel.specs.outerDiameter !== 0 && selectedModel.specs.outerDiameter !== '0') && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Średnica:</span>
                          <span className="font-medium">{selectedModel.specs.outerDiameter}</span>
                        </div>
                      )}
                      {!!selectedModel.specs.dimensions && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Wymiary:</span>
                          <span className="font-medium">{selectedModel.specs.dimensions}</span>
                        </div>
                      )}
                      {!!(selectedModel.specs.depth && selectedModel.specs.depth !== 0 && selectedModel.specs.depth !== '0') && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Głębokość:</span>
                          <span className="font-medium">{selectedModel.specs.depth}</span>
                        </div>
                      )}
                      {!!selectedModel.specs.volume && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Pojemność:</span>
                          <span className="font-medium">{selectedModel.specs.volume}</span>
                        </div>
                      )}
                      {!!(selectedModel.specs.seats && selectedModel.specs.seats !== 0 && selectedModel.specs.seats !== '0') && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Miejsca:</span>
                          <span className="font-medium">{selectedModel.specs.seats}</span>
                        </div>
                      )}
                      {!!(selectedModel.specs.heaterPower && selectedModel.specs.heaterPower !== 0 && selectedModel.specs.heaterPower !== '0') && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Moc pieca:</span>
                          <span className="font-medium">{selectedModel.specs.heaterPower}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Options */}
        {selectedModel && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Badge variant="secondary" className="h-6 w-6 rounded-full flex items-center justify-center p-0">3</Badge>
                Opcje dodatkowe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {prices.categories?.filter(cat => isCategoryVisible(cat)).map(category => (
                <div key={category.id} className="space-y-2">
                  <Label className="font-medium flex items-center gap-2">
                    {category.imageUrl && (
                      <img 
                        src={getImageUrl(category.imageUrl)} 
                        alt={getName(category)}
                        className="w-8 h-8 object-contain rounded"
                      />
                    )}
                    {getName(category)}
                    {(category.hintPl || category.hint) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            {category.hintPl || category.hint}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </Label>
                  
                  {/* Checkbox - multiple selection */}
                  {category.inputType === 'checkbox' ? (
                    category.displayType === 'tiles' ? (
                      /* Tiles display for checkbox */
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {category.options?.map(option => (
                          <div
                            key={option.id}
                            onClick={() => handleCheckboxChange(category.id, option.id, !selections[category.id]?.[option.id])}
                            className={`
                              relative p-3 rounded-lg border-2 cursor-pointer transition-all text-center
                              ${selections[category.id]?.[option.id]
                                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                              }
                            `}
                          >
                            {(option.hintPl || option.hint) && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <div className="absolute top-1 right-1 text-blue-500">
                                      <Info className="h-3 w-3" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-xs">
                                    {option.hintPl || option.hint}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {option.imageUrl && (
                              <img 
                                src={getImageUrl(option.imageUrl)} 
                                alt={getName(option)}
                                className="w-full h-16 object-contain mb-2"
                              />
                            )}
                            {option.colorPreview && (
                              <div 
                                className="w-8 h-8 rounded-full border-2 mx-auto mb-2"
                                style={{ backgroundColor: option.colorPreview }}
                              />
                            )}
                            <p className="text-sm font-medium">{getName(option)}</p>
                            {option.price > 0 && (
                              <p className="text-xs text-blue-600 mt-1">+{option.price} {currencySymbol}</p>
                            )}
                            {selections[category.id]?.[option.id] && (
                              <div className="absolute top-1 left-1 bg-blue-500 rounded-full p-0.5">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* List display for checkbox */
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {category.options?.map(option => (
                          <div
                            key={option.id}
                            className="flex items-center gap-2 p-2 rounded border hover:bg-gray-50"
                          >
                            <Checkbox
                              id={option.id}
                              checked={selections[category.id]?.[option.id] || false}
                              onCheckedChange={(checked) => handleCheckboxChange(category.id, option.id, checked)}
                            />
                            {option.imageUrl && (
                              <img 
                                src={getImageUrl(option.imageUrl)} 
                                alt={getName(option)}
                                className="w-10 h-10 object-contain rounded"
                              />
                            )}
                            <label htmlFor={option.id} className="flex-1 cursor-pointer text-sm">
                              {option.colorPreview && (
                                <span 
                                  className="inline-block w-4 h-4 rounded border mr-2 align-middle"
                                  style={{ backgroundColor: option.colorPreview }}
                                />
                              )}
                              {getName(option)}
                              {(option.hintPl || option.hint) && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="h-3 w-3 inline ml-1 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs text-xs">
                                      {option.hintPl || option.hint}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </label>
                            {option.price > 0 && (
                              <span className="text-blue-600 text-sm font-medium">
                                +{option.price} {currencySymbol}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  ) : category.displayType === 'tiles' ? (
                    /* Tiles display for radio (single selection) */
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {category.options?.map(option => (
                        <div
                          key={option.id}
                          onClick={() => handleSelectionChange(category.id, option.id)}
                          className={`
                            relative p-3 rounded-lg border-2 cursor-pointer transition-all text-center
                            ${selections[category.id] === option.id
                              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                              : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                            }
                          `}
                        >
                          {(option.hintPl || option.hint) && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <div className="absolute top-1 right-1 text-blue-500">
                                    <Info className="h-3 w-3" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs text-xs">
                                  {option.hintPl || option.hint}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {option.imageUrl && (
                            <img 
                              src={getImageUrl(option.imageUrl)} 
                              alt={getName(option)}
                              className="w-full h-16 object-contain mb-2"
                            />
                          )}
                          {option.colorPreview && (
                            <div 
                              className="w-8 h-8 rounded-full border-2 mx-auto mb-2"
                              style={{ backgroundColor: option.colorPreview }}
                            />
                          )}
                          <p className="text-sm font-medium">{getName(option)}</p>
                          {option.price > 0 && (
                            <p className="text-xs text-blue-600 mt-1">+{option.price} {currencySymbol}</p>
                          )}
                          {selections[category.id] === option.id && (
                            <div className="absolute top-1 left-1 bg-blue-500 rounded-full p-0.5">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Select
                      value={selections[category.id] || ''}
                      onValueChange={(value) => handleSelectionChange(category.id, value)}
                    >
                      <SelectTrigger>
                        {(() => {
                          const sel = category.options?.find(o => o.id === selections[category.id]);
                          return sel ? (
                            <div className="flex items-center gap-2">
                              {sel.imageUrl && (
                                <img 
                                  src={getImageUrl(sel.imageUrl)} 
                                  alt={getName(sel)}
                                  className="w-6 h-6 object-contain rounded"
                                />
                              )}
                              {sel.colorPreview && (
                                <span 
                                  className="w-4 h-4 rounded border"
                                  style={{ backgroundColor: sel.colorPreview }}
                                />
                              )}
                              <span>{getName(sel)}</span>
                            </div>
                          ) : <SelectValue placeholder="Wybierz..." />;
                        })()}
                      </SelectTrigger>
                      <SelectContent>
                        {category.options?.map(option => (
                          <SelectItem key={option.id} value={option.id}>
                            <div className="flex items-center gap-2">
                              {option.imageUrl && (
                                <img 
                                  src={getImageUrl(option.imageUrl)} 
                                  alt={getName(option)}
                                  className="w-6 h-6 object-contain rounded"
                                />
                              )}
                              {option.colorPreview && (
                                <span 
                                  className="w-4 h-4 rounded border"
                                  style={{ backgroundColor: option.colorPreview }}
                                />
                              )}
                              <span>{getName(option)}</span>
                              {option.price > 0 && (
                                <span className="text-blue-600 ml-2">+{option.price} {currencySymbol}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  {/* Static hint display for selected option - prefer Polish */}
                  {(() => {
                    // Get selected option(s) hint
                    if (category.inputType === 'checkbox') {
                      const selectedOpts = category.options?.filter(
                        opt => selections[category.id]?.[opt.id]
                      );
                      if (selectedOpts?.length > 0) {
                        return selectedOpts.filter(opt => opt.hintPl || opt.hint).map(opt => (
                          <div key={opt.id} className="mt-2 p-2 bg-blue-50 rounded-lg border-l-2 border-blue-400">
                            <p className="text-xs font-medium text-blue-800">{getName(opt)}:</p>
                            <p className="text-xs text-blue-700">{opt.hintPl || opt.hint}</p>
                          </div>
                        ));
                      }
                    } else {
                      const selectedOpt = category.options?.find(
                        opt => opt.id === selections[category.id]
                      );
                      if (selectedOpt?.hintPl || selectedOpt?.hint) {
                        return (
                          <div className="mt-2 p-2 bg-blue-50 rounded-lg border-l-2 border-blue-400">
                            <p className="text-xs text-blue-700">{selectedOpt.hintPl || selectedOpt.hint}</p>
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Customer Data & Submit */}
        {selectedModel && (
          <Card className="border-2 border-blue-200">
            <CardHeader className="pb-3 bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Badge className="h-6 w-6 rounded-full flex items-center justify-center p-0 bg-blue-600">4</Badge>
                Twoje dane kontaktowe
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    Imię i nazwisko *
                  </Label>
                  <Input
                    id="name"
                    value={customerData.name}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Jan Kowalski"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    Numer telefonu *
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={customerData.phone}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+48 123 456 789"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="comment" className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  Komentarz (opcjonalnie)
                </Label>
                <Textarea
                  id="comment"
                  value={customerData.comment}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, comment: e.target.value }))}
                  placeholder="Dodatkowe informacje lub pytania..."
                  rows={3}
                />
              </div>

              <Separator />

              {/* Discount Section */}
              <div className="bg-purple-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Label htmlFor="discount" className="font-medium text-purple-800">
                    Rabat (%):
                  </Label>
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    max={maxManagerDiscount}
                    value={appliedDiscount}
                    onChange={(e) => handleDiscountChange(e.target.value)}
                    className="w-20 h-9"
                  />
                  <span className="text-sm text-purple-600">
                    (max {maxManagerDiscount}%)
                  </span>
                </div>
                
                {appliedDiscount > 0 && (
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between text-gray-600">
                      <span>Cena przed rabatem:</span>
                      <span>{subtotal.toLocaleString()} {currencySymbol}</span>
                    </div>
                    <div className="flex justify-between text-purple-700 font-medium">
                      <span>Rabat ({appliedDiscount}%):</span>
                      <span>-{discountAmount.toLocaleString()} {currencySymbol}</span>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Total & Submit */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2">
                <div className="text-center md:text-left">
                  <p className="text-sm text-gray-500">Suma{appliedDiscount > 0 ? ' po rabacie' : ''}:</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {total.toLocaleString()} {currencySymbol}
                  </p>
                </div>
                
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={submitting || !selectedModel || !customerData.name || !customerData.phone}
                  className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-lg px-8"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Wysyłanie...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5 mr-2" />
                      Wyślij zamówienie
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <DialogTitle className="text-center text-xl">
              Zamówienie zostało wysłane!
            </DialogTitle>
            <DialogDescription className="text-center">
              Dziękujemy za zainteresowanie. Skontaktujemy się z Tobą wkrótce, aby potwierdzić szczegóły zamówienia.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500">Numer zamówienia:</p>
            <p className="font-mono font-bold text-lg">{submittedOrderId}</p>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => setShowSuccessDialog(false)}
              className="w-full"
            >
              Zamknij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmbedBaliaCalculator;
