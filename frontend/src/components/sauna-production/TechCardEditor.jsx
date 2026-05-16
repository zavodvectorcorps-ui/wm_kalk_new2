import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Plus, Trash2, Loader2, Save, X, Calculator, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Copy } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { COST_BASE, API, authHeaders, CAT_BY_ID, fmtMoney } from './costConstants';

/**
 * TechCardEditor — full BOM editor for one target entity (model/variant/option/option_variant).
 * Opened from TechCardsAdmin via the "Тех.карта" button.
 */
export default function TechCardEditor({ target, prices, onClose, onSaved }) {
  const [components, setComponents] = useState([]);
  const [card, setCard] = useState(null);     // server card with computed fields
  const [draft, setDraft] = useState({         // editable copy
    items: [],
    laborCost: 0,
    overheadPct: 15,
    manualAdjustment: 0,
    syncToCostPrice: true,
    note: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const targetKey = useMemo(() => ({
    scope: target.scope,
    modelId: target.modelId || '',
    variantId: target.variantId || '',
    optionId: target.optionId || '',
    optionVariantId: target.optionVariantId || '',
  }), [target]);

  // ---- load ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [comps, cards] = await Promise.all([
          axios.get(`${COST_BASE}/components`, { headers: authHeaders() }),
          axios.get(`${COST_BASE}/tech-cards`, { headers: authHeaders() }),
        ]);
        if (cancelled) return;
        setComponents(comps.data.items || []);
        const existing = (cards.data.items || []).find(
          (c) => c.scope === targetKey.scope
            && (c.modelId || '') === targetKey.modelId
            && (c.variantId || '') === targetKey.variantId
            && (c.optionId || '') === targetKey.optionId
            && (c.optionVariantId || '') === targetKey.optionVariantId
        );
        if (existing) {
          // fetch enriched view
          const r = await axios.get(`${COST_BASE}/tech-cards/${existing.id}`, { headers: authHeaders() });
          if (!cancelled) {
            setCard(r.data);
            setDraft({
              items: (r.data.items || []).map((i) => ({ id: i.id, componentId: i.componentId, qty: i.qty || 0, note: i.note || '' })),
              laborCost: r.data.laborCost || 0,
              overheadPct: r.data.overheadPct || 0,
              manualAdjustment: r.data.manualAdjustment || 0,
              syncToCostPrice: r.data.syncToCostPrice !== false,
              note: r.data.note || '',
            });
          }
        } else {
          setCard(null);
        }
      } catch (e) {
        toast.error('Ошибка загрузки');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [targetKey]);

  // ---- local totals (live as user edits) ----
  const compMap = useMemo(() => Object.fromEntries(components.map((c) => [c.id, c])), [components]);
  const computed = useMemo(() => {
    let materials = 0;
    const enriched = (draft.items || []).map((it) => {
      const comp = compMap[it.componentId];
      const unitPrice = Number(comp?.unitPrice || 0);
      const qty = Number(it.qty || 0);
      const lineTotal = unitPrice * qty;
      materials += lineTotal;
      return { ...it, comp, unitPrice, qty, lineTotal };
    });
    const labor = Number(draft.laborCost || 0);
    const overheadPct = Number(draft.overheadPct || 0);
    const overhead = materials * overheadPct / 100;
    const manual = Number(draft.manualAdjustment || 0);
    const total = materials + labor + overhead + manual;
    const retail = target.retailPrice || 0;
    const margin = retail - total;
    const marginPct = retail > 0 ? (margin / retail) * 100 : null;
    return { enriched, materials, labor, overhead, manual, total, retail, margin, marginPct };
  }, [draft, compMap, target.retailPrice]);

  // ---- actions ----
  const addItem = () => {
    setDraft({ ...draft, items: [...draft.items, { id: crypto.randomUUID?.() || String(Date.now()), componentId: '', qty: 1, note: '' }] });
  };
  const updateItem = (id, patch) => {
    setDraft({ ...draft, items: draft.items.map((i) => i.id === id ? { ...i, ...patch } : i) });
  };
  const removeItem = (id) => {
    setDraft({ ...draft, items: draft.items.filter((i) => i.id !== id) });
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await axios.post(`${COST_BASE}/tech-cards`, {
        ...targetKey,
        items: draft.items.filter((i) => i.componentId),
        laborCost: Number(draft.laborCost) || 0,
        overheadPct: Number(draft.overheadPct) || 0,
        manualAdjustment: Number(draft.manualAdjustment) || 0,
        syncToCostPrice: draft.syncToCostPrice,
        note: draft.note,
      }, { headers: authHeaders() });
      toast.success(`Сохранено. Себестоимость: ${fmtMoney(r.data.totalCost)}` + (draft.syncToCostPrice ? ' (синхронизирована в прайс)' : ''));
      onSaved?.(r.data);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!card?.id) return onClose();
    if (!window.confirm('Удалить тех.карту?')) return;
    try {
      await axios.delete(`${COST_BASE}/tech-cards/${card.id}`, { headers: authHeaders() });
      toast.success('Удалено');
      onSaved?.(null);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка');
    }
  };

  const lowMargin = computed.marginPct !== null && computed.marginPct < 15;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col" data-testid="tech-card-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-orange-600" />
            Тех.карта: {target.name}
          </DialogTitle>
          <DialogDescription>
            Розничная цена: <b className="text-foreground">{fmtMoney(target.retailPrice)}</b>
            {' · '}Тип: <b className="text-foreground">{target.scope}</b>
            {card?.id && <Badge variant="outline" className="ml-2">Сохранена</Badge>}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 overflow-hidden">
            {/* BOM table — main column */}
            <div className="lg:col-span-2 flex flex-col gap-2 overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Комплектующие</div>
                <Button size="sm" variant="outline" onClick={addItem} data-testid="bom-add-item">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Строка
                </Button>
              </div>
              <div className="border rounded-md overflow-auto flex-1">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="text-left">
                      <th className="px-2 py-1.5">Компонент</th>
                      <th className="px-2 py-1.5 w-20">Кол-во</th>
                      <th className="px-2 py-1.5 w-14">Ед.</th>
                      <th className="px-2 py-1.5 w-24">Цена/ед</th>
                      <th className="px-2 py-1.5 w-28 text-right">Сумма</th>
                      <th className="px-2 py-1.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {computed.enriched.length === 0 ? (
                      <tr><td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">
                        Добавьте комплектующие из базы для расчёта себестоимости
                      </td></tr>
                    ) : computed.enriched.map((it) => {
                      const cat = it.comp ? (CAT_BY_ID[it.comp.category] || CAT_BY_ID.other) : null;
                      return (
                        <tr key={it.id} className="border-t hover:bg-slate-50/70" data-testid={`bom-row-${it.id}`}>
                          <td className="px-2 py-1">
                            <Select
                              value={it.componentId || '__none__'}
                              onValueChange={(v) => updateItem(it.id, { componentId: v === '__none__' ? '' : v })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Выберите компонент">
                                  {it.comp ? (
                                    <span className="inline-flex items-center gap-1">
                                      {cat && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />}
                                      {it.comp.name}
                                    </span>
                                  ) : null}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— не выбран —</SelectItem>
                                {components.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {(CAT_BY_ID[c.category] || CAT_BY_ID.other).name} · {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={it.qty}
                              onChange={(e) => updateItem(it.id, { qty: parseFloat(e.target.value) || 0 })}
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="px-2 py-1 text-xs text-muted-foreground">{it.comp?.unit || '—'}</td>
                          <td className="px-2 py-1 font-mono text-xs">{fmtMoney(it.unitPrice)}</td>
                          <td className="px-2 py-1 font-mono text-xs text-right font-medium">{fmtMoney(it.lineTotal)}</td>
                          <td className="px-2 py-1 text-right">
                            <button onClick={() => removeItem(it.id)} className="text-slate-400 hover:text-red-600" data-testid={`bom-remove-${it.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sidebar: totals + settings */}
            <div className="flex flex-col gap-2 overflow-y-auto">
              <div className="border rounded-md p-3 bg-slate-50 space-y-2 text-sm" data-testid="tech-card-totals">
                <TotalRow label="Материалы" value={computed.materials} />
                <div className="flex items-center justify-between text-xs">
                  <label className="text-muted-foreground">Работа (zł)</label>
                  <Input type="number" value={draft.laborCost} onChange={(e) => setDraft({ ...draft, laborCost: parseFloat(e.target.value) || 0 })} className="h-7 w-28 text-xs text-right" data-testid="tech-card-labor" />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <label className="text-muted-foreground">Накладные (%)</label>
                  <Input type="number" step="0.1" value={draft.overheadPct} onChange={(e) => setDraft({ ...draft, overheadPct: parseFloat(e.target.value) || 0 })} className="h-7 w-28 text-xs text-right" data-testid="tech-card-overhead" />
                </div>
                <TotalRow label="Накладные (расч.)" value={computed.overhead} subtle />
                <div className="flex items-center justify-between text-xs">
                  <label className="text-muted-foreground">Корректировка (zł)</label>
                  <Input type="number" value={draft.manualAdjustment} onChange={(e) => setDraft({ ...draft, manualAdjustment: parseFloat(e.target.value) || 0 })} className="h-7 w-28 text-xs text-right" data-testid="tech-card-adjustment" />
                </div>

                <div className="pt-2 border-t space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Себестоимость:</span>
                    <span className="text-lg font-bold text-orange-600 font-mono" data-testid="tech-card-total">{fmtMoney(computed.total)}</span>
                  </div>
                  {target.retailPrice > 0 && (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Розница</span>
                        <span className="font-mono">{fmtMoney(target.retailPrice)}</span>
                      </div>
                      <div className={`flex items-center justify-between text-sm font-semibold ${lowMargin ? 'text-red-600' : 'text-emerald-700'}`} data-testid="tech-card-margin">
                        <span className="inline-flex items-center gap-1">
                          {lowMargin ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                          Маржа
                        </span>
                        <span className="font-mono">
                          {fmtMoney(computed.margin)} ({computed.marginPct === null ? '—' : `${computed.marginPct.toFixed(1)}%`})
                        </span>
                      </div>
                      {lowMargin && (
                        <div className="text-[10px] text-red-700 flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3 h-3" />Маржа ниже 15%
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="border rounded-md p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <label className="font-medium">Записывать costPrice в прайс</label>
                  <Switch checked={draft.syncToCostPrice} onCheckedChange={(v) => setDraft({ ...draft, syncToCostPrice: v })} data-testid="tech-card-sync" />
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Если включено — при сохранении итог запишется в поле <b>costPrice</b> этой позиции прайса (используется в Excel-импорте и дилерских заказах).
                </p>
              </div>

              <Input
                placeholder="Примечание к тех.карте..."
                value={draft.note || ''}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
          </div>
        )}

        <DialogFooter className="pt-3 border-t mt-2 flex-row justify-between sm:justify-between">
          <div className="flex gap-2">
            {card?.id && (
              <Button variant="outline" size="sm" onClick={remove} className="border-red-300 text-red-600 hover:bg-red-50" data-testid="tech-card-delete">
                <Trash2 className="w-4 h-4 mr-1" /> Удалить
              </Button>
            )}
            {card?.id && (
              <DuplicateButton card={card} prices={prices} onDuplicated={() => { onSaved?.(); onClose(); }} />
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-1" />Отмена</Button>
            <Button onClick={save} disabled={saving} className="bg-orange-500 hover:bg-orange-600" data-testid="tech-card-save">
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Сохранить
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TotalRow({ label, value, subtle }) {
  return (
    <div className={`flex items-center justify-between ${subtle ? 'text-xs text-muted-foreground' : 'text-sm'}`}>
      <span>{label}</span>
      <span className="font-mono">{fmtMoney(value)}</span>
    </div>
  );
}

function DuplicateButton({ card, prices, onDuplicated }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState('model');
  const [modelId, setModelId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [busy, setBusy] = useState(false);

  const model = (prices?.models || []).find((m) => m.id === modelId);

  const submit = async () => {
    if (!modelId) return toast.error('Выберите модель');
    setBusy(true);
    try {
      await axios.post(`${COST_BASE}/tech-cards/${card.id}/duplicate`, {
        scope,
        modelId,
        variantId: scope === 'variant' ? variantId : '',
      }, { headers: authHeaders() });
      toast.success('Тех.карта скопирована');
      setOpen(false);
      onDuplicated?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка копирования');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} data-testid="tech-card-duplicate-btn">
        <Copy className="w-4 h-4 mr-1" /> Скопировать
      </Button>
      {open && (
        <Dialog open={true} onOpenChange={setOpen}>
          <DialogContent className="max-w-md" data-testid="duplicate-dialog">
            <DialogHeader>
              <DialogTitle>Скопировать тех.карту</DialogTitle>
              <DialogDescription>Все компоненты, работа, накладные и корректировки будут перенесены на новую цель.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Куда копируем</label>
                <Select value={scope} onValueChange={(v) => { setScope(v); setVariantId(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="model">На модель целиком</SelectItem>
                    <SelectItem value="variant">На вариант модели</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Модель</label>
                <Select value={modelId || '__none__'} onValueChange={(v) => setModelId(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Выбрать..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— не выбрана —</SelectItem>
                    {(prices?.models || []).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {scope === 'variant' && model && (
                <div>
                  <label className="text-xs font-medium">Вариант</label>
                  <Select value={variantId || '__none__'} onValueChange={(v) => setVariantId(v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Выбрать..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— не выбран —</SelectItem>
                      {(model.variants || []).map((v) => <SelectItem key={v.id} value={v.id}>{v.name || v.namePl}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button onClick={submit} disabled={busy || !modelId} className="bg-orange-500 hover:bg-orange-600" data-testid="duplicate-submit">
                {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Copy className="w-4 h-4 mr-1" />}
                Копировать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
