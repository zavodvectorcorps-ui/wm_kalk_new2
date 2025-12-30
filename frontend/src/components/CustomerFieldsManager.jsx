import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Plus, Pencil, Trash2, GripVertical, Save, User } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const FIELD_TYPES = [
  { value: 'text', label: 'Text', labelPl: 'Tekst', labelRu: 'Текст' },
  { value: 'phone', label: 'Phone', labelPl: 'Telefon', labelRu: 'Телефон' },
  { value: 'email', label: 'Email', labelPl: 'Email', labelRu: 'Email' },
  { value: 'textarea', label: 'Text Area', labelPl: 'Pole tekstowe', labelRu: 'Текстовое поле' },
  { value: 'date', label: 'Date', labelPl: 'Data', labelRu: 'Дата' },
];

export const CustomerFieldsManager = ({ calculatorType }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    nameRu: '',
    namePl: '',
    fieldType: 'text',
    placeholder: '',
    placeholderRu: '',
    placeholderPl: '',
    required: false,
    sortOrder: 0,
    active: true
  });

  useEffect(() => {
    fetchFields();
  }, [calculatorType]);

  const fetchFields = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/customer-fields/${calculatorType}`);
      setFields(response.data.fields || []);
    } catch (error) {
      console.error('Error fetching customer fields:', error);
      toast.error('Failed to load customer fields');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    try {
      await axios.post(`${API_URL}/api/customer-fields/${calculatorType}`, {
        calculatorType,
        fields
      });
      toast.success(lang === 'ru' ? 'Поля сохранены' : 'Pola zapisane');
    } catch (error) {
      console.error('Error saving fields:', error);
      toast.error(lang === 'ru' ? 'Ошибка сохранения' : 'Błąd zapisu');
    }
  };

  const openAddDialog = () => {
    setEditingField(null);
    setFormData({
      id: '',
      name: '',
      nameRu: '',
      namePl: '',
      fieldType: 'text',
      placeholder: '',
      placeholderRu: '',
      placeholderPl: '',
      required: false,
      sortOrder: fields.length + 1,
      active: true
    });
    setDialogOpen(true);
  };

  const openEditDialog = (field) => {
    setEditingField(field);
    setFormData({ ...field });
    setDialogOpen(true);
  };

  const handleSaveField = async () => {
    if (!formData.name || !formData.namePl || !formData.nameRu) {
      toast.error(lang === 'ru' ? 'Заполните все названия' : 'Wypełnij wszystkie nazwy');
      return;
    }

    try {
      if (editingField) {
        // Update existing field
        const updatedFields = fields.map(f => 
          f.id === editingField.id ? { ...formData, id: editingField.id } : f
        );
        setFields(updatedFields);
      } else {
        // Add new field
        const newField = {
          ...formData,
          id: formData.id || `field_${Date.now()}`
        };
        setFields([...fields, newField]);
      }
      
      setDialogOpen(false);
      toast.success(lang === 'ru' ? 'Поле сохранено' : 'Pole zapisane');
    } catch (error) {
      console.error('Error saving field:', error);
      toast.error(lang === 'ru' ? 'Ошибка' : 'Błąd');
    }
  };

  const handleDeleteField = (fieldId) => {
    if (window.confirm(lang === 'ru' ? 'Удалить поле?' : 'Usunąć pole?')) {
      setFields(fields.filter(f => f.id !== fieldId));
      toast.success(lang === 'ru' ? 'Поле удалено' : 'Pole usunięte');
    }
  };

  const toggleRequired = (fieldId) => {
    setFields(fields.map(f => 
      f.id === fieldId ? { ...f, required: !f.required } : f
    ));
  };

  const toggleActive = (fieldId) => {
    setFields(fields.map(f => 
      f.id === fieldId ? { ...f, active: !f.active } : f
    ));
  };

  const moveField = (index, direction) => {
    const newFields = [...fields];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= fields.length) return;
    
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    // Update sortOrder
    newFields.forEach((f, i) => f.sortOrder = i + 1);
    setFields(newFields);
  };

  const getFieldLabel = (field) => {
    if (lang === 'ru') return field.nameRu || field.name;
    if (lang === 'pl') return field.namePl || field.name;
    return field.name;
  };

  const getFieldTypeName = (type) => {
    const ft = FIELD_TYPES.find(t => t.value === type);
    if (!ft) return type;
    if (lang === 'ru') return ft.labelRu;
    if (lang === 'pl') return ft.labelPl;
    return ft.label;
  };

  if (loading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          {lang === 'ru' ? 'Поля данных клиента' : 'Pola danych klienta'}
        </CardTitle>
        <div className="flex gap-2">
          <Button onClick={openAddDialog} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {lang === 'ru' ? 'Добавить поле' : 'Dodaj pole'}
          </Button>
          <Button onClick={handleSaveAll} size="sm" variant="default">
            <Save className="h-4 w-4 mr-1" />
            {lang === 'ru' ? 'Сохранить всё' : 'Zapisz wszystko'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {fields.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            {lang === 'ru' ? 'Нет полей' : 'Brak pól'}
          </p>
        ) : (
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div 
                key={field.id} 
                className={`flex items-center gap-3 p-3 border rounded-lg ${!field.active ? 'opacity-50 bg-gray-50' : 'bg-white'}`}
              >
                <div className="flex flex-col gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-5 px-1"
                    onClick={() => moveField(index, -1)}
                    disabled={index === 0}
                  >
                    ↑
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-5 px-1"
                    onClick={() => moveField(index, 1)}
                    disabled={index === fields.length - 1}
                  >
                    ↓
                  </Button>
                </div>
                
                <div className="flex-1">
                  <div className="font-medium">{getFieldLabel(field)}</div>
                  <div className="text-xs text-muted-foreground">
                    {getFieldTypeName(field.fieldType)} • ID: {field.id}
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox 
                      checked={field.required} 
                      onCheckedChange={() => toggleRequired(field.id)}
                    />
                    {lang === 'ru' ? 'Обязат.' : 'Wymag.'}
                  </label>
                  
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox 
                      checked={field.active} 
                      onCheckedChange={() => toggleActive(field.id)}
                    />
                    {lang === 'ru' ? 'Активно' : 'Aktywne'}
                  </label>
                </div>
                
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(field)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteField(field.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingField 
                  ? (lang === 'ru' ? 'Редактировать поле' : 'Edytuj pole')
                  : (lang === 'ru' ? 'Добавить поле' : 'Dodaj pole')
                }
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ID</Label>
                  <Input 
                    value={formData.id}
                    onChange={(e) => setFormData({...formData, id: e.target.value.replace(/\s/g, '_')})}
                    placeholder="field_id"
                    disabled={!!editingField}
                  />
                </div>
                <div>
                  <Label>{lang === 'ru' ? 'Тип поля' : 'Typ pola'}</Label>
                  <Select 
                    value={formData.fieldType} 
                    onValueChange={(v) => setFormData({...formData, fieldType: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map(ft => (
                        <SelectItem key={ft.value} value={ft.value}>
                          {lang === 'ru' ? ft.labelRu : ft.labelPl}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Name (EN)</Label>
                  <Input 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Field name"
                  />
                </div>
                <div>
                  <Label>Nazwa (PL)</Label>
                  <Input 
                    value={formData.namePl}
                    onChange={(e) => setFormData({...formData, namePl: e.target.value})}
                    placeholder="Nazwa pola"
                  />
                </div>
                <div>
                  <Label>Название (RU)</Label>
                  <Input 
                    value={formData.nameRu}
                    onChange={(e) => setFormData({...formData, nameRu: e.target.value})}
                    placeholder="Название поля"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Placeholder (EN)</Label>
                  <Input 
                    value={formData.placeholder}
                    onChange={(e) => setFormData({...formData, placeholder: e.target.value})}
                    placeholder="Placeholder text"
                  />
                </div>
                <div>
                  <Label>Placeholder (PL)</Label>
                  <Input 
                    value={formData.placeholderPl}
                    onChange={(e) => setFormData({...formData, placeholderPl: e.target.value})}
                    placeholder="Tekst zastępczy"
                  />
                </div>
                <div>
                  <Label>Placeholder (RU)</Label>
                  <Input 
                    value={formData.placeholderRu}
                    onChange={(e) => setFormData({...formData, placeholderRu: e.target.value})}
                    placeholder="Текст подсказки"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <Checkbox 
                    checked={formData.required} 
                    onCheckedChange={(c) => setFormData({...formData, required: c})}
                  />
                  {lang === 'ru' ? 'Обязательное' : 'Wymagane'}
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox 
                    checked={formData.active} 
                    onCheckedChange={(c) => setFormData({...formData, active: c})}
                  />
                  {lang === 'ru' ? 'Активное' : 'Aktywne'}
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {lang === 'ru' ? 'Отмена' : 'Anuluj'}
                </Button>
                <Button onClick={handleSaveField}>
                  {lang === 'ru' ? 'Сохранить' : 'Zapisz'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default CustomerFieldsManager;
