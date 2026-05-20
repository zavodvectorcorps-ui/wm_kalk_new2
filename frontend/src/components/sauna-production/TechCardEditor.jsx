import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
    retailExtraCost: 0,
    syncToCostPrice: true,
    note: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Snapshot of the last *successfully persisted* draft. We compare the
  // current draft to this snapshot to derive an `isDirty` flag — used to
  // show the "Несохранённые изменения" badge and warn before close.
  const lastSavedRef = useRef('');
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

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
            const loadedDraft = {
              items: (r.data.items || []).map((i) => ({ id: i.id, componentId: i.componentId, qty: i.qty || 0, note: i.note || '' })),
              laborCost: r.data.laborCost || 0,
              overheadPct: r.data.overheadPct || 0,
              manualAdjustment: r.data.manualAdjustment || 0,
              retailExtraCost: r.data.retailExtraCost || 0,
              syncToCostPrice: r.data.syncToCostPrice !== false,
              note: r.data.note || '',
            };
            setDraft(loadedDraft);
            // Seed snapshot AFTER React batches the setDraft so auto-save knows
            // the freshly loaded state IS the saved baseline.
            lastSavedRef.current = JSON.stringify(_normalizeDraft(loadedDraft));
            setAutoSaveStatus('saved');
          }
        } else {
          setCard(null);
          // New card → mark as unsaved so first real edit triggers auto-save.
          lastSavedRef.current = '';
          setAutoSaveStatus('idle');
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
    const retailExtra = Math.max(0, Number(draft.retailExtraCost || 0));
    const total = materials + labor + overhead + manual;
    const retail = target.retailPrice || 0;
    const margin = retail - total;
    const marginPct = retail > 0 ? (margin / retail) * 100 : null;
    return { enriched, materials, labor, overhead, manual, retailExtra, total, retail, margin, marginPct };
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

  // ---- auto-save ----
  // Normalize a draft for change detection: strip items with empty componentId
  // (they're skipped on save anyway) and coerce numbers so 5 vs "5" don't
  // count as a change.
  function _normalizeDraft(d) {
    return {
      items: (d.items || [])
        .filter((i) => i.componentId)
        .map((i) => ({ componentId: i.componentId, qty: Number(i.qty) || 0, note: i.note || '' })),
      laborCost: Number(d.laborCost) || 0,
      overheadPct: Number(d.overheadPct) || 0,
      manualAdjustment: Number(d.manualAdjustment) || 0,
      retailExtraCost: Number(d.retailExtraCost) || 0,
      syncToCostPrice: !!d.syncToCostPrice,
      note: d.note || '',
    };
  }

  const doSave = useCallback(async () => {
    try {
      setSaving(true);
      const r = await axios.post(`${COST_BASE}/tech-cards`, {
        ...targetKey,
        items: draft.items.filter((i) => i.componentId),
        laborCost: Number(draft.laborCost) || 0,
        overheadPct: Number(draft.overheadPct) || 0,
        manualAdjustment: Number(draft.manualAdjustment) || 0,
        retailExtraCost: Number(draft.retailExtraCost) || 0,
        syncToCostPrice: draft.syncToCostPrice,
        note: draft.note,
      }, { headers: authHeaders() });
      if (!isMountedRef.current) return r.data;
      lastSavedRef.current = JSON.stringify(_normalizeDraft(draft));
      toast.success(`Сохранено. Себестоимость: ${fmtMoney(r.data.totalCost)}` + (draft.syncToCostPrice ? ' (синхронизирована в прайс)' : ''));
      onSaved?.(r.data);
      return r.data;
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка сохранения');
      throw e;
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  }, [draft, targetKey, onSaved]);

  // Track unsaved-changes state derived from current draft vs last persisted.
  const draftSnapshot = useMemo(() => JSON.stringify(_normalizeDraft(draft)), [draft]);
  const isDirty = !loading && draftSnapshot !== lastSavedRef.current;

  // Browser-level guard: warn if the user reloads / closes the tab with
  // unsaved tech-card edits.
  useEffect(() => {
    if (!isDirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Keep a ref to the latest draft (used for unsaved-changes confirm).
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  const save = async () => {
    try {
      await doSave();
      onClose();
    } catch (_e) { /* toast already shown */ }
  };

  // Confirm if there are unsaved changes before closing. Wired into both
  // the Dialog overlay/Escape (onOpenChange) and the explicit Cancel button.
  const requestClose = useCallback(() => {
    if (isDirty) {
      const ok = window.confirm('У вас есть несохранённые изменения. Закрыть без сохранения?');
      if (!ok) return;
    }
    onClose();
  }, [isDirty, onClose]);

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
  const staleCount = computed.enriched.filter((it) => it.componentId && !it.comp).length;
  // Retail prices in sauna_prices are stored as BRUTTO (incl. VAT 23%).
  // Component cost prices are entered NET. Compute margin against netto.
  const VAT = 0.23;
  const retailBrutto = target.retailPrice || 0;
  const retailNetto = retailBrutto / (1 + VAT);
  const marginNetto = retailNetto - computed.total;
  const marginPctNetto = retailNetto > 0 ? (marginNetto / retailNetto) * 100 : null;
  const lowMarginNetto = marginPctNetto !== null && marginPctNetto < 15;
  // Розничная маржа (учитывает доп. розничные расходы — доставку клиенту,
  // упаковку, комиссии). НЕ влияет на дилерскую/«чистую» маржу.
  const retailMarginNetto = marginNetto - computed.retailExtra;
  const retailMarginPctNetto = retailNetto > 0 ? (retailMarginNetto / retailNetto) * 100 : null;
  const lowRetailMargin = retailMarginPctNetto !== null && retailMarginPctNetto < 15;

  return (
    <Dialog open={true} onOpenChange={(v) => { if (!v) requestClose(); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col" data-testid="tech-card-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-orange-600" />
            Тех.карта: {target.name}
            <DirtyBadge isDirty={isDirty} saving={saving} hasCard={!!card?.id} />
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
          <>
            {staleCount > 0 && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-red-300 bg-red-50 text-red-800 text-xs mb-2" data-testid="tech-card-stale-banner">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <b>{staleCount}</b> {staleCount === 1 ? 'компонент удалён' : 'компонента(-ов) удалено'} из базы. Их стоимость учтена как <b>0&nbsp;zł</b>, что искажает себестоимость.
                  Замените или удалите подсвеченные строки.
                </div>
              </div>
            )}
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
                      <th className="px-2 py-1.5 w-28">Кол-во</th>
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
                      const isStale = !!it.componentId && !it.comp;
                      return (
                        <tr
                          key={it.id}
                          className={`border-t hover:bg-slate-50/70 ${isStale ? 'bg-red-50/60' : ''}`}
                          data-testid={`bom-row-${it.id}`}
                        >
                          <td className="px-2 py-1">
                            {isStale && (
                              <div className="flex items-center gap-1 text-[10px] text-red-700 font-medium mb-0.5" data-testid={`bom-stale-${it.id}`}>
                                <AlertTriangle className="w-3 h-3" />
                                Компонент удалён из базы — обновите или удалите строку
                              </div>
                            )}
                            <Select
                              value={it.componentId || '__none__'}
                              onValueChange={(v) => updateItem(it.id, { componentId: v === '__none__' ? '' : v })}
                            >
                              <SelectTrigger className={`h-8 text-xs ${isStale ? 'border-red-400' : ''}`}>
                                <SelectValue placeholder="Выберите компонент">
                                  {it.comp ? (
                                    <span className="inline-flex items-center gap-1">
                                      {cat && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />}
                                      {it.comp.name}
                                    </span>
                                  ) : isStale ? (
                                    <span className="inline-flex items-center gap-1 text-red-700">
                                      <AlertTriangle className="w-3 h-3" />
                                      Удалённый компонент ({(it.componentId || '').slice(0, 8)})
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
                              step="0.001"
                              min="0"
                              value={it.qty}
                              onChange={(e) => updateItem(it.id, { qty: parseFloat(e.target.value) || 0 })}
                              className="h-8 text-xs text-right font-mono px-2"
                              data-testid={`bom-qty-${it.id}`}
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
                <div className="flex items-center justify-between text-xs">
                  <label className="text-muted-foreground inline-flex items-center gap-1" title="Учитывается только в розничной марже. На дилерскую маржу не влияет.">
                    Розн. расходы (zł)
                    <span className="text-[10px] text-blue-600 px-1 border border-blue-200 rounded bg-blue-50">розница</span>
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={draft.retailExtraCost}
                    onChange={(e) => setDraft({ ...draft, retailExtraCost: parseFloat(e.target.value) || 0 })}
                    className="h-7 w-28 text-xs text-right"
                    data-testid="tech-card-retail-extra"
                  />
                </div>

                <div className="pt-2 border-t space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Себестоимость:</span>
                    <span className="text-lg font-bold text-orange-600 font-mono" data-testid="tech-card-total">{fmtMoney(computed.total)}</span>
                  </div>
                  {target.retailPrice > 0 && (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Розница brutto (с НДС 23%)</span>
                        <span className="font-mono">{fmtMoney(retailBrutto)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Розница netto (без НДС)</span>
                        <span className="font-mono">{fmtMoney(retailNetto)}</span>
                      </div>
                      <div className={`flex items-center justify-between text-sm font-semibold ${lowMarginNetto ? 'text-red-600' : 'text-emerald-700'}`} data-testid="tech-card-margin">
                        <span className="inline-flex items-center gap-1" title="Используется в сравнении с дилерскими ценами (без розничных расходов)">
                          {lowMarginNetto ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                          Маржа (для дилеров)
                        </span>
                        <span className="font-mono">
                          {fmtMoney(marginNetto)} ({marginPctNetto === null ? '—' : `${marginPctNetto.toFixed(1)}%`})
                        </span>
                      </div>
                      {computed.retailExtra > 0 && (
                        <>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>− розничные расходы</span>
                            <span className="font-mono text-red-600">−{fmtMoney(computed.retailExtra)}</span>
                          </div>
                          <div className={`flex items-center justify-between text-sm font-semibold ${lowRetailMargin ? 'text-red-600' : 'text-blue-700'}`} data-testid="tech-card-retail-margin">
                            <span className="inline-flex items-center gap-1" title="Маржа от розничной продажи (с учётом доставки/упаковки/комиссий)">
                              {lowRetailMargin ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                              Маржа (розница)
                            </span>
                            <span className="font-mono">
                              {fmtMoney(retailMarginNetto)} ({retailMarginPctNetto === null ? '—' : `${retailMarginPctNetto.toFixed(1)}%`})
                            </span>
                          </div>
                        </>
                      )}
                      {lowMarginNetto && (
                        <div className="text-[10px] text-red-700 flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3 h-3" />Маржа ниже 15% (от netto)
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
          </>
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
            <Button variant="outline" onClick={requestClose} data-testid="tech-card-cancel-btn"><X className="w-4 h-4 mr-1" />Отмена</Button>
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


/**
/**
 * Compact pill showing the *manual-save* status next to the card title.
 *  - saving: blue   "Сохранение…"
 *  - dirty:  amber  "Не сохранено"
 *  - clean:  green  "Сохранено"  (only after the card has been persisted at least once)
 */
function DirtyBadge({ isDirty, saving, hasCard }) {
  if (saving) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-700 border border-blue-500/30" data-testid="techcard-saving">
        <Loader2 className="h-3 w-3 animate-spin" /> Сохранение…
      </span>
    );
  }
  if (isDirty) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 border border-amber-500/30 animate-pulse" data-testid="techcard-dirty">
        <AlertTriangle className="h-3 w-3" /> Не сохранено
      </span>
    );
  }
  if (hasCard) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 border border-emerald-500/30" data-testid="techcard-saved">
        <CheckCircle2 className="h-3 w-3" /> Сохранено
      </span>
    );
  }
  return null;
}