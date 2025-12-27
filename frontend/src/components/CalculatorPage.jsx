import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomerInfoForm } from './CustomerInfoForm';
import { ConfigurationForm } from './ConfigurationForm';
import { FeaturesForm } from './FeaturesForm';
import { NotesSection } from './NotesSection';
import { OrderSummary } from './OrderSummary';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { FileDown, Save, RotateCcw, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const CalculatorPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState({
    shellModels: {},
    woodTypes: {},
    shellColors: {},
    lidTypes: {},
    woodColors: {},
    features: {},
  });
  
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    fullAddress: '',
    orderDate: new Date().toISOString().split('T')[0],
    shellModel: '',
    woodType: '',
    shellColor: '',
    lidType: '',
    woodColor: '',
    sandFilter: 'none',
    features: {},
    notes: '',
  });

  useEffect(() => {
    fetchPrices();
  }, []);

  const fetchPrices = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/prices`);
      setPrices(response.data);
    } catch (error) {
      console.error('Error fetching prices:', error);
      toast.error(t('error'));
    }
  };

  const calculateTotal = () => {
    let total = 0;

    // Add configuration prices
    if (formData.shellModel && prices.shellModels[formData.shellModel]) {
      total += prices.shellModels[formData.shellModel];
    }
    if (formData.woodType && prices.woodTypes[formData.woodType]) {
      total += prices.woodTypes[formData.woodType];
    }
    if (formData.shellColor && prices.shellColors[formData.shellColor]) {
      total += prices.shellColors[formData.shellColor];
    }
    if (formData.lidType && prices.lidTypes[formData.lidType]) {
      total += prices.lidTypes[formData.lidType];
    }
    if (formData.woodColor && prices.woodColors[formData.woodColor]) {
      total += prices.woodColors[formData.woodColor];
    }

    // Add sand filter price
    if (formData.sandFilter && formData.sandFilter !== 'none' && prices.features[formData.sandFilter]) {
      total += prices.features[formData.sandFilter];
    }

    // Add feature prices
    Object.entries(formData.features).forEach(([key, value]) => {
      if (value && prices.features[key]) {
        total += prices.features[key];
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

  const validateForm = () => {
    if (!formData.fullName || !formData.phoneNumber || !formData.fullAddress) {
      toast.error(t('fillRequired'));
      return false;
    }
    if (!formData.shellModel || !formData.woodType || !formData.shellColor || 
        !formData.lidType || !formData.woodColor) {
      toast.error(t('fillRequired'));
      return false;
    }
    return true;
  };

  const handleSaveOrder = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const orderData = {
        ...formData,
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
      const orderData = {
        ...formData,
        total: calculateTotal(),
        type: type,
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
    setFormData({
      fullName: '',
      phoneNumber: '',
      fullAddress: '',
      orderDate: new Date().toISOString().split('T')[0],
      shellModel: '',
      woodType: '',
      shellColor: '',
      lidType: '',
      woodColor: '',
      sandFilter: 'none',
      features: {},
      notes: '',
    });
    toast.success(t('formCleared'));
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <CustomerInfoForm formData={formData} onChange={handleInputChange} />
          <ConfigurationForm formData={formData} onChange={handleInputChange} prices={prices} />
          <FeaturesForm formData={formData} onChange={handleInputChange} prices={prices} />
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
          <OrderSummary formData={formData} prices={prices} total={calculateTotal()} />
        </div>
      </div>
    </div>
  );
};
