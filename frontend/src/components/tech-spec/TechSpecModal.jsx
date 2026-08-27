import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { Loader2, Save, Info, FileDown, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/api';
import axios from 'axios';

const API_URL = getApiUrl();

// Tech spec modal — driven by the DB config (admin tab "Спецификация" → /api/tech-spec).
// Categories/options and their mapping (techSpecCategoryId/techSpecId set on calculator
// options) share the same ids, so auto-fill from the calculator actually works.
export const TechSpecModal = ({ open, onOpenChange, order, onSaved, leadId }) => {
  const [formData, setFormData] = useState({ selections: {}, textInputs: {}, conditionalData: {}, comment: '' });
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [layoutImage, setLayoutImage] = useState(null);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [masterCategories, setMasterCategories] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [calcCatMap, setCalcCatMap] = useState({}); // calculator categoryId -> techSpecCategoryId

  // Load calculator price list to know category-level tech spec mapping
  useEffect(() => {
    if (!open) return;
    axios.get(`${API_URL}/api/sauna/prices`)
      .then(r => {
        const m = {};
        (r.data?.categories || []).forEach(c => {
          if (c.techSpecCategoryId) m[c.id] = c.techSpecCategoryId;
        });
        setCalcCatMap(m);
      })
      .catch(() => setCalcCatMap({}));
  }, [open]);

  // Load configurable tech spec structure
  useEffect(() => {
    if (!open) return;
    setConfigLoading(true);
    axios.get(`${API_URL}/api/tech-spec/config`)
      .then(r => {
        const mc = (r.data?.masterCategories || []).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        const cats = (r.data?.categories || []).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        setMasterCategories(mc);
        setDbCategories(cats);
      })
      .catch(() => { setMasterCategories([]); setDbCategories([]); })
      .finally(() => setConfigLoading(false));
  }, [open]);

  // Fetch layout image
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
        } catch { /* ignore */ }
      }
      setLayoutImage(null);
    } catch { setLayoutImage(null); }
    finally { setLayoutLoading(false); }
  }, [order]);

  useEffect(() => { if (open && order) fetchLayout(); }, [open, order, fetchLayout]);

  const getBenchData = () => {
    if (!order?.selectedOptions) return [];
    return order.selectedOptions.filter(o => (o.categoryId || '').includes('lawki') || (o.categoryName || '').toLowerCase().includes('ławki'));
  };

  // Initialize form + auto-fill from calculator (using the SAME DB category ids)
  useEffect(() => {
    if (!order || !open || dbCategories.length === 0) return;
    const ts = order.techSpec || {};
    const sel = { ...ts.selections };
    const txt = { ...ts.textInputs };

    const catsById = {};
    dbCategories.forEach(c => { catsById[c.id] = c; });

    const opts = order.selectedOptions || [];
    if (opts.length > 0) {
      // 1) Explicit mapping stored on the calculator option / variant,
      //    falling back to the option's CATEGORY-level mapping.
      opts.forEach(co => {
        const tcId = co.techSpecCategoryId || calcCatMap[co.categoryId];
        const tsId = co.techSpecId;
        if (!tcId || !catsById[tcId]) return;
        const tc = catsById[tcId];
        if (tsId && (tc.inputType === 'radio' || tc.inputType === 'checkbox')) {
          if (tc.inputType === 'checkbox') {
            const cur = Array.isArray(sel[tc.id]) ? sel[tc.id] : [];
            if (!cur.includes(tsId)) sel[tc.id] = [...cur, tsId];
          } else if (!sel[tc.id]) {
            sel[tc.id] = tsId;
          }
        } else if ((tc.inputType === 'text' || tc.inputType === 'textarea' || tc.inputType === 'mixed')) {
          const firstOpt = (tc.options && tc.options[0]) || { id: 'value' };
          const key = `${tc.id}_${firstOpt.id}`;
          const n = co.selectedVariant?.name || co.optionName || co.name || '';
          if (n) txt[key] = txt[key] ? `${txt[key]}, ${n}` : n;
        }
      });

      // 2) Name-matching fallback for radio/checkbox categories without explicit mapping
      dbCategories.forEach(tc => {
        if (tc.inputType !== 'radio' && tc.inputType !== 'checkbox') return;
        if (sel[tc.id]) return;
        for (const co of opts) {
          const name = (co.optionName || co.name || '').toLowerCase();
          if (!name) continue;
          const match = (tc.options || []).find(to => {
            const a = (to.name || '').toLowerCase();
            return a && (a === name || a.includes(name) || name.includes(a));
          });
          if (match) {
            if (tc.inputType === 'checkbox') {
              sel[tc.id] = [...(Array.isArray(sel[tc.id]) ? sel[tc.id] : []), match.id];
            } else {
              sel[tc.id] = match.id;
              break;
            }
          }
        }
      });
    }

    setFormData({ selections: sel, textInputs: txt, conditionalData: {}, comment: ts.comment || '' });
  }, [order, open, dbCategories, calcCatMap]);

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
  const toggleCheckbox = (catId, optId) => {
    setFormData(p => {
      const current = p.selections[catId] || [];
      const arr = Array.isArray(current) ? current : [];
      const next = arr.includes(optId) ? arr.filter(x => x !== optId) : [...arr, optId];
      return { ...p, selections: { ...p.selections, [catId]: next } };
    });
  };

  // Map DB categories -> payload the backend PDF generator understands
  // (groups by `section` == masterCategoryId; textarea/mixed render as text).
  const buildPayloadCatsAndSections = () => {
    const cats = dbCategories.map(c => {
      let options = c.options || [];
      const inputType = (c.inputType === 'textarea' || c.inputType === 'mixed') ? 'text' : c.inputType;
      if ((inputType === 'text') && options.length === 0) {
        options = [{ id: 'value', name: c.name }];
      }
      return { id: c.id, name: c.name, section: c.masterCategoryId || 'general', inputType, options };
    });
    const sections = masterCategories.map(m => ({ id: m.id, name: m.name }));
    // Include a fallback section for categories without a master
    if (dbCategories.some(c => !c.masterCategoryId)) {
      sections.push({ id: 'general', name: 'Общее' });
    }
    return { cats, sections };
  };

  const persistTechSpec = async () => {
    const techSpec = {
      selections: formData.selections,
      textInputs: formData.textInputs,
      conditionalData: formData.conditionalData,
      comment: formData.comment,
      updatedAt: new Date().toISOString(),
    };
    await axios.put(`${API_URL}/api/sauna/orders/${order.id}/tech-spec`, techSpec);
    return techSpec;
  };

  const handleSave = async () => {
    if (!order) return;
    setSaving(true);
    try {
      const techSpec = await persistTechSpec();
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
      await persistTechSpec();
      const { cats, sections } = buildPayloadCatsAndSections();
      const payload = {
        order: {
          id: order.id,
          fullName: order.fullName || order.clientName || '',
          phoneNumber: order.phoneNumber || order.phone || '',
          modelName: order.modelName || '',
          selectedModelVariantName: order.selectedModelVariantName || '',
          clientName: order.clientName || '',
          amocrm_id: order.amocrm_id || null,
        },
        layoutImageUrl: layoutImage || null,
        techSpec: {
          selections: formData.selections,
          textInputs: formData.textInputs,
          conditionalData: formData.conditionalData,
          comment: formData.comment,
        },
        categories: cats,
        sections,
        benchData: getBenchData(),
        leadId: leadId || null,
      };
      const res = await axios.post(`${API_URL}/api/sauna/generate-tech-spec-pdf`, payload, {
        responseType: leadId ? 'json' : 'blob',
      });
      if (leadId && res.data?.url) {
        toast.success('PDF создан и прикреплён к лиду');
        window.open(res.data.url, '_blank');
        onSaved?.(formData);
      } else {
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

  // Group categories by master category (section)
  const categoriesByMaster = {};
  dbCategories.forEach(cat => {
    const key = cat.masterCategoryId || 'general';
    if (!categoriesByMaster[key]) categoriesByMaster[key] = [];
    categoriesByMaster[key].push(cat);
  });
  const renderSections = [...masterCategories];
  if (dbCategories.some(c => !c.masterCategoryId)) {
    renderSections.push({ id: 'general', name: 'Общее' });
  }

  const isBenchCat = (cat) => {
    const s = `${cat.id} ${cat.name}`.toLowerCase();
    return s.includes('bench') || s.includes('ław') || s.includes('лавк') || s.includes('полк');
  };

  const renderCategory = (cat) => {
    const inputType = cat.inputType || 'radio';
    return (
      <div key={cat.id} className="space-y-2" data-testid={`ts-cat-${cat.id}`}>
        <Label className="text-sm font-medium">{cat.name}</Label>

        {(inputType === 'text' || inputType === 'textarea' || inputType === 'mixed') && (
          <div className={`grid gap-2 ${(cat.options?.length || 0) >= 3 ? 'grid-cols-3' : (cat.options?.length === 2 ? 'grid-cols-2' : '')}`}>
            {(cat.options && cat.options.length > 0 ? cat.options : [{ id: 'value', name: cat.name }]).map(opt => (
              <div key={opt.id}>
                {(cat.options?.length || 0) > 1 && <Label className="text-xs text-muted-foreground">{opt.name}</Label>}
                {inputType === 'textarea' ? (
                  <Textarea
                    value={formData.textInputs[`${cat.id}_${opt.id}`] || ''}
                    onChange={(e) => setTextInput(`${cat.id}_${opt.id}`, e.target.value)}
                    placeholder={opt.placeholder || ''}
                    rows={2}
                    data-testid={`ts-input-${cat.id}-${opt.id}`}
                  />
                ) : (
                  <Input
                    value={formData.textInputs[`${cat.id}_${opt.id}`] || ''}
                    onChange={(e) => setTextInput(`${cat.id}_${opt.id}`, e.target.value)}
                    placeholder={opt.placeholder || ''}
                    className="h-9"
                    data-testid={`ts-input-${cat.id}-${opt.id}`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {inputType === 'radio' && (
          <RadioGroup
            value={formData.selections[cat.id] || ''}
            onValueChange={(v) => setSelection(cat.id, v)}
            className={`flex ${cat.layout === 'column' ? 'flex-col gap-2' : 'flex-wrap gap-3'}`}
          >
            {(cat.options || []).map(opt => (
              <div key={opt.id} className="flex items-center gap-2">
                <RadioGroupItem value={opt.id} id={`${cat.id}_${opt.id}`} />
                <Label htmlFor={`${cat.id}_${opt.id}`} className="text-sm cursor-pointer">{opt.name}</Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {inputType === 'checkbox' && (
          <div className={`flex ${cat.layout === 'column' ? 'flex-col gap-2' : 'flex-wrap gap-4'}`}>
            {(cat.options || []).map(opt => {
              const checked = Array.isArray(formData.selections[cat.id]) && formData.selections[cat.id].includes(opt.id);
              return (
                <div key={opt.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleCheckbox(cat.id, opt.id)}
                    id={`${cat.id}_${opt.id}`}
                  />
                  <Label htmlFor={`${cat.id}_${opt.id}`} className="text-sm cursor-pointer">{opt.name}</Label>
                </div>
              );
            })}
          </div>
        )}

        {/* Benches transferred from the calculator (read-only helper) */}
        {isBenchCat(cat) && benchData.length > 0 && (
          <div className="space-y-2 mt-1">
            {benchData.map((bench, i) => (
              <div key={i} className="flex items-center gap-3 p-2 border rounded-lg bg-muted/20">
                {bench.imageUrl && <img src={bench.imageUrl} alt="" className="w-14 h-14 object-cover rounded" />}
                <div className="flex-1 text-sm">
                  <div className="font-medium">{bench.optionName}</div>
                  {bench.selectedVariant && <div className="text-muted-foreground text-xs">Вариант: {bench.selectedVariant.name}</div>}
                  {bench.quantity > 1 && <Badge variant="outline" className="text-xs mt-1">x{bench.quantity}</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Техническое задание</DialogTitle>
          <DialogDescription>{order?.fullName || order?.clientName || ''} — {order?.modelName || ''}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order info row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg text-sm">
            <div><span className="text-muted-foreground text-xs block">Заказ</span><strong>{order?.id}</strong></div>
            <div><span className="text-muted-foreground text-xs block">Клиент</span>{order?.fullName || order?.clientName || '—'}</div>
            <div><span className="text-muted-foreground text-xs block">Телефон</span>{order?.phoneNumber || order?.phone || '—'}</div>
          </div>

          {/* Layout + Model info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          {configLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-rose-600" /></div>
          ) : dbCategories.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Структура тех.задания не настроена. Откройте админку → вкладка «Спецификация».
            </div>
          ) : (
            renderSections.map(section => {
              const cats = categoriesByMaster[section.id] || [];
              if (cats.length === 0) return null;
              return (
                <div key={section.id} className="space-y-4" data-testid={`ts-section-${section.id}`}>
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Info className="w-5 h-5 text-rose-600" />
                    <h3 className="font-semibold text-base">{section.name}</h3>
                  </div>
                  <div className="grid gap-4">
                    {cats.map(renderCategory)}
                  </div>
                </div>
              );
            })
          )}

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
