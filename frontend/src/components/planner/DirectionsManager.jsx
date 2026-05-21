import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, X, Check, Loader2, Settings2, GripVertical } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/api';
import { getAuthHeaders } from './constants';

const API = getApiUrl();

// Quick palette of pleasant tailwind hues — single-click picks.
const COLOR_SWATCHES = [
  '#3b82f6', '#06b6d4', '#10b981', '#84cc16',
  '#f59e0b', '#f97316', '#ef4444', '#ec4899',
  '#a855f7', '#8b5cf6', '#64748b', '#1f2937',
];

/**
 * Admin-only editor for planner task directions.
 * - Lists existing directions, sorted by sortOrder.
 * - Add new (name + colour + sort) at the top.
 * - Inline edit each row (name, colour, sort).
 * - Delete with confirm.
 */
export default function DirectionsManager({ open, onClose, onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [editing, setEditing] = useState({}); // id -> draft
  const [newRow, setNewRow] = useState({ name: '', color: '#3b82f6', sortOrder: 10 });
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/planner/directions`, { headers: getAuthHeaders() });
      setItems(r.data.items || []);
    } catch {
      toast.error('Не удалось загрузить направления');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) reload(); /* eslint-disable-next-line */ }, [open]);

  const beginEdit = (d) => {
    setEditing((prev) => ({
      ...prev,
      [d.id]: { name: d.name || '', color: d.color || '#64748b', sortOrder: d.sortOrder ?? 100 },
    }));
  };
  const cancelEdit = (id) => {
    setEditing((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };
  const setEditField = (id, field, value) => {
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const saveEdit = async (id) => {
    const draft = editing[id];
    if (!draft?.name?.trim()) {
      toast.error('Название обязательно');
      return;
    }
    setSavingId(id);
    try {
      await axios.put(`${API}/api/planner/directions/${id}`, {
        name: draft.name.trim(),
        color: draft.color,
        sortOrder: Number(draft.sortOrder) || 100,
      }, { headers: getAuthHeaders() });
      toast.success('Направление обновлено');
      cancelEdit(id);
      await reload();
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (d) => {
    if (!window.confirm(`Удалить направление «${d.name}»? Существующие задачи с этим направлением останутся, но без привязки.`)) return;
    setSavingId(d.id);
    try {
      await axios.delete(`${API}/api/planner/directions/${d.id}`, { headers: getAuthHeaders() });
      toast.success('Направление удалено');
      await reload();
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка удаления');
    } finally {
      setSavingId(null);
    }
  };

  const create = async () => {
    if (!newRow.name.trim()) {
      toast.error('Введите название');
      return;
    }
    setCreating(true);
    try {
      await axios.post(`${API}/api/planner/directions`, {
        name: newRow.name.trim(),
        color: newRow.color,
        sortOrder: Number(newRow.sortOrder) || 100,
      }, { headers: getAuthHeaders() });
      toast.success('Направление добавлено');
      setNewRow({ name: '', color: '#3b82f6', sortOrder: 10 });
      await reload();
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка создания');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl" data-testid="directions-manager">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-orange-600" />
            Направления задач
          </DialogTitle>
          <DialogDescription>
            Создавайте новые направления и редактируйте существующие.
            Цвет используется в метках на доске и в таблице.
          </DialogDescription>
        </DialogHeader>

        {/* New row */}
        <div className="rounded-md border border-dashed bg-orange-50/40 p-3 space-y-2" data-testid="dm-new-row">
          <div className="text-xs font-semibold uppercase tracking-wide text-orange-700">Новое направление</div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={newRow.name}
              onChange={(e) => setNewRow({ ...newRow, name: e.target.value })}
              placeholder="Например: «Маркетинг»"
              className="flex-1 min-w-[180px] h-9"
              data-testid="dm-new-name"
            />
            <ColorPicker value={newRow.color} onChange={(c) => setNewRow({ ...newRow, color: c })} testIdPrefix="dm-new" />
            <Input
              type="number"
              value={newRow.sortOrder}
              onChange={(e) => setNewRow({ ...newRow, sortOrder: e.target.value })}
              placeholder="порядок"
              className="w-20 h-9 text-right"
              title="Порядок (меньше = выше)"
              data-testid="dm-new-sort"
            />
            <Button
              onClick={create}
              disabled={creating || !newRow.name.trim()}
              size="sm"
              className="gap-1 h-9 bg-orange-500 hover:bg-orange-600"
              data-testid="dm-new-save"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Добавить
            </Button>
          </div>
        </div>

        {/* Existing list */}
        <div className="border rounded-md overflow-hidden">
          {loading ? (
            <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin text-orange-500 inline" /></div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Нет направлений</div>
          ) : (
            items.map((d) => {
              const isEditing = !!editing[d.id];
              const draft = editing[d.id] || d;
              return (
                <div key={d.id} className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-slate-50/60 transition-colors" data-testid={`dm-row-${d.id}`}>
                  <GripVertical className="h-4 w-4 text-slate-300" />
                  {isEditing ? (
                    <>
                      <Input
                        value={draft.name}
                        onChange={(e) => setEditField(d.id, 'name', e.target.value)}
                        className="flex-1 h-8"
                        data-testid={`dm-edit-name-${d.id}`}
                      />
                      <ColorPicker
                        value={draft.color}
                        onChange={(c) => setEditField(d.id, 'color', c)}
                        testIdPrefix={`dm-edit-${d.id}`}
                      />
                      <Input
                        type="number"
                        value={draft.sortOrder}
                        onChange={(e) => setEditField(d.id, 'sortOrder', e.target.value)}
                        className="w-16 h-8 text-right"
                        data-testid={`dm-edit-sort-${d.id}`}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                        onClick={() => saveEdit(d.id)}
                        disabled={savingId === d.id}
                        data-testid={`dm-edit-save-${d.id}`}
                      >
                        {savingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => cancelEdit(d.id)} data-testid={`dm-edit-cancel-${d.id}`}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: d.color || '#64748b' }} />
                      <div className="flex-1 text-sm font-medium">{d.name}</div>
                      <span className="text-[10px] text-muted-foreground font-mono">#{d.sortOrder ?? 100}</span>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500" onClick={() => beginEdit(d)} data-testid={`dm-edit-btn-${d.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-600 hover:bg-red-50"
                        onClick={() => remove(d)}
                        disabled={savingId === d.id}
                        data-testid={`dm-delete-${d.id}`}
                      >
                        {savingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="text-[11px] text-muted-foreground">
          Подсказка: «Порядок» определяет порядок отображения (меньше — выше). Цвет помогает быстро различать направления в списке задач.
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Inline colour picker — popover-like grid of swatches + free-form hex input. */
function ColorPicker({ value, onChange, testIdPrefix }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-md border-2 border-slate-200 cursor-pointer hover:border-slate-400 transition-colors"
        style={{ backgroundColor: value || '#64748b' }}
        title="Цвет"
        data-testid={`${testIdPrefix}-color-toggle`}
      />
      {open && (
        <>
          {/* click-outside catcher */}
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
            aria-label="close colour picker"
          />
          <div
            className="absolute right-0 top-10 z-50 bg-white border rounded-md shadow-lg p-2 w-44"
            data-testid={`${testIdPrefix}-color-panel`}
          >
            <div className="grid grid-cols-6 gap-1.5">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { onChange(c); setOpen(false); }}
                  className={`w-6 h-6 rounded-md border ${value === c ? 'ring-2 ring-offset-1 ring-orange-500' : ''}`}
                  style={{ backgroundColor: c }}
                  title={c}
                  data-testid={`${testIdPrefix}-color-${c.replace('#', '')}`}
                />
              ))}
            </div>
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="mt-2 h-7 text-xs font-mono"
              placeholder="#3b82f6"
              data-testid={`${testIdPrefix}-color-hex`}
            />
          </div>
        </>
      )}
    </div>
  );
}
