import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Loader2, ShoppingCart, AlertTriangle, Plus, Trash2, Calculator, Factory, Printer } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { COST_BASE, API, authHeaders, CAT_BY_ID, fmtMoney, fmtNumber } from './costConstants';

/**
 * ProcurementForecast — shopping list aggregator.
 * Two modes:
 *   • Auto (from production) — pulls from CRM leads with inProduction=true.
 *   • What-if — admin manually picks N model+option targets with qty.
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

function WhatIfBuilder() {
  const [prices, setPrices] = useState(null);
  const [targets, setTargets] = useState([]);
  const [result, setResult] = useState(null);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    axios.get(`${API}/api/sauna/prices`).then((r) => setPrices(r.data)).catch(() => {});
  }, []);

  const addTarget = () => setTargets([...targets, { _id: Math.random().toString(36).slice(2), scope: 'model', modelId: '', variantId: '', qty: 1 }]);
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
          qty: t.qty || 1,
        })).filter((t) => t.modelId || t.optionId),
      };
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
        {targets.length === 0 && <div className="text-xs text-muted-foreground py-2">Добавьте позиции и нажмите «Рассчитать»</div>}
        {targets.map((t) => {
          const model = prices?.models?.find((m) => m.id === t.modelId);
          return (
            <div key={t._id} className="flex flex-wrap items-center gap-2 text-xs">
              <Select value={t.modelId || '__none__'} onValueChange={(v) => updateTarget(t._id, { modelId: v === '__none__' ? '' : v, variantId: '' })}>
                <SelectTrigger className="h-8 w-[240px]"><SelectValue placeholder="Модель..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— модель не выбрана —</SelectItem>
                  {(prices?.models || []).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {model && (model.variants || []).length > 0 && (
                <Select value={t.variantId || '__base__'} onValueChange={(v) => updateTarget(t._id, { variantId: v === '__base__' ? '' : v, scope: v === '__base__' ? 'model' : 'variant' })}>
                  <SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Вариант..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__base__">База (без варианта)</SelectItem>
                    {(model.variants || []).map((v) => <SelectItem key={v.id} value={v.id}>{v.name || v.namePl}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Input type="number" min={1} value={t.qty || 1} onChange={(e) => updateTarget(t._id, { qty: parseInt(e.target.value) || 1 })} className="h-8 w-20" placeholder="шт" />
              <button onClick={() => removeTarget(t._id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          );
        })}
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={addTarget} data-testid="whatif-add"><Plus className="w-3.5 h-3.5 mr-1" />Позиция</Button>
          <Button size="sm" onClick={compute} disabled={computing || targets.length === 0} className="bg-orange-500 hover:bg-orange-600" data-testid="whatif-compute">
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
