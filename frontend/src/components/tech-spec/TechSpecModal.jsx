import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import { FileText, Loader2, User, Phone, MessageSquare, Package } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const TechSpecModal = ({ open, onOpenChange, order, onSaved }) => {
  const { i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [masterCategories, setMasterCategories] = useState([]);
  const [formData, setFormData] = useState({
    comment: '',
    selections: {},
    textInputs: {},
  });

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/tech-spec/categories`);
        setCategories(response.data.categories || []);
        setMasterCategories(response.data.masterCategories || []);
      } catch (error) {
        console.error('Error fetching tech spec categories:', error);
      }
    };
    if (open) {
      fetchCategories();
    }
  }, [open]);

  // Initialize form with order data and existing tech spec
  useEffect(() => {
    if (order && open && categories.length > 0) {
      const existingTechSpec = order.techSpec || {};
      
      // Pre-fill selections from existing tech spec first
      const initialSelections = { ...existingTechSpec.selections };
      const initialTextInputs = { ...existingTechSpec.textInputs };
      
      // Try to map order selections to tech spec categories
      // Map from order.selections (categoryId -> optionId or categoryId -> {optionId: true})
      if (order.selections && Object.keys(order.selections).length > 0) {
        Object.entries(order.selections).forEach(([categoryId, value]) => {
          // Find matching tech spec category by name similarity
          const orderCategory = order.categories?.find(c => c.categoryId === categoryId);
          if (!orderCategory) return;
          
          // Try to find tech spec category with similar name
          const techCategory = categories.find(tc => {
            const tcName = tc.name.toLowerCase();
            const ocName = orderCategory.categoryName?.toLowerCase() || '';
            return tcName.includes(ocName) || ocName.includes(tcName) ||
                   tc.id === categoryId;
          });
          
          if (techCategory && !initialSelections[techCategory.id]) {
            // For checkbox type in order
            if (typeof value === 'object') {
              const selectedIds = Object.entries(value)
                .filter(([_, isSelected]) => isSelected)
                .map(([optId]) => {
                  const orderOpt = orderCategory.options?.find(o => o.id === optId);
                  const techOpt = techCategory.options?.find(to => 
                    to.name.toLowerCase().includes(orderOpt?.name?.toLowerCase() || '') ||
                    (orderOpt?.name?.toLowerCase() || '').includes(to.name.toLowerCase())
                  );
                  return techOpt?.id;
                })
                .filter(Boolean);
              
              if (selectedIds.length > 0) {
                initialSelections[techCategory.id] = techCategory.inputType === 'checkbox' 
                  ? selectedIds 
                  : selectedIds[0];
              }
            } else {
              // For radio type - value is optionId
              const orderOpt = orderCategory.options?.find(o => o.id === value);
              const techOpt = techCategory.options?.find(to => 
                to.name.toLowerCase().includes(orderOpt?.name?.toLowerCase() || '') ||
                (orderOpt?.name?.toLowerCase() || '').includes(to.name.toLowerCase())
              );
              if (techOpt) {
                initialSelections[techCategory.id] = techOpt.id;
              }
            }
          }
        });
      }
      
      // Also map from selectedOptions array if available
      if (order.selectedOptions && order.selectedOptions.length > 0) {
        order.selectedOptions.forEach(selOpt => {
          // Find matching tech spec category
          const techCategory = categories.find(tc => {
            const tcName = tc.name.toLowerCase();
            const optName = selOpt.categoryName?.toLowerCase() || '';
            return tcName.includes(optName) || optName.includes(tcName);
          });
          
          if (techCategory && !initialSelections[techCategory.id]) {
            // Find matching option
            const techOpt = techCategory.options?.find(to => {
              const toName = to.name.toLowerCase();
              const soName = selOpt.optionName?.toLowerCase() || '';
              return toName.includes(soName) || soName.includes(toName);
            });
            
            if (techOpt) {
              if (techCategory.inputType === 'checkbox') {
                const existing = initialSelections[techCategory.id] || [];
                if (!existing.includes(techOpt.id)) {
                  initialSelections[techCategory.id] = [...existing, techOpt.id];
                }
              } else {
                initialSelections[techCategory.id] = techOpt.id;
              }
            }
          }
        });
      }
      
      // Special mapping for common categories
      // Map heater/piece selection
      if (order.selections?.piece || order.selectedOptions?.some(o => o.categoryName?.toLowerCase().includes('piec'))) {
        const heaterCategory = categories.find(c => c.id === 'heater' || c.name.toLowerCase().includes('piec'));
        if (heaterCategory && !initialSelections[heaterCategory.id]) {
          const orderPiece = order.selections?.piece || 
            order.selectedOptions?.find(o => o.categoryName?.toLowerCase().includes('piec'))?.optionName;
          
          if (orderPiece) {
            const techOpt = heaterCategory.options?.find(o => 
              o.name.toLowerCase().includes(orderPiece.toLowerCase()) ||
              orderPiece.toLowerCase().includes(o.name.toLowerCase())
            );
            if (techOpt) {
              initialSelections[heaterCategory.id] = techOpt.id;
            }
          }
        }
      }
      
      setFormData({
        comment: existingTechSpec.comment || '',
        selections: initialSelections,
        textInputs: initialTextInputs,
      });
    }
  }, [order, open, categories]);

  const handleRadioChange = useCallback((categoryId, value) => {
    setFormData(prev => ({
      ...prev,
      selections: {
        ...prev.selections,
        [categoryId]: value,
      },
    }));
  }, []);

  const handleCheckboxChange = useCallback((categoryId, optionId, checked) => {
    setFormData(prev => {
      const current = prev.selections[categoryId] || [];
      const updated = checked
        ? [...current, optionId]
        : current.filter(id => id !== optionId);
      return {
        ...prev,
        selections: {
          ...prev.selections,
          [categoryId]: updated,
        },
      };
    });
  }, []);

  const handleTextChange = useCallback((categoryId, optionId, value) => {
    setFormData(prev => ({
      ...prev,
      textInputs: {
        ...prev.textInputs,
        [`${categoryId}_${optionId}`]: value,
      },
    }));
  }, []);

  const handleCommentChange = useCallback((e) => {
    setFormData(prev => ({ ...prev, comment: e.target.value }));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const techSpecData = {
        ...formData,
        createdAt: new Date().toISOString(),
        orderId: order.id,
      };

      await axios.put(`${API_URL}/api/sauna/orders/${order.id}/tech-spec`, techSpecData);
      toast.success('Техническое задание сохранено!');
      onSaved && onSaved(techSpecData);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving tech spec:', error);
      toast.error('Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setLoading(true);
    try {
      // First save the tech spec
      const techSpecData = {
        ...formData,
        createdAt: new Date().toISOString(),
        orderId: order.id,
      };

      await axios.put(`${API_URL}/api/sauna/orders/${order.id}/tech-spec`, techSpecData);

      // Then generate PDF
      const response = await axios.post(
        `${API_URL}/api/sauna/generate-tech-spec-pdf`,
        { order, techSpec: techSpecData },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TechSpec_${order.id}_${order.fullName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('PDF создан!');
      onSaved && onSaved(techSpecData);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Ошибка генерации PDF');
    } finally {
      setLoading(false);
    }
  };

  const renderCategory = (category) => {
    const { id, name, inputType, layout, options, hasImages } = category;

    return (
      <div key={id} className="border rounded-lg p-2 bg-white/50">
        <Label className="font-semibold text-amber-800 block mb-1 text-sm">{name}</Label>
        
        {inputType === 'radio' && (
          <RadioGroup
            value={formData.selections[id] || ''}
            onValueChange={(value) => handleRadioChange(id, value)}
            className={hasImages ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2' : (layout === 'row' ? 'flex flex-wrap gap-3' : 'space-y-2')}
          >
            {options.map((option) => (
              <div 
                key={option.id} 
                className={hasImages 
                  ? 'flex flex-col items-center p-2 border rounded-lg bg-white cursor-pointer hover:border-amber-500 transition-colors' 
                  : 'flex items-center gap-2'
                }
              >
                <RadioGroupItem value={option.id} id={`${id}-${option.id}`} className={hasImages ? 'sr-only' : ''} />
                {hasImages && option.imageUrl && (
                  <label htmlFor={`${id}-${option.id}`} className="cursor-pointer w-full">
                    <img 
                      src={option.imageUrl} 
                      alt={option.name} 
                      className={`w-full h-16 object-cover rounded mb-1 ${formData.selections[id] === option.id ? 'ring-2 ring-amber-500' : ''}`} 
                    />
                  </label>
                )}
                <Label htmlFor={`${id}-${option.id}`} className="cursor-pointer text-xs text-center">
                  {option.name}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {inputType === 'checkbox' && (
          <div className={layout === 'row' ? 'flex flex-wrap gap-4' : 'space-y-2'}>
            {options.map((option) => {
              const isChecked = (formData.selections[id] || []).includes(option.id) || option.required;
              return (
                <div key={option.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`${id}-${option.id}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => handleCheckboxChange(id, option.id, checked)}
                    disabled={option.required}
                  />
                  <Label htmlFor={`${id}-${option.id}`} className="cursor-pointer text-sm">
                    {option.name}
                  </Label>
                </div>
              );
            })}
          </div>
        )}

        {inputType === 'text' && (
          <div className={layout === 'row' ? 'flex flex-wrap gap-2' : 'space-y-1'}>
            {options.map((option) => (
              <div key={option.id} className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">{option.name}:</Label>
                <Input
                  value={formData.textInputs[`${id}_${option.id}`] || ''}
                  onChange={(e) => handleTextChange(id, option.id, e.target.value)}
                  placeholder={option.placeholder}
                  className="h-7 w-32 text-sm"
                />
              </div>
            ))}
          </div>
        )}

        {inputType === 'textarea' && (
          <Textarea
            value={formData.textInputs[`${id}_${options[0]?.id}`] || ''}
            onChange={(e) => handleTextChange(id, options[0]?.id, e.target.value)}
            placeholder={options[0]?.placeholder}
            rows={1}
            className="text-sm min-h-[32px]"
          />
        )}

        {inputType === 'mixed' && (
          <div className="space-y-2">
            {options.map((option) => (
              <div key={option.id} className="flex items-center gap-2">
                {option.inputType === 'radio' ? (
                  <>
                    <input
                      type="radio"
                      name={id}
                      value={option.id}
                      checked={formData.selections[id] === option.id}
                      onChange={() => handleRadioChange(id, option.id)}
                      className="h-4 w-4"
                    />
                    <Label className="text-sm">{option.name}</Label>
                  </>
                ) : (
                  <>
                    <Label className="text-sm w-40">{option.name}</Label>
                    <Input
                      value={formData.textInputs[`${id}_${option.id}`] || ''}
                      onChange={(e) => handleTextChange(id, option.id, e.target.value)}
                      placeholder={option.placeholder}
                      className="h-8 w-24"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-amber-800">
            <FileText className="h-5 w-5" />
            Techniczne zestawienie sauny
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <div className="space-y-4 pb-4">
            {/* Order Info Header */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Данные заказа #{order.id}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{order.fullName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{order.phoneNumber}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Модель:</span>{' '}
                  <span className="font-medium">{order.modelName}</span>
                </div>
              </div>
              
              {/* Show order selections */}
              {order.categories && order.categories.length > 0 && (
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <p className="text-xs text-muted-foreground mb-2">Выбранные опции из заказа:</p>
                  <div className="flex flex-wrap gap-2">
                    {order.categories.map((cat, idx) => (
                      <span key={idx} className="bg-white px-2 py-1 rounded text-xs border">
                        {cat.name}: {cat.selectedOption}
                        {cat.quantity && cat.quantity > 1 && ` (x${cat.quantity})`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Internal Comment */}
            <div className="border rounded-lg p-3 bg-white/50">
              <Label className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4" />
                Комментарий (внутренний)
              </Label>
              <Textarea
                value={formData.comment}
                onChange={handleCommentChange}
                placeholder="Особые требования, примечания для производства..."
                rows={3}
              />
            </div>

            {/* Technical Options - Grouped by Master Categories */}
            {masterCategories.map(master => {
              const masterCats = categories.filter(c => c.masterCategoryId === master.id);
              if (masterCats.length === 0) return null;
              
              return (
                <div key={master.id} className="space-y-2">
                  <h3 className="font-bold text-amber-700 text-sm border-b border-amber-200 pb-1">
                    {master.name}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {masterCats.map(category => (
                      <div 
                        key={category.id} 
                        className={category.displayWidth === 'full' ? 'md:col-span-2' : ''}
                      >
                        {renderCategory(category)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            
            {/* Categories without master */}
            {(() => {
              const unassignedCats = categories.filter(c => !c.masterCategoryId);
              if (unassignedCats.length === 0) return null;
              
              return (
                <div className="space-y-2">
                  <h3 className="font-bold text-amber-700 text-sm border-b border-amber-200 pb-1">
                    Прочее
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {unassignedCats.map(category => (
                      <div 
                        key={category.id} 
                        className={category.displayWidth === 'full' ? 'md:col-span-2' : ''}
                      >
                        {renderCategory(category)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <DialogFooter className="mt-4 flex gap-2 flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={loading} className="bg-amber-600 hover:bg-amber-700">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Сохранить
          </Button>
          <Button onClick={handleDownloadPDF} disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Создать PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
