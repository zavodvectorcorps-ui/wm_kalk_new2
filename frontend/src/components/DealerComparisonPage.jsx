import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Loader2, Search, TrendingDown, TrendingUp, Minus, Download } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { toast } from 'sonner';
import { getApiUrl } from '../utils/api';

const API = getApiUrl();
const authHeaders = () => {
  const t = localStorage.getItem('authToken');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const KIND_LABELS = {
  model: 'Модель',
  model_variant: 'Вариант',
  option: 'Опция',
  option_variant: 'Вар. опции',
};

const fmt = (n) => (n === null || n === undefined ? '—' : Math.round(Number(n)).toLocaleString('ru-RU') + ' zł');

/**
 * Dealer pricing comparison: catalog rows × all dealers, with color cues
 * (green = cheaper than retail, red = more expensive, gray = no override).
 */
export default function DealerComparisonPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [onlyWithOverrides, setOnlyWithOverrides] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/api/admin/dealers/comparison`, { headers: authHeaders() });
        setData(r.data);
      } catch (e) {
        toast.error('Ошибка загрузки');
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    if (kindFilter) rows = rows.filter((r) => r.kind === kindFilter);
    if (onlyWithOverrides) rows = rows.filter((r) => r.overrideCount > 0);
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter((r) => (r.name || '').toLowerCase().includes(s));
    }
    return rows;
  }, [data, search, kindFilter, onlyWithOverrides]);

  const exportCsv = () => {
    if (!data) return;
    const header = ['Тип', 'Позиция', 'Розница (brutto)', ...data.dealers.map((d) => d.name)];
    const lines = [header.join(';')];
    for (const r of filtered) {
      const row = [
        KIND_LABELS[r.kind] || r.kind,
        `"${(r.name || '').replace(/"/g, '""')}"`,
        r.retailBrutto,
        ...r.dealers.map((d) => d.price ?? ''),
      ];
      lines.push(row.join(';'));
    }
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `dealer_prices_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>;
  if (!data) return null;

  return (
    <div className="space-y-3" data-testid="dealer-comparison-page">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по моделям и опциям..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
            data-testid="comparison-search"
          />
        </div>
        <Select value={kindFilter || '__all__'} onValueChange={(v) => setKindFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Тип" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Все типы</SelectItem>
            <SelectItem value="model">Модели</SelectItem>
            <SelectItem value="model_variant">Варианты моделей</SelectItem>
            <SelectItem value="option">Опции</SelectItem>
            <SelectItem value="option_variant">Варианты опций</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={onlyWithOverrides ? 'default' : 'outline'}
          size="sm"
          className={`h-9 ${onlyWithOverrides ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
          onClick={() => setOnlyWithOverrides(!onlyWithOverrides)}
          data-testid="comparison-only-overrides"
        >
          Только с overrides
        </Button>
        <Button variant="outline" size="sm" className="h-9 ml-auto" onClick={exportCsv} data-testid="comparison-export-csv">
          <Download className="w-4 h-4 mr-1" />CSV
        </Button>
      </div>

      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
        <span><b className="text-foreground">{filtered.length}</b> из {data.totalRows} позиций</span>
        <span><b className="text-foreground">{data.dealers.length}</b> активных дилеров</span>
        <Legend />
      </div>

      <div className="border rounded-lg bg-card overflow-auto max-h-[70vh]" data-testid="comparison-table-wrap">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr className="text-left">
              <th className="px-2 py-2 w-24">Тип</th>
              <th className="px-2 py-2">Позиция</th>
              <th className="px-2 py-2 w-28 text-right">Розница</th>
              {data.dealers.map((d) => (
                <th key={d.id} className="px-2 py-2 w-28 text-right" title={d.username}>{d.name}</th>
              ))}
              <th className="px-2 py-2 w-20 text-right" title="Минимальная дилерская цена">Min</th>
              <th className="px-2 py-2 w-20 text-right" title="Средняя дилерская цена">Avg</th>
              <th className="px-2 py-2 w-20 text-right" title="Максимальная дилерская цена">Max</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={4 + data.dealers.length + 3} className="px-3 py-8 text-center text-muted-foreground">Ничего не найдено</td></tr>
            ) : filtered.map((r) => (
              <Row key={`${r.kind}|${r.modelId || ''}|${r.variantId || ''}|${r.optionId || ''}|${r.optionVariantId || ''}`} r={r} dealers={data.dealers} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ r, dealers }) {
  return (
    <tr className="border-t hover:bg-slate-50/70">
      <td className="px-2 py-1.5">
        <Badge variant="outline" className="text-[10px]">{KIND_LABELS[r.kind] || r.kind}</Badge>
      </td>
      <td className="px-2 py-1.5">{r.name}</td>
      <td className="px-2 py-1.5 text-right font-mono font-semibold">{fmt(r.retailBrutto)}</td>
      {dealers.map((d) => {
        const cell = r.dealers.find((x) => x.dealerId === d.id);
        return <DealerCell key={d.id} price={cell?.price} retail={r.retailBrutto} />;
      })}
      <td className="px-2 py-1.5 text-right font-mono text-emerald-700">{fmt(r.minDealerPrice)}</td>
      <td className="px-2 py-1.5 text-right font-mono">{fmt(r.avgDealerPrice)}</td>
      <td className="px-2 py-1.5 text-right font-mono text-red-700">{fmt(r.maxDealerPrice)}</td>
    </tr>
  );
}

function DealerCell({ price, retail }) {
  if (price === null || price === undefined) {
    return (
      <td className="px-2 py-1.5 text-right text-slate-400 font-mono" title="По базовой розничной цене">
        <span className="inline-flex items-center gap-0.5 justify-end"><Minus className="w-3 h-3" />база</span>
      </td>
    );
  }
  const isCheaper = price < retail;
  const isMore = price > retail;
  const ratio = retail > 0 ? price / retail : 1;
  const discountPct = retail > 0 ? ((1 - ratio) * 100) : 0;

  // Color intensity based on discount/markup magnitude
  let bg = '';
  let color = '';
  if (isCheaper) {
    if (discountPct >= 30) bg = 'bg-emerald-200';
    else if (discountPct >= 15) bg = 'bg-emerald-100';
    else bg = 'bg-emerald-50';
    color = 'text-emerald-800';
  } else if (isMore) {
    if (-discountPct >= 30) bg = 'bg-red-200';
    else if (-discountPct >= 15) bg = 'bg-red-100';
    else bg = 'bg-red-50';
    color = 'text-red-800';
  }

  return (
    <td className={`px-2 py-1.5 text-right font-mono ${bg} ${color}`} title={`${discountPct >= 0 ? 'Скидка' : 'Наценка'} ${Math.abs(discountPct).toFixed(1)}% от розницы`}>
      <span className="inline-flex items-center gap-0.5 justify-end">
        {isCheaper && <TrendingDown className="w-3 h-3" />}
        {isMore && <TrendingUp className="w-3 h-3" />}
        {fmt(price)}
      </span>
    </td>
  );
}

function Legend() {
  return (
    <span className="inline-flex items-center gap-2 text-[11px]">
      <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">дешевле</span>
      <span className="inline-block px-1.5 py-0.5 rounded bg-red-100 text-red-800">дороже</span>
      <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">база</span>
    </span>
  );
}
