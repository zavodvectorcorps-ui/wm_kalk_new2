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
import { ScrollArea } from '../ui/scroll-area';
import { toast } from 'sonner';
import { FileText, Loader2, User, Phone, MessageSquare, Package } from 'lucide-react';
import { TECH_SPEC_CATEGORIES } from './techSpecData';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const TechSpecModal = ({ open, onOpenChange, order, onSaved }) => {
  const { i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    comment: '',
    selections: {},
    textInputs: {},
  });

  // Initialize form with order data and existing tech spec
  useEffect(() => {
    if (order && open) {
      const existingTechSpec = order.techSpec || {};
      
      // Pre-fill selections from order's categories/selections
      const initialSelections = { ...existingTechSpec.selections };
      const initialTextInputs = { ...existingTechSpec.textInputs };
      
      // Try to map order selections to tech spec categories
      if (order.selections) {
        // Map heater selection
        if (order.selections.piece) {
          const heaterOption = TECH_SPEC_CATEGORIES.find(c => c.id === 'heater')?.options
            ?.find(o => o.name.toLowerCase().includes(order.selections.piece.toLowerCase()));
          if (heaterOption) {
            initialSelections.heater = heaterOption.id;
          }
        }
      }
      
      setFormData({
        comment: existingTechSpec.comment || '',
        selections: initialSelections,
        textInputs: initialTextInputs,
      });
    }
  }, [order, open]);

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
      <div key={id} className="border rounded-lg p-3 bg-white/50">
        <Label className="font-semibold text-amber-800 block mb-2">{name}</Label>
        
        {inputType === 'radio' && (
          <RadioGroup
            value={formData.selections[id] || ''}
            onValueChange={(value) => handleRadioChange(id, value)}
            className={layout === 'row' ? 'flex flex-wrap gap-3' : 'space-y-2'}
          >
            {options.map((option) => (
              <div key={option.id} className={`flex items-center gap-2 ${hasImages ? 'flex-col p-2 border rounded-lg bg-white cursor-pointer hover:border-amber-500' : ''}`}>
                <RadioGroupItem value={option.id} id={`${id}-${option.id}`} />
                {hasImages && option.imageUrl && (
                  <img src={option.imageUrl} alt={option.name} className="w-24 h-16 object-cover rounded" />
                )}
                <Label htmlFor={`${id}-${option.id}`} className="cursor-pointer text-sm">
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
          <div className={layout === 'row' ? 'flex flex-wrap gap-3' : 'space-y-2'}>
            {options.map((option) => (
              <div key={option.id} className="flex-1 min-w-[150px]">
                <Label className="text-xs text-muted-foreground">{option.name}</Label>
                <Input
                  value={formData.textInputs[`${id}_${option.id}`] || ''}
                  onChange={(e) => handleTextChange(id, option.id, e.target.value)}
                  placeholder={option.placeholder}
                  className="h-8"
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
            rows={2}
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-800">
            <FileText className="h-5 w-5" />
            Techniczne zestawienie sauny
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
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

            {/* Technical Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {TECH_SPEC_CATEGORIES.map(renderCategory)}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4 flex gap-2">
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
