import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { 
  Loader2, Plus, Trash2, GripVertical, Save, RotateCcw, Edit, 
  Home, LayoutGrid, Flame, ArrowRight, Sofa, Package, Check, Gift, 
  Shield, Calendar, User, ChevronUp, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

// Available icons for steps
const AVAILABLE_ICONS = [
  { name: 'Home', icon: Home },
  { name: 'LayoutGrid', icon: LayoutGrid },
  { name: 'Flame', icon: Flame },
  { name: 'ArrowRight', icon: ArrowRight },
  { name: 'Sofa', icon: Sofa },
  { name: 'Package', icon: Package },
  { name: 'Check', icon: Check },
  { name: 'Gift', icon: Gift },
  { name: 'Shield', icon: Shield },
  { name: 'Calendar', icon: Calendar },
  { name: 'User', icon: User },
];

const ICON_MAP = {
  Home, LayoutGrid, Flame, ArrowRight, Sofa, Package, Check, Gift, Shield, Calendar, User
};

export const WizardStepsAdmin = ({ lang }) => {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newStep, setNewStep] = useState({
    id: '',
    name: '',
    nameRu: '',
    icon: 'Package',
    description: '',
    descriptionRu: '',
    categoryNames: [],
    isActive: true,
    isRequired: true
  });

  const API_URL = (() => {
    if (typeof window !== 'undefined') {
      const o = window.location.origin;
      if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o;
    }
    return process.env.REACT_APP_BACKEND_URL || '';
  })();

  // Load wizard steps
  useEffect(() => {
    loadSteps();
  }, []);

  const loadSteps = async () => {
    try {
      const response = await fetch(`${API_URL}/api/sauna/wizard-steps`);
      if (response.ok) {
        const data = await response.json();
        setSteps(data);
      }
    } catch (error) {
      console.error('Failed to load wizard steps:', error);
      toast.error(lang === 'ru' ? 'Ошибка загрузки шагов' : 'Błąd ładowania kroków');
    } finally {
      setLoading(false);
    }
  };

  // Save all steps
  const saveSteps = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/sauna/wizard-steps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(steps)
      });
      if (response.ok) {
        toast.success(lang === 'ru' ? 'Шаги сохранены' : 'Kroki zapisane');
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Failed to save wizard steps:', error);
      toast.error(lang === 'ru' ? 'Ошибка сохранения' : 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const resetToDefaults = async () => {
    if (!window.confirm(lang === 'ru' ? 'Сбросить к настройкам по умолчанию?' : 'Resetować do domyślnych?')) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/sauna/wizard-steps/reset`, {
        method: 'POST'
      });
      if (response.ok) {
        await loadSteps();
        toast.success(lang === 'ru' ? 'Сброшено к настройкам по умолчанию' : 'Zresetowano do domyślnych');
      }
    } catch (error) {
      console.error('Failed to reset wizard steps:', error);
      toast.error(lang === 'ru' ? 'Ошибка сброса' : 'Błąd resetu');
    } finally {
      setSaving(false);
    }
  };

  // Move step up/down
  const moveStep = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= steps.length) return;
    
    const newSteps = [...steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    // Update sortOrder
    newSteps.forEach((s, i) => s.sortOrder = i);
    setSteps(newSteps);
  };

  // Delete step
  const deleteStep = (index) => {
    if (!window.confirm(lang === 'ru' ? 'Удалить этот шаг?' : 'Usunąć ten krok?')) {
      return;
    }
    const newSteps = steps.filter((_, i) => i !== index);
    newSteps.forEach((s, i) => s.sortOrder = i);
    setSteps(newSteps);
  };

  // Add new step
  const addStep = () => {
    if (!newStep.id || !newStep.name) {
      toast.error(lang === 'ru' ? 'Заполните ID и название' : 'Wypełnij ID i nazwę');
      return;
    }
    
    // Check for duplicate ID
    if (steps.some(s => s.id === newStep.id)) {
      toast.error(lang === 'ru' ? 'Шаг с таким ID уже существует' : 'Krok z takim ID już istnieje');
      return;
    }
    
    const stepToAdd = {
      ...newStep,
      sortOrder: steps.length,
      categoryNames: newStep.categoryNames.filter(n => n.trim())
    };
    
    setSteps([...steps, stepToAdd]);
    setShowAddDialog(false);
    setNewStep({
      id: '',
      name: '',
      nameRu: '',
      icon: 'Package',
      description: '',
      descriptionRu: '',
      categoryNames: [],
      isActive: true,
      isRequired: true
    });
    toast.success(lang === 'ru' ? 'Шаг добавлен' : 'Krok dodany');
  };

  // Update step
  const updateStep = (index, updates) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    setSteps(newSteps);
  };

  // Save edited step
  const saveEditedStep = () => {
    if (!editingStep) return;
    
    const index = steps.findIndex(s => s.id === editingStep.id);
    if (index >= 0) {
      const newSteps = [...steps];
      newSteps[index] = {
        ...editingStep,
        categoryNames: (editingStep.categoryNames || []).filter(n => n.trim())
      };
      setSteps(newSteps);
    }
    setEditingStep(null);
    toast.success(lang === 'ru' ? 'Шаг обновлён' : 'Krok zaktualizowany');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            {lang === 'ru' ? 'Настройка шагов калькулятора NEW' : 'Konfiguracja kroków kalkulatora NEW'}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetToDefaults} disabled={saving}>
              <RotateCcw className="h-4 w-4 mr-1" />
              {lang === 'ru' ? 'Сбросить' : 'Resetuj'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {lang === 'ru' ? 'Добавить шаг' : 'Dodaj krok'}
            </Button>
            <Button size="sm" onClick={saveSteps} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {lang === 'ru' ? 'Сохранить' : 'Zapisz'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {lang === 'ru' 
              ? 'Настройте порядок шагов, их названия и привязку к категориям опций. Изменения вступят в силу после сохранения.'
              : 'Skonfiguruj kolejność kroków, ich nazwy i powiązanie z kategoriami opcji. Zmiany wejdą w życie po zapisaniu.'
            }
          </p>
          
          <div className="space-y-3">
            {steps.map((step, index) => {
              const IconComponent = ICON_MAP[step.icon] || Package;
              return (
                <div 
                  key={step.id}
                  className={`flex items-center gap-3 p-4 border rounded-lg ${
                    step.isActive ? 'bg-white' : 'bg-gray-50 opacity-60'
                  }`}
                >
                  {/* Drag handle / Order */}
                  <div className="flex flex-col items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0"
                      onClick={() => moveStep(index, -1)}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground font-mono">{index + 1}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0"
                      onClick={() => moveStep(index, 1)}
                      disabled={index === steps.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Icon */}
                  <div className={`p-2 rounded-lg ${step.isActive ? 'bg-amber-100' : 'bg-gray-200'}`}>
                    <IconComponent className="h-5 w-5 text-amber-700" />
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{step.name}</span>
                      {step.nameRu && <span className="text-muted-foreground">/ {step.nameRu}</span>}
                      <span className="text-xs text-muted-foreground font-mono">({step.id})</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {step.description || step.descriptionRu || '-'}
                    </div>
                    {step.categoryNames?.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {step.categoryNames.map((cat, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Flags */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={step.isActive}
                        onCheckedChange={(checked) => updateStep(index, { isActive: checked })}
                      />
                      <Label className="text-xs">{lang === 'ru' ? 'Активен' : 'Aktywny'}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={step.isRequired}
                        onCheckedChange={(checked) => updateStep(index, { isRequired: checked })}
                      />
                      <Label className="text-xs">{lang === 'ru' ? 'Обязательный' : 'Wymagany'}</Label>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setEditingStep({ ...step })}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => deleteStep(index)}
                      className="text-red-500 hover:text-red-700"
                      disabled={['model', 'variant'].includes(step.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add Step Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {lang === 'ru' ? 'Добавить новый шаг' : 'Dodaj nowy krok'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{lang === 'ru' ? 'ID (уникальный)' : 'ID (unikalny)'}</Label>
                <Input
                  value={newStep.id}
                  onChange={(e) => setNewStep({ ...newStep, id: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="e.g., doors"
                />
              </div>
              <div>
                <Label>{lang === 'ru' ? 'Иконка' : 'Ikona'}</Label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {AVAILABLE_ICONS.map(({ name, icon: Icon }) => (
                    <button
                      key={name}
                      type="button"
                      className={`p-2 rounded border ${newStep.icon === name ? 'bg-amber-100 border-amber-500' : 'hover:bg-gray-100'}`}
                      onClick={() => setNewStep({ ...newStep, icon: name })}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{lang === 'ru' ? 'Название (PL)' : 'Nazwa (PL)'}</Label>
                <Input
                  value={newStep.name}
                  onChange={(e) => setNewStep({ ...newStep, name: e.target.value })}
                  placeholder="Drzwi"
                />
              </div>
              <div>
                <Label>{lang === 'ru' ? 'Название (RU)' : 'Nazwa (RU)'}</Label>
                <Input
                  value={newStep.nameRu}
                  onChange={(e) => setNewStep({ ...newStep, nameRu: e.target.value })}
                  placeholder="Двери"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{lang === 'ru' ? 'Описание (PL)' : 'Opis (PL)'}</Label>
                <Input
                  value={newStep.description}
                  onChange={(e) => setNewStep({ ...newStep, description: e.target.value })}
                  placeholder="Wybierz drzwi"
                />
              </div>
              <div>
                <Label>{lang === 'ru' ? 'Описание (RU)' : 'Opis (RU)'}</Label>
                <Input
                  value={newStep.descriptionRu}
                  onChange={(e) => setNewStep({ ...newStep, descriptionRu: e.target.value })}
                  placeholder="Выберите двери"
                />
              </div>
            </div>
            
            <div>
              <Label>{lang === 'ru' ? 'Категории (для привязки к опциям)' : 'Kategorie (powiązanie z opcjami)'}</Label>
              <Textarea
                value={(newStep.categoryNames || []).join('\n')}
                onChange={(e) => setNewStep({ ...newStep, categoryNames: e.target.value.split('\n') })}
                placeholder="Drzwi&#10;drzwi"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {lang === 'ru' 
                  ? 'Одна категория на строку. Шаг покажет опции из категорий, названия которых содержат эти слова.'
                  : 'Jedna kategoria na linię. Krok pokaże opcje z kategorii, których nazwy zawierają te słowa.'
                }
              </p>
            </div>
            
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={newStep.isActive}
                  onCheckedChange={(checked) => setNewStep({ ...newStep, isActive: checked })}
                />
                <Label>{lang === 'ru' ? 'Активен' : 'Aktywny'}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={newStep.isRequired}
                  onCheckedChange={(checked) => setNewStep({ ...newStep, isRequired: checked })}
                />
                <Label>{lang === 'ru' ? 'Обязательный' : 'Wymagany'}</Label>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              {lang === 'ru' ? 'Отмена' : 'Anuluj'}
            </Button>
            <Button onClick={addStep}>
              <Plus className="h-4 w-4 mr-1" />
              {lang === 'ru' ? 'Добавить' : 'Dodaj'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Step Dialog */}
      <Dialog open={!!editingStep} onOpenChange={() => setEditingStep(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {lang === 'ru' ? 'Редактировать шаг' : 'Edytuj krok'}
            </DialogTitle>
          </DialogHeader>
          
          {editingStep && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>ID</Label>
                  <Input value={editingStep.id} disabled className="bg-gray-50" />
                </div>
                <div>
                  <Label>{lang === 'ru' ? 'Иконка' : 'Ikona'}</Label>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {AVAILABLE_ICONS.map(({ name, icon: Icon }) => (
                      <button
                        key={name}
                        type="button"
                        className={`p-2 rounded border ${editingStep.icon === name ? 'bg-amber-100 border-amber-500' : 'hover:bg-gray-100'}`}
                        onClick={() => setEditingStep({ ...editingStep, icon: name })}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{lang === 'ru' ? 'Название (PL)' : 'Nazwa (PL)'}</Label>
                  <Input
                    value={editingStep.name}
                    onChange={(e) => setEditingStep({ ...editingStep, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{lang === 'ru' ? 'Название (RU)' : 'Nazwa (RU)'}</Label>
                  <Input
                    value={editingStep.nameRu || ''}
                    onChange={(e) => setEditingStep({ ...editingStep, nameRu: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{lang === 'ru' ? 'Описание (PL)' : 'Opis (PL)'}</Label>
                  <Input
                    value={editingStep.description || ''}
                    onChange={(e) => setEditingStep({ ...editingStep, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{lang === 'ru' ? 'Описание (RU)' : 'Opis (RU)'}</Label>
                  <Input
                    value={editingStep.descriptionRu || ''}
                    onChange={(e) => setEditingStep({ ...editingStep, descriptionRu: e.target.value })}
                  />
                </div>
              </div>
              
              <div>
                <Label>{lang === 'ru' ? 'Категории' : 'Kategorie'}</Label>
                <Textarea
                  value={(editingStep.categoryNames || []).join('\n')}
                  onChange={(e) => setEditingStep({ ...editingStep, categoryNames: e.target.value.split('\n') })}
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStep(null)}>
              {lang === 'ru' ? 'Отмена' : 'Anuluj'}
            </Button>
            <Button onClick={saveEditedStep}>
              <Save className="h-4 w-4 mr-1" />
              {lang === 'ru' ? 'Сохранить' : 'Zapisz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
