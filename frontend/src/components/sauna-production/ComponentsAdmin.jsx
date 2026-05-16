import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, Search, Loader2, Save, X, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { toast } from 'sonner';
import { COST_BASE, authHeaders, COMPONENT_CATEGORIES, CAT_BY_ID, UNITS, fmtMoney } from './costConstants';

const EMPTY = { name: '', category: 'wood', unit: 'шт', unitPrice: 0, supplier: '', note: '', isActive: true };

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
                <th className="px-3 py-2 w-40">Поставщик</th>
                <th className="px-3 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Нет компонентов. Нажмите «Добавить компонент».</td></tr>
              ) : filtered.map((c) => {
                const cat = CAT_BY_ID[c.category] || CAT_BY_ID.other;
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
                    <td className="px-3 py-2 text-xs text-muted-foreground">{c.supplier || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => setEditing(c)} className="text-slate-500 hover:text-slate-700 p-1" data-testid={`component-edit-${c.id}`}><Pencil className="w-3.5 h-3.5" /></button>
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
