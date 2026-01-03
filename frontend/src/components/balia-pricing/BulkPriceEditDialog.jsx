import React, { memo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DollarSign } from 'lucide-react';

export const BulkPriceEditDialog = memo(({ 
  open, 
  onClose, 
  onApply, 
  currencySymbol, 
  modelsCount, 
  lang 
}) => {
  const [changeType, setChangeType] = useState('percent');
  const [value, setValue] = useState(0);
  const [applyTo, setApplyTo] = useState('all');

  const handleApply = () => {
    if (value === 0) return;
    onApply({ changeType, value: parseFloat(value), applyTo });
  };

  const getPreviewText = () => {
    if (value === 0) return '';
    const sign = value > 0 ? '+' : '';
    if (changeType === 'percent') {
      return `${sign}${value}%`;
    }
    return `${sign}${value} ${currencySymbol}`;
  };

  const txt = {
    title: lang === 'ru' ? 'Массовое изменение цен' : 'Zmiana cen hurtowo',
    description: lang === 'ru' 
      ? `Применить изменение ко всем ${modelsCount} моделям` 
      : `Zastosuj zmianę do wszystkich ${modelsCount} modeli`,
    changeType: lang === 'ru' ? 'Тип изменения' : 'Typ zmiany',
    percent: lang === 'ru' ? 'Процент (%)' : 'Procent (%)',
    absolute: lang === 'ru' ? `Сумма (${currencySymbol})` : `Kwota (${currencySymbol})`,
    value: lang === 'ru' ? 'Значение' : 'Wartość',
    applyTo: lang === 'ru' ? 'Применить к' : 'Zastosuj do',
    all: lang === 'ru' ? 'Все варианты' : 'Wszystkie warianty',
    integrated: lang === 'ru' ? 'Только встроенная печь' : 'Tylko zintegrowany',
    external: lang === 'ru' ? 'Только внешняя печь' : 'Tylko zewnętrzny',
    preview: lang === 'ru' ? 'Предпросмотр' : 'Podgląd',
    example: lang === 'ru' ? 'Пример: 1000 → ' : 'Przykład: 1000 → ',
    cancel: lang === 'ru' ? 'Отмена' : 'Anuluj',
    apply: lang === 'ru' ? 'Применить' : 'Zastosuj',
    warning: lang === 'ru' 
      ? 'Изменения будут применены после нажатия "Сохранить всё"' 
      : 'Zmiany zostaną zastosowane po kliknięciu "Zapisz wszystko"',
  };

  const calculateExample = () => {
    const base = 1000;
    if (changeType === 'percent') {
      return Math.round(base * (1 + value / 100) * 100) / 100;
    }
    return base + parseFloat(value || 0);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-orange-500" />
            {txt.title}
          </DialogTitle>
          <DialogDescription>{txt.description}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Change Type */}
          <div className="space-y-2">
            <Label>{txt.changeType}</Label>
            <Select value={changeType} onValueChange={setChangeType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">{txt.percent}</SelectItem>
                <SelectItem value="absolute">{txt.absolute}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Value */}
          <div className="space-y-2">
            <Label>{txt.value}</Label>
            <div className="flex items-center gap-2">
              <Input 
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={changeType === 'percent' ? '10' : '100'}
                className="flex-1"
              />
              <span className="text-muted-foreground font-medium w-12">
                {changeType === 'percent' ? '%' : currencySymbol}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {lang === 'ru' ? 'Используйте отрицательные значения для уменьшения' : 'Użyj ujemnych wartości, aby zmniejszyć'}
            </p>
          </div>

          {/* Apply To */}
          <div className="space-y-2">
            <Label>{txt.applyTo}</Label>
            <Select value={applyTo} onValueChange={setApplyTo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{txt.all}</SelectItem>
                <SelectItem value="integrated">{txt.integrated}</SelectItem>
                <SelectItem value="external">{txt.external}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {value !== 0 && value !== '' && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-800">{txt.preview}</p>
              <p className="text-lg font-bold text-blue-600">
                {txt.example}{calculateExample()} {currencySymbol}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                ({getPreviewText()})
              </p>
            </div>
          )}

          {/* Warning */}
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs text-amber-700">
              {txt.warning}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{txt.cancel}</Button>
          <Button 
            onClick={handleApply} 
            disabled={value === 0 || value === ''}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {txt.apply}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

BulkPriceEditDialog.displayName = 'BulkPriceEditDialog';
