import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { User, Phone, MapPin, Calendar, Mail, FileText } from 'lucide-react';
import { AddressAutocomplete } from './AddressAutocomplete';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Icons for different field types
const FIELD_ICONS = {
  text: User,
  phone: Phone,
  email: Mail,
  textarea: FileText,
  date: Calendar,
  address: MapPin,
};

export const DynamicCustomerForm = ({ 
  calculatorType, 
  formData, 
  setFormData, 
  onChange 
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFields();
  }, [calculatorType]);

  const fetchFields = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/customer-fields/${calculatorType}`);
      const activeFields = (response.data.fields || [])
        .filter(f => f.active)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      setFields(activeFields);
    } catch (error) {
      console.error('Error fetching customer fields:', error);
      // Fallback to default fields
      setFields([
        { id: 'fullName', name: 'Full Name', nameRu: 'ФИО', namePl: 'Imię i nazwisko', fieldType: 'text', required: true },
        { id: 'phoneNumber', name: 'Phone', nameRu: 'Телефон', namePl: 'Telefon', fieldType: 'phone', required: true },
        { id: 'fullAddress', name: 'Address', nameRu: 'Адрес', namePl: 'Adres', fieldType: 'textarea', required: false },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (onChange) {
      onChange(e);
    } else if (setFormData) {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAddressChange = (fieldId, address, details) => {
    if (setFormData) {
      setFormData(prev => ({ ...prev, [fieldId]: address }));
    } else if (onChange) {
      // Create synthetic event for compatibility
      onChange({ target: { name: fieldId, value: address } });
    }
  };

  const getFieldLabel = (field) => {
    if (lang === 'ru') return field.nameRu || field.name;
    if (lang === 'pl') return field.namePl || field.name;
    return field.name;
  };

  const getPlaceholder = (field) => {
    if (lang === 'ru') return field.placeholderRu || field.placeholder || '';
    if (lang === 'pl') return field.placeholderPl || field.placeholder || '';
    return field.placeholder || '';
  };

  const getIcon = (field) => {
    // Special handling for address field
    if (field.id.toLowerCase().includes('address')) {
      return MapPin;
    }
    return FIELD_ICONS[field.fieldType] || User;
  };

  const renderField = (field) => {
    const Icon = getIcon(field);
    const label = getFieldLabel(field);
    const placeholder = getPlaceholder(field);
    const value = formData[field.id] || '';

    if (field.fieldType === 'textarea') {
      return (
        <div key={field.id} className="space-y-2">
          <Label htmlFor={field.id} className="text-sm font-medium">
            {label} {field.required && <span className="text-destructive">*</span>}
          </Label>
          <div className="relative">
            <Icon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Textarea
              id={field.id}
              name={field.id}
              value={value}
              onChange={handleChange}
              className="pl-10 min-h-[80px]"
              placeholder={placeholder}
              required={field.required}
            />
          </div>
        </div>
      );
    }

    const inputType = field.fieldType === 'phone' ? 'tel' 
      : field.fieldType === 'email' ? 'email'
      : field.fieldType === 'date' ? 'date'
      : 'text';

    return (
      <div key={field.id} className="space-y-2">
        <Label htmlFor={field.id} className="text-sm font-medium">
          {label} {field.required && <span className="text-destructive">*</span>}
        </Label>
        <div className="relative">
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id={field.id}
            name={field.id}
            type={inputType}
            value={value}
            onChange={handleChange}
            className="pl-10"
            placeholder={placeholder}
            required={field.required}
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" />
            {t('customerInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5 text-primary" />
          {t('customerInfo')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map(field => renderField(field))}
        
        {fields.length === 0 && (
          <p className="text-center text-muted-foreground py-4">
            {lang === 'ru' ? 'Нет полей для заполнения' : 'Brak pól do wypełnienia'}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// Export legacy component for backward compatibility
export const CustomerInfoForm = ({ formData, setFormData, onChange }) => {
  return (
    <DynamicCustomerForm 
      calculatorType="sauna" 
      formData={formData} 
      setFormData={setFormData}
      onChange={onChange}
    />
  );
};

export default DynamicCustomerForm;
