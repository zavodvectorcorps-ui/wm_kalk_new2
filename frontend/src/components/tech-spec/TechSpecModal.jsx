import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { TECH_SPEC_CATEGORIES, TECH_SPEC_SECTIONS } from './techSpecData';
import { Loader2, Save, Info, Flame, Sofa, Zap, Image as ImageIcon, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/api';
import axios from 'axios';

const API_URL = getApiUrl();

const sectionIcons = {
  info: Info,
  flame: Flame,
  sofa: Sofa,
  zap: Zap,
};

export const TechSpecModal = ({ open, onOpenChange, order, onSaved, leadId }) => {
  const [formData, setFormData] = useState({ selections: {}, textInputs: {}, conditionalData: {} });
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [layoutImage, setLayoutImage] = useState(null);
  const [layoutLoading, setLayoutLoading] = useState(false);

  // Fetch layout
  const fetchLayout = useCallback(async () => {
    if (!order) return;
    setLayoutLoading(true);
    try {
      if (order.layoutImageUrl) { setLayoutImage(order.layoutImageUrl); return; }
      if (order.selectedLayoutId) {
        const [faqRes, confRes] = await Promise.allSettled([
          axios.get(`${API_URL}/api/faq/layout-variants`),
          axios.get(`${API_URL}/api/layout-configurator/published-layouts`)
        ]);
        const faqVariants = faqRes.status === 'fulfilled' ? (faqRes.value.data || []) : [];
        const confLayouts = confRes.status === 'fulfilled' ? (confRes.value.data || []) : [];
        let found = faqVariants.find(v => v._id === order.selectedLayoutId || v.id === order.selectedLayoutId);
        if (found?.imageUrl) { setLayoutImage(found.imageUrl); return; }
        found = confLayouts.find(l => l.id === order.selectedLayoutId);
        if (found?.imageUrl) { setLayoutImage(found.imageUrl); return; }
      }
      const modelId = order.modelId || order.selectedModelId || order.selectedModel;
      const variantId = order.selectedVariantId || order.selectedModelVariant;
      if (modelId) {
        try {
          const r = await axios.get(`${API_URL}/api/layout-configurator/layouts`, { params: { modelId, variantId, published: true } });
          const layouts = r.data?.layouts || [];
          if (layouts[0]?.imageUrl) { setLayoutImage(layouts[0].imageUrl); return; }
        } catch {}
      }
      setLayoutImage(null);
    } catch { setLayoutImage(null); }
    finally { setLayoutLoading(false); }
  }, [order]);

  useEffect(() => { if (open && order) fetchLayout(); }, [open, order, fetchLayout]);

  // Initialize form
  useEffect(() => {
    if (!order || !open) return;
    const ts = order.techSpec || {};
    const sel = { ...ts.selections };
    const txt = { ...ts.textInputs };
    const cond = { ...ts.conditionalData };

    // Apply default values for categories that have them
    TECH_SPEC_CATEGORIES.forEach(cat => {
      if (cat.defaultValue && !sel[cat.id]) {
        sel[cat.id] = cat.defaultValue;
      }
    });

    // Auto-fill from calculator selectedOptions
    if (order.selectedOptions?.length > 0) {
      const optsByCat = {};
      order.selectedOptions.forEach(o => {
        if (o.categoryId) {
          if (!optsByCat[o.categoryId]) optsByCat[o.categoryId] = [];
          optsByCat[o.categoryId].push(o);
        }
      });

      TECH_SPEC_CATEGORIES.forEach(cat => {
        if (!cat.calcCategoryMapping) return;
        const calcOpts = optsByCat[cat.calcCategoryMapping];
        if (!calcOpts?.length) return;

        if (cat.inputType === 'text') {
          const names = calcOpts.map(o => o.optionName || o.name).filter(Boolean).join(', ');
          if (names && cat.options[0]) txt[`${cat.id}_${cat.options[0].id}`] = txt[`${cat.id}_${cat.options[0].id}`] || names;
        } else if (cat.inputType === 'calc_transfer') {
          // benches - handled separately in render
        } else {
          // Try name matching for radio/checkbox
          calcOpts.forEach(co => {
            const name = co.optionName || co.name || '';
            const match = cat.options.find(to => {
              const a = to.name.toLowerCase(), b = name.toLowerCase();
              return a === b || a.includes(b) || b.includes(a);
            });
            if (match && !sel[cat.id]) sel[cat.id] = match.id;
          });
        }

        // Also check direct techSpec mapping on options
        calcOpts.forEach(co => {
          if (co.techSpecCategoryId && co.techSpecId) {
            const tc = TECH_SPEC_CATEGORIES.find(c => c.id === co.techSpecCategoryId);
            if (tc) {
              const to = tc.options.find(o => o.id === co.techSpecId);
              if (to) {
                if (tc.inputType === 'checkbox') {
                  sel[tc.id] = [...(sel[tc.id] || []), to.id];
                } else {
                  sel[tc.id] = to.id;
                }
              }
            }
          } else if (co.techSpecCategoryId && !co.techSpecId) {
            const tc = TECH_SPEC_CATEGORIES.find(c => c.id === co.techSpecCategoryId);
            if (tc && tc.inputType === 'text' && tc.options[0]) {
              const key = `${tc.id}_${tc.options[0].id}`;
              const n = co.optionName || co.name || '';
              if (n) txt[key] = txt[key] ? txt[key] + ', ' + n : n;
            }
          }
        });
      });
    }

    setFormData({ selections: sel, textInputs: txt, conditionalData: cond, comment: ts.comment || '' });
  }, [order, open]);

  // Get bench data from calculator order
  const getBenchData = () => {
    if (!order?.selectedOptions) return [];
    return order.selectedOptions.filter(o => (o.categoryId || '').includes('lawki') || (o.categoryName || '').toLowerCase().includes('ławki'));
  };

  // Get model info
  const getModelInfo = () => {
    if (!order) return {};
    return {
      modelName: order.modelName || '',
      capacity: order.modelCapacity || order.capacity || '',
      dimensions: order.modelDimensions || order.dimensions || '',
    };
  };

  const setSelection = (catId, value) => setFormData(p => ({ ...p, selections: { ...p.selections, [catId]: value } }));
  const setTextInput = (key, value) => setFormData(p => ({ ...p, textInputs: { ...p.textInputs, [key]: value } }));
  const setConditional = (key, value) => setFormData(p => ({ ...p, conditionalData: { ...p.conditionalData, [key]: value } }));
  const toggleCheckbox = (catId, optId) => {
    setFormData(p => {
      const current = p.selections[catId] || [];
      const arr = Array.isArray(current) ? current : [];
      const next = arr.includes(optId) ? arr.filter(x => x !== optId) : [...arr, optId];
      return { ...p, selections: { ...p.selections, [catId]: next } };
    });
  };

  const handleSave = async () => {
    if (!order) return;
    setSaving(true);
    try {
      const techSpec = {
        selections: formData.selections,
        textInputs: formData.textInputs,
        conditionalData: formData.conditionalData,
        comment: formData.comment,
        updatedAt: new Date().toISOString(),
      };
      await axios.put(`${API_URL}/api/sauna/orders/${order.id}/tech-spec`, techSpec);
      toast.success('Тех. задание сохранено');
      onSaved?.(techSpec);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Ошибка сохранения');
    }
    setSaving(false);
  };

  const handleCreatePdf = async () => {
    if (!order) return;
    setGeneratingPdf(true);
    try {
      // First save the tech spec
      const techSpec = {
        selections: formData.selections,
        textInputs: formData.textInputs,
        conditionalData: formData.conditionalData,
        comment: formData.comment,
        updatedAt: new Date().toISOString(),
      };
      await axios.put(`${API_URL}/api/sauna/orders/${order.id}/tech-spec`, techSpec);

      // Prepare categories and sections as plain objects for the backend
      const cats = TECH_SPEC_CATEGORIES.map(c => ({
        id: c.id, name: c.name, section: c.section, inputType: c.inputType,
        options: c.options, conditionalFields: c.conditionalFields || null,
      }));
      const secs = TECH_SPEC_SECTIONS.map(s => ({ id: s.id, name: s.name }));

      const payload = {
        order: {
          id: order.id,
          fullName: order.fullName || order.clientName || '',
          phoneNumber: order.phoneNumber || order.phone || '',
          modelName: order.modelName || '',
          selectedModelVariantName: order.selectedModelVariantName || '',
          clientName: order.clientName || '',
        },
        techSpec,
        categories: cats,
        sections: secs,
        benchData: getBenchData(),
        leadId: leadId || null,
      };

      const res = await axios.post(`${API_URL}/api/sauna/generate-tech-spec-pdf`, payload, {
        responseType: leadId ? 'json' : 'blob',
      });

      if (leadId && res.data?.url) {
        toast.success('PDF создан и прикреплён к лиду');
        window.open(res.data.url, '_blank');
        onSaved?.(techSpec);
      } else {
        // Download as file
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `TechSpec_${order.id}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('PDF скачан');
      }
    } catch (e) {
      console.error(e);
      toast.error('Ошибка генерации PDF');
    }
    setGeneratingPdf(false);
  };

  const modelInfo = getModelInfo();
  const benchData = getBenchData();
  const categoriesBySection = {};
  TECH_SPEC_CATEGORIES.forEach(cat => {
    if (!categoriesBySection[cat.section]) categoriesBySection[cat.section] = [];
    categoriesBySection[cat.section].push(cat);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Техническое задание</DialogTitle>
          <DialogDescription>{order?.fullName || order?.clientName || ''} — {order?.modelName || ''}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order info row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/40 rounded-lg text-sm">
            <div><span className="text-muted-foreground text-xs block">Заказ</span><strong>{order?.id}</strong></div>
            <div><span className="text-muted-foreground text-xs block">Клиент</span>{order?.fullName || order?.clientName || '—'}</div>
            <div><span className="text-muted-foreground text-xs block">Телефон</span>{order?.phoneNumber || order?.phone || '—'}</div>
            <div><span className="text-muted-foreground text-xs block">Сумма</span>{order?.total ? `${Number(order.total).toLocaleString()} zł` : '—'}</div>
          </div>

          {/* Layout + Model info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Layout image */}
            <div className="border rounded-lg p-3">
              <Label className="text-xs text-muted-foreground mb-2 block">Планировка</Label>
              {layoutLoading ? (
                <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : layoutImage ? (
                <img src={layoutImage} alt="Layout" className="w-full h-auto max-h-60 object-contain rounded" />
              ) : (
                <div className="flex items-center justify-center h-40 bg-muted/30 rounded text-sm text-muted-foreground">
                  <ImageIcon className="w-5 h-5 mr-2" />Планировка не найдена
                </div>
              )}
            </div>

            {/* Model info */}
            <div className="border rounded-lg p-3 space-y-2">
              <Label className="text-xs text-muted-foreground mb-2 block">Данные сауны</Label>
              <div className="space-y-1 text-sm">
                {modelInfo.modelName && <div><span className="text-muted-foreground">Модель:</span> <strong>{modelInfo.modelName}</strong></div>}
                {modelInfo.dimensions && <div><span className="text-muted-foreground">Размер:</span> {modelInfo.dimensions}</div>}
                {modelInfo.capacity && <div><span className="text-muted-foreground">Кол-во человек:</span> {modelInfo.capacity}</div>}
                {order?.selectedModelVariant && <div><span className="text-muted-foreground">Вариант:</span> {order.selectedModelVariantName || order.selectedModelVariant}</div>}
              </div>
            </div>
          </div>

          {/* Sections */}
          {TECH_SPEC_SECTIONS.map(section => {
            const cats = categoriesBySection[section.id] || [];
            if (cats.length === 0) return null;
            const SectionIcon = sectionIcons[section.icon] || Info;

            return (
              <div key={section.id} className="space-y-4" data-testid={`ts-section-${section.id}`}>
                <div className="flex items-center gap-2 border-b pb-2">
                  <SectionIcon className="w-5 h-5 text-rose-600" />
                  <h3 className="font-semibold text-base">{section.name}</h3>
                </div>

                <div className="grid gap-4">
                  {cats.map(cat => (
                    <div key={cat.id} className="space-y-2" data-testid={`ts-cat-${cat.id}`}>
                      <Label className="text-sm font-medium">{cat.name}</Label>

                      {/* TEXT inputs */}
                      {cat.inputType === 'text' && (
                        <div className={`grid gap-2 ${cat.options.length >= 3 ? 'grid-cols-3' : cat.options.length === 2 ? 'grid-cols-2' : ''}`}>
                          {cat.options.map(opt => (
                            <div key={opt.id}>
                              {cat.options.length > 1 && <Label className="text-xs text-muted-foreground">{opt.name}</Label>}
                              <Input
                                value={formData.textInputs[`${cat.id}_${opt.id}`] || ''}
                                onChange={(e) => setTextInput(`${cat.id}_${opt.id}`, e.target.value)}
                                placeholder={opt.placeholder || ''}
                                className="h-9"
                                data-testid={`ts-input-${cat.id}-${opt.id}`}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* RADIO */}
                      {cat.inputType === 'radio' && (
                        <RadioGroup
                          value={formData.selections[cat.id] || ''}
                          onValueChange={(v) => setSelection(cat.id, v)}
                          className={`flex ${cat.layout === 'column' ? 'flex-col gap-2' : 'flex-wrap gap-3'}`}
                        >
                          {cat.options.map(opt => (
                            <div key={opt.id} className="flex items-center gap-2">
                              <RadioGroupItem value={opt.id} id={`${cat.id}_${opt.id}`} />
                              <Label htmlFor={`${cat.id}_${opt.id}`} className="text-sm cursor-pointer">{opt.name}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      )}

                      {/* CHECKBOX */}
                      {cat.inputType === 'checkbox' && (
                        <div className={`flex ${cat.layout === 'column' ? 'flex-col gap-2' : 'flex-wrap gap-4'}`}>
                          {cat.options.map(opt => {
                            const checked = Array.isArray(formData.selections[cat.id]) && formData.selections[cat.id].includes(opt.id);
                            return (
                              <div key={opt.id}>
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggleCheckbox(cat.id, opt.id)}
                                    id={`${cat.id}_${opt.id}`}
                                  />
                                  <Label htmlFor={`${cat.id}_${opt.id}`} className="text-sm cursor-pointer">{opt.name}</Label>
                                </div>
                                {opt.hasCustomField && checked && (
                                  <Input
                                    value={formData.textInputs[`${cat.id}_${opt.id}_custom`] || ''}
                                    onChange={(e) => setTextInput(`${cat.id}_${opt.id}_custom`, e.target.value)}
                                    placeholder="Укажите размер"
                                    className="h-8 mt-1 ml-6 w-48"
                                    data-testid={`ts-custom-${cat.id}-${opt.id}`}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* CALC_TRANSFER (benches from calculator) */}
                      {cat.inputType === 'calc_transfer' && (
                        <div className="space-y-2">
                          {benchData.length > 0 ? benchData.map((bench, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20">
                              {bench.imageUrl && (
                                <img src={bench.imageUrl} alt="" className="w-16 h-16 object-cover rounded" />
                              )}
                              <div className="flex-1 text-sm">
                                <div className="font-medium">{bench.optionName}</div>
                                {bench.selectedVariant && (
                                  <div className="text-muted-foreground text-xs">Вариант: {bench.selectedVariant.name}</div>
                                )}
                                {bench.quantity > 1 && <Badge variant="outline" className="text-xs mt-1">x{bench.quantity}</Badge>}
                              </div>
                              {bench.selectedVariant?.imageUrl && (
                                <img src={bench.selectedVariant.imageUrl} alt="" className="w-16 h-16 object-cover rounded border" />
                              )}
                            </div>
                          )) : (
                            <p className="text-sm text-muted-foreground">Лавки не выбраны в калькуляторе</p>
                          )}
                        </div>
                      )}

                      {/* Conditional fields (for stove) */}
                      {cat.conditionalFields && formData.selections[cat.id] && cat.conditionalFields[formData.selections[cat.id]] && (
                        <div className="ml-6 pl-4 border-l-2 border-rose-200 space-y-3 mt-2">
                          {cat.conditionalFields[formData.selections[cat.id]].map(cf => (
                            <div key={cf.id}>
                              <Label className="text-xs text-muted-foreground">{cf.name}</Label>
                              {cf.inputType === 'text' && (
                                <Input
                                  value={formData.conditionalData[`${cat.id}_${cf.id}`] || ''}
                                  onChange={(e) => setConditional(`${cat.id}_${cf.id}`, e.target.value)}
                                  placeholder={cf.placeholder || ''}
                                  className="h-9 mt-1"
                                  data-testid={`ts-cond-${cat.id}-${cf.id}`}
                                />
                              )}
                              {cf.inputType === 'radio' && (
                                <RadioGroup
                                  value={formData.conditionalData[`${cat.id}_${cf.id}`] || ''}
                                  onValueChange={(v) => setConditional(`${cat.id}_${cf.id}`, v)}
                                  className="flex flex-wrap gap-3 mt-1"
                                >
                                  {cf.options.map(o => (
                                    <div key={o.id} className="flex items-center gap-2">
                                      <RadioGroupItem value={o.id} id={`cond_${cat.id}_${cf.id}_${o.id}`} />
                                      <Label htmlFor={`cond_${cat.id}_${cf.id}_${o.id}`} className="text-sm cursor-pointer">{o.name}</Label>
                                    </div>
                                  ))}
                                </RadioGroup>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Comment */}
          <div>
            <Label className="text-sm font-medium">Комментарий</Label>
            <Textarea
              value={formData.comment || ''}
              onChange={(e) => setFormData(p => ({ ...p, comment: e.target.value }))}
              placeholder="Дополнительные замечания..."
              rows={3}
              data-testid="ts-comment"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Закрыть</Button>
          <Button
            variant="outline"
            onClick={handleCreatePdf}
            disabled={generatingPdf || saving}
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
            data-testid="ts-create-pdf-btn"
          >
            {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />}
            Создать PDF
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-rose-600 hover:bg-rose-700" data-testid="ts-save-btn">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
