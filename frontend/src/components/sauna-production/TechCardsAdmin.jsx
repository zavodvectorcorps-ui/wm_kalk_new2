import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Calculator, Loader2, RotateCw, TrendingDown, TrendingUp, ChevronDown, ChevronRight, Search, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import TechCardEditor from './TechCardEditor';
import { COST_BASE, API, authHeaders, fmtMoney } from './costConstants';

/**
 * TechCardsAdmin — list of all sauna models / variants / options, each with its
 * computed tech-card cost (if any). Clicking a row opens the BOM editor.
 */
export default function TechCardsAdmin() {
  const [prices, setPrices] = useState(null);
  const [cards, setCards] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);  // currently editing
  const [search, setSearch] = useState('');
  const [recomputing, setRecomputing] = useState(false);
  const [expanded, setExpanded] = useState({}); // modelId -> bool
  const [marginMode, setMarginMode] = useState('dealer'); // 'dealer' | 'retail' | 'both'

  const load = async () => {
    setLoading(true);
    try {
      const [pricesRes, cardsRes, dashRes] = await Promise.all([
        axios.get(`${API}/api/sauna/prices`),
        axios.get(`${COST_BASE}/tech-cards`, { headers: authHeaders() }),
        axios.get(`${COST_BASE}/dashboard`, { headers: authHeaders() }),
      ]);
      setPrices(pricesRes.data || {});
      setCards(cardsRes.data.items || []);
      setDashboard(dashRes.data || null);
    } catch (e) {
      toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const cardByKey = useMemo(() => {
    const m = new Map();
    cards.forEach((c) => {
      const k = [c.scope, c.modelId || '', c.variantId || '', c.optionId || '', c.optionVariantId || ''].join('|');
      m.set(k, c);
    });
    return m;
  }, [cards]);

  const findCard = (scope, modelId = '', variantId = '', optionId = '', optionVariantId = '') => {
    return cardByKey.get([scope, modelId, variantId, optionId, optionVariantId].join('|'));
  };

  const filteredModels = useMemo(() => {
    if (!prices?.models) return [];
    if (!search.trim()) return prices.models;
    const s = search.toLowerCase();
    return prices.models.filter((m) => m.name?.toLowerCase().includes(s));
  }, [prices, search]);

  const allOptions = useMemo(() => {
    if (!prices) return [];
    const flat = [...(prices.options || [])];
    (prices.categories || []).forEach((cat) => {
      (cat.options || []).forEach((o) => flat.push({ ...o, _catId: cat.id, _catName: cat.name }));
    });
    if (!search.trim()) return flat;
    const s = search.toLowerCase();
    return flat.filter((o) => o.name?.toLowerCase().includes(s));
  }, [prices, search]);

  const recomputeAll = async () => {
    setRecomputing(true);
    try {
      const r = await axios.post(`${COST_BASE}/tech-cards/recompute-all`, {}, { headers: authHeaders() });
      toast.success(`Пересчитано тех.карт: ${r.data.recomputed}`);
      load();
    } catch (e) {
      toast.error('Ошибка');
    } finally {
      setRecomputing(false);
    }
  };

  if (loading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>;

  return (
    <div className="space-y-3">
      {dashboard && dashboard.totalCards > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="margin-leaderboard">
          <div className="border rounded-lg bg-card p-3">
            <div className="text-xs font-semibold text-red-700 mb-2 inline-flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" /> Самая низкая маржа
            </div>
            {(dashboard.lowMarginTop || []).length === 0 ? (
              <div className="text-xs text-muted-foreground">Нет данных</div>
            ) : (dashboard.lowMarginTop || []).slice(0, 5).map((c) => (
              <div key={c.modelId + c.variantId + c.optionId} className="flex items-center justify-between py-1 text-xs border-b last:border-b-0">
                <span className="truncate">{c.name || '—'}</span>
                <span className={`font-mono font-semibold ${c.marginPct < 15 ? 'text-red-600' : 'text-amber-700'}`}>{c.marginPct?.toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <div className="border rounded-lg bg-card p-3">
            <div className="text-xs font-semibold text-emerald-700 mb-2 inline-flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Самая высокая маржа
            </div>
            {(dashboard.highMarginTop || []).length === 0 ? (
              <div className="text-xs text-muted-foreground">Нет данных</div>
            ) : (dashboard.highMarginTop || []).slice(0, 5).map((c) => (
              <div key={c.modelId + c.variantId + c.optionId} className="flex items-center justify-between py-1 text-xs border-b last:border-b-0">
                <span className="truncate">{c.name || '—'}</span>
                <span className="font-mono font-semibold text-emerald-700">{c.marginPct?.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Поиск по моделям и опциям..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" data-testid="tech-cards-search" />
        </div>

        {/* Margin mode toggle */}
        <div className="inline-flex border rounded-md overflow-hidden h-9 text-xs" data-testid="margin-mode-toggle">
          <button
            onClick={() => setMarginMode('dealer')}
            className={`px-3 ${marginMode === 'dealer' ? 'bg-emerald-100 text-emerald-800 font-semibold' : 'bg-white text-muted-foreground hover:bg-slate-50'}`}
            data-testid="margin-mode-dealer"
            title="Чистая маржа (для сравнения с дилерами)"
          >Дилерская</button>
          <button
            onClick={() => setMarginMode('retail')}
            className={`px-3 border-l ${marginMode === 'retail' ? 'bg-blue-100 text-blue-800 font-semibold' : 'bg-white text-muted-foreground hover:bg-slate-50'}`}
            data-testid="margin-mode-retail"
            title="Маржа с учётом розничных расходов"
          >Розница</button>
          <button
            onClick={() => setMarginMode('both')}
            className={`px-3 border-l ${marginMode === 'both' ? 'bg-orange-100 text-orange-800 font-semibold' : 'bg-white text-muted-foreground hover:bg-slate-50'}`}
            data-testid="margin-mode-both"
            title="Показать обе маржи"
          >Обе</button>
        </div>

        <Button variant="outline" size="sm" onClick={recomputeAll} disabled={recomputing} data-testid="recompute-all-btn" title="Пересчитать все тех.карты">
          {recomputing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCw className="w-4 h-4 mr-1" />}
          Пересчитать всё
        </Button>
      </div>

      <div className="space-y-2" data-testid="tech-cards-list">
        {/* MODELS */}
        {filteredModels.length > 0 && <SectionHeader title="Модели саун" />}
        {filteredModels.map((m) => {
          const variants = m.variants || [];
          const hasVariants = variants.length > 0;
          const modelCard = findCard('model', m.id);
          const isExpanded = !!expanded[m.id];

          // For models with variants we do NOT show / allow a model-scope
          // tech card — costs come from per-variant cards. We aggregate
          // variant costs into a min..max range for the collapsed row.
          let variantCosts = [];
          let variantsWithCard = 0;
          if (hasVariants) {
            variants.forEach((v) => {
              const c = findCard('variant', m.id, v.id);
              if (c && c.totalCost != null) {
                variantCosts.push(Number(c.totalCost) || 0);
                variantsWithCard += 1;
              }
            });
          }
          const minCost = variantCosts.length ? Math.min(...variantCosts) : null;
          const maxCost = variantCosts.length ? Math.max(...variantCosts) : null;

          return (
            <div key={m.id} className="border rounded-md bg-card overflow-hidden">
              {hasVariants ? (
                <ModelGroupRow
                  model={m}
                  variantsTotal={variants.length}
                  variantsWithCard={variantsWithCard}
                  minCost={minCost}
                  maxCost={maxCost}
                  expanded={isExpanded}
                  onToggle={() => setExpanded({ ...expanded, [m.id]: !isExpanded })}
                />
              ) : (
                <TargetRow
                  title={m.name}
                  subtitle={`Базовая цена ${fmtMoney(m.basePrice)}`}
                  retail={m.basePrice}
                  card={modelCard}
                  onClick={() => setTarget({ scope: 'model', modelId: m.id, name: m.name, retailPrice: m.basePrice })}
                  marginMode={marginMode}
                />
              )}
              {isExpanded && variants.map((v) => {
                const vCard = findCard('variant', m.id, v.id);
                const retailFull = (m.basePrice || 0) + (v.price || 0);
                return (
                  <TargetRow
                    key={v.id}
                    title={`└─ ${v.name || v.namePl}`}
                    subtitle={`Вариант · доплата ${fmtMoney(v.price)} · итого ${fmtMoney(retailFull)}`}
                    retail={retailFull}
                    card={vCard}
                    indent
                    onClick={() => setTarget({
                      scope: 'variant', modelId: m.id, variantId: v.id,
                      name: `${m.name} — ${v.name || v.namePl}`, retailPrice: retailFull,
                    })}
                    marginMode={marginMode}
                  />
                );
              })}
            </div>
          );
        })}

        {/* OPTIONS */}
        {allOptions.length > 0 && <SectionHeader title="Опции" className="pt-3" />}
        {allOptions.map((o) => {
          const variants = o.variants || [];
          const hasVariants = variants.length > 0;
          const optCard = findCard('option', '', '', o.id);
          const isExpanded = !!expanded[`opt-${o.id}`];

          // Aggregate variant costs (same UX as for models with variants).
          let variantCosts = [];
          let variantsWithCard = 0;
          if (hasVariants) {
            variants.forEach((ov) => {
              const c = findCard('option_variant', '', '', o.id, ov.id);
              if (c && c.totalCost != null) {
                variantCosts.push(Number(c.totalCost) || 0);
                variantsWithCard += 1;
              }
            });
          }
          const minCost = variantCosts.length ? Math.min(...variantCosts) : null;
          const maxCost = variantCosts.length ? Math.max(...variantCosts) : null;

          const openOption = () => {
            setTarget({ scope: 'option', optionId: o.id, name: o.name, retailPrice: o.price });
          };

          return (
            <div key={o.id} className="border rounded-md bg-card overflow-hidden">
              {hasVariants ? (
                <OptionGroupRow
                  option={o}
                  catName={o._catName}
                  variantsTotal={variants.length}
                  variantsWithCard={variantsWithCard}
                  minCost={minCost}
                  maxCost={maxCost}
                  expanded={isExpanded}
                  onToggle={() => setExpanded({ ...expanded, [`opt-${o.id}`]: !isExpanded })}
                />
              ) : (
                <TargetRow
                  title={o.name}
                  subtitle={`${o._catName ? o._catName + ' · ' : ''}${fmtMoney(o.price)}`}
                  retail={o.price}
                  card={optCard}
                  onClick={openOption}
                  marginMode={marginMode}
                />
              )}
              {isExpanded && variants.map((ov) => {
                const ovCard = findCard('option_variant', '', '', o.id, ov.id);
                return (
                  <TargetRow
                    key={ov.id}
                    title={`└─ ${ov.name || ov.namePl}`}
                    subtitle={`Вариант · ${fmtMoney(ov.price)}`}
                    retail={ov.price}
                    card={ovCard}
                    indent
                    onClick={() => setTarget({
                      scope: 'option_variant', optionId: o.id, optionVariantId: ov.id,
                      name: `${o.name} — ${ov.name || ov.namePl}`, retailPrice: ov.price,
                    })}
                    marginMode={marginMode}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {target && (
        <TechCardEditor
          target={target}
          prices={prices}
          onClose={() => setTarget(null)}
          onSaved={() => load()}
        />
      )}
    </div>
  );
}

function SectionHeader({ title, className = '' }) {
  return (
    <div className={`text-xs font-semibold uppercase text-muted-foreground tracking-wider mt-2 ${className}`}>
      {title}
    </div>
  );
}

function TargetRow({ title, subtitle, retail, card, onClick, onToggle, expanded, indent, marginMode = 'dealer' }) {
  const hasCard = !!card?.id;
  const cost = card?.totalCost || 0;
  const retailBrutto = Number(retail) || 0;
  const retailNetto = retailBrutto > 0 ? retailBrutto / 1.23 : 0;
  // Dealer-style margin (cost-only, VAT-aware)
  const dealerMargin = hasCard && retailNetto > 0 ? retailNetto - cost : null;
  const dealerMarginPct = dealerMargin !== null && retailNetto > 0 ? (dealerMargin / retailNetto) * 100 : null;
  // Retail-style margin (cost + retail extras)
  const retailExtra = Number(card?.retailExtraCost || 0);
  const retailMargin = dealerMargin !== null ? dealerMargin - retailExtra : null;
  const retailMarginPct = retailMargin !== null && retailNetto > 0 ? (retailMargin / retailNetto) * 100 : null;

  const showDealer = marginMode === 'dealer' || marginMode === 'both';
  const showRetail = marginMode === 'retail' || marginMode === 'both';

  // Choose what drives the "loss" red-row tint based on current mode.
  const activeMargin = marginMode === 'retail' ? retailMargin : dealerMargin;
  const isLoss = activeMargin !== null && activeMargin < 0;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 hover:bg-slate-50/70 border-t first:border-t-0 ${indent ? 'pl-6' : ''} ${isLoss ? 'bg-red-50/60' : indent ? 'bg-slate-50/30' : ''}`}
      data-testid={`target-row-${(card?.id || title).slice(0, 20)}`}
    >
      {onToggle ? (
        <button onClick={onToggle} className="text-slate-400 hover:text-slate-700 -ml-1">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      ) : <span className="w-3" />}

      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
        <div className="text-sm font-medium truncate">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
      </div>

      {/* Numbers block — desktop only (sm+) */}
      <div className="hidden sm:grid gap-x-3 text-right shrink-0" style={{ gridTemplateColumns: `repeat(${2 + (showDealer ? 1 : 0) + (showRetail ? 1 : 0)}, minmax(100px, auto))` }}>
        <NumCell label="Розница" value={retailBrutto > 0 ? fmtMoney(retailBrutto) : '—'} subValue={retailBrutto > 0 ? `${fmtMoney(retailNetto)} netto` : null} />
        <NumCell
          label="Себест."
          value={hasCard ? fmtMoney(cost) : '—'}
          valueClass={hasCard ? 'text-orange-600 font-bold' : 'text-muted-foreground'}
          subValue={hasCard ? 'netto' : null}
        />
        {showDealer && (
          <MarginCell label={marginMode === 'both' ? 'Маржа (дилер)' : 'Маржа'} margin={dealerMargin} pct={dealerMarginPct} accent="emerald" />
        )}
        {showRetail && (
          <MarginCell
            label={marginMode === 'both' ? 'Маржа (розн.)' : 'Маржа'}
            margin={retailMargin}
            pct={retailMarginPct}
            accent="blue"
            disabledHint={hasCard && retailExtra === 0 ? '= дилерской (нет розн. расходов)' : null}
          />
        )}
      </div>

      {/* Mobile compact */}
      <div className="sm:hidden text-right shrink-0">
        {hasCard ? (
          <>
            <div className="text-sm font-bold text-orange-600 font-mono">{fmtMoney(cost)}</div>
            {activeMargin !== null && (
              <div className={`text-[11px] font-mono inline-flex items-center gap-0.5 justify-end ${isLoss ? 'text-red-700 font-bold' : 'text-emerald-700'}`}>
                {isLoss ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                {fmtMoney(activeMargin)}
              </div>
            )}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">{retailBrutto > 0 ? fmtMoney(retailBrutto) : 'нет тех.карты'}</span>
        )}
      </div>

      <Button
        size="sm"
        variant={hasCard ? 'outline' : 'default'}
        onClick={onClick}
        className={hasCard ? '' : 'bg-orange-500 hover:bg-orange-600'}
        data-testid={`tech-card-open-${title.replace(/\s+/g, '-').slice(0, 30)}`}
      >
        <Calculator className="w-3.5 h-3.5 mr-1" />
        {hasCard ? 'Открыть' : 'Создать'}
      </Button>
    </div>
  );
}

function MarginCell({ label, margin, pct, accent, disabledHint }) {
  if (margin === null) {
    return <NumCell label={label} value="—" valueClass="text-muted-foreground" />;
  }
  const isLoss = margin < 0;
  const isLow = !isLoss && pct !== null && pct < 15;
  // Static class strings so Tailwind's JIT keeps them in the bundle.
  const okClass = accent === 'blue' ? 'text-blue-700 font-bold' : 'text-emerald-700 font-bold';
  const cls = isLoss ? 'text-red-700 font-bold' : isLow ? 'text-amber-700 font-bold' : okClass;
  const icon = isLoss ? <TrendingDown className="w-3 h-3" /> : isLow ? <AlertTriangle className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />;
  return (
    <NumCell
      label={label}
      value={fmtMoney(margin)}
      valueClass={cls}
      icon={icon}
      subValue={pct === null ? null : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`}
      subHint={disabledHint}
    />
  );
}

function NumCell({ label, value, valueClass = 'font-mono', subValue, icon, subHint }) {
  return (
    <div className="min-w-[100px]">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide leading-tight">{label}</div>
      <div className={`text-sm font-mono leading-tight inline-flex items-center gap-0.5 justify-end ${valueClass}`}>
        {icon}{value}
      </div>
      {subValue && (
        <div className="text-[10px] text-muted-foreground font-mono leading-tight">{subValue}</div>
      )}
      {subHint && (
        <div className="text-[9px] text-muted-foreground italic leading-tight">{subHint}</div>
      )}
    </div>
  );
}

/**
 * Header row for models that HAVE variants.
 * - No tech-card for the model itself (cost is per-variant).
 * - Shows aggregated cost range from existing variant tech-cards.
 * - Click anywhere to expand/collapse; no "Создать" button.
 */
function ModelGroupRow({ model, variantsTotal, variantsWithCard, minCost, maxCost, expanded, onToggle }) {
  const hasAnyCost = minCost != null;
  const costLabel = !hasAnyCost
    ? '—'
    : minCost === maxCost
      ? fmtMoney(minCost)
      : `${fmtMoney(minCost)} – ${fmtMoney(maxCost)}`;
  const allFilled = variantsWithCard === variantsTotal && variantsTotal > 0;
  const someFilled = variantsWithCard > 0 && !allFilled;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50/70 cursor-pointer select-none"
      onClick={onToggle}
      data-testid={`model-group-${model.id}`}
    >
      <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="text-slate-400 hover:text-slate-700 -ml-1">
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate flex items-center gap-2">
          {model.name}
          <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md font-normal ${
            allFilled ? 'bg-emerald-100 text-emerald-700'
              : someFilled ? 'bg-amber-100 text-amber-800'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {variantsWithCard}/{variantsTotal} тех.карт
          </span>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          Базовая цена {fmtMoney(model.basePrice)} · себестоимость по вариантам ↓
        </div>
      </div>

      <div className="hidden sm:grid gap-x-3 text-right shrink-0" style={{ gridTemplateColumns: 'repeat(2, minmax(120px, auto))' }}>
        <NumCell label="Розница (от)" value={fmtMoney(model.basePrice)} subValue="базовая" />
        <NumCell
          label="Себест. вариантов"
          value={costLabel}
          valueClass={hasAnyCost ? 'text-orange-600 font-bold' : 'text-muted-foreground'}
          subValue={hasAnyCost ? (minCost === maxCost ? 'одинаковая у всех' : 'диапазон') : 'нет данных'}
        />
      </div>

      <span className="text-xs text-muted-foreground italic shrink-0 ml-2 hidden md:inline">
        Тех.карта на модель не нужна
      </span>
    </div>
  );
}

/**
 * Header row for options that HAVE variants — same pattern as ModelGroupRow.
 * Cost is per-variant; the option itself doesn't need its own tech-card.
 */
function OptionGroupRow({ option, catName, variantsTotal, variantsWithCard, minCost, maxCost, expanded, onToggle }) {
  const hasAnyCost = minCost != null;
  const costLabel = !hasAnyCost
    ? '—'
    : minCost === maxCost
      ? fmtMoney(minCost)
      : `${fmtMoney(minCost)} – ${fmtMoney(maxCost)}`;
  const allFilled = variantsWithCard === variantsTotal && variantsTotal > 0;
  const someFilled = variantsWithCard > 0 && !allFilled;
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50/70 cursor-pointer select-none"
      onClick={onToggle}
      data-testid={`option-group-${option.id}`}
    >
      <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="text-slate-400 hover:text-slate-700 -ml-1">
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate flex items-center gap-2">
          {option.name}
          <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md font-normal ${
            allFilled ? 'bg-emerald-100 text-emerald-700'
              : someFilled ? 'bg-amber-100 text-amber-800'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {variantsWithCard}/{variantsTotal} тех.карт
          </span>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {catName ? `${catName} · ` : ''}{fmtMoney(option.price)} · себестоимость по вариантам ↓
        </div>
      </div>
      <div className="hidden sm:grid gap-x-3 text-right shrink-0" style={{ gridTemplateColumns: 'repeat(2, minmax(120px, auto))' }}>
        <NumCell label="Розница (от)" value={fmtMoney(option.price)} subValue="базовая" />
        <NumCell
          label="Себест. вариантов"
          value={costLabel}
          valueClass={hasAnyCost ? 'text-orange-600 font-bold' : 'text-muted-foreground'}
          subValue={hasAnyCost ? (minCost === maxCost ? 'одинаковая у всех' : 'диапазон') : 'нет данных'}
        />
      </div>
      <span className="text-xs text-muted-foreground italic shrink-0 ml-2 hidden md:inline">
        Тех.карта на опцию не нужна
      </span>
    </div>
  );
}
