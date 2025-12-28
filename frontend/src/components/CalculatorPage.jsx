import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomerInfoForm } from './CustomerInfoForm';
import { DynamicCategorySection } from './DynamicCategorySection';
import { NotesSection } from './NotesSection';
import { OrderSummary } from './OrderSummary';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { FileDown, Save, RotateCcw, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const CalculatorPage = () => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState({
    shellModels: {},
    woodTypes: {},
    shellColors: {},
    lidTypes: {},
    woodColors: {},
    features: {},
    displayTypes: {},
    categories: {},
    optionCategories: {},
    optionLabels: {},
  });
  
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    fullAddress: '',
    orderDate: new Date().toISOString().split('T')[0],
    // Dynamic selections will be stored here
    selections: {},
    notes: '',
  });

  useEffect(() => {
    fetchPrices();
  }, []);

  const fetchPrices = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/prices`);
      setPrices(response.data);
      
      // Initialize selections with empty values for each category
      const categories = response.data.categories || {};
      const initialSelections = {};
      Object.keys(categories).forEach(catId => {
        const category = categories[catId];
        if (category.displayType === 'checkbox') {
          initialSelections[catId] = {}; // Object for multiple checkboxes
        } else {
          initialSelections[catId] = ''; // Single value for dropdown
        }
      });
      
      setFormData(prev => ({
        ...prev,
        selections: initialSelections,
      }));
    } catch (error) {
      console.error('Error fetching prices:', error);
      toast.error(t('error'));
    }
  };

  const calculateTotal = () => {
    let total = 0;
    const categories = prices.categories || {};

    Object.keys(categories).forEach(categoryId => {
      const categoryOptions = prices[categoryId] || {};
      const selection = formData.selections[categoryId];
      
      if (typeof selection === 'object') {
        // Checkbox category - sum up all selected options
        Object.entries(selection).forEach(([key, isSelected]) => {
          if (isSelected && categoryOptions[key]) {
            total += categoryOptions[key];
          }
        });
      } else if (selection && categoryOptions[selection]) {
        // Dropdown category - add single selected option
        total += categoryOptions[selection];
      }
    });

    return total;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectionChange = (categoryId, value) => {
    setFormData((prev) => ({
      ...prev,
      selections: {
        ...prev.selections,
        [categoryId]: value,
      },
    }));
  };

  const handleCheckboxChange = (categoryId, optionKey, checked) => {
    setFormData((prev) => ({
      ...prev,
      selections: {
        ...prev.selections,
        [categoryId]: {
          ...(prev.selections[categoryId] || {}),
          [optionKey]: checked,
        },
      },
    }));
  };

  const validateForm = () => {
    if (!formData.fullName || !formData.phoneNumber || !formData.fullAddress) {
      toast.error(t('fillRequired'));
      return false;
    }
    
    // Check required categories
    const categories = prices.categories || {};
    for (const [categoryId, category] of Object.entries(categories)) {
      if (category.required) {
        const selection = formData.selections[categoryId];
        if (typeof selection === 'object') {
          // Checkbox - at least one must be selected
          const hasSelection = Object.values(selection).some(v => v);
          if (!hasSelection) {
            toast.error(`${category.name}: ${t('fillRequired')}`);
            return false;
          }
        } else if (!selection) {
          toast.error(`${category.name}: ${t('fillRequired')}`);
          return false;
        }
      }
    }
    
    return true;
  };

  // Convert selections to legacy format for backend compatibility
  const convertToLegacyFormat = () => {
    const categories = prices.categories || {};
    const result = {
      shellModel: '',
      woodType: '',
      shellColor: '',
      lidType: '',
      woodColor: '',
      sandFilter: 'none',
      features: {},
    };

    Object.entries(formData.selections).forEach(([categoryId, selection]) => {
      if (categoryId === 'shellModels') {
        result.shellModel = selection || '';
      } else if (categoryId === 'woodTypes') {
        result.woodType = selection || '';
      } else if (categoryId === 'shellColors') {
        result.shellColor = selection || '';
      } else if (categoryId === 'lidTypes') {
        result.lidType = selection || '';
      } else if (categoryId === 'woodColors') {
        result.woodColor = selection || '';
      } else if (categoryId === 'features') {
        // Features are checkboxes
        if (typeof selection === 'object') {
          // Handle sand filter separately
          const sandFilterOptions = ['sandFilterConnections', 'sandFilterUnderStairs', 'sandFilterBox'];
          Object.entries(selection).forEach(([key, isSelected]) => {
            if (sandFilterOptions.includes(key) && isSelected) {
              result.sandFilter = key;
            } else {
              result.features[key] = isSelected;
            }
          });
        }
      } else {
        // Custom category - add to features
        if (typeof selection === 'object') {
          Object.entries(selection).forEach(([key, isSelected]) => {
            result.features[key] = isSelected;
          });
        } else if (selection) {
          result.features[selection] = true;
        }
      }
    });

    return result;
  };

  const handleSaveOrder = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const legacyData = convertToLegacyFormat();
      const orderData = {
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        fullAddress: formData.fullAddress,
        orderDate: formData.orderDate,
        ...legacyData,
        notes: formData.notes,
        total: calculateTotal(),
        createdAt: new Date().toISOString(),
      };

      await axios.post(`${API_URL}/api/orders`, orderData);
      toast.success(t('orderSaved'));
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = async (type = 'customer') => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const legacyData = convertToLegacyFormat();
      const orderData = {
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        fullAddress: formData.fullAddress,
        orderDate: formData.orderDate,
        ...legacyData,
        notes: formData.notes,
        total: calculateTotal(),
        type: type,
        language: i18n.language,  // Send current language for PDF generation
      };

      const response = await axios.post(`${API_URL}/api/generate-pdf`, orderData, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `order_${formData.fullName}_${type}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(t('pdfGenerated'));
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleClearForm = () => {
    const categories = prices.categories || {};
    const initialSelections = {};
    Object.keys(categories).forEach(catId => {
      const category = categories[catId];
      if (category.displayType === 'checkbox') {
        initialSelections[catId] = {};
      } else {
        initialSelections[catId] = '';
      }
    });

    setFormData({
      fullName: '',
      phoneNumber: '',
      fullAddress: '',
      orderDate: new Date().toISOString().split('T')[0],
      selections: initialSelections,
      notes: '',
    });
    toast.success(t('formCleared'));
  };

  // Get sorted categories
  const getSortedCategories = () => {
    const categories = prices.categories || {};
    return Object.entries(categories)
      .map(([id, cat]) => ({ id, ...cat }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  const sortedCategories = getSortedCategories();

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <CustomerInfoForm formData={formData} onChange={handleInputChange} />
          
          {/* Dynamic Category Sections */}
          {sortedCategories.map((category) => (
            <DynamicCategorySection
              key={category.id}
              categoryId={category.id}
              category={category}
              options={prices[category.id] || {}}
              displayTypes={prices.displayTypes || {}}
              optionLabels={prices.optionLabels || {}}
              selection={formData.selections[category.id]}
              onSelectionChange={handleSelectionChange}
              onCheckboxChange={handleCheckboxChange}
            />
          ))}
          
          <NotesSection formData={formData} onChange={handleInputChange} />
          
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleSaveOrder}
              disabled={loading}
              size="lg"
              className="flex-1 min-w-[200px]"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Save className="h-5 w-5 mr-2" />
              )}
              {t('saveOrder')}
            </Button>
            
            <Button
              onClick={() => handleGeneratePDF('customer')}
              disabled={loading}
              variant="secondary"
              size="lg"
              className="flex-1 min-w-[200px]"
            >
              <FileDown className="h-5 w-5 mr-2" />
              {t('generatePDF')}
            </Button>
            
            <Button
              onClick={handleClearForm}
              disabled={loading}
              variant="outline"
              size="lg"
            >
              <RotateCcw className="h-5 w-5 mr-2" />
              {t('clearForm')}
            </Button>
          </div>
        </div>
        
        <div className="lg:col-span-1">
          <OrderSummary 
            formData={formData} 
            prices={prices} 
            total={calculateTotal()} 
            categories={prices.categories || {}}
          />
        </div>
      </div>
    </div>
  );
};
