import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import { API_URL, getTranslation, getImageUrl, getInitialFormData } from './constants';

export const useSaunaCalculator = (editingOrder = null, onEditComplete, amocrmPrefill = null, onAmocrmPrefillUsed = null) => {
  const { t, i18n } = useTranslation();
  const { user, isAdmin } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [prices, setPrices] = useState({ models: [], categories: [] });
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  
  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editOrderId, setEditOrderId] = useState(null);
  const [adminGifts, setAdminGifts] = useState([]);
  const [adminDiscountApproved, setAdminDiscountApproved] = useState(false);
  
  // amoCRM integration
  const [amocrmData, setAmocrmData] = useState(null);
  
  // Manager requested discount
  const [requestedDiscount, setRequestedDiscount] = useState(0);
  const [requestedDiscountNote, setRequestedDiscountNote] = useState('');
  
  const isAdminUser = isAdmin && isAdmin();
  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = getTranslation(lang);
  
  const [formData, setFormData] = useState(getInitialFormData());

  // Handle amoCRM prefill data
  useEffect(() => {
    if (amocrmPrefill && !editingOrder) {
      setFormData(prev => ({
        ...prev,
        fullName: amocrmPrefill.fullName || prev.fullName,
        phoneNumber: amocrmPrefill.phoneNumber || prev.phoneNumber,
        fullAddress: amocrmPrefill.fullAddress || prev.fullAddress,
        email: amocrmPrefill.email || prev.email,
      }));
      
      setAmocrmData({
        amocrm_id: amocrmPrefill.amocrm_id,
        amocrm_link: amocrmPrefill.amocrm_link,
        amocrm_name: amocrmPrefill.amocrm_name || amocrmPrefill.fullName,
        crmLeadId: amocrmPrefill.crmLeadId, // From Sauna CRM
      });
      
      const sourceName = amocrmPrefill.fullName || amocrmPrefill.amocrm_name || 'CRM';
      toast.success(`Данные загружены: ${sourceName}`);
      
      // Notify parent that prefill was used
      if (onAmocrmPrefillUsed) {
        onAmocrmPrefillUsed();
      }
    }
  }, [amocrmPrefill, editingOrder, onAmocrmPrefillUsed]);

  // Fetch prices
  const fetchPrices = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sauna/prices`);
      setPrices(response.data);
      
      // Initialize selections for each category
      const initialSelections = {};
      (response.data.categories || []).forEach(cat => {
        initialSelections[cat.id] = cat.inputType === 'checkbox' ? {} : '';
      });
      
      setFormData(prev => ({ ...prev, selections: initialSelections }));
    } catch (error) {
      console.error('Error fetching sauna prices:', error);
      toast.error(t('error'));
    } finally {
      setInitialLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Load order data when editing
  useEffect(() => {
    if (editingOrder && prices.categories?.length > 0) {
      setIsEditMode(true);
      setEditOrderId(editingOrder.id);
      
      setFormData(prev => ({
        ...prev,
        fullName: editingOrder.fullName || '',
        email: editingOrder.email || '',
        phoneNumber: editingOrder.phoneNumber || '',
        fullAddress: editingOrder.fullAddress || '',
        orderDate: editingOrder.orderDate || new Date().toISOString().split('T')[0],
        selectedModel: editingOrder.selectedModel || '',
        notes: editingOrder.notes || '',
        selections: editingOrder.selections || prev.selections,
        quantities: editingOrder.quantities || {},
      }));
      
      setRequestedDiscount(editingOrder.requestedDiscount || 0);
      setRequestedDiscountNote(editingOrder.requestedDiscountNote || '');
      
      // Rebuild selections if needed
      if ((!editingOrder.selections || Object.keys(editingOrder.selections).length === 0) && editingOrder.selectedOptions?.length > 0) {
        const rebuiltSelections = {};
        const rebuiltQuantities = {};
        
        prices.categories.forEach(cat => {
          rebuiltSelections[cat.id] = cat.inputType === 'checkbox' ? {} : '';
        });
        
        editingOrder.selectedOptions.forEach(opt => {
          const category = prices.categories.find(c => c.id === opt.categoryId);
          if (category) {
            const optionId = opt.optionId || opt.id;
            if (category.inputType === 'checkbox') {
              rebuiltSelections[opt.categoryId] = {
                ...(rebuiltSelections[opt.categoryId] || {}),
                [optionId]: true
              };
            } else {
              rebuiltSelections[opt.categoryId] = optionId;
            }
            if (opt.quantity && opt.quantity > 1) {
              rebuiltQuantities[optionId] = opt.quantity;
            }
          }
        });
        
        setFormData(prev => ({ ...prev, selections: rebuiltSelections, quantities: rebuiltQuantities }));
      }
      
      setAppliedDiscount(editingOrder.discountPercent || 0);
      setAdminGifts(editingOrder.adminGifts || []);
      setAdminDiscountApproved(editingOrder.adminDiscountApproved || false);
      
      toast.info(`${txt.editingOrder}: ${editingOrder.id}`);
    }
  }, [editingOrder, prices.categories, txt.editingOrder]);

  // Get selected model
  const getSelectedModel = useCallback(() => {
    return prices.models?.find(m => m.id === formData.selectedModel);
  }, [prices.models, formData.selectedModel]);

  // Calculate options total
  const calculateOptionsTotal = useCallback(() => {
    let total = 0;
    const categories = prices.categories || [];
    
    categories.forEach(category => {
      const selection = formData.selections[category.id];
      if (!selection) return;
      
      if (category.inputType === 'checkbox') {
        Object.entries(selection).forEach(([optId, isSelected]) => {
          if (isSelected) {
            const option = category.options?.find(o => o.id === optId);
            if (option) {
              const quantity = option.hasQuantity ? (formData.quantities[optId] || 1) : 1;
              total += option.price * quantity;
            }
          }
        });
      } else {
        const option = category.options?.find(o => o.id === selection);
        if (option) {
          const quantity = option.hasQuantity ? (formData.quantities[selection] || 1) : 1;
          total += option.price * quantity;
        }
      }
    });
    
    return total;
  }, [prices.categories, formData.selections, formData.quantities]);

  // Calculate foundation price
  const calculateFoundationPrice = useCallback(() => {
    const model = getSelectedModel();
    if (!model) return 0;
    
    const foundationCat = prices.categories?.find(c => c.id === 'fundament');
    if (foundationCat) {
      const selection = formData.selections[foundationCat.id];
      if (selection && selection.includes('dodaj')) {
        return model.foundationPrice || 0;
      }
    }
    return 0;
  }, [getSelectedModel, prices.categories, formData.selections]);

  // Calculate subtotal
  const calculateSubtotal = useCallback(() => {
    const model = getSelectedModel();
    if (!model) return 0;
    return (model.basePrice || 0) + calculateOptionsTotal() + calculateFoundationPrice();
  }, [getSelectedModel, calculateOptionsTotal, calculateFoundationPrice]);

  // Calculate total
  const calculateTotal = useCallback(() => {
    const subtotal = calculateSubtotal();
    const discountAmount = subtotal * (appliedDiscount / 100);
    return subtotal - discountAmount;
  }, [calculateSubtotal, appliedDiscount]);

  // Input handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDiscountChange = (e) => {
    const maxDiscount = isAdminUser ? 100 : 10;
    const value = Math.max(0, Math.min(maxDiscount, parseFloat(e.target.value) || 0));
    setAppliedDiscount(value);
  };

  const handleModelChange = (modelId) => {
    setFormData(prev => ({ ...prev, selectedModel: modelId }));
    setAppliedDiscount(0);
  };

  const handleApplyStandardDiscount = () => {
    const model = getSelectedModel();
    if (!model) {
      toast.error(txt.selectModelFirst);
      return;
    }
    
    const maxDiscount = isAdminUser ? 100 : 10;
    const modelDiscount = Math.min(model.discount || 0, maxDiscount);
    if (modelDiscount > 0) {
      setAppliedDiscount(modelDiscount);
      toast.success(`${txt.discountApplied}: ${modelDiscount}%`);
    } else {
      toast.error(txt.noDiscountForModel);
    }
  };

  const handleRadioChange = (categoryId, optionId) => {
    setFormData(prev => ({
      ...prev,
      selections: { ...prev.selections, [categoryId]: optionId },
    }));
  };

  const handleCheckboxChange = (categoryId, optionId, checked) => {
    setFormData(prev => ({
      ...prev,
      selections: {
        ...prev.selections,
        [categoryId]: { ...(prev.selections[categoryId] || {}), [optionId]: checked },
      },
    }));
  };

  const handleQuantityChange = (optionId, quantity) => {
    const qty = Math.max(1, parseInt(quantity) || 1);
    setFormData(prev => ({
      ...prev,
      quantities: { ...prev.quantities, [optionId]: qty },
    }));
  };

  // Toggle gift
  const toggleGift = (optionId) => {
    setAdminGifts(prev => 
      prev.includes(optionId) ? prev.filter(id => id !== optionId) : [...prev, optionId]
    );
  };

  // Validate form
  const validateForm = () => {
    if (!formData.fullName || !formData.phoneNumber) {
      toast.error(txt.fillRequired);
      return false;
    }
    if (!formData.selectedModel) {
      toast.error(txt.selectModelFirst);
      return false;
    }
    return true;
  };

  // Get selected options for PDF
  const getSelectedOptions = useCallback(() => {
    const options = [];
    const categories = prices.categories || [];
    
    categories.forEach(category => {
      const selection = formData.selections[category.id];
      if (!selection) return;
      
      if (category.inputType === 'checkbox') {
        Object.entries(selection).forEach(([optId, isSelected]) => {
          if (isSelected) {
            const option = category.options?.find(o => o.id === optId);
            if (option) {
              const quantity = option.hasQuantity ? (formData.quantities[optId] || 1) : 1;
              options.push({
                categoryId: category.id,
                categoryName: category.name,
                optionId: option.id,
                optionName: option.name,
                price: option.price,
                quantity,
                totalPrice: option.price * quantity,
                imageUrl: option.imageUrl || null,
                techSpecId: option.techSpecId || null,
                techSpecCategoryId: option.techSpecCategoryId || category.techSpecCategoryId || null,
              });
            }
          }
        });
      } else {
        const option = category.options?.find(o => o.id === selection);
        if (option) {
          const quantity = option.hasQuantity ? (formData.quantities[selection] || 1) : 1;
          options.push({
            categoryId: category.id,
            categoryName: category.name,
            optionId: option.id,
            optionName: option.name,
            price: option.price,
            quantity,
            totalPrice: option.price * quantity,
            imageUrl: option.imageUrl || null,
            techSpecId: option.techSpecId || null,
            techSpecCategoryId: option.techSpecCategoryId || category.techSpecCategoryId || null,
          });
        }
      }
    });
    
    return options;
  }, [prices.categories, formData.selections, formData.quantities]);

  // Save and generate PDF
  const handleSaveAndGeneratePDF = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const model = getSelectedModel();
      const subtotal = calculateSubtotal();
      const selectedOptions = getSelectedOptions();
      
      // Calculate total considering admin gifts
      const giftsTotal = selectedOptions
        .filter(opt => adminGifts.includes(opt.optionId) || adminGifts.includes(opt.id))
        .reduce((sum, opt) => sum + (opt.totalPrice || opt.price || 0), 0);
      const discountableAmount = subtotal - giftsTotal;
      const discountAmount = discountableAmount * (appliedDiscount / 100);
      const total = discountableAmount - discountAmount;
      
      const orderId = isEditMode && editOrderId ? editOrderId : undefined;
      
      const orderData = {
        ...(orderId && { id: orderId }),
        fullName: formData.fullName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        fullAddress: formData.fullAddress || '',
        orderDate: formData.orderDate,
        selectedModel: formData.selectedModel,
        modelName: model?.name || '',
        modelImageUrl: getImageUrl(model?.imageUrl) || '',
        basePrice: model?.basePrice || 0,
        foundationPrice: calculateFoundationPrice(),
        discountPercent: appliedDiscount,
        selections: formData.selections,
        quantities: formData.quantities || {},
        selectedOptions,
        notes: formData.notes || '',
        optionsTotal: calculateOptionsTotal(),
        subtotal,
        total,
        createdBy: user?.username || '',
        adminGifts,
        adminDiscountApproved: appliedDiscount > 10 && isAdminUser ? adminDiscountApproved : false,
        adminDiscountApprovedBy: appliedDiscount > 10 && adminDiscountApproved ? user?.username : '',
        adminDiscountApprovedAt: appliedDiscount > 10 && adminDiscountApproved ? new Date().toISOString() : '',
        requestedDiscount: !isAdminUser ? requestedDiscount : 0,
        requestedDiscountNote: !isAdminUser ? requestedDiscountNote : '',
        // amoCRM integration fields - use 'calculator_amocrm' to distinguish from webhook imports
        ...(amocrmData && {
          amocrm_id: amocrmData.amocrm_id,
          amocrm_link: amocrmData.amocrm_link,
          amocrm_name: amocrmData.amocrm_name,
          source: 'calculator_amocrm',  // Different from 'amocrm' which is used for webhook imports
        }),
      };

      let finalOrderId;
      
      if (isEditMode && editOrderId) {
        await axios.put(`${API_URL}/api/sauna/orders/${editOrderId}`, orderData);
        finalOrderId = editOrderId;
        toast.success(txt.orderUpdated);
      } else {
        const orderResponse = await axios.post(`${API_URL}/api/sauna/orders`, orderData);
        finalOrderId = orderResponse.data?.id || '';
        toast.success(txt.orderSaved);
        
        // Mark quote as created in amoCRM
        if (amocrmData?.amocrm_id && finalOrderId) {
          try {
            await axios.post(`${API_URL}/api/integrations/amocrm/mark-quote-created?amocrm_id=${amocrmData.amocrm_id}&order_id=${finalOrderId}&calculator_type=sauna`);
          } catch (e) {
            console.error('Failed to mark quote in amoCRM:', e);
          }
        }
      }

      // Generate PDF
      const pdfData = { ...orderData, orderId: finalOrderId, language: 'pl', categories: prices.categories };
      const response = await axios.post(`${API_URL}/api/sauna/generate-pdf`, pdfData, { responseType: 'blob' });

      const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      
      let safeName = (formData.fullName || 'Klient').replace(/\s+/g, '_').replace(/[<>:"/\\|?*]/g, '');
      if (!safeName || safeName === '_') safeName = 'Klient';
      link.setAttribute('download', `SAUNA_${safeName}_${finalOrderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(txt.pdfGenerated);

      // Upload PDF to amoCRM if this order came from amoCRM
      if (amocrmData?.amocrm_id && finalOrderId) {
        try {
          // Get employee name from current user
          const employeeName = user?.username || user?.name || '';
          const totalAmount = total?.toFixed(2) || '';
          
          const uploadResponse = await fetch(
            `${API_URL}/api/integrations/amocrm/upload-calculator-pdf?amocrm_id=${amocrmData.amocrm_id}&order_id=${finalOrderId}&calculator_type=sauna&client_name=${encodeURIComponent(formData.fullName || '')}&employee_name=${encodeURIComponent(employeeName)}&total_amount=${encodeURIComponent(totalAmount)}`,
            {
              method: 'POST',
              body: pdfBlob,
              headers: {
                'Content-Type': 'application/pdf'
              }
            }
          );
          const uploadResult = await uploadResponse.json();
          if (uploadResult.pdf_uploaded) {
            toast.success('PDF загружен в amoCRM');
          }
        } catch (e) {
          console.error('Failed to upload PDF to amoCRM:', e);
        }
      }

      // Save calculator data back to CRM lead if opened from Sauna CRM
      if (amocrmData?.crmLeadId && finalOrderId) {
        try {
          await axios.put(`${API_URL}/api/sauna-crm/leads/${amocrmData.crmLeadId}/calculator-data`, {
            calculatorData: {
              orderId: finalOrderId,
              selectedModel: formData.selectedModel,
              total: total,
              createdAt: new Date().toISOString()
            },
            pdfUrl: null // PDF is stored in amoCRM, not as URL
          });
        } catch (e) {
          console.error('Failed to save calculator data to CRM lead:', e);
        }
      }

      if (isEditMode) {
        setIsEditMode(false);
        setEditOrderId(null);
        setAdminGifts([]);
        setAdminDiscountApproved(false);
        onEditComplete?.();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  // Clear form
  const handleClearForm = () => {
    const initialSelections = {};
    (prices.categories || []).forEach(cat => {
      initialSelections[cat.id] = cat.inputType === 'checkbox' ? {} : '';
    });

    setFormData({ ...getInitialFormData(), selections: initialSelections });
    setAppliedDiscount(0);
    setAdminGifts([]);
    setAdminDiscountApproved(false);
    setRequestedDiscount(0);
    setRequestedDiscountNote('');
    toast.success(txt.formCleared);
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditOrderId(null);
    setAdminGifts([]);
    setAdminDiscountApproved(false);
    handleClearForm();
    onEditComplete?.();
  };

  // Get category name with translation
  const getCategoryName = (category) => txt[category.name] || category.name;

  // Computed values
  const model = getSelectedModel();
  const optionsTotal = calculateOptionsTotal();
  const foundationPrice = calculateFoundationPrice();
  const subtotal = calculateSubtotal();
  const discountAmount = subtotal * (appliedDiscount / 100);
  const total = calculateTotal();

  return {
    // State
    loading,
    initialLoading,
    prices,
    formData,
    appliedDiscount,
    isEditMode,
    editOrderId,
    adminGifts,
    adminDiscountApproved,
    requestedDiscount,
    requestedDiscountNote,
    isAdminUser,
    lang,
    txt,
    amocrmData,
    
    // Computed
    model,
    optionsTotal,
    foundationPrice,
    subtotal,
    discountAmount,
    total,
    
    // Setters
    setFormData,
    setAppliedDiscount,
    setAdminDiscountApproved,
    setRequestedDiscount,
    setRequestedDiscountNote,
    
    // Handlers
    handleInputChange,
    handleDiscountChange,
    handleModelChange,
    handleApplyStandardDiscount,
    handleRadioChange,
    handleCheckboxChange,
    handleQuantityChange,
    toggleGift,
    handleSaveAndGeneratePDF,
    handleClearForm,
    handleCancelEdit,
    getCategoryName,
    getSelectedOptions,
  };
};

export default useSaunaCalculator;
