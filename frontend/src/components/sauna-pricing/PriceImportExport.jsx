import React, { useRef, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Download, Upload, FileSpreadsheet, FileText, Loader2, AlertTriangle, CheckCircle2, Pencil, FilePlus2, X, History, Undo2 } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../ui/dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/api';

const API = getApiUrl();

const authHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const STATUS_META = {
  added: { color: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: FilePlus2, label: 'Добавлено' },
  modified: { color: 'bg-amber-100 text-amber-800 border-amber-300', icon: Pencil, label: 'Изменено' },
  unchanged: { color: 'bg-slate-100 text-slate-600 border-slate-200', icon: CheckCircle2, label: 'Без изменений' },
  error: { color: 'bg-red-100 text-red-700 border-red-300', icon: AlertTriangle, label: 'Ошибка' },
};

/**
 * PriceImportExport — admin-only Excel/CSV export + import (with dry-run diff).
 *
 * Props:
 *   dealerId  — if provided, exports include a `dealerPrice` column and imports
 *               upsert dealer overrides for this dealer.
 *   dealerName — optional label shown in the dialog header.
 *   onImported — callback fired after a successful commit (parent should reload data).
 */
export default function PriceImportExport({ dealerId = null, dealerName = '', onImported }) {
  const fileInput = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [hideUnchanged, setHideUnchanged] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  // Dry-run result
  const [dryRun, setDryRun] = useState(null); // {summary, rows, totalRows, dealerId, _file}

  const isDealerMode = !!dealerId;

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format });
      if (dealerId) params.set('dealerId', dealerId);
      const res = await axios.get(`${API}/api/sauna/prices/export?${params}`, {
        headers: authHeaders(),
        responseType: 'blob',
      });
      const cd = res.headers['content-disposition'] || '';
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match ? match[1] : `sauna_prices.${format}`;
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`Экспорт ${format.toUpperCase()} готов`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  const triggerFilePick = () => fileInput.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so same file can be re-picked
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (dealerId) form.append('dealerId', dealerId);
      const res = await axios.post(`${API}/api/sauna/prices/import/dry-run`, form, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      setDryRun({ ...res.data, _file: file });
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Не удалось разобрать файл');
    } finally {
      setUploading(false);
    }
  };

  const handleCommit = async () => {
    if (!dryRun?._file) return;
    setCommitting(true);
    try {
      const form = new FormData();
      form.append('file', dryRun._file);
      if (dealerId) form.append('dealerId', dealerId);
      const res = await axios.post(`${API}/api/sauna/prices/import/commit`, form, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      const s = res.data.summary || {};
      toast.success(
        `Импорт применён: +${s.added || 0} новых, ~${s.modified || 0} изм., ${s.unchanged || 0} без изм.`
          + (res.data.overridesUpserted ? `, ${res.data.overridesUpserted} оверрайдов` : '')
      );
      setDryRun(null);
      onImported?.(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Ошибка применения');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <>
      <div className="inline-flex items-center gap-2" data-testid="price-import-export-bar">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              data-testid="export-prices-btn"
            >
              {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              Экспорт
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('xlsx')} data-testid="export-xlsx">
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('csv')} data-testid="export-csv">
              <FileText className="h-4 w-4 mr-2" /> CSV (.csv)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          onClick={triggerFilePick}
          disabled={uploading}
          className="border-amber-300 text-amber-700 hover:bg-amber-50"
          data-testid="import-prices-btn"
        >
          {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
          Импорт
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowHistory(true)}
          className="border-slate-300 text-slate-700 hover:bg-slate-50"
          data-testid="history-prices-btn"
          title="История импортов и откат"
        >
          <History className="h-4 w-4 mr-1" />
          История
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.csv"
          onChange={handleFile}
          className="hidden"
          data-testid="import-file-input"
        />
      </div>

      {dryRun && (
        <DryRunDialog
          dryRun={dryRun}
          isDealerMode={isDealerMode}
          dealerName={dealerName}
          hideUnchanged={hideUnchanged}
          setHideUnchanged={setHideUnchanged}
          committing={committing}
          onCancel={() => setDryRun(null)}
          onCommit={handleCommit}
        />
      )}

      {showHistory && (
        <HistoryDialog
          dealerId={dealerId}
          dealerName={dealerName}
          onClose={() => setShowHistory(false)}
          onRolledBack={() => onImported?.()}
        />
      )}
    </>
  );
}

function HistoryDialog({ dealerId, dealerName, onClose, onRolledBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rollingId, setRollingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (dealerId) params.set('dealerId', dealerId);
      const res = await axios.get(`${API}/api/sauna/prices/import/history?${params}`, {
        headers: authHeaders(),
      });
      setItems(res.data.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Не удалось загрузить историю');
    } finally {
      setLoading(false);
    }
  }, [dealerId]);

  useEffect(() => { load(); }, [load]);

  const handleRollback = async (id) => {
    if (!window.confirm('Откатить этот импорт? Текущие значения будут заменены снимком до коммита.')) return;
    setRollingId(id);
    try {
      await axios.post(
        `${API}/api/sauna/prices/import/history/${id}/rollback`,
        {},
        { headers: authHeaders() },
      );
      toast.success('Откат выполнен');
      onRolledBack?.();
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка отката');
    } finally {
      setRollingId(null);
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
    } catch { return iso; }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="history-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-slate-600" />
            История импортов
            {dealerId && (
              <Badge variant="outline" className="ml-2 border-orange-300 text-orange-700">
                Дилер: {dealerName || dealerId}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Снимок состояния прайса до каждого импорта. Любой коммит можно откатить за один клик.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto border rounded-md">
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Импортов пока не было
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2">Дата</th>
                  <th className="px-3 py-2">Кто</th>
                  <th className="px-3 py-2">Файл</th>
                  <th className="px-3 py-2">Сводка</th>
                  <th className="px-3 py-2 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((h) => {
                  const s = h.summary || {};
                  return (
                    <tr key={h.id} className="border-t align-top hover:bg-slate-50/50" data-testid={`history-row-${h.id}`}>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(h.timestamp)}</td>
                      <td className="px-3 py-2 font-medium">{h.adminUsername || '—'}</td>
                      <td className="px-3 py-2 font-mono text-[11px] break-all">{h.filename || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {s.added ? <Tag color="emerald">+{s.added}</Tag> : null}
                          {s.modified ? <Tag color="amber">~{s.modified}</Tag> : null}
                          {s.errors ? <Tag color="red">!{s.errors}</Tag> : null}
                          {h.overridesUpserted ? <Tag color="orange">оверр. {h.overridesUpserted}</Tag> : null}
                          {!s.added && !s.modified && !s.errors && !h.overridesUpserted ? (
                            <span className="text-slate-400">без изменений</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {h.rolledBack ? (
                          <Badge variant="outline" className="text-slate-500 border-slate-300">
                            Откачен
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={rollingId === h.id}
                            onClick={() => handleRollback(h.id)}
                            data-testid={`rollback-${h.id}`}
                            className="border-red-300 text-red-600 hover:bg-red-50"
                          >
                            {rollingId === h.id
                              ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              : <Undo2 className="h-3 w-3 mr-1" />}
                            Откатить
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button variant="outline" onClick={onClose} data-testid="history-close">
            <X className="h-4 w-4 mr-1" /> Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Tag({ color, children }) {
  const palettes = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
    slate:   'bg-slate-50 text-slate-600 border-slate-200',
    red:     'bg-red-50 text-red-700 border-red-200',
    orange:  'bg-orange-50 text-orange-700 border-orange-200',
  };
  return (
    <span className={`inline-flex items-center text-[11px] px-1.5 py-0.5 rounded border ${palettes[color] || palettes.slate}`}>
      {children}
    </span>
  );
}

function DryRunDialog({ dryRun, isDealerMode, dealerName, hideUnchanged, setHideUnchanged, committing, onCancel, onCommit }) {
  const s = dryRun.summary || {};
  const total = (s.added || 0) + (s.modified || 0) + (s.unchanged || 0) + (s.errors || 0);
  const hasChanges = (s.added || 0) + (s.modified || 0) > 0;
  const visibleRows = (dryRun.rows || []).filter((r) => !hideUnchanged || r.status !== 'unchanged');
  const marginAlerts = s.marginAlerts || 0;

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="dry-run-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-amber-600" />
            Предпросмотр импорта
            {isDealerMode && (
              <Badge variant="outline" className="ml-2 border-orange-300 text-orange-700">
                Дилер: {dealerName || dryRun.dealerId}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Проверьте изменения. Ничего не будет записано, пока вы не нажмёте «Применить».
          </DialogDescription>
        </DialogHeader>

        {marginAlerts > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-red-300 bg-red-50 text-red-700 text-xs" data-testid="margin-alert-banner">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <b>Внимание:</b> у {marginAlerts}{' '}
              {marginAlerts === 1 ? 'позиции' : 'позиций'} маржа после импорта станет ниже 15% — выделены красным ниже.
            </span>
          </div>
        )}

        {/* Summary */}
        <div className="flex flex-wrap gap-2 py-2">
          <SummaryChip label="Добавлено" value={s.added || 0} color="emerald" />
          <SummaryChip label="Изменено" value={s.modified || 0} color="amber" />
          <SummaryChip label="Без изм." value={s.unchanged || 0} color="slate" />
          {s.errors > 0 && <SummaryChip label="Ошибки" value={s.errors} color="red" />}
          {isDealerMode && <SummaryChip label="Оверрайды" value={s.overrides_changed || 0} color="orange" />}
          {marginAlerts > 0 && <SummaryChip label="Маржа <15%" value={marginAlerts} color="red" />}
          <SummaryChip label="Всего строк" value={total} color="slate" />
          <label className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={hideUnchanged}
              onChange={(e) => setHideUnchanged(e.target.checked)}
              data-testid="hide-unchanged-toggle"
            />
            Скрыть «без изменений»
          </label>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-auto border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left">
                <th className="px-2 py-2 w-28">Статус</th>
                <th className="px-2 py-2 w-32">Тип</th>
                <th className="px-2 py-2">ID / Имя</th>
                <th className="px-2 py-2">Изменения</th>
                <th className="px-2 py-2 w-32">Маржа</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr><td colSpan={5} className="px-2 py-8 text-center text-muted-foreground">Нет строк для отображения</td></tr>
              ) : visibleRows.map((r, idx) => <DiffRow key={idx} row={r} />)}
            </tbody>
          </table>
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button variant="outline" onClick={onCancel} disabled={committing} data-testid="dry-run-cancel">
            <X className="h-4 w-4 mr-1" /> Отмена
          </Button>
          <Button
            onClick={onCommit}
            disabled={committing || !hasChanges}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-60"
            data-testid="dry-run-commit"
          >
            {committing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            {hasChanges ? `Применить (${(s.added || 0) + (s.modified || 0)} изменений)` : 'Нет изменений'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryChip({ label, value, color }) {
  const palettes = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
    slate:   'bg-slate-50 text-slate-600 border-slate-200',
    red:     'bg-red-50 text-red-700 border-red-200',
    orange:  'bg-orange-50 text-orange-700 border-orange-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border ${palettes[color] || palettes.slate}`}>
      <span className="font-medium">{value}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}

function DiffRow({ row }) {
  const meta = STATUS_META[row.status] || STATUS_META.unchanged;
  const Icon = meta.icon;
  const diffEntries = Object.entries(row.diff || {});
  const m = row.margin || {};
  const lowMargin = !!row.lowMargin;
  const showMargin = m.oldAmount !== null && m.oldAmount !== undefined || m.newAmount !== null && m.newAmount !== undefined;
  return (
    <tr className={`border-t align-top hover:bg-slate-50/50 ${lowMargin ? 'bg-red-50/40' : ''}`} data-testid={`diff-row-${row.status}`}>
      <td className="px-2 py-2">
        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border ${meta.color}`}>
          <Icon className="h-3 w-3" />
          {meta.label}
        </span>
      </td>
      <td className="px-2 py-2 font-mono text-[11px] text-slate-500">{row.type}</td>
      <td className="px-2 py-2">
        <div className="font-medium">{row.name || <span className="text-slate-400">— без имени —</span>}</div>
        <div className="text-[11px] text-slate-500 font-mono break-all">
          {row.id}{row.parentId ? ` ← ${row.parentId}` : ''}
        </div>
        {row.error && <div className="text-[11px] text-red-600 mt-1">⚠ {row.error}</div>}
      </td>
      <td className="px-2 py-2">
        {diffEntries.length === 0 ? (
          <span className="text-slate-400">—</span>
        ) : (
          <ul className="space-y-0.5">
            {diffEntries.map(([field, { old, new: newVal }]) => (
              <li key={field} className="font-mono text-[11px]">
                <span className="text-slate-500">{field}:</span>{' '}
                <span className="line-through text-slate-400">{formatVal(old)}</span>{' '}
                <span className="text-slate-400">→</span>{' '}
                <span className="text-emerald-700 font-medium">{formatVal(newVal)}</span>
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-2 py-2 text-[11px] font-mono whitespace-nowrap" data-testid={`margin-cell-${row.id || row.type}`}>
        {showMargin ? (
          <MarginCell margin={m} lowMargin={lowMargin} />
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
    </tr>
  );
}

function MarginCell({ margin, lowMargin }) {
  const oldPct = margin.oldPct;
  const newPct = margin.newPct;
  const oldAmt = margin.oldAmount;
  const newAmt = margin.newAmount;
  const delta = margin.delta;
  const changed = delta !== null && delta !== undefined && delta !== 0;
  const newColor = lowMargin
    ? 'text-red-700 font-bold'
    : (changed && delta < 0 ? 'text-amber-700' : 'text-emerald-700');
  return (
    <div className="space-y-0.5 leading-tight">
      {changed && oldAmt !== null && oldAmt !== undefined ? (
        <div className="text-slate-400 line-through">
          {oldAmt} ({oldPct !== null && oldPct !== undefined ? `${oldPct}%` : '—'})
        </div>
      ) : null}
      <div className={newColor}>
        {newAmt !== null && newAmt !== undefined ? newAmt : '—'}
        {newPct !== null && newPct !== undefined ? ` (${newPct}%)` : ''}
        {lowMargin && <AlertTriangle className="inline h-3 w-3 ml-1 -mt-0.5" />}
      </div>
    </div>
  );
}

function formatVal(v) {
  if (v === null || v === undefined || v === '') return '∅';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'string' && v.length > 40) return v.slice(0, 40) + '…';
  return String(v);
}
