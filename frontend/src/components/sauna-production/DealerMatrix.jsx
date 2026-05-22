import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Loader2, AlertTriangle, Search, Download, Wand2, Pencil, Check, X as XIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { toast } from 'sonner';
import { API, authHeaders, fmtMoney } from './costConstants';

const VAT = 0.23;

/**
 * DealerMatrix — таблица для контроля цен конкретного дилера.
 *
 *   "Себестоимость" дилера = цена WM → Дилер (B2B brutto).
 *   "Розница" дилера       = dealerRetailPrice.
 *   Маржа                  = розница netto − B2B netto.
 *
 * Полезно: открыть таблицу, посмотреть «если дилер продаёт по таким ценам,
 * он заработает столько», скорректировать его розницу или WM→B2B,
 * экспортнуть в CSV и переслать ему.
 */
export default function DealerMatrix() {
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState(null);
  const [dealers, setDealers] = useState([]);
  const [dealerId, setDealerId] = useState('');
  const [dealerOverrides, setDealerOverrides] = useState([]);
  const [dealerLoading, setDealerLoading] = useState(false);

  // фильтры
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [onlyMissing, setOnlyMissing] = useState(false);

  // EUR-конвертация: курс PLN per 1 EUR. Хранится в localStorage. При смене
  // дилера подставляется его dealer.eurRate, если задан.
  const [eurRate, setEurRate] = useState(() => {
    const v = parseFloat(localStorage.getItem('dm_eur_rate') || '');
    return Number.isFinite(v) && v > 0 ? v : 4.30;
  });
  useEffect(() => {
    if (Number.isFinite(eurRate) && eurRate > 0) {
      localStorage.setItem('dm_eur_rate', String(eurRate));
    }
  }, [eurRate]);
  const showEur = Number.isFinite(eurRate) && eurRate > 0;
  const toEur = (pln) => (pln == null || !showEur ? null : pln / eurRate);
  const fmtEur = (eur) => (eur == null ? '—' : `${eur.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);

  // primary load
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [p, d] = await Promise.all([
          axios.get(`${API}/api/sauna/prices`),
          axios.get(`${API}/api/admin/dealers`, { headers: authHeaders() }).catch(() => ({ data: { dealers: [] } })),
        ]);
        setPrices(p.data || {});
        const ds = d.data?.dealers || d.data?.items || [];
        setDealers(ds);
        // Auto-pick first dealer for convenience
        if (ds.length > 0 && !dealerId) setDealerId(ds[0].id);
      } catch (_e) {
        toast.error('Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOverrides = async () => {
    if (!dealerId) {
      setDealerOverrides([]);
      return;
    }
    setDealerLoading(true);
    try {
      const r = await axios.get(`${API}/api/admin/dealers/${dealerId}/overrides`, { headers: authHeaders() });
      setDealerOverrides(r.data?.overrides || []);
    } catch (_e) {
      toast.error('Не удалось загрузить цены дилера');
      setDealerOverrides([]);
    } finally {
      setDealerLoading(false);
    }
  };

  useEffect(() => { loadOverrides(); /* eslint-disable-next-line */ }, [dealerId]);

  const dealerByKey = useMemo(() => {
    const m = new Map();
    dealerOverrides.forEach((o) => {
      const k = [o.kind, o.modelId || '', o.variantId || '', o.optionId || '', o.optionVariantId || ''].join('|');
      m.set(k, o);
    });
    return m;
  }, [dealerOverrides]);

  const rows = useMemo(() => {
    if (!prices) return [];
    const out = [];
    const make = (kind, name, parent, retailBrutto, ids) => {
      let dealerKind = kind;
      if (kind === 'variant') dealerKind = 'model_variant';
      const dealerKey = [dealerKind, ids.modelId || '', ids.variantId || '', ids.optionId || '', ids.optionVariantId || ''].join('|');
      const dr = dealerByKey.get(dealerKey);
      const b2bBrutto = dr && dr.price != null ? Number(dr.price) : null;
      const b2bNetto = b2bBrutto != null ? b2bBrutto / (1 + VAT) : null;
      const dealerRetail = dr && dr.dealerRetailPrice != null ? Number(dr.dealerRetailPrice) : null;
      const dealerRetailNetto = dealerRetail != null ? dealerRetail / (1 + VAT) : null;
      const margin = (dealerRetailNetto != null && b2bNetto != null) ? (dealerRetailNetto - b2bNetto) : null;
      const marginPct = (margin != null && dealerRetailNetto && dealerRetailNetto > 0) ? (margin / dealerRetailNetto) * 100 : null;
      // markup % over B2B: (retail − b2b) / b2b
      const markupPct = (b2bBrutto && b2bBrutto > 0 && dealerRetail != null) ? ((dealerRetail / b2bBrutto - 1) * 100) : null;
      // discount от WM розницы
      const discountFromWmPct = (retailBrutto > 0 && b2bBrutto != null) ? Math.max(0, (1 - b2bBrutto / retailBrutto) * 100) : null;
      // подсветка проблем
      const noB2B = b2bBrutto == null;
      const noRetail = dealerRetail == null;
      const negative = margin != null && margin < 0;
      const underWm = (dealerRetail != null && retailBrutto > 0 && dealerRetail < retailBrutto);
      const isMissing = noB2B || noRetail || negative || underWm;

      out.push({
        kind, name, parent, ids,
        wmRetailBrutto: retailBrutto,
        b2bBrutto, b2bNetto, dealerRetail, dealerRetailNetto,
        margin, marginPct, markupPct, discountFromWmPct,
        flags: { noB2B, noRetail, negative, underWm },
        isMissing,
      });
    };

    (prices.models || []).forEach((m) => {
      const variants = m.variants || [];
      if (!variants.length) make('model', m.name, '', Number(m.basePrice || 0), { modelId: m.id });
      variants.forEach((v) => {
        make('variant', `${m.name} → ${v.name || v.namePl || v.id}`, m.name,
          Number(m.basePrice || 0) + Number(v.price || 0),
          { modelId: m.id, variantId: v.id });
      });
    });
    const flatOpts = [];
    (prices.options || []).forEach((o) => flatOpts.push({ ...o, _catName: '' }));
    (prices.categories || []).forEach((cat) => {
      (cat.options || []).forEach((o) => flatOpts.push({ ...o, _catName: cat.name }));
    });
    flatOpts.forEach((o) => {
      const namePrefix = o._catName ? `[${o._catName}] ` : '';
      const optHasVariants = (o.variants || []).length > 0;
      if (!optHasVariants) make('option', `${namePrefix}${o.name || o.namePl}`, '', Number(o.price || 0), { optionId: o.id });
      (o.variants || []).forEach((v) => {
        make('option_variant',
          `${namePrefix}${o.name || o.namePl} → ${v.name || v.namePl}`,
          o.name,
          Number(o.price || 0) + Number(v.price || 0),
          { optionId: o.id, optionVariantId: v.id });
      });
    });
    return out;
  }, [prices, dealerByKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== 'all' && r.kind !== typeFilter) return false;
      if (onlyMissing && !r.isMissing) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, typeFilter, onlyMissing]);

  // KPIs
  const stats = useMemo(() => {
    const total = rows.length;
    const noB2B = rows.filter((r) => r.flags.noB2B).length;
    const noRetail = rows.filter((r) => r.flags.noRetail).length;
    const negative = rows.filter((r) => r.flags.negative).length;
    const underWm = rows.filter((r) => r.flags.underWm).length;
    // total potential earnings if dealer sells everything (sum of margins, only where both are set)
    const totalMargin = rows.reduce((s, r) => s + (r.margin != null ? r.margin : 0), 0);
    return { total, noB2B, noRetail, negative, underWm, totalMargin };
  }, [rows]);

  const dealer = useMemo(() => dealers.find((d) => d.id === dealerId), [dealers, dealerId]);
  // Auto-apply dealer's own EUR rate when picking a dealer that has one.
  useEffect(() => {
    if (!dealer) return;
    const r = dealer.eurRate ? parseFloat(dealer.eurRate) : null;
    if (Number.isFinite(r) && r > 0) setEurRate(r);
  }, [dealer]);

  // --- inline edits ---
  const saveDealerB2B = async (row, newB2B) => {
    if (!dealerId) return;
    let kind = row.kind;
    if (kind === 'variant') kind = 'model_variant';
    await axios.post(`${API}/api/admin/dealers/${dealerId}/overrides/upsert`,
      { overrides: [{ kind, ...row.ids, price: Math.max(0, Math.round(Number(newB2B) || 0)) }] },
      { headers: authHeaders() });
    toast.success('B2B-цена обновлена');
    await loadOverrides();
  };
  const saveDealerRetail = async (row, newRetail) => {
    if (!dealerId) return;
    let kind = row.kind;
    if (kind === 'variant') kind = 'model_variant';
    await axios.post(`${API}/api/admin/dealers/${dealerId}/overrides/upsert`,
      { overrides: [{ kind, ...row.ids, dealerRetailPrice: Math.max(0, Math.round(Number(newRetail) || 0)) }] },
      { headers: authHeaders() });
    toast.success('Розница дилера обновлена');
    await loadOverrides();
  };

  // --- bulk: applyMarkupPct ---
  const [markupPct, setMarkupPct] = useState(30);
  const [applyOpen, setApplyOpen] = useState(false);
  const applyMarkup = async () => {
    const eligible = rows.filter((r) => r.b2bBrutto != null);
    if (!eligible.length) {
      toast.error('Нет позиций с B2B-ценой');
      return;
    }
    const overrides = eligible.map((r) => {
      let kind = r.kind;
      if (kind === 'variant') kind = 'model_variant';
      const newRetail = Math.round((r.b2bBrutto || 0) * (1 + Number(markupPct) / 100));
      return { kind, ...r.ids, dealerRetailPrice: newRetail };
    });
    try {
      await axios.post(`${API}/api/admin/dealers/${dealerId}/overrides/upsert`,
        { overrides }, { headers: authHeaders() });
      toast.success(`Розница дилера установлена для ${overrides.length} позиций (+${markupPct}% к B2B)`);
      setApplyOpen(false);
      await loadOverrides();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка применения наценки');
    }
  };

  // --- CSV export ---
  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.error('Нечего экспортировать');
      return;
    }
    const dealerLabel = dealer?.name || dealer?.username || dealerId;
    const headers = [
      'Тип', 'Название',
      'WM розница brutto', 'Скидка от WM %',
      'Себестоимость дилера (B2B brutto)', 'B2B netto',
      ...(showEur ? ['B2B brutto €', 'B2B netto €'] : []),
      'Розница дилера brutto', 'Розница дилера netto',
      ...(showEur ? ['Розница дилера €'] : []),
      'Markup дилера %', 'Маржа', 'Маржа %',
      'Проблемы',
    ];
    const esc = (v) => {
      const s = String(v ?? '');
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const kindLabel = { model: 'Модель', variant: 'Вариант', option: 'Опция', option_variant: 'Вар.опции' };
    const eurNum = (pln) => {
      const v = toEur(pln);
      return v == null ? '' : v.toFixed(2);
    };
    const lines = [
      `Прайс-лист дилера: ${dealerLabel}`,
      ...(showEur ? [`Курс EUR/PLN: ${eurRate.toFixed(4)}`] : []),
      '',
      headers.map(esc).join(';'),
    ];
    for (const r of filtered) {
      const row = [
        kindLabel[r.kind] || r.kind,
        r.name,
        Math.round(r.wmRetailBrutto),
        r.discountFromWmPct != null ? r.discountFromWmPct.toFixed(1) : '',
        r.b2bBrutto != null ? Math.round(r.b2bBrutto) : '',
        r.b2bNetto != null ? Math.round(r.b2bNetto) : '',
        ...(showEur ? [eurNum(r.b2bBrutto), eurNum(r.b2bNetto)] : []),
        r.dealerRetail != null ? Math.round(r.dealerRetail) : '',
        r.dealerRetailNetto != null ? Math.round(r.dealerRetailNetto) : '',
        ...(showEur ? [eurNum(r.dealerRetail)] : []),
        r.markupPct != null ? r.markupPct.toFixed(1) : '',
        r.margin != null ? Math.round(r.margin) : '',
        r.marginPct != null ? r.marginPct.toFixed(1) : '',
      ];
      const probs = [];
      if (r.flags.noB2B) probs.push('нет B2B');
      if (r.flags.noRetail) probs.push('нет розницы');
      if (r.flags.negative) probs.push('убыток');
      if (r.flags.underWm) probs.push('ниже WM розницы');
      row.push(probs.join(', '));
      lines.push(row.map(esc).join(';'));
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = (dealerLabel || 'dealer').toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-|-$/g, '');
    a.href = url;
    a.download = `dealer-matrix-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Экспортировано: ${filtered.length} строк`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Загрузка матрицы дилера…
      </div>
    );
  }

  if (dealers.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
          Нет ни одного дилера. Создайте дилера в разделе Дилеры, чтобы пользоваться матрицей.
        </CardContent>
      </Card>
    );
  }

  const kindBadge = (kind) => {
    const map = {
      model: { label: 'Модель', cls: 'bg-blue-100 text-blue-800' },
      variant: { label: 'Вариант', cls: 'bg-cyan-100 text-cyan-800' },
      option: { label: 'Опция', cls: 'bg-purple-100 text-purple-800' },
      option_variant: { label: 'Вар.опции', cls: 'bg-fuchsia-100 text-fuchsia-800' },
    };
    const k = map[kind] || { label: kind, cls: 'bg-gray-100' };
    return <Badge className={`${k.cls} font-normal`}>{k.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3">
          <div className="text-[11px] text-muted-foreground">Всего позиций</div>
          <div className="text-xl font-semibold" data-testid="dm-stat-total">{stats.total}</div>
        </CardContent></Card>
        <Card className={stats.noB2B > 0 ? 'border-orange-300 bg-orange-50/40' : ''}>
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">Без B2B-цены</div>
            <div className={`text-xl font-semibold ${stats.noB2B > 0 ? 'text-orange-700' : ''}`} data-testid="dm-stat-no-b2b">{stats.noB2B}</div>
          </CardContent>
        </Card>
        <Card className={stats.noRetail > 0 ? 'border-yellow-300 bg-yellow-50/40' : ''}>
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">Без розницы дилера</div>
            <div className={`text-xl font-semibold ${stats.noRetail > 0 ? 'text-yellow-700' : ''}`} data-testid="dm-stat-no-retail">{stats.noRetail}</div>
          </CardContent>
        </Card>
        <Card className={stats.underWm > 0 ? 'border-red-300 bg-red-50/40' : ''}>
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">Демпинг (ниже WM)</div>
            <div className={`text-xl font-semibold ${stats.underWm > 0 ? 'text-red-700' : ''}`} data-testid="dm-stat-under-wm">{stats.underWm}</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">Потенциал дохода дилера</div>
            <div className="text-xl font-semibold text-emerald-700" data-testid="dm-stat-total-margin">{fmtMoney(stats.totalMargin)}</div>
            <div className="text-[10px] text-muted-foreground">если продаст всю матрицу</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Матрица дилера
            {dealer && <Badge variant="outline">{dealer.name || dealer.username}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={dealerId} onValueChange={setDealerId}>
              <SelectTrigger className="w-[260px] h-9" data-testid="dm-dealer-select">
                <SelectValue placeholder="Выберите дилера" />
              </SelectTrigger>
              <SelectContent>
                {dealers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name || d.username || d.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5 px-3 h-9 rounded-md border bg-background" title="Курс PLN за 1 EUR. При выборе дилера с заданным курсом подставится автоматически.">
              <Label htmlFor="dm-eur-rate" className="text-xs">€/zł</Label>
              <Input
                id="dm-eur-rate"
                type="text"
                inputMode="decimal"
                value={eurRate}
                onChange={(e) => {
                  const raw = e.target.value.replace(',', '.').replace(/[^\d.]/g, '');
                  const v = parseFloat(raw);
                  setEurRate(Number.isFinite(v) ? v : 0);
                }}
                placeholder="4.30"
                className="h-7 w-[80px] text-sm"
                data-testid="dm-eur-rate"
              />
            </div>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по названию…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
                data-testid="dm-search"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px] h-9" data-testid="dm-type-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value="model">Модели</SelectItem>
                <SelectItem value="variant">Варианты</SelectItem>
                <SelectItem value="option">Опции</SelectItem>
                <SelectItem value="option_variant">Вар.опций</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 px-3 h-9 rounded-md border bg-background">
              <Switch
                id="dm-only-missing"
                checked={onlyMissing}
                onCheckedChange={setOnlyMissing}
                data-testid="dm-only-missing"
              />
              <Label htmlFor="dm-only-missing" className="text-xs cursor-pointer">Только пробелы</Label>
            </div>

            <Popover open={applyOpen} onOpenChange={setApplyOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 border-purple-300 text-purple-800 hover:bg-purple-50" data-testid="dm-bulk-markup">
                  <Wand2 className="h-4 w-4" />
                  Наценка ко всем
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3" align="end">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Установить розницу дилера = B2B + N%</div>
                  <p className="text-[11px] text-muted-foreground">
                    Применится ко всем позициям с заданной B2B-ценой ({rows.filter((r) => r.b2bBrutto != null).length} шт.).
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">B2B +</span>
                    <Input
                      type="number"
                      min={0}
                      max={500}
                      value={markupPct}
                      onChange={(e) => setMarkupPct(Math.max(0, Math.min(500, Number(e.target.value) || 0)))}
                      className="h-8 w-20 text-right font-mono"
                      data-testid="dm-bulk-markup-input"
                    />
                    <span className="text-xs">%</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[15, 20, 25, 30, 40, 50].map((v) => (
                      <button
                        key={v}
                        onClick={() => setMarkupPct(v)}
                        className={`text-[11px] px-2 py-0.5 rounded border ${markupPct === v ? 'bg-purple-100 border-purple-400 text-purple-800 font-semibold' : 'hover:bg-purple-50'}`}
                        data-testid={`dm-bulk-markup-preset-${v}`}
                      >+{v}%</button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-1 pt-1">
                    <Button variant="ghost" size="sm" onClick={() => setApplyOpen(false)}>Отмена</Button>
                    <Button size="sm" onClick={applyMarkup} data-testid="dm-bulk-markup-apply">Применить</Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button onClick={exportCsv} variant="outline" size="sm" className="h-9 gap-1.5" data-testid="dm-export-csv">
              <Download className="h-4 w-4" />
              CSV для дилера
            </Button>

            <div className="text-xs text-muted-foreground ml-auto">
              {filtered.length} из {rows.length}
              {dealerLoading && <Loader2 className="inline ml-2 h-3 w-3 animate-spin" />}
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[110px]">Тип</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead className="text-right text-muted-foreground">WM розница</TableHead>
                  <TableHead className="text-right">Скидка от WM</TableHead>
                  <TableHead className="text-right border-l-2">Себест. дилера (B2B)</TableHead>
                  {showEur && <TableHead className="text-right text-blue-700">B2B brutto €</TableHead>}
                  {showEur && <TableHead className="text-right text-blue-700">B2B netto €</TableHead>}
                  <TableHead className="text-right">Розница дилера</TableHead>
                  {showEur && <TableHead className="text-right text-blue-700">Розница €</TableHead>}
                  <TableHead className="text-right">Markup</TableHead>
                  <TableHead className="text-right">Маржа дилера</TableHead>
                  <TableHead className="text-center w-[160px]">Проблемы</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9 + (showEur ? 3 : 0)} className="text-center py-8 text-muted-foreground">
                      Ничего не найдено
                    </TableCell>
                  </TableRow>
                ) : filtered.map((r, idx) => (
                  <TableRow
                    key={idx}
                    className={
                      r.flags.negative ? 'bg-red-50/40'
                        : r.flags.underWm ? 'bg-red-50/20'
                        : (r.isMissing ? 'bg-amber-50/30' : '')
                    }
                    data-testid={`dm-row-${idx}`}
                  >
                    <TableCell>{kindBadge(r.kind)}</TableCell>
                    <TableCell className="font-medium text-sm">{r.name}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {r.wmRetailBrutto > 0 ? fmtMoney(r.wmRetailBrutto) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.discountFromWmPct != null ? (
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded-md text-xs font-semibold ${
                            r.discountFromWmPct >= 30 ? 'bg-emerald-100 text-emerald-800'
                              : r.discountFromWmPct >= 15 ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >−{r.discountFromWmPct.toFixed(1)}%</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className={`text-right text-sm border-l-2 ${r.flags.noB2B ? 'text-orange-700 font-semibold' : ''}`}>
                      <InlineNum
                        value={r.b2bBrutto}
                        onSave={(v) => saveDealerB2B(r, v)}
                        label={`B2B brutto · ${r.name}`}
                        testId={`dm-edit-b2b-${idx}`}
                        emptyHint="+ B2B"
                      />
                    </TableCell>
                    {showEur && (
                      <TableCell
                        className="text-right text-sm text-blue-700"
                        title={r.b2bBrutto != null ? `B2B brutto / ${eurRate.toFixed(4)}` : 'Нет B2B-цены'}
                        data-testid={`dm-b2b-brutto-eur-${idx}`}
                      >
                        {fmtEur(toEur(r.b2bBrutto))}
                      </TableCell>
                    )}
                    {showEur && (
                      <TableCell
                        className="text-right text-sm text-blue-700"
                        title={r.b2bNetto != null ? `B2B netto / ${eurRate.toFixed(4)}` : 'Нет B2B-цены'}
                        data-testid={`dm-b2b-netto-eur-${idx}`}
                      >
                        {fmtEur(toEur(r.b2bNetto))}
                      </TableCell>
                    )}
                    <TableCell className={`text-right text-sm ${r.flags.noRetail ? 'text-yellow-700 font-semibold' : (r.flags.underWm ? 'text-red-700 font-semibold' : '')}`}>
                      <InlineNum
                        value={r.dealerRetail}
                        onSave={(v) => saveDealerRetail(r, v)}
                        label={`Розница дилера · ${r.name}`}
                        helper={r.wmRetailBrutto > 0 ? `Рекомендуем ≥ ${fmtMoney(r.wmRetailBrutto)} (наша розница)` : ''}
                        testId={`dm-edit-retail-${idx}`}
                        emptyHint="+ розница"
                      />
                    </TableCell>
                    {showEur && (
                      <TableCell
                        className="text-right text-sm text-blue-700"
                        title={r.dealerRetail != null ? `Розница / ${eurRate.toFixed(4)}` : 'Нет розницы'}
                        data-testid={`dm-retail-eur-${idx}`}
                      >
                        {fmtEur(toEur(r.dealerRetail))}
                      </TableCell>
                    )}
                    <TableCell className="text-right text-sm">
                      {r.markupPct != null ? (
                        <span className={`text-xs font-mono ${
                          r.markupPct < 10 ? 'text-amber-700' : 'text-emerald-700'
                        }`}>+{r.markupPct.toFixed(0)}%</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className={`text-right text-sm font-semibold ${
                      r.margin == null ? 'text-muted-foreground'
                        : r.margin < 0 ? 'text-red-700'
                        : (r.marginPct != null && r.marginPct < 10) ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}>
                      {r.margin != null ? (
                        <span>
                          {fmtMoney(r.margin)}
                          {r.marginPct != null && <span className="ml-1 text-[10px] opacity-80">({r.marginPct.toFixed(0)}%)</span>}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        {r.flags.noB2B && <Badge className="bg-orange-100 text-orange-800 text-[10px] font-normal">нет B2B</Badge>}
                        {r.flags.noRetail && <Badge className="bg-yellow-100 text-yellow-800 text-[10px] font-normal">нет розницы</Badge>}
                        {r.flags.negative && <Badge className="bg-red-100 text-red-800 text-[10px] font-normal">убыток</Badge>}
                        {r.flags.underWm && <Badge className="bg-red-100 text-red-800 text-[10px] font-normal">демпинг</Badge>}
                        {!r.isMissing && <span className="text-emerald-600 text-[11px]">✓</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Тонкий клиентский inline-edit поповер на одно число. */
function InlineNum({ value, onSave, label, helper, testId, emptyHint = '—' }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value || '');
  useEffect(() => { if (open) setDraft(value || ''); }, [open, value]);
  const isEmpty = value == null || value === 0;
  const submit = async (e) => {
    e?.preventDefault?.();
    await onSave(Number(draft) || 0);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`group inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-blue-50 hover:text-blue-700 transition-colors ${
            isEmpty ? 'text-muted-foreground italic underline decoration-dashed underline-offset-2' : ''
          }`}
          data-testid={testId}
        >
          <span>{isEmpty ? emptyHint : fmtMoney(value)}</span>
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <form onSubmit={submit} className="space-y-2">
          <div className="text-xs font-medium">{label}</div>
          {helper && <div className="text-[11px] text-muted-foreground">{helper}</div>}
          <div className="flex items-center gap-2">
            <Input
              autoFocus type="number" min={0} step="1"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-8 text-right font-mono"
              data-testid={`${testId}-input`}
            />
            <span className="text-xs text-muted-foreground">zł</span>
          </div>
          <div className="flex justify-end gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              <XIcon className="h-3.5 w-3.5" />
            </Button>
            <Button type="submit" size="sm" className="gap-1" data-testid={`${testId}-save`}>
              <Check className="h-3.5 w-3.5" /> Сохранить
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
