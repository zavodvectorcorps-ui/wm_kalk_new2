import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { User, Phone, MapPin, Calendar } from 'lucide-react';

export const CustomerInfoForm = ({ formData, onChange }) => {
  const { t } = useTranslation();

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5 text-primary" />
          {t('customerInfo')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-sm font-medium">
            {t('fullName')} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={onChange}
              className="pl-10"
              placeholder={t('fullName')}
              required
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="phoneNumber" className="text-sm font-medium">
            {t('phoneNumber')} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              value={formData.phoneNumber}
              onChange={onChange}
              className="pl-10"
              placeholder="+48 123 456 789"
              required
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="fullAddress" className="text-sm font-medium">
            {t('fullAddress')} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="fullAddress"
              name="fullAddress"
              value={formData.fullAddress}
              onChange={onChange}
              className="pl-10"
              placeholder={t('fullAddress')}
              required
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="orderDate" className="text-sm font-medium">
            {t('orderDate')} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="orderDate"
              name="orderDate"
              type="date"
              value={formData.orderDate}
              onChange={onChange}
              className="pl-10"
              required
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
