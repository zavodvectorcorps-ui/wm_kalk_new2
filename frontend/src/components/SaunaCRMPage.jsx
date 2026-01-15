import React, { useState, useEffect, useCallback } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Plus, RefreshCw, Settings, User, Phone, Mail, MapPin, 
  ExternalLink, Calculator, GripVertical, Star, Trash2, Edit2,
  ChevronDown, Clock, FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Sortable Lead Card Component
const SortableLeadCard = ({ lead, settings, onEdit, onOpenCalculator, onStageChange, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const enabledFields = settings?.fields?.filter(f => f.enabled) || [];

  return (
    <div ref={setNodeRef} style={style} className="mb-2">
      <Card className={`border ${lead.isImportant ? 'border-amber-400 bg-amber-50' : 'border-gray-200'}`}>
        <CardContent className="p-3">
          {/* Drag handle and header */}
          <div className="flex items-start gap-2 mb-2">
            <div {...attributes} {...listeners} className="cursor-grab mt-1">
              <GripVertical className="h-4 w-4 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {lead.isImportant && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                <span className="font-medium text-sm truncate">{lead.clientName || 'Без имени'}</span>
              </div>
              {lead.phone && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {lead.phone}
                </div>
              )}
            </div>
            {lead.amocrm_link && (
              <a href={lead.amocrm_link} target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-purple-700">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>

          {/* Custom fields preview */}
          <div className="space-y-1 mb-2">
            {enabledFields.slice(0, 3).map(field => (
              lead[field.id] && (
                <div key={field.id} className="text-xs text-gray-600">
                  <span className="text-muted-foreground">{field.name}:</span> {lead[field.id]}
                </div>
              )
            ))}
          </div>

          {/* Stage selector */}
          <Select value={lead.stageId} onValueChange={(val) => onStageChange(lead.id, val)}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {settings?.stages?.map(stage => (
                <SelectItem key={stage.id} value={stage.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                    {stage.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Actions */}
          <div className="flex items-center gap-1 mt-2">
            <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => onEdit(lead)}>
              <Edit2 className="h-3 w-3 mr-1" />
              Изменить
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => onOpenCalculator(lead)}>
              <Calculator className="h-3 w-3 mr-1" />
              Калькулятор
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => onDelete(lead.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>

          {/* Timestamps */}
          {lead.updatedAt && (
            <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Обновлено: {new Date(lead.updatedAt).toLocaleDateString('ru-RU')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Stage Column Component
const StageColumn = ({ stage, leads, settings, onEdit, onOpenCalculator, onStageChange, onDelete }) => {
  return (
    <div className="flex-1 min-w-[300px] max-w-[350px]">
      <div 
        className="rounded-t-lg px-3 py-2 text-white font-medium flex items-center justify-between"
        style={{ backgroundColor: stage.color }}
      >
        <span>{stage.name}</span>
        <Badge variant="secondary" className="bg-white/20 text-white">
          {leads.length}
        </Badge>
      </div>
      <div className="bg-gray-50 rounded-b-lg p-2 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <SortableLeadCard 
              key={lead.id}
              lead={lead}
              settings={settings}
              onEdit={onEdit}
              onOpenCalculator={onOpenCalculator}
              onStageChange={onStageChange}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Нет заявок
          </div>
        )}
      </div>
    </div>
  );
};

// Lead Edit Dialog
const LeadEditDialog = ({ open, lead, settings, onClose, onSave }) => {
  const [formData, setFormData] = useState({});
  const enabledFields = settings?.fields?.filter(f => f.enabled) || [];

  useEffect(() => {
    if (lead) {
      setFormData({ ...lead });
    }
  }, [lead]);

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead?.id ? 'Редактировать заявку' : 'Новая заявка'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Basic fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Имя клиента</Label>
              <Input 
                value={formData.clientName || ''} 
                onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Телефон</Label>
              <Input 
                value={formData.phone || ''} 
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                value={formData.email || ''} 
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Этап</Label>
              <Select 
                value={formData.stageId || 'new'} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, stageId: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {settings?.stages?.map(stage => (
                    <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Адрес</Label>
            <Input 
              value={formData.address || ''} 
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            />
          </div>

          {/* Custom fields */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Дополнительные поля</h4>
            <div className="grid grid-cols-2 gap-4">
              {enabledFields.map(field => (
                <div key={field.id} className="space-y-2">
                  <Label className="text-sm">{field.name}</Label>
                  <Input 
                    value={formData[field.id] || ''} 
                    onChange={(e) => setFormData(prev => ({ ...prev, [field.id]: e.target.value }))}
                    placeholder={field.name}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Примечания</Label>
            <Textarea 
              value={formData.notes || ''} 
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Important flag */}
          <label className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={formData.isImportant || false}
              onChange={(e) => setFormData(prev => ({ ...prev, isImportant: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">Важная заявка</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Settings Dialog
const SettingsDialog = ({ open, settings, onClose, onSave }) => {
  const [formData, setFormData] = useState({ fields: [], stages: [] });
  const [activeTab, setActiveTab] = useState('fields');

  useEffect(() => {
    if (settings) {
      setFormData({
        fields: settings.fields || [],
        stages: settings.stages || []
      });
    }
  }, [settings]);

  const updateField = (index, key, value) => {
    const newFields = [...formData.fields];
    newFields[index] = { ...newFields[index], [key]: value };
    setFormData(prev => ({ ...prev, fields: newFields }));
  };

  const updateStage = (index, key, value) => {
    const newStages = [...formData.stages];
    newStages[index] = { ...newStages[index], [key]: value };
    setFormData(prev => ({ ...prev, stages: newStages }));
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Настройки CRM</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="fields">Поля (10)</TabsTrigger>
            <TabsTrigger value="stages">Этапы (3)</TabsTrigger>
          </TabsList>
          
          <TabsContent value="fields" className="space-y-3 max-h-[400px] overflow-y-auto">
            {formData.fields.map((field, idx) => (
              <div key={field.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={field.enabled}
                  onChange={(e) => updateField(idx, 'enabled', e.target.checked)}
                  className="rounded"
                />
                <Input 
                  value={field.name}
                  onChange={(e) => updateField(idx, 'name', e.target.value)}
                  placeholder="Название поля"
                  className="flex-1"
                />
                <Input 
                  value={field.amoFieldId}
                  onChange={(e) => updateField(idx, 'amoFieldId', e.target.value)}
                  placeholder="ID поля в amoCRM"
                  className="w-40"
                />
              </div>
            ))}
          </TabsContent>
          
          <TabsContent value="stages" className="space-y-3">
            {formData.stages.map((stage, idx) => (
              <div key={stage.id} className="p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={stage.color}
                    onChange={(e) => updateStage(idx, 'color', e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                  <Input 
                    value={stage.name}
                    onChange={(e) => updateStage(idx, 'name', e.target.value)}
                    placeholder="Название этапа"
                    className="flex-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input 
                    value={stage.amoStageId}
                    onChange={(e) => updateStage(idx, 'amoStageId', e.target.value)}
                    placeholder="ID этапа в amoCRM"
                  />
                  <Input 
                    value={stage.amoPipelineId}
                    onChange={(e) => updateStage(idx, 'amoPipelineId', e.target.value)}
                    placeholder="ID воронки в amoCRM"
                  />
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave}>Сохранить настройки</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Main CRM Component
const SaunaCRMPage = () => {
  const { user, canEdit } = useAuth();
  const [settings, setSettings] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/sauna-crm/leads`);
      const data = await response.json();
      setSettings(data.settings);
      setLeads(data.leads || []);
    } catch (error) {
      console.error('Error fetching CRM data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync from amoCRM
  const syncFromAmoCRM = async () => {
    try {
      setSyncing(true);
      const response = await fetch(`${API_URL}/api/sauna-crm/sync-from-amocrm`, { method: 'POST' });
      const data = await response.json();
      alert(`Импортировано: ${data.imported} заявок`);
      fetchData();
    } catch (error) {
      console.error('Sync error:', error);
      alert('Ошибка синхронизации');
    } finally {
      setSyncing(false);
    }
  };

  // Save settings
  const saveSettings = async (newSettings) => {
    try {
      await fetch(`${API_URL}/api/sauna-crm/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      fetchData();
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // Create/Update lead
  const saveLead = async (leadData) => {
    try {
      const isNew = !leadData.id;
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? `${API_URL}/api/sauna-crm/leads` : `${API_URL}/api/sauna-crm/leads/${leadData.id}`;
      
      if (isNew) {
        leadData.id = `CRM-${Date.now()}`;
        leadData.stageId = leadData.stageId || 'new';
      }
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData)
      });
      fetchData();
    } catch (error) {
      console.error('Error saving lead:', error);
    }
  };

  // Change stage
  const changeStage = async (leadId, stageId) => {
    try {
      await fetch(`${API_URL}/api/sauna-crm/leads/${leadId}/stage?stage_id=${stageId}`, {
        method: 'PUT'
      });
      fetchData();
    } catch (error) {
      console.error('Error changing stage:', error);
    }
  };

  // Delete lead
  const deleteLead = async (leadId) => {
    if (!window.confirm('Удалить заявку?')) return;
    try {
      await fetch(`${API_URL}/api/sauna-crm/leads/${leadId}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting lead:', error);
    }
  };

  // Open calculator with lead data
  const openCalculator = async (lead) => {
    try {
      const response = await fetch(`${API_URL}/api/sauna-crm/leads/${lead.id}/open-calculator`, {
        method: 'POST'
      });
      const data = await response.json();
      
      // Open calculator in new tab with query params
      const params = new URLSearchParams({
        crmLeadId: lead.id,
        prefill: JSON.stringify(data.calculatorData)
      });
      window.open(`/sauna?${params.toString()}`, '_blank');
    } catch (error) {
      console.error('Error opening calculator:', error);
    }
  };

  // Handle drag end
  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;
    
    // Find which stage the lead was dropped on
    const lead = leads.find(l => l.id === active.id);
    if (!lead) return;
    
    // Check if dropped on a different stage
    const targetLead = leads.find(l => l.id === over.id);
    if (targetLead && targetLead.stageId !== lead.stageId) {
      changeStage(lead.id, targetLead.stageId);
    }
  };

  // Group leads by stage
  const leadsByStage = {};
  settings?.stages?.forEach(stage => {
    leadsByStage[stage.id] = leads.filter(l => l.stageId === stage.id);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-amber-800">CRM Сауны</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={syncFromAmoCRM} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Синхронизация amoCRM
          </Button>
          <Button variant="outline" onClick={() => { setEditingLead({}); setEditDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Новая заявка
          </Button>
          {canEdit() && (
            <Button variant="outline" onClick={() => setSettingsDialogOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Настройки
            </Button>
          )}
        </div>
      </div>

      {/* Last sync time */}
      {settings?.lastSyncAt && (
        <p className="text-sm text-muted-foreground mb-4">
          Последняя синхронизация: {new Date(settings.lastSyncAt).toLocaleString('ru-RU')}
        </p>
      )}

      {/* Kanban Board */}
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveId(active.id)}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {settings?.stages?.map(stage => (
            <StageColumn 
              key={stage.id}
              stage={stage}
              leads={leadsByStage[stage.id] || []}
              settings={settings}
              onEdit={(lead) => { setEditingLead(lead); setEditDialogOpen(true); }}
              onOpenCalculator={openCalculator}
              onStageChange={changeStage}
              onDelete={deleteLead}
            />
          ))}
        </div>
      </DndContext>

      {/* Dialogs */}
      <LeadEditDialog 
        open={editDialogOpen}
        lead={editingLead}
        settings={settings}
        onClose={() => { setEditDialogOpen(false); setEditingLead(null); }}
        onSave={saveLead}
      />
      
      <SettingsDialog 
        open={settingsDialogOpen}
        settings={settings}
        onClose={() => setSettingsDialogOpen(false)}
        onSave={saveSettings}
      />
    </div>
  );
};

export default SaunaCRMPage;
