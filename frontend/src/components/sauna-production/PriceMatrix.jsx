import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Loader2, AlertTriangle, Search, Download, Pencil, Check, X as XIcon } from 'lucide-react';
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
import { API, COST_BASE, authHeaders, fmtMoney } from './costConstants';

const VAT = 0.23;

/**
 * PriceMatrix — единая таблица «Себестоимость / Розница / Дилер» по всем
 * моделям, вариантам, опциям, и вариантам опций. Позволяет за один взгляд
 * найти пустые ячейки (нет тех.карты, нет розничной цены, нет дилерского
 * оверрайда) и быстро посчитать маржи.
 *
 * Источники данных:
 *  - /api/sauna/prices           — модели/варианты/опции и их розничные brutto
 *  - /api/sauna-production/cost/tech-cards — себестоимость netto + retailExtra
 *  - /api/admin/dealers          — для дропдауна выбора дилера
 *  - /api/admin/dealers/{id}/overrides — B2B-цены конкретного дилера
 */
export default function PriceMatrix() {
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState(null);
  const [cards, setCards] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [dealerId, setDealerId] = useState('');
  const [dealerOverrides, setDealerOverrides] = useState([]);
  const [dealerLoading, setDealerLoading] = useState(false);

  // фильтры
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all | model | variant | option | option_variant
  const [onlyMissing, setOnlyMissing] = useState(false);

  // первичная загрузка
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [p, c, d] = await Promise.all([
          axios.get(`${API}/api/sauna/prices`),
          axios.get(`${COST_BASE}/tech-cards`, { headers: authHeaders() }),
          axios.get(`${API}/api/admin/dealers`, { headers: authHeaders() }).catch(() => ({ data: { dealers: [] } })),
        ]);
        setPrices(p.data || {});
        setCards(c.data?.items || []);
        setDealers(d.data?.dealers || d.data?.items || []);
      } catch (e) {
        toast.error('Ошибка загрузки прайс-матрицы');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // подгрузить B2B-оверрайды выбранного дилера
  useEffect(() => {
    if (!dealerId) {
      setDealerOverrides([]);
      return;
    }
    (async () => {
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
    })();
  }, [dealerId]);

  // карта тех.карт по составному ключу
  const cardByKey = useMemo(() => {
    const m = new Map();
    cards.forEach((c) => {
      m.set(
        [c.scope, c.modelId || '', c.variantId || '', c.optionId || '', c.optionVariantId || ''].join('|'),
        c,
      );
    });
    return m;
  }, [cards]);

  // карта дилерских оверрайдов
  const dealerByKey = useMemo(() => {
    const m = new Map();
    dealerOverrides.forEach((o) => {
      // map kind → scope-like key
      const kind = o.kind;
      const k = [
        kind,
        o.modelId || '',
        o.variantId || '',
        o.optionId || '',
        o.optionVariantId || '',
      ].join('|');
      m.set(k, o);
    });
    return m;
  }, [dealerOverrides]);

  // строки таблицы (плоский список из моделей/вариантов/опций)
  const rows = useMemo(() => {
    if (!prices) return [];
    const out = [];
    // helper для одной строки
    const make = (kind, name, parent, retailBrutto, scope, ids) => {
      const card = cardByKey.get([scope, ids.modelId || '', ids.variantId || '', ids.optionId || '', ids.optionVariantId || ''].join('|'));
      const cost = Number(card?.totalCost || 0);
      const retailExtra = Number(card?.retailExtraCost || 0);
      const retailNetto = retailBrutto / (1 + VAT);
      const margin = retailNetto - cost - retailExtra;
      const marginPct = retailNetto > 0 ? (margin / retailNetto) * 100 : null;
      // dealer B2B
      // dealer kind mapping: model | model_variant | option | option_variant
      let dealerKind = kind;
      if (kind === 'variant') dealerKind = 'model_variant';
      const dealerKey = [dealerKind, ids.modelId || '', ids.variantId || '', ids.optionId || '', ids.optionVariantId || ''].join('|');
      const dealerRow = dealerByKey.get(dealerKey);
      const dealerB2B = dealerRow && dealerRow.price != null ? Number(dealerRow.price) : null;
      const dealerRetail = dealerRow && dealerRow.dealerRetailPrice != null ? Number(dealerRow.dealerRetailPrice) : null;
      const dealerB2BNetto = dealerB2B != null ? dealerB2B / (1 + VAT) : null;
      // Dealer margin = B2B netto − cost ONLY. Retail extras (доставка
      // клиенту, упаковка, комиссия продавца) к дилеру не относятся —
      // мы продаём ему оптом, доставку он организует сам.
      const dealerMargin = dealerB2B != null ? (dealerB2BNetto - cost) : null;
      const dealerMarginPct = dealerB2BNetto && dealerB2BNetto > 0 ? (dealerMargin / dealerB2BNetto) * 100 : null;
      // Скидка от нашей розницы (brutto vs brutto) — насколько дешевле мы
      // продаём дилеру по сравнению с прямой розничной ценой.
      const dealerDiscountPct = (dealerB2B != null && retailBrutto > 0)
        ? Math.max(0, (1 - dealerB2B / retailBrutto) * 100)
        : null;
      // Рекомендованная цена для дилера = наша розничная brutto
      // (минимум, чтобы дилер нас не демпинговал). Если у дилера задана
      // собственная dealerRetailPrice — мы её тоже покажем рядом для
      // контроля. Считаем "ОК", если он продаёт ≥ нашей розницы.
      const recommendedDealerRetail = retailBrutto > 0 ? retailBrutto : null;
      const dealerRetailUnderscut = (dealerRetail != null && retailBrutto > 0 && dealerRetail < retailBrutto);

      const flags = {
        noCard: !card,
        noRetail: !retailBrutto,
        noDealer: !!dealerId && !dealerRow,
        negative: margin < 0,
      };
      const isMissing = flags.noCard || flags.noRetail || flags.negative || (!!dealerId && flags.noDealer);

      out.push({
        kind, name, parent,
        ids,
        retailBrutto, retailNetto, retailExtra, cost,
        margin, marginPct,
        dealerB2B, dealerB2BNetto, dealerMargin, dealerMarginPct, dealerRetail,
        dealerDiscountPct, recommendedDealerRetail, dealerRetailUnderscut,
        flags, isMissing,
      });
    };

    // модели + варианты
    (prices.models || []).forEach((m) => {
      const hasVariants = (m.variants || []).length > 0;
      // Если у модели есть варианты — сама модель не нуждается в тех.карте,
      // себестоимость берётся по вариантам. Пропускаем строку «model».
      if (!hasVariants) {
        make('model', m.name, '', Number(m.basePrice || 0), 'model', { modelId: m.id });
      }
      (m.variants || []).forEach((v) => {
        make(
          'variant',
          `${m.name} → ${v.name || v.namePl || v.id}`,
          m.name,
          Number(m.basePrice || 0) + Number(v.price || 0),
          'variant',
          { modelId: m.id, variantId: v.id },
        );
      });
    });

    // опции + варианты опций
    const flatOpts = [];
    (prices.options || []).forEach((o) => flatOpts.push({ ...o, _catName: '' }));
    (prices.categories || []).forEach((cat) => {
      (cat.options || []).forEach((o) => flatOpts.push({ ...o, _catName: cat.name }));
    });
    flatOpts.forEach((o) => {
      const namePrefix = o._catName ? `[${o._catName}] ` : '';
      const optHasVariants = (o.variants || []).length > 0;
      // Опции с вариантами тоже не нуждаются в собственной тех.карте —
      // себестоимость берётся по вариантам.
      if (!optHasVariants) {
        make('option', `${namePrefix}${o.name || o.namePl}`, '', Number(o.price || 0), 'option', { optionId: o.id });
      }
      (o.variants || []).forEach((v) => {
        make(
          'option_variant',
          `${namePrefix}${o.name || o.namePl} → ${v.name || v.namePl}`,
          o.name,
          Number(o.price || 0) + Number(v.price || 0),
          'option_variant',
          { optionId: o.id, optionVariantId: v.id },
        );
      });
    });

    return out;
  }, [prices, cardByKey, dealerByKey, dealerId]);

  // применяем фильтры
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== 'all' && r.kind !== typeFilter) return false;
      if (onlyMissing && !r.isMissing) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, typeFilter, onlyMissing]);

  // сводка
  const stats = useMemo(() => {
    const total = rows.length;
    const noCard = rows.filter((r) => r.flags.noCard).length;
    const noRetail = rows.filter((r) => r.flags.noRetail).length;
    const negative = rows.filter((r) => r.flags.negative).length;
    const noDealer = dealerId ? rows.filter((r) => r.flags.noDealer).length : 0;
    return { total, noCard, noRetail, negative, noDealer };
  }, [rows, dealerId]);

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.error('Нечего экспортировать');
      return;
    }
    const dealerLabel = dealerId ? (dealers.find((d) => d.id === dealerId)?.name || dealerId) : '';
    const headers = [
      'Тип', 'Название',
      'Розница brutto', 'Розница netto', 'Накладные',
      'Себестоимость', 'Маржа netto', 'Маржа %',
    ];
    if (dealerId) headers.push(
      `B2B brutto (${dealerLabel})`,
      'Скидка от розницы %',
      'B2B netto',
      'Маржа дилера',
      'Маржа дилера %',
      'Реком. розница дилера',
      'Розница дилера (его)',
    );
    headers.push('Проблемы');
    const esc = (v) => {
      const s = String(v ?? '');
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const kindLabel = { model: 'Модель', variant: 'Вариант', option: 'Опция', option_variant: 'Вар.опции' };
    const lines = [headers.map(esc).join(';')];
    for (const r of filtered) {
      const row = [
        kindLabel[r.kind] || r.kind,
        r.name,
        Math.round(r.retailBrutto),
        Math.round(r.retailNetto),
        Math.round(r.retailExtra),
        Math.round(r.cost),
        Math.round(r.margin),
        r.marginPct != null ? r.marginPct.toFixed(1) : '',
      ];
      if (dealerId) {
        row.push(
          r.dealerB2B != null ? Math.round(r.dealerB2B) : '',
          r.dealerDiscountPct != null ? r.dealerDiscountPct.toFixed(1) : '',
          r.dealerB2BNetto != null ? Math.round(r.dealerB2BNetto) : '',
          r.dealerMargin != null ? Math.round(r.dealerMargin) : '',
          r.dealerMarginPct != null ? r.dealerMarginPct.toFixed(1) : '',
          r.recommendedDealerRetail != null ? Math.round(r.recommendedDealerRetail) : '',
          r.dealerRetail != null ? Math.round(r.dealerRetail) : '',
        );
      }
      const probs = [];
      if (r.flags.noCard) probs.push('нет тех.карты');
      if (r.flags.noRetail) probs.push('нет розницы');
      if (r.flags.negative) probs.push('убыток');
      if (r.flags.noDealer) probs.push('нет дилер.оверрайда');
      row.push(probs.join(', '));
      lines.push(row.map(esc).join(';'));
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pricematrix-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Экспортировано: ${filtered.length} строк`);
  };

  // --- Inline editing of retail price (basePrice / variant.price / option.price) ---
  // We deep-clone the entire `prices` doc, mutate the right leaf, and POST the
  // whole doc back. The API replaces the prices doc atomically.
  const saveRetail = async (row, newRetailBrutto) => {
    if (!prices) return;
    const next = JSON.parse(JSON.stringify(prices));
    const num = Math.max(0, Math.round(Number(newRetailBrutto) || 0));
    const { modelId, variantId, optionId, optionVariantId } = row.ids;

    if (row.kind === 'model') {
      const m = (next.models || []).find((x) => x.id === modelId);
      if (!m) return toast.error('Модель не найдена');
      m.basePrice = num;
    } else if (row.kind === 'variant') {
      const m = (next.models || []).find((x) => x.id === modelId);
      const v = m?.variants?.find((x) => x.id === variantId);
      if (!v) return toast.error('Вариант не найден');
      // displayed retailBrutto = basePrice + variant.price → solve for variant.price
      v.price = Math.max(0, num - (m.basePrice || 0));
    } else if (row.kind === 'option') {
      // option may be in flat options[] or nested in categories[].options
      let opt = (next.options || []).find((x) => x.id === optionId);
      if (!opt) {
        for (const cat of (next.categories || [])) {
          const found = (cat.options || []).find((x) => x.id === optionId);
          if (found) { opt = found; break; }
        }
      }
      if (!opt) return toast.error('Опция не найдена');
      opt.price = num;
    } else if (row.kind === 'option_variant') {
      let opt = (next.options || []).find((x) => x.id === optionId);
      if (!opt) {
        for (const cat of (next.categories || [])) {
          const found = (cat.options || []).find((x) => x.id === optionId);
          if (found) { opt = found; break; }
        }
      }
      const v = opt?.variants?.find((x) => x.id === optionVariantId);
      if (!v) return toast.error('Вариант опции не найден');
      v.price = Math.max(0, num - (opt.price || 0));
    }

    try {
      await axios.post(`${API}/api/sauna/prices`, next, { headers: authHeaders() });
      setPrices(next);
      toast.success('Розничная цена обновлена');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка сохранения');
    }
  };

  // --- Inline editing of dealer B2B brutto (requires dealer selected) ---
  const saveDealerB2B = async (row, newB2B) => {
    if (!dealerId) return;
    const num = Math.max(0, Math.round(Number(newB2B) || 0));
    let kind = row.kind;
    if (kind === 'variant') kind = 'model_variant';
    if (!['model', 'model_variant', 'option', 'option_variant'].includes(kind)) {
      return toast.error('Этот тип строки не поддерживается для дилерских цен');
    }
    const payload = {
      kind,
      modelId: row.ids.modelId || null,
      variantId: row.ids.variantId || null,
      optionId: row.ids.optionId || null,
      optionVariantId: row.ids.optionVariantId || null,
      price: num,
    };
    try {
      await axios.post(
        `${API}/api/admin/dealers/${dealerId}/overrides/upsert`,
        { overrides: [payload] },
        { headers: authHeaders() },
      );
      // refresh overrides
      const r = await axios.get(`${API}/api/admin/dealers/${dealerId}/overrides`, { headers: authHeaders() });
      setDealerOverrides(r.data?.overrides || []);
      toast.success('B2B-цена дилера обновлена');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка сохранения');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Загрузка прайс-матрицы…
      </div>
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
      {/* Сводка */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3">
          <div className="text-[11px] text-muted-foreground">Всего позиций</div>
          <div className="text-xl font-semibold" data-testid="pm-stat-total">{stats.total}</div>
        </CardContent></Card>
        <Card className={stats.noCard > 0 ? 'border-amber-300 bg-amber-50/40' : ''}>
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">Без тех.карты</div>
            <div className={`text-xl font-semibold ${stats.noCard > 0 ? 'text-amber-700' : ''}`} data-testid="pm-stat-no-card">{stats.noCard}</div>
          </CardContent>
        </Card>
        <Card className={stats.noRetail > 0 ? 'border-yellow-300 bg-yellow-50/40' : ''}>
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">Без розницы</div>
            <div className={`text-xl font-semibold ${stats.noRetail > 0 ? 'text-yellow-700' : ''}`} data-testid="pm-stat-no-retail">{stats.noRetail}</div>
          </CardContent>
        </Card>
        <Card className={stats.negative > 0 ? 'border-red-300 bg-red-50/40' : ''}>
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">Убыточные</div>
            <div className={`text-xl font-semibold ${stats.negative > 0 ? 'text-red-700' : ''}`} data-testid="pm-stat-negative">{stats.negative}</div>
          </CardContent>
        </Card>
        <Card className={dealerId && stats.noDealer > 0 ? 'border-orange-300 bg-orange-50/40' : ''}>
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">{dealerId ? 'Нет дилер. цены' : 'Дилер не выбран'}</div>
            <div className={`text-xl font-semibold ${dealerId && stats.noDealer > 0 ? 'text-orange-700' : 'text-muted-foreground'}`} data-testid="pm-stat-no-dealer">
              {dealerId ? stats.noDealer : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Фильтры */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Прайс-матрица</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по названию…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
                data-testid="pm-search"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px] h-9" data-testid="pm-type-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value="model">Модели</SelectItem>
                <SelectItem value="variant">Варианты</SelectItem>
                <SelectItem value="option">Опции</SelectItem>
                <SelectItem value="option_variant">Вар.опций</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dealerId || 'none'} onValueChange={(v) => setDealerId(v === 'none' ? '' : v)}>
              <SelectTrigger className="w-[220px] h-9" data-testid="pm-dealer-select">
                <SelectValue placeholder="Без дилера" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без дилера (только розница)</SelectItem>
                {dealers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name || d.username || d.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 px-3 h-9 rounded-md border bg-background">
              <Switch
                id="pm-only-missing"
                checked={onlyMissing}
                onCheckedChange={setOnlyMissing}
                data-testid="pm-only-missing"
              />
              <Label htmlFor="pm-only-missing" className="text-xs cursor-pointer">Только пробелы</Label>
            </div>

            <Button onClick={exportCsv} variant="outline" size="sm" className="gap-1.5 h-9" data-testid="pm-export-csv">
              <Download className="h-4 w-4" />
              CSV
            </Button>

            <div className="text-xs text-muted-foreground ml-auto">
              {filtered.length} из {rows.length}
              {dealerLoading && <Loader2 className="inline ml-2 h-3 w-3 animate-spin" />}
            </div>
          </div>

          {/* Таблица */}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[110px]">Тип</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead className="text-right">Розница brutto</TableHead>
                  <TableHead className="text-right">Розница netto</TableHead>
                  <TableHead className="text-right">Себестоимость</TableHead>
                  <TableHead className="text-right">Накладные</TableHead>
                  <TableHead className="text-right">Маржа</TableHead>
                  {dealerId && <TableHead className="text-right border-l-2">B2B brutto</TableHead>}
                  {dealerId && <TableHead className="text-right">Скидка</TableHead>}
                  {dealerId && <TableHead className="text-right">Маржа дилера</TableHead>}
                  {dealerId && <TableHead className="text-right">Реком. розница дилера</TableHead>}
                  <TableHead className="text-center w-[180px]">Проблемы</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={dealerId ? 12 : 8} className="text-center py-8 text-muted-foreground">
                      Ничего не найдено
                    </TableCell>
                  </TableRow>
                ) : filtered.map((r, idx) => (
                  <TableRow key={idx} className={r.flags.negative ? 'bg-red-50/40' : (r.isMissing ? 'bg-amber-50/30' : '')} data-testid={`pm-row-${idx}`}>
                    <TableCell>{kindBadge(r.kind)}</TableCell>
                    <TableCell className="font-medium text-sm">{r.name}</TableCell>
                    <TableCell className={`text-right text-sm ${r.flags.noRetail ? 'text-yellow-700 font-semibold' : ''}`}>
                      <InlineEditCell
                        value={r.retailBrutto}
                        onSave={(v) => saveRetail(r, v)}
                        label={`Розница brutto · ${r.name}`}
                        helper={
                          r.kind === 'variant'
                            ? 'Это итоговая цена brutto. Сохраним как «надбавку варианта» = новая − базовая цена модели.'
                            : r.kind === 'option_variant'
                              ? 'Это итоговая цена brutto. Сохраним как «надбавку варианта» = новая − базовая цена опции.'
                              : 'Розничная цена с НДС 23%.'
                        }
                        testId={`pm-edit-retail-${idx}`}
                        emptyHint="+ цена"
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {r.flags.noRetail ? '—' : fmtMoney(r.retailNetto)}
                    </TableCell>
                    <TableCell className={`text-right text-sm ${r.flags.noCard ? 'text-amber-700 font-semibold' : ''}`}>
                      {r.flags.noCard ? '—' : fmtMoney(r.cost)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {r.retailExtra ? fmtMoney(r.retailExtra) : '—'}
                    </TableCell>
                    <TableCell className={`text-right text-sm font-semibold ${
                      r.flags.negative ? 'text-red-700'
                        : (r.marginPct != null && r.marginPct < 15) ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}>
                      {r.flags.noRetail || r.flags.noCard ? '—' : (
                        <span>
                          {fmtMoney(r.margin)}
                          {r.marginPct != null && (
                            <span className="ml-1 text-[10px] opacity-80">({r.marginPct.toFixed(0)}%)</span>
                          )}
                        </span>
                      )}
                    </TableCell>
                    {dealerId && (
                      <TableCell className={`text-right text-sm border-l-2 ${r.flags.noDealer ? 'text-orange-700 font-semibold' : ''}`}>
                        <InlineEditCell
                          value={r.dealerB2B}
                          onSave={(v) => saveDealerB2B(r, v)}
                          label={`B2B brutto для дилера · ${r.name}`}
                          helper="Цена, по которой WM продаёт дилеру (brutto, с НДС 23%)."
                          testId={`pm-edit-b2b-${idx}`}
                          emptyHint="+ b2b"
                        />
                      </TableCell>
                    )}
                    {dealerId && (
                      <TableCell className="text-right text-sm">
                        {r.dealerDiscountPct != null ? (
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded-md text-xs font-semibold ${
                              r.dealerDiscountPct >= 30 ? 'bg-emerald-100 text-emerald-800'
                                : r.dealerDiscountPct >= 15 ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                            title={`Дилер платит ${fmtMoney(r.dealerB2B)} вместо ${fmtMoney(r.retailBrutto)} — экономит ${fmtMoney(r.retailBrutto - r.dealerB2B)}`}
                            data-testid={`pm-discount-${idx}`}
                          >
                            −{r.dealerDiscountPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {dealerId && (
                      <TableCell className={`text-right text-sm font-semibold ${
                        r.dealerMargin == null ? 'text-muted-foreground'
                          : r.dealerMargin < 0 ? 'text-red-700'
                          : (r.dealerMarginPct != null && r.dealerMarginPct < 10) ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}>
                        {r.dealerMargin != null ? (
                          <span>
                            {fmtMoney(r.dealerMargin)}
                            {r.dealerMarginPct != null && (
                              <span className="ml-1 text-[10px] opacity-80">({r.dealerMarginPct.toFixed(0)}%)</span>
                            )}
                          </span>
                        ) : '—'}
                      </TableCell>
                    )}
                    {dealerId && (
                      <TableCell className="text-right text-sm" data-testid={`pm-recommended-${idx}`}>
                        {r.recommendedDealerRetail != null ? (
                          <div className="leading-tight">
                            <div className="font-semibold text-slate-700">
                              {fmtMoney(r.recommendedDealerRetail)}
                            </div>
                            {r.dealerRetail != null ? (
                              <div className={`text-[10px] ${r.dealerRetailUnderscut ? 'text-red-700 font-medium' : 'text-emerald-700'}`}>
                                {r.dealerRetailUnderscut
                                  ? `⚠ дилер ставит ${fmtMoney(r.dealerRetail)}`
                                  : `у дилера: ${fmtMoney(r.dealerRetail)}`}
                              </div>
                            ) : (
                              <div className="text-[10px] text-muted-foreground italic">дилер не задал</div>
                            )}
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        {r.flags.noCard && <Badge className="bg-amber-100 text-amber-800 text-[10px] font-normal"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />нет тех.карты</Badge>}
                        {r.flags.noRetail && <Badge className="bg-yellow-100 text-yellow-800 text-[10px] font-normal">нет розницы</Badge>}
                        {r.flags.negative && <Badge className="bg-red-100 text-red-800 text-[10px] font-normal">убыток</Badge>}
                        {r.flags.noDealer && <Badge className="bg-orange-100 text-orange-800 text-[10px] font-normal">нет дилер.</Badge>}
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

/** Inline price editor cell with popover. Renders the current value as a clickable
 *  number; clicking opens a small input + Save/Cancel. Empty state shows a "+".
 */
function InlineEditCell({ value, onSave, label, placeholder, helper, testId, disabled, emptyText = '—', emptyHint = 'Указать' }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value || '');
  useEffect(() => { if (open) setDraft(value || ''); }, [open, value]);

  const isEmpty = value == null || value === 0;
  const handleSave = async (e) => {
    e?.preventDefault?.();
    await onSave(Number(draft) || 0);
    setOpen(false);
  };

  if (disabled) {
    return <span className="text-muted-foreground">{isEmpty ? emptyText : fmtMoney(value)}</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`group inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-blue-50 hover:text-blue-700 transition-colors ${
            isEmpty ? 'text-muted-foreground italic underline decoration-dashed underline-offset-2' : ''
          }`}
          data-testid={testId}
          title="Кликните, чтобы изменить"
        >
          <span>{isEmpty ? emptyHint : fmtMoney(value)}</span>
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <form onSubmit={handleSave} className="space-y-2">
          <div className="text-xs font-medium text-foreground">{label}</div>
          {helper && <div className="text-[11px] text-muted-foreground leading-tight">{helper}</div>}
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              type="number"
              min={0}
              step="1"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder || 'zł brutto'}
              className="h-8 text-right font-mono"
              data-testid={`${testId}-input`}
            />
            <span className="text-xs text-muted-foreground">zł</span>
          </div>
          <div className="flex justify-end gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} data-testid={`${testId}-cancel`}>
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
