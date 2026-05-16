import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, Search, Loader2, Save, X, AlertTriangle, Boxes, History, ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { COST_BASE, authHeaders, COMPONENT_CATEGORIES, CAT_BY_ID, UNITS, fmtMoney, fmtNumber } from './costConstants';

const EMPTY = { name: '', category: 'wood', unit: 'шт', unitPrice: 0, supplier: '', note: '', isActive: true, stockCurrent: 0, stockMin: 0 };

/**
 * ComponentsAdmin — CRUD for the materials/components master catalog.
 * Editing a unitPrice automatically recomputes every tech card that uses it.
 */
export default function ComponentsAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [stockOn, setStockOn] = useState(null);   // component for stock-adjust dialog

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${COST_BASE}/components`, { headers: authHeaders() });
      setItems(r.data.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (catFilter) list = list.filter((i) => i.category === catFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((i) => i.name?.toLowerCase().includes(s) || i.supplier?.toLowerCase().includes(s));
    }
    return list;
  }, [items, search, catFilter]);

  const save = async (item) => {
    try {
      if (item.id) {
        const r = await axios.put(`${COST_BASE}/components/${item.id}`, item, { headers: authHeaders() });
        if (r.data.affectedCards > 0) toast.success(`Сохранено. Пересчитано тех.карт: ${r.data.affectedCards}`);
        else toast.success('Сохранено');
      } else {
        await axios.post(`${COST_BASE}/components`, item, { headers: authHeaders() });
        toast.success('Компонент добавлен');
      }
      setEditing(null); load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка');
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Удалить «${item.name}»?`)) return;
    try {
      await axios.delete(`${COST_BASE}/components/${item.id}`, { headers: authHeaders() });
      toast.success('Удалено'); load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка удаления');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Поиск по названию или поставщику..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" data-testid="components-search" />
        </div>
        <Select value={catFilter || '__all__'} onValueChange={(v) => setCatFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Категория" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Все категории</SelectItem>
            {COMPONENT_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={async () => {
            if (!window.confirm('Импортировать ~49 компонентов из шаблона (из файла «Себес Сауны.xlsx»)? Уже существующие по названию будут пропущены.')) return;
            try {
              const r = await axios.post(`${COST_BASE}/components/seed-from-template`, {}, { headers: authHeaders() });
              toast.success(`Добавлено ${r.data.added}, пропущено ${r.data.skipped}`);
              load();
            } catch (e) {
              toast.error(e?.response?.data?.detail || 'Ошибка импорта');
            }
          }}
          className="h-9"
          data-testid="components-seed"
          title="Импорт компонентов из готового шаблона"
        >
          <Plus className="w-4 h-4 mr-1" /> Импорт из шаблона
        </Button>
        <Button onClick={() => setEditing({ ...EMPTY })} className="bg-orange-500 hover:bg-orange-600 h-9 ml-auto" data-testid="component-add">
          <Plus className="w-4 h-4 mr-1" /> Добавить компонент
        </Button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
      ) : (
        <div className="border rounded-lg bg-card overflow-auto" data-testid="components-table">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 w-40">Категория</th>
                <th className="px-3 py-2">Название</th>
                <th className="px-3 py-2 w-20">Ед.</th>
                <th className="px-3 py-2 w-32">Цена за ед.</th>
                <th className="px-3 py-2 w-40">Остаток / Мин.</th>
                <th className="px-3 py-2 w-32">Поставщик</th>
                <th className="px-3 py-2 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Нет компонентов. Нажмите «Добавить компонент».</td></tr>
              ) : filtered.map((c) => {
                const cat = CAT_BY_ID[c.category] || CAT_BY_ID.other;
                const stock = Number(c.stockCurrent || 0);
                const min = Number(c.stockMin || 0);
                const lowStock = min > 0 && stock <= min;
                return (
                  <tr key={c.id} className="border-t hover:bg-slate-50/70" data-testid={`component-row-${c.id}`}>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">{c.name}{c.note && <span className="block text-xs text-muted-foreground">{c.note}</span>}</td>
                    <td className="px-3 py-2 text-xs">{c.unit}</td>
                    <td className="px-3 py-2 font-mono">{fmtMoney(c.unitPrice)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs ${lowStock ? 'text-red-600 font-semibold' : ''}`}>
                        {lowStock && <AlertTriangle className="w-3 h-3" />}
                        <span className="font-mono">{fmtNumber(stock, 2)}</span>
                        {min > 0 && <span className="text-muted-foreground">/ {fmtNumber(min, 2)}</span>}
                        <span className="text-muted-foreground">{c.unit}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{c.supplier || '—'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => setStockOn(c)} className="text-slate-500 hover:text-orange-600 p-1" title="Изменить остаток" data-testid={`component-stock-${c.id}`}><Boxes className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditing(c)} className="text-slate-500 hover:text-slate-700 p-1 ml-1" data-testid={`component-edit-${c.id}`}><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(c)} className="text-slate-500 hover:text-red-600 p-1 ml-1" data-testid={`component-delete-${c.id}`}><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && <ComponentDialog item={editing} onClose={() => setEditing(null)} onSave={save} />}
      {stockOn && <StockDialog item={stockOn} onClose={() => setStockOn(null)} onChanged={(updated) => { setStockOn(null); if (updated) load(); }} />}
    </div>
  );
}

function ComponentDialog({ item, onClose, onSave }) {
  const [d, setD] = useState(item);
  const set = (k, v) => setD({ ...d, [k]: v });
  const priceChanged = item.id && Number(item.unitPrice) !== Number(d.unitPrice);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="component-dialog">
        <DialogHeader><DialogTitle>{item.id ? 'Редактировать компонент' : 'Новый компонент'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Название *</label>
            <Input value={d.name} onChange={(e) => set('name', e.target.value)} data-testid="component-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Категория</label>
              <Select value={d.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger data-testid="component-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPONENT_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Единица</label>
              <Select value={d.unit} onValueChange={(v) => set('unit', v)}>
                <SelectTrigger data-testid="component-unit"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Цена за единицу (zł) *</label>
            <Input type="number" step="0.01" value={d.unitPrice} onChange={(e) => set('unitPrice', parseFloat(e.target.value) || 0)} data-testid="component-price" />
            {priceChanged && (
              <div className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Все тех.карты с этим компонентом будут пересчитаны автоматически.
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Остаток на складе</label>
              <Input type="number" step="0.01" value={d.stockCurrent ?? 0} onChange={(e) => set('stockCurrent', parseFloat(e.target.value) || 0)} data-testid="component-stock-current" />
            </div>
            <div>
              <label className="text-xs font-medium">Минимальный остаток</label>
              <Input type="number" step="0.01" value={d.stockMin ?? 0} onChange={(e) => set('stockMin', parseFloat(e.target.value) || 0)} data-testid="component-stock-min" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Поставщик</label>
            <Input value={d.supplier || ''} onChange={(e) => set('supplier', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium">Примечание</label>
            <Input value={d.note || ''} onChange={(e) => set('note', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-1" />Отмена</Button>
          <Button onClick={() => onSave(d)} disabled={!d.name?.trim()} className="bg-orange-500 hover:bg-orange-600" data-testid="component-save">
            <Save className="w-4 h-4 mr-1" />Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/**
 * StockDialog — manual in/out/set adjustments + last 20 movements log.
 */
function StockDialog({ item, onClose, onChanged }) {
  const [type, setType] = useState('in');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [moves, setMoves] = useState([]);
  const [loadingMoves, setLoadingMoves] = useState(true);
  const [stockNow, setStockNow] = useState(Number(item.stockCurrent || 0));

  const loadMoves = async () => {
    setLoadingMoves(true);
    try {
      const r = await axios.get(`${COST_BASE}/components/${item.id}/stock-movements`, { headers: authHeaders() });
      setMoves(r.data.items || []);
    } catch (e) {
      // silent
    } finally {
      setLoadingMoves(false);
    }
  };
  useEffect(() => { loadMoves(); /* eslint-disable-next-line */ }, [item.id]);

  const submit = async () => {
    const n = parseFloat(qty);
    if (!isFinite(n) || (type !== 'set' && n <= 0)) {
      toast.error('Введите положительное количество');
      return;
    }
    setBusy(true);
    try {
      const r = await axios.post(
        `${COST_BASE}/components/${item.id}/stock-adjust`,
        { type, qty: n, note: (note || '').trim() },
        { headers: authHeaders() },
      );
      setStockNow(r.data.stockCurrent);
      setQty(1); setNote('');
      toast.success(`Остаток обновлён: ${fmtNumber(r.data.stockCurrent, 2)} ${item.unit}`);
      loadMoves();
      onChanged?.(true);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const previewAfter = (() => {
    const n = parseFloat(qty);
    if (!isFinite(n)) return stockNow;
    if (type === 'in') return stockNow + n;
    if (type === 'out') return stockNow - n;
    return n;
  })();

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="stock-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Boxes className="w-5 h-5 text-orange-600" />Изменить остаток · {item.name}</DialogTitle>
          <DialogDescription>
            Текущий остаток: <b className="text-foreground font-mono">{fmtNumber(stockNow, 2)} {item.unit}</b>
            {item.stockMin > 0 && <> · Минимум: <b className="text-foreground font-mono">{fmtNumber(item.stockMin, 2)} {item.unit}</b></>}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Adjustment form */}
          <div className="space-y-3 border rounded-md p-3 bg-slate-50/40">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Новая операция</div>
            <div>
              <label className="text-xs font-medium">Тип операции</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="stock-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in"><span className="inline-flex items-center gap-1.5"><ArrowUpCircle className="w-3.5 h-3.5 text-emerald-600" />Пополнение (приход)</span></SelectItem>
                  <SelectItem value="out"><span className="inline-flex items-center gap-1.5"><ArrowDownCircle className="w-3.5 h-3.5 text-red-600" />Списание (расход)</span></SelectItem>
                  <SelectItem value="set"><span className="inline-flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5 text-blue-600" />Установить точное значение</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Количество ({item.unit})</label>
              <Input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} data-testid="stock-qty" />
            </div>
            <div>
              <label className="text-xs font-medium">Примечание (необязательно)</label>
              <Textarea
                placeholder="Напр.: приход от поставщика, инвентаризация, списано на заказ #42…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[60px] text-sm"
                data-testid="stock-note"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              После операции остаток станет:{' '}
              <b className={`font-mono ${previewAfter < 0 ? 'text-red-600' : 'text-foreground'}`}>{fmtNumber(previewAfter, 2)} {item.unit}</b>
              {previewAfter < 0 && <span className="text-red-600 ml-2">⚠ уйдёт в минус</span>}
            </div>
            <Button onClick={submit} disabled={busy} className="bg-orange-500 hover:bg-orange-600 w-full" data-testid="stock-submit">
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Применить
            </Button>
          </div>

          {/* Movement history */}
          <div className="border rounded-md p-3 bg-card max-h-[420px] overflow-y-auto">
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2 inline-flex items-center gap-1.5"><History className="w-3.5 h-3.5" />История</div>
            {loadingMoves ? (
              <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-orange-500" /></div>
            ) : moves.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">История пуста</div>
            ) : (
              <div className="space-y-1.5">
                {moves.map((m) => {
                  const icon = m.type === 'in'
                    ? <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    : m.type === 'out'
                      ? <ArrowDownCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                      : <RefreshCw className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />;
                  return (
                    <div key={m.id} className="flex items-start gap-2 text-xs border-b last:border-b-0 pb-1.5">
                      {icon}
                      <div className="flex-1 min-w-0">
                        <div>
                          <span className="font-mono">{m.type === 'set' ? '=' : m.type === 'in' ? '+' : '−'}{fmtNumber(m.qty, 2)} {item.unit}</span>
                          <span className="text-muted-foreground"> · {fmtNumber(m.before, 2)} → <b className="text-foreground">{fmtNumber(m.after, 2)}</b></span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {m.actorUsername || '—'} · {new Date(m.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          {m.note && <span className="block italic">«{m.note}»</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-1" />Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
