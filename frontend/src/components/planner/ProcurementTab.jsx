import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  ShoppingCart, Plus, Pencil, Trash2, AlertTriangle, Clock, CheckCircle2,
  Loader2, Search, ChevronDown, Package, Bell, BellOff, ExternalLink,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/api';
import { getAuthHeaders } from './constants';

const API = getApiUrl();

const STATUS_META = {
  draft:     { label: 'Черновик',     color: 'bg-slate-100 text-slate-700 border-slate-300' },
  approved:  { label: 'Утверждено',   color: 'bg-blue-50 text-blue-700 border-blue-300' },
  ordered:   { label: 'Заказано',     color: 'bg-amber-50 text-amber-700 border-amber-300' },
  delivered: { label: 'Получено',     color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  cancelled: { label: 'Отменено',     color: 'bg-gray-100 text-gray-500 border-gray-300' },
};
const PRIORITY_META = {
  low:    { label: 'Низкий',  color: 'text-slate-500' },
  medium: { label: 'Средний', color: 'text-blue-600' },
  high:   { label: 'Высокий', color: 'text-amber-600' },
  urgent: { label: 'Срочный', color: 'text-red-600 font-semibold' },
};

const emptyForm = () => ({
  title: '',
  componentId: '',
  componentName: '',
  category: '',
  unit: 'шт',
  quantity: 1,
  unitPrice: 0,
  supplier: '',
  note: '',
  status: 'draft',
  priority: 'medium',
  dueDate: '',
  assigneeUserId: '',
  assigneeUsername: '',
  reminderDaysBefore: 3,
  notifyTelegram: true,
});

const fmtMoney = (n) => (Number(n || 0)).toLocaleString('ru-RU', { maximumFractionDigits: 2 });

/**
 * Inline component picker: searchable list of sauna_components + quick-create
 * button for items the user can't find in the catalog.
 */
const ComponentPicker = ({ value, onPick, components, onQuickCreate }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return components.slice(0, 50);
    return components.filter(c =>
      (c.name || '').toLowerCase().includes(q)
      || (c.category || '').toLowerCase().includes(q)
      || (c.supplier || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [components, query]);
  const current = components.find(c => c.id === value);

  return (
    <div className="relative">
      <button
        type="button"
        className="w-full border rounded-md px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-muted/50"
        onClick={() => setOpen(o => !o)}
        data-testid="component-picker-trigger"
      >
        {current ? (
          <span className="truncate">
            <span className="font-medium">{current.name}</span>
            <span className="text-xs text-muted-foreground ml-2">
              {current.unitPrice ? fmtMoney(current.unitPrice) + ' / ' + current.unit : 'без цены'}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">— Выбрать комплектующее —</span>
        )}
        <ChevronDown className="h-4 w-4 opacity-60" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-md bg-popover shadow-lg max-h-80 overflow-hidden flex flex-col">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Поиск по названию, категории, поставщику…"
                className="w-full pl-8 pr-2 py-1.5 text-sm border rounded-md"
                autoFocus
                data-testid="component-picker-search"
              />
            </div>
          </div>
          <div className="overflow-auto flex-1">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                Ничего не найдено
              </div>
            )}
            {filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onPick(c); setOpen(false); setQuery(''); }}
                className="w-full text-left px-3 py-2 hover:bg-muted/70 border-b text-sm flex items-center justify-between"
              >
                <span className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {c.category} · {c.unit}{c.supplier ? ' · ' + c.supplier : ''}
                  </div>
                </span>
                <span className="text-xs font-semibold text-foreground ml-3 whitespace-nowrap">
                  {fmtMoney(c.unitPrice)}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); onQuickCreate(query); }}
            className="px-3 py-2 border-t bg-indigo-50 text-indigo-700 text-sm hover:bg-indigo-100 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Создать новое комплектующее{query ? ` "${query}"` : ''}
          </button>
        </div>
      )}
    </div>
  );
};

const QuickCreateDialog = ({ open, onClose, initialName, onCreated }) => {
  const [form, setForm] = useState({ name: '', category: 'other', unit: 'шт', unitPrice: 0, supplier: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(f => ({ ...f, name: initialName || '' }));
  }, [open, initialName]);

  const save = async () => {
    if (!form.name.trim()) { toast.error('Введите название'); return; }
    setSaving(true);
    try {
      const res = await axios.post(`${API}/api/procurement/components/quick-create`, form, { headers: getAuthHeaders() });
      toast.success('Комплектующее добавлено');
      onCreated?.(res.data);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="quick-create-component-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" /> Новое комплектующее
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Название *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Категория</Label>
              <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <Label>Ед. изм.</Label>
              <Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Цена за ед.</Label>
              <Input type="number" min="0" step="0.01" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Поставщик</Label>
              <Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const RequestDialog = ({ open, onClose, initial, onSaved, components, users, refreshComponents }) => {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickInitial, setQuickInitial] = useState('');

  useEffect(() => {
    if (open) setForm(initial ? { ...emptyForm(), ...initial } : emptyForm());
  }, [open, initial]);

  const pickComponent = (c) => {
    setForm(f => ({
      ...f,
      componentId: c.id,
      componentName: c.name,
      category: c.category || '',
      unit: c.unit || 'шт',
      unitPrice: f.unitPrice && f.unitPrice !== 0 ? f.unitPrice : (c.unitPrice || 0),
      supplier: f.supplier || c.supplier || '',
      title: f.title || c.name,
    }));
  };

  const save = async () => {
    if (!form.title.trim() && !form.componentName) {
      toast.error('Введите название или выберите комплектующее');
      return;
    }
    setSaving(true);
    try {
      if (initial?.id) {
        await axios.put(`${API}/api/procurement/requests/${initial.id}`, form, { headers: getAuthHeaders() });
        toast.success('Заявка обновлена');
      } else {
        await axios.post(`${API}/api/procurement/requests`, form, { headers: getAuthHeaders() });
        toast.success('Заявка создана');
      }
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    } finally { setSaving(false); }
  };

  const total = useMemo(() => Number(form.quantity || 0) * Number(form.unitPrice || 0), [form.quantity, form.unitPrice]);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto" data-testid="procurement-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-indigo-600" />
              {initial?.id ? 'Редактировать заявку' : 'Новая заявка на закупку'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">Комплектующее</Label>
              <ComponentPicker
                value={form.componentId}
                components={components}
                onPick={pickComponent}
                onQuickCreate={(name) => { setQuickInitial(name); setQuickOpen(true); }}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                При выборе цена и поставщик подставятся автоматически —
                их можно переопределить ниже.
              </p>
            </div>
            <div>
              <Label className="text-sm">Название заявки *</Label>
              <Input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Например: Доски сосна 25×100, партия №3"
                data-testid="procurement-title"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-sm">Кол-во *</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })}
                  data-testid="procurement-quantity"
                />
              </div>
              <div>
                <Label className="text-sm">Ед.</Label>
                <Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
              </div>
              <div>
                <Label className="text-sm">Цена за ед.</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={form.unitPrice}
                  onChange={e => setForm({ ...form, unitPrice: parseFloat(e.target.value) || 0 })}
                  data-testid="procurement-unitprice"
                />
              </div>
            </div>
            <div className="text-right font-semibold text-indigo-700">
              Сумма: {fmtMoney(total)}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm">Срок поставки *</Label>
                <Input
                  type="date"
                  value={form.dueDate || ''}
                  onChange={e => setForm({ ...form, dueDate: e.target.value })}
                  data-testid="procurement-due"
                />
              </div>
              <div>
                <Label className="text-sm">За сколько дней напомнить</Label>
                <Input
                  type="number" min="0" max="30"
                  value={form.reminderDaysBefore}
                  onChange={e => setForm({ ...form, reminderDaysBefore: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm">Статус</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_META).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Приоритет</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_META).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm">Поставщик</Label>
                <Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
              </div>
              <div>
                <Label className="text-sm">Ответственный</Label>
                <Select
                  value={form.assigneeUserId || '__none__'}
                  onValueChange={v => {
                    const u = users.find(x => x.id === v);
                    setForm({
                      ...form,
                      assigneeUserId: v === '__none__' ? '' : v,
                      assigneeUsername: u?.username || '',
                    });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Не назначен" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Не назначен —</SelectItem>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-sm">Заметка</Label>
              <Textarea
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="notify-tg"
                checked={!!form.notifyTelegram}
                onCheckedChange={(v) => setForm({ ...form, notifyTelegram: !!v })}
              />
              <Label htmlFor="notify-tg" className="text-sm cursor-pointer">
                Уведомлять в Telegram (создание, напоминание за {form.reminderDaysBefore} дн., просрочка)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Отмена</Button>
            <Button onClick={save} disabled={saving} data-testid="procurement-save">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {initial?.id ? 'Сохранить' : 'Создать заявку'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <QuickCreateDialog
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        initialName={quickInitial}
        onCreated={(c) => { refreshComponents(); pickComponent(c); }}
      />
    </>
  );
};

export default function ProcurementTab({ users = [] }) {
  const [items, setItems] = useState([]);
  const [components, setComponents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, cmpRes, statsRes] = await Promise.all([
        axios.get(`${API}/api/procurement/requests`, { headers: getAuthHeaders() }),
        axios.get(`${API}/api/procurement/components`, { headers: getAuthHeaders() }),
        axios.get(`${API}/api/procurement/stats`, { headers: getAuthHeaders() }),
      ]);
      setItems(reqRes.data.items || []);
      setComponents(cmpRes.data.items || []);
      setStats(statsRes.data);
    } catch (e) {
      toast.error('Не удалось загрузить заявки: ' + (e.response?.data?.detail || e.message));
    } finally { setLoading(false); }
  }, []);

  const refreshComponents = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/procurement/components`, { headers: getAuthHeaders() });
      setComponents(r.data.items || []);
    } catch (_) {}
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const del = async (id) => {
    if (!window.confirm('Удалить заявку?')) return;
    try {
      await axios.delete(`${API}/api/procurement/requests/${id}`, { headers: getAuthHeaders() });
      toast.success('Заявка удалена');
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    }
  };

  const filtered = useMemo(() => {
    let list = items;
    if (statusFilter) list = list.filter(it => it.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(it =>
        (it.title || '').toLowerCase().includes(q)
        || (it.componentName || '').toLowerCase().includes(q)
        || (it.supplier || '').toLowerCase().includes(q)
        || (it.assigneeUsername || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, search, statusFilter]);

  return (
    <div className="space-y-4" data-testid="procurement-tab">
      {/* KPI tiles */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiTile label="Всего заявок" value={stats.total} icon={ShoppingCart} color="text-slate-700" bg="bg-slate-100" />
          <KpiTile label="Просрочено" value={stats.overdue} icon={AlertTriangle} color="text-red-600" bg="bg-red-50" />
          <KpiTile label="Скоро (7 дн)" value={stats.dueSoon} icon={Clock} color="text-amber-600" bg="bg-amber-50" />
          <KpiTile label="Получено" value={stats.byStatus?.delivered?.count || 0} icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50" />
          <KpiTile label="Сумма (открытые)" value={fmtMoney((stats.byStatus?.draft?.totalValue || 0) + (stats.byStatus?.approved?.totalValue || 0) + (stats.byStatus?.ordered?.totalValue || 0))} icon={Package} color="text-indigo-600" bg="bg-indigo-50" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по названию, комплектующему, поставщику…"
            className="pl-8"
            data-testid="procurement-search"
          />
        </div>
        <Select value={statusFilter || '__all__'} onValueChange={v => setStatusFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Все статусы" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Все статусы</SelectItem>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90 text-white"
          data-testid="procurement-new-btn"
        >
          <Plus className="h-4 w-4 mr-1" />
          Новая заявка
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Название / комплектующее</th>
                <th className="text-center px-2 py-2 font-medium w-20">Кол-во</th>
                <th className="text-right px-2 py-2 font-medium w-24">Цена/ед</th>
                <th className="text-right px-2 py-2 font-medium w-28">Сумма</th>
                <th className="text-center px-2 py-2 font-medium w-32">Срок</th>
                <th className="text-center px-2 py-2 font-medium w-28">Статус</th>
                <th className="text-left px-2 py-2 font-medium w-36">Ответственный</th>
                <th className="text-center px-2 py-2 font-medium w-24">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin inline" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-12 text-muted-foreground">
                  {items.length === 0 ? 'Пока нет заявок. Создайте первую — данные о комплектующих подтянутся автоматически.' : 'Ничего не найдено по фильтрам'}
                </td></tr>
              ) : filtered.map(it => (
                <tr key={it.id}
                  className={`border-b hover:bg-muted/30 ${it.isOverdue ? 'bg-red-50/60' : ''}`}
                  data-testid={`procurement-row-${it.id}`}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium">{it.title}</div>
                    {it.componentName && (
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {it.componentName}{it.category ? ' · ' + it.category : ''}
                      </div>
                    )}
                    {it.supplier && (
                      <div className="text-[11px] text-muted-foreground">{it.supplier}</div>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-[10px] ${PRIORITY_META[it.priority]?.color}`}>
                        ● {PRIORITY_META[it.priority]?.label}
                      </span>
                      {it.notifyTelegram
                        ? <Bell className="h-3 w-3 text-indigo-500" />
                        : <BellOff className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </td>
                  <td className="text-center px-2 py-2">{it.quantity} <span className="text-[10px] text-muted-foreground">{it.unit}</span></td>
                  <td className="text-right px-2 py-2 font-mono text-xs">{fmtMoney(it.unitPrice)}</td>
                  <td className="text-right px-2 py-2 font-semibold">{fmtMoney(it.totalPrice)}</td>
                  <td className="text-center px-2 py-2">
                    {it.dueDate ? (
                      <span className={it.isOverdue ? 'text-red-600 font-semibold' : ''}>
                        {it.dueDate}
                        {it.isOverdue && (
                          <Badge variant="destructive" className="ml-1 text-[9px] py-0">просрочено</Badge>
                        )}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="text-center px-2 py-2">
                    <Badge variant="outline" className={`text-[10px] ${STATUS_META[it.status]?.color}`}>
                      {STATUS_META[it.status]?.label}
                    </Badge>
                  </td>
                  <td className="px-2 py-2 text-xs">{it.assigneeUsername || <span className="text-muted-foreground">—</span>}</td>
                  <td className="text-center px-2 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => { setEditing(it); setDialogOpen(true); }}
                        className="p-1 hover:bg-muted rounded"
                        data-testid={`procurement-edit-${it.id}`}
                        title="Редактировать"
                      >
                        <Pencil className="h-4 w-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => del(it.id)}
                        className="p-1 hover:bg-muted rounded"
                        data-testid={`procurement-delete-${it.id}`}
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <RequestDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editing}
        onSaved={fetchAll}
        components={components}
        users={users}
        refreshComponents={refreshComponents}
      />
    </div>
  );
}

const KpiTile = ({ label, value, icon: Icon, color, bg }) => (
  <div className="border rounded-lg bg-card p-4 flex items-center gap-3">
    <div className={`shrink-0 w-10 h-10 rounded-md flex items-center justify-center ${bg}`}>
      <Icon className={`w-5 h-5 ${color}`} />
    </div>
    <div className="min-w-0">
      <div className="text-2xl font-bold leading-none truncate">{value || 0}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  </div>
);
