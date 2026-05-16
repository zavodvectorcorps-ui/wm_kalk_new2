import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Calculator, Loader2, RotateCw, TrendingDown, TrendingUp, ChevronDown, ChevronRight, Search } from 'lucide-react';
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
        <Button variant="outline" size="sm" onClick={recomputeAll} disabled={recomputing} className="ml-auto" data-testid="recompute-all-btn" title="Пересчитать все тех.карты">
          {recomputing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCw className="w-4 h-4 mr-1" />}
          Пересчитать всё
        </Button>
      </div>

      <div className="space-y-2" data-testid="tech-cards-list">
        {/* MODELS */}
        {filteredModels.length > 0 && <SectionHeader title="Модели саун" />}
        {filteredModels.map((m) => {
          const modelCard = findCard('model', m.id);
          const isExpanded = !!expanded[m.id];
          return (
            <div key={m.id} className="border rounded-md bg-card overflow-hidden">
              <TargetRow
                title={m.name}
                subtitle={`Базовая цена ${fmtMoney(m.basePrice)}`}
                retail={m.basePrice}
                card={modelCard}
                onClick={() => setTarget({ scope: 'model', modelId: m.id, name: m.name, retailPrice: m.basePrice })}
                onToggle={(m.variants || []).length > 0 ? () => setExpanded({ ...expanded, [m.id]: !isExpanded }) : null}
                expanded={isExpanded}
              />
              {isExpanded && (m.variants || []).map((v) => {
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
                  />
                );
              })}
            </div>
          );
        })}

        {/* OPTIONS */}
        {allOptions.length > 0 && <SectionHeader title="Опции" className="pt-3" />}
        {allOptions.map((o) => {
          const optCard = findCard('option', '', '', o.id);
          const hasVariants = (o.variants || []).length > 0;
          const isExpanded = !!expanded[`opt-${o.id}`];
          return (
            <div key={o.id} className="border rounded-md bg-card overflow-hidden">
              <TargetRow
                title={o.name}
                subtitle={`${o._catName ? o._catName + ' · ' : ''}${fmtMoney(o.price)}`}
                retail={o.price}
                card={optCard}
                onClick={() => setTarget({ scope: 'option', optionId: o.id, name: o.name, retailPrice: o.price })}
                onToggle={hasVariants ? () => setExpanded({ ...expanded, [`opt-${o.id}`]: !isExpanded }) : null}
                expanded={isExpanded}
              />
              {isExpanded && (o.variants || []).map((ov) => {
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

function TargetRow({ title, subtitle, retail, card, onClick, onToggle, expanded, indent }) {
  const hasCard = !!card?.id;
  const cost = card?.totalCost || 0;
  const margin = card?.marginAmount;
  const marginPct = card?.marginPct;
  const lowMargin = marginPct !== null && marginPct !== undefined && marginPct < 15;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 hover:bg-slate-50/70 border-t first:border-t-0 ${indent ? 'bg-slate-50/30 pl-6' : ''}`} data-testid={`target-row-${(card?.id || title).slice(0,20)}`}>
      {onToggle ? (
        <button onClick={onToggle} className="text-slate-400 hover:text-slate-700 -ml-1">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      ) : <span className="w-3" />}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
        <div className="text-sm font-medium truncate">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <div className="text-right">
        {hasCard ? (
          <div>
            <div className="text-sm font-bold text-orange-600 font-mono">{fmtMoney(cost)}</div>
            {marginPct !== null && marginPct !== undefined && (
              <div className={`text-[11px] font-mono ${lowMargin ? 'text-red-600' : 'text-emerald-700'} inline-flex items-center gap-0.5 justify-end`}>
                {lowMargin ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                маржа {marginPct.toFixed(1)}%
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">нет тех.карты</span>
        )}
      </div>
      <Button size="sm" variant={hasCard ? 'outline' : 'default'} onClick={onClick} className={hasCard ? '' : 'bg-orange-500 hover:bg-orange-600'} data-testid={`tech-card-open-${title.replace(/\s+/g,'-').slice(0,30)}`}>
        <Calculator className="w-3.5 h-3.5 mr-1" />
        {hasCard ? 'Открыть' : 'Создать'}
      </Button>
    </div>
  );
}
