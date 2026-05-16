import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Loader2, Plus, Trash2, Sparkles, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { COST_BASE, API, authHeaders, fmtMoney } from './costConstants';

const VAT = 0.23;

/**
 * PriceSimulator — what-if margin / dealer-price playground.
 *
 * - Pick model + variant + N options (with variants) + qty.
 * - Reads existing tech-cards to sum *netto* cost.
 * - Reads sauna_prices to sum *brutto* retail (includes VAT 23%).
 * - Converts retail → netto so margin = retail_netto − cost.
 * - Adds an editable "Цена для дилера" (brutto by default; netto toggle)
 *   and shows the resulting margin.
 */
export default function PriceSimulator() {
  const [prices, setPrices] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modelId, setModelId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [options, setOptions] = useState([]); // [{_id, optionId, optionVariantId, qty}]
  const [dealerInput, setDealerInput] = useState('');
  const [dealerMode, setDealerMode] = useState('brutto'); // 'brutto' | 'netto'

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [p, c] = await Promise.all([
          axios.get(`${API}/api/sauna/prices`),
          axios.get(`${COST_BASE}/tech-cards`, { headers: authHeaders() }),
        ]);
        setPrices(p.data || {});
        setCards(c.data.items || []);
      } catch (e) {
        toast.error('Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cardByKey = useMemo(() => {
    const m = new Map();
    cards.forEach((c) => {
      m.set([c.scope, c.modelId || '', c.variantId || '', c.optionId || '', c.optionVariantId || ''].join('|'), c);
    });
    return m;
  }, [cards]);
  const findCard = (scope, modelId = '', variantId = '', optionId = '', optionVariantId = '') =>
    cardByKey.get([scope, modelId, variantId, optionId, optionVariantId].join('|'));

  const model = useMemo(() => (prices?.models || []).find((m) => m.id === modelId), [prices, modelId]);
  const variant = useMemo(() => (model?.variants || []).find((v) => v.id === variantId), [model, variantId]);

  const allOptions = useMemo(() => {
    if (!prices) return [];
    const flat = [...(prices.options || [])];
    (prices.categories || []).forEach((cat) => {
      (cat.options || []).forEach((o) => flat.push({ ...o, _catName: cat.name }));
    });
    return flat;
  }, [prices]);
  const optById = useMemo(() => Object.fromEntries(allOptions.map((o) => [o.id, o])), [allOptions]);

  // ---------- compute breakdown ----------
  const breakdown = useMemo(() => {
    const rows = [];

    // Base model (or variant)
    if (model) {
      if (variant) {
        const card = findCard('variant', model.id, variant.id);
        const retailBrutto = (model.basePrice || 0) + (variant.price || 0);
        rows.push({
          kind: 'variant',
          name: `${model.name} — ${variant.name || variant.namePl}`,
          retailBrutto,
          costNetto: card?.totalCost || 0,
          hasCard: !!card?.id,
          qty: 1,
        });
      } else {
        const card = findCard('model', model.id);
        rows.push({
          kind: 'model',
          name: model.name,
          retailBrutto: model.basePrice || 0,
          costNetto: card?.totalCost || 0,
          hasCard: !!card?.id,
          qty: 1,
        });
      }
    }

    // Options
    for (const opt of options) {
      const o = optById[opt.optionId];
      if (!o) continue;
      const ov = (o.variants || []).find((v) => v.id === opt.optionVariantId);
      const qty = Math.max(1, parseInt(opt.qty) || 1);
      if (ov) {
        const card = findCard('option_variant', '', '', o.id, ov.id);
        rows.push({
          kind: 'option_variant',
          name: `${o.name} — ${ov.name || ov.namePl}`,
          retailBrutto: (ov.price || 0) * qty,
          costNetto: (card?.totalCost || 0) * qty,
          hasCard: !!card?.id,
          qty,
        });
      } else {
        const card = findCard('option', '', '', o.id);
        rows.push({
          kind: 'option',
          name: o.name,
          retailBrutto: (o.price || 0) * qty,
          costNetto: (card?.totalCost || 0) * qty,
          hasCard: !!card?.id,
          qty,
        });
      }
    }

    const retailBrutto = rows.reduce((s, r) => s + r.retailBrutto, 0);
    const retailNetto = retailBrutto / (1 + VAT);
    const cost = rows.reduce((s, r) => s + r.costNetto, 0);
    const margin = retailNetto - cost;
    const marginPct = retailNetto > 0 ? (margin / retailNetto) * 100 : null;
    const missingCards = rows.filter((r) => !r.hasCard).length;
    return { rows, retailBrutto, retailNetto, cost, margin, marginPct, missingCards };
  }, [model, variant, options, optById, cardByKey]);

  // ---------- dealer-price math ----------
  const dealer = useMemo(() => {
    const raw = parseFloat(dealerInput);
    if (!isFinite(raw) || raw <= 0) return null;
    const brutto = dealerMode === 'brutto' ? raw : raw * (1 + VAT);
    const netto = brutto / (1 + VAT);
    const margin = netto - breakdown.cost;
    const marginPct = netto > 0 ? (margin / netto) * 100 : null;
    const discountVsRetail = breakdown.retailBrutto > 0
      ? (1 - brutto / breakdown.retailBrutto) * 100
      : null;
    return { brutto, netto, margin, marginPct, discountVsRetail };
  }, [dealerInput, dealerMode, breakdown.cost, breakdown.retailBrutto]);

  // ---------- helpers ----------
  const addOption = () => setOptions([...options, { _id: Math.random().toString(36).slice(2), optionId: '', optionVariantId: '', qty: 1 }]);
  const updateOption = (id, patch) => setOptions(options.map((o) => o._id === id ? { ...o, ...patch } : o));
  const removeOption = (id) => setOptions(options.filter((o) => o._id !== id));

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>;

  return (
    <div className="space-y-3" data-testid="price-simulator">
      <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-blue-200 bg-blue-50 text-blue-900 text-xs">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          Все расчёты ведутся с учётом <b>НДС 23%</b>: розничные цены в прайсе — <b>brutto</b> (с НДС),
          себестоимость по тех.картам — <b>netto</b>. Маржа считается на netto-выручку: <code className="px-1 bg-blue-100 rounded">retail&nbsp;÷&nbsp;1.23&nbsp;−&nbsp;cost</code>.
        </div>
      </div>

      {/* Configuration */}
      <div className="border rounded-lg bg-card p-4 space-y-3" data-testid="simulator-config">
        <div className="text-sm font-medium">Конфигурация сборки</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Модель</label>
            <Select value={modelId || '__none__'} onValueChange={(v) => { setModelId(v === '__none__' ? '' : v); setVariantId(''); }}>
              <SelectTrigger data-testid="sim-model"><SelectValue placeholder="Выберите модель..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— модель не выбрана —</SelectItem>
                {(prices?.models || []).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {model && (model.variants || []).length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Вариант модели</label>
              <Select value={variantId || '__base__'} onValueChange={(v) => setVariantId(v === '__base__' ? '' : v)}>
                <SelectTrigger data-testid="sim-variant"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__base__">База (без варианта)</SelectItem>
                  {(model.variants || []).map((v) => <SelectItem key={v.id} value={v.id}>{v.name || v.namePl}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-medium text-muted-foreground">Опции в заказе</div>
            <Button size="sm" variant="outline" onClick={addOption} data-testid="sim-add-option">
              <Plus className="w-3.5 h-3.5 mr-1" />Опция
            </Button>
          </div>
          {options.length === 0 && (
            <div className="text-xs text-muted-foreground py-2">Добавьте опции, которые менеджер выбирает в калькуляторе.</div>
          )}
          {options.map((opt) => {
            const o = optById[opt.optionId];
            return (
              <div key={opt._id} className="flex flex-wrap items-center gap-2 py-1 text-xs" data-testid={`sim-opt-row-${opt._id}`}>
                <Select value={opt.optionId || '__none__'} onValueChange={(v) => updateOption(opt._id, { optionId: v === '__none__' ? '' : v, optionVariantId: '' })}>
                  <SelectTrigger className="h-8 w-[260px]"><SelectValue placeholder="Опция..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— опция не выбрана —</SelectItem>
                    {allOptions.map((opx) => (
                      <SelectItem key={opx.id} value={opx.id}>
                        {opx._catName ? `${opx._catName} · ` : ''}{opx.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {o && (o.variants || []).length > 0 && (
                  <Select value={opt.optionVariantId || '__base__'} onValueChange={(v) => updateOption(opt._id, { optionVariantId: v === '__base__' ? '' : v })}>
                    <SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Вариант опции..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__base__">База (без варианта)</SelectItem>
                      {(o.variants || []).map((v) => <SelectItem key={v.id} value={v.id}>{v.name || v.namePl}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Input type="number" min={1} value={opt.qty} onChange={(e) => updateOption(opt._id, { qty: parseInt(e.target.value) || 1 })} className="h-8 w-20" />
                <button onClick={() => removeOption(opt._id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Breakdown */}
      {breakdown.rows.length > 0 && (
        <div className="border rounded-lg bg-card overflow-hidden" data-testid="simulator-breakdown">
          <div className="px-3 py-2 border-b bg-slate-50 text-sm font-semibold inline-flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-orange-600" /> Расшифровка
            {breakdown.missingCards > 0 && (
              <Badge variant="outline" className="ml-2 border-amber-300 text-amber-700 bg-amber-50">
                {breakdown.missingCards} без тех.карты
              </Badge>
            )}
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50/60">
              <tr className="text-left">
                <th className="px-3 py-1.5">Позиция</th>
                <th className="px-3 py-1.5 w-16 text-right">Кол-во</th>
                <th className="px-3 py-1.5 w-32 text-right">Розница brutto</th>
                <th className="px-3 py-1.5 w-32 text-right">Себестоимость</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.rows.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-1.5">
                    {r.name}
                    {!r.hasCard && (
                      <span className="ml-2 text-[10px] text-amber-700">нет тех.карты — cost=0</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">{r.qty}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtMoney(r.retailBrutto)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtMoney(r.costNetto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals + Dealer */}
      {breakdown.rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Retail */}
          <div className="border rounded-lg bg-card p-4 space-y-2" data-testid="simulator-retail">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Розничная продажа</div>
            <SumRow label="Розница brutto (с НДС 23%)" value={breakdown.retailBrutto} />
            <SumRow label="Розница netto (без НДС)" value={breakdown.retailNetto} subtle />
            <SumRow label="Себестоимость (netto)" value={breakdown.cost} subtle />
            <div className="border-t pt-2 mt-1">
              <SumRow
                label="Маржа (netto − cost)"
                value={breakdown.margin}
                pct={breakdown.marginPct}
                color={breakdown.marginPct !== null && breakdown.marginPct < 15 ? 'red' : 'emerald'}
                bold
              />
            </div>
          </div>

          {/* Dealer */}
          <div className="border-2 border-blue-200 rounded-lg bg-blue-50/30 p-4 space-y-2" data-testid="simulator-dealer">
            <div className="text-xs font-semibold uppercase text-blue-700">Дилерская цена</div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Цена для дилера ({dealerMode === 'brutto' ? 'brutto, с НДС' : 'netto, без НДС'})</label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  step="100"
                  placeholder={`Напр. ${Math.round(breakdown.retailBrutto * 0.7).toLocaleString('ru-RU')}`}
                  value={dealerInput}
                  onChange={(e) => setDealerInput(e.target.value)}
                  className="h-9 flex-1 font-mono"
                  data-testid="sim-dealer-price"
                />
                <Select value={dealerMode} onValueChange={setDealerMode}>
                  <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brutto">brutto</SelectItem>
                    <SelectItem value="netto">netto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {dealer ? (
              <div className="space-y-1 pt-2">
                <SumRow label="Дилер brutto" value={dealer.brutto} subtle />
                <SumRow label="Дилер netto (без НДС)" value={dealer.netto} subtle />
                <div className="border-t pt-2 mt-1">
                  <SumRow
                    label="Маржа на дилера"
                    value={dealer.margin}
                    pct={dealer.marginPct}
                    color={dealer.margin < 0 ? 'red' : dealer.marginPct < 10 ? 'amber' : 'emerald'}
                    bold
                  />
                </div>
                {dealer.discountVsRetail !== null && (
                  <div className="text-[11px] text-muted-foreground">
                    Скидка от розницы: <b className="text-foreground">{dealer.discountVsRetail.toFixed(1)}%</b>
                  </div>
                )}
                {dealer.margin < 0 && (
                  <div className="text-xs text-red-700 font-medium mt-1">
                    ⚠ Цена ниже себестоимости — продажа в убыток
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground pt-2">Введите цену, которую вы готовы дать дилеру.</div>
            )}

            {/* Quick discount presets */}
            {breakdown.retailBrutto > 0 && (
              <div className="pt-2 border-t">
                <div className="text-[10px] text-muted-foreground uppercase mb-1">Быстро: скидка от розницы</div>
                <div className="flex flex-wrap gap-1.5">
                  {[10, 15, 20, 25, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => { setDealerMode('brutto'); setDealerInput(String(Math.round(breakdown.retailBrutto * (1 - d / 100)))); }}
                      className="text-[11px] px-2 py-1 rounded border bg-white hover:bg-blue-100 hover:border-blue-300"
                      data-testid={`sim-dealer-preset-${d}`}
                    >
                      −{d}%
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SumRow({ label, value, pct, subtle, bold, color }) {
  const colorCls = color === 'red' ? 'text-red-600'
    : color === 'amber' ? 'text-amber-700'
    : color === 'emerald' ? 'text-emerald-700'
    : '';
  return (
    <div className={`flex items-center justify-between ${subtle ? 'text-xs text-muted-foreground' : 'text-sm'} ${bold ? 'font-semibold' : ''} ${colorCls}`}>
      <span>{label}</span>
      <span className="font-mono">
        {fmtMoney(value)}
        {pct !== null && pct !== undefined && (
          <span className="ml-1.5 text-[11px]">({pct.toFixed(1)}%)</span>
        )}
      </span>
    </div>
  );
}
