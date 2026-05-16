import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Loader2, ShoppingCart, AlertTriangle, Plus, Trash2, Calculator, Factory, Printer } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { toast } from 'sonner';
import { COST_BASE, API, authHeaders, CAT_BY_ID, fmtMoney, fmtNumber } from './costConstants';

/**
 * ProcurementForecast — shopping list aggregator.
 * Two modes:
 *   • Auto (from production) — pulls from CRM leads with inProduction=true.
 *   • What-if — admin manually picks N targets with qty. Each row can be a
 *     model (+ variant) or an option (+ variant).
 */
export default function ProcurementForecast() {
  const [mode, setMode] = useState('production');
  return (
    <Tabs value={mode} onValueChange={setMode} className="space-y-3">
      <TabsList>
        <TabsTrigger value="production" className="gap-1" data-testid="procurement-mode-prod">
          <Factory className="w-4 h-4" /> По активным заказам
        </TabsTrigger>
        <TabsTrigger value="whatif" className="gap-1" data-testid="procurement-mode-whatif">
          <Calculator className="w-4 h-4" /> What-if (ручной выбор)
        </TabsTrigger>
      </TabsList>
      <TabsContent value="production"><ProductionList /></TabsContent>
      <TabsContent value="whatif"><WhatIfBuilder /></TabsContent>
    </Tabs>
  );
}

function ProductionList() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${COST_BASE}/procurement`, { headers: authHeaders() });
        setData(r.data);
      } catch (e) {
        toast.error('Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>;
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="border rounded-lg bg-card p-4 flex flex-wrap gap-3" data-testid="procurement-summary">
        <Stat label="Заказов в работе" value={data.totalOrders} />
        <Stat label="Сопоставлено с тех.картой" value={data.matchedTargets} />
        <Stat label="Не найдено тех.карт" value={(data.unmatched || []).length} warn={(data.unmatched || []).length > 0} />
        <Stat label="Итого материалов" value={fmtMoney(data.totalMaterials)} highlight />
      </div>

      {(data.unmatched || []).length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-amber-300 bg-amber-50 text-amber-800 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <b>{data.unmatched.length}</b> позиций в активных заказах не имеют тех.карты — их материалы не учтены в расчёте.
            <span className="block opacity-80 mt-1">
              Создайте тех.карты для них во вкладке «Тех.карты», чтобы прогноз закупки был полным.
            </span>
          </div>
        </div>
      )}

      <ProcurementTable items={data.items} />

      {(data.orders || []).length > 0 && (
        <div className="border rounded-lg bg-card overflow-auto" data-testid="procurement-orders">
          <div className="text-sm font-semibold px-3 py-2 border-b bg-slate-50">Активные заказы ({data.orders.length})</div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50/50"><tr className="text-left">
              <th className="px-3 py-1.5">Клиент</th>
              <th className="px-3 py-1.5">Модель</th>
              <th className="px-3 py-1.5">Готовность</th>
              <th className="px-3 py-1.5">Позиций</th>
            </tr></thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.leadId} className="border-t hover:bg-slate-50/70">
                  <td className="px-3 py-1.5">{o.clientName || '—'}</td>
                  <td className="px-3 py-1.5">{o.modelName || '—'}</td>
                  <td className="px-3 py-1.5">{o.readyDate || '—'}</td>
                  <td className="px-3 py-1.5">{o.targets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Flatten option list from prices (top-level + nested under categories). */
function collectAllOptions(prices) {
  const out = [];
  if (!prices) return out;
  for (const o of (prices.options || [])) out.push(o);
  for (const cat of (prices.categories || [])) {
    for (const o of (cat.options || [])) out.push({ ...o, _catName: cat.name });
  }
  return out;
}

function WhatIfBuilder() {
  const [prices, setPrices] = useState(null);
  const [targets, setTargets] = useState([]);
  const [result, setResult] = useState(null);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    axios.get(`${API}/api/sauna/prices`).then((r) => setPrices(r.data)).catch(() => {});
  }, []);

  const allOptions = useMemo(() => collectAllOptions(prices), [prices]);

  const addModelTarget = () => setTargets([
    ...targets,
    { _id: Math.random().toString(36).slice(2), kind: 'model', scope: 'model', modelId: '', variantId: '', qty: 1 },
  ]);
  const addOptionTarget = () => setTargets([
    ...targets,
    { _id: Math.random().toString(36).slice(2), kind: 'option', scope: 'option', optionId: '', optionVariantId: '', qty: 1 },
  ]);
  const removeTarget = (id) => setTargets(targets.filter((t) => t._id !== id));
  const updateTarget = (id, patch) => setTargets(targets.map((t) => t._id === id ? { ...t, ...patch } : t));

  const compute = async () => {
    if (targets.length === 0) {
      toast.error('Добавьте хотя бы одну позицию');
      return;
    }
    setComputing(true);
    try {
      const payload = {
        targets: targets.map((t) => ({
          scope: t.scope,
          modelId: t.modelId || '',
          variantId: t.variantId || '',
          optionId: t.optionId || '',
          optionVariantId: t.optionVariantId || '',
          qty: t.qty || 1,
        })).filter((t) => t.modelId || t.optionId),
      };
      if (payload.targets.length === 0) {
        toast.error('Выберите модель или опцию в каждой позиции');
        setComputing(false);
        return;
      }
      const r = await axios.post(`${COST_BASE}/procurement/forecast`, payload, { headers: authHeaders() });
      setResult(r.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка расчёта');
    } finally {
      setComputing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="border rounded-lg bg-card p-3 space-y-2" data-testid="whatif-builder">
        <div className="text-sm font-medium">Позиции для расчёта</div>
        {targets.length === 0 && <div className="text-xs text-muted-foreground py-2">Добавьте модель или опцию и нажмите «Рассчитать»</div>}
        {targets.map((t) => (
          t.kind === 'option'
            ? <OptionRow key={t._id} t={t} options={allOptions} onUpdate={(p) => updateTarget(t._id, p)} onRemove={() => removeTarget(t._id)} />
            : <ModelRow key={t._id} t={t} prices={prices} onUpdate={(p) => updateTarget(t._id, p)} onRemove={() => removeTarget(t._id)} />
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={addModelTarget} data-testid="whatif-add-model">
            <Plus className="w-3.5 h-3.5 mr-1" />Модель
          </Button>
          <Button size="sm" variant="outline" onClick={addOptionTarget} data-testid="whatif-add-option">
            <Plus className="w-3.5 h-3.5 mr-1" />Опция
          </Button>
          <Button size="sm" onClick={compute} disabled={computing || targets.length === 0} className="bg-orange-500 hover:bg-orange-600 ml-auto" data-testid="whatif-compute">
            {computing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Calculator className="w-3.5 h-3.5 mr-1" />}
            Рассчитать
          </Button>
        </div>
      </div>

      {result && (
        <>
          <div className="border rounded-lg bg-card p-4 flex flex-wrap gap-3">
            <Stat label="Сопоставлено" value={result.matchedTargets} />
            <Stat label="Не найдено тех.карт" value={(result.unmatched || []).length} warn={(result.unmatched || []).length > 0} />
            <Stat label="Итого материалов" value={fmtMoney(result.totalMaterials)} highlight />
          </div>
          <ProcurementTable items={result.items} />
        </>
      )}
    </div>
  );
}

function ModelRow({ t, prices, onUpdate, onRemove }) {
  const model = prices?.models?.find((m) => m.id === t.modelId);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="whatif-row-model">
      <span className="px-2 py-0.5 text-[10px] rounded border bg-blue-50 text-blue-700 border-blue-200">Модель</span>
      <Select value={t.modelId || '__none__'} onValueChange={(v) => onUpdate({ modelId: v === '__none__' ? '' : v, variantId: '', scope: 'model' })}>
        <SelectTrigger className="h-8 w-[240px]"><SelectValue placeholder="Модель..." /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— модель не выбрана —</SelectItem>
          {(prices?.models || []).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {model && (model.variants || []).length > 0 && (
        <Select value={t.variantId || '__base__'} onValueChange={(v) => onUpdate({ variantId: v === '__base__' ? '' : v, scope: v === '__base__' ? 'model' : 'variant' })}>
          <SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Вариант..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__base__">База (без варианта)</SelectItem>
            {(model.variants || []).map((v) => <SelectItem key={v.id} value={v.id}>{v.name || v.namePl}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <Input type="number" min={1} value={t.qty || 1} onChange={(e) => onUpdate({ qty: parseInt(e.target.value) || 1 })} className="h-8 w-20" placeholder="шт" />
      <button onClick={onRemove} className="text-slate-400 hover:text-red-600" title="Убрать позицию"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function OptionRow({ t, options, onUpdate, onRemove }) {
  const option = options.find((o) => o.id === t.optionId);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="whatif-row-option">
      <span className="px-2 py-0.5 text-[10px] rounded border bg-purple-50 text-purple-700 border-purple-200">Опция</span>
      <Select value={t.optionId || '__none__'} onValueChange={(v) => onUpdate({ optionId: v === '__none__' ? '' : v, optionVariantId: '', scope: 'option' })}>
        <SelectTrigger className="h-8 w-[280px]"><SelectValue placeholder="Опция..." /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— опция не выбрана —</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o._catName ? `${o._catName} · ` : ''}{o.name || o.namePl || o.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {option && (option.variants || []).length > 0 && (
        <Select value={t.optionVariantId || '__base__'} onValueChange={(v) => onUpdate({ optionVariantId: v === '__base__' ? '' : v, scope: v === '__base__' ? 'option' : 'option_variant' })}>
          <SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Вариант опции..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__base__">База (без варианта)</SelectItem>
            {(option.variants || []).map((v) => <SelectItem key={v.id} value={v.id}>{v.name || v.namePl}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <Input type="number" min={1} value={t.qty || 1} onChange={(e) => onUpdate({ qty: parseInt(e.target.value) || 1 })} className="h-8 w-20" placeholder="шт" />
      <button onClick={onRemove} className="text-slate-400 hover:text-red-600" title="Убрать позицию"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function ProcurementTable({ items }) {
  const grouped = useMemo(() => {
    const g = new Map();
    (items || []).forEach((it) => {
      if (!g.has(it.category)) g.set(it.category, []);
      g.get(it.category).push(it);
    });
    return Array.from(g.entries());
  }, [items]);

  if (!items || items.length === 0) return <div className="border rounded-lg bg-card p-6 text-center text-muted-foreground text-sm">Закупать пока нечего — в расчёте 0 позиций</div>;

  const handlePrint = () => window.print();

  return (
    <div className="border rounded-lg bg-card overflow-hidden" data-testid="procurement-table">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-slate-50 print:hidden">
        <div className="text-sm font-semibold inline-flex items-center gap-1.5"><ShoppingCart className="w-4 h-4 text-orange-600" />Список закупки</div>
        <Button size="sm" variant="outline" onClick={handlePrint} data-testid="procurement-print">
          <Printer className="w-3.5 h-3.5 mr-1" /> Печать
        </Button>
      </div>
      <table className="w-full text-xs">
        <thead className="bg-slate-50/70 sticky top-0">
          <tr className="text-left">
            <th className="px-3 py-2">Категория / Компонент</th>
            <th className="px-3 py-2 w-32 text-right">Кол-во</th>
            <th className="px-3 py-2 w-20">Ед.</th>
            <th className="px-3 py-2 w-32 text-right">Цена/ед</th>
            <th className="px-3 py-2 w-32 text-right">Сумма</th>
            <th className="px-3 py-2 w-32">Поставщик</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(([catId, rows]) => {
            const cat = CAT_BY_ID[catId] || CAT_BY_ID.other;
            const catTotal = rows.reduce((acc, r) => acc + (r.lineTotal || 0), 0);
            return (
              <React.Fragment key={catId}>
                <tr className="border-t bg-slate-50/30">
                  <td colSpan={4} className="px-3 py-1.5 font-medium text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      {cat.name} ({rows.length})
                    </span>
                  </td>
                  <td className="px-3 py-1.5 font-mono font-bold text-right">{fmtMoney(catTotal)}</td>
                  <td></td>
                </tr>
                {rows.map((r) => (
                  <tr key={r.componentId} className="border-t hover:bg-slate-50/70">
                    <td className="px-3 py-1.5 pl-6">{r.name}</td>
                    <td className="px-3 py-1.5 font-mono text-right font-medium">{fmtNumber(r.totalQty, 3)}</td>
                    <td className="px-3 py-1.5">{r.unit}</td>
                    <td className="px-3 py-1.5 font-mono text-right text-muted-foreground">{fmtMoney(r.unitPrice)}</td>
                    <td className="px-3 py-1.5 font-mono text-right font-bold text-orange-700">{fmtMoney(r.lineTotal)}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{r.supplier || '—'}</td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, highlight, warn }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-lg font-bold ${highlight ? 'text-orange-600' : warn ? 'text-amber-700' : ''}`}>{value}</span>
    </div>
  );
}
