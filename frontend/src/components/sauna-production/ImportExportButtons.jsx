import React, { useState } from 'react';
import axios from 'axios';
import { Download, Upload, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet, X, FilePlus } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { COST_BASE, authHeaders } from './costConstants';

/**
 * ImportExportButtons — Excel round-trip for components + tech-cards.
 *
 * Buttons:
 *  • "Шаблон"   → /api/sauna-production/cost/export?template=true
 *                 — full XLSX with blank rows for every position WITHOUT a tech-card.
 *                 Only shown when `showTemplate` (e.g. on the TechCards tab).
 *  • "Экспорт"  → /api/sauna-production/cost/export
 *  • "Импорт"   → dialog → upload file → preview diff → confirm → commit
 */
export default function ImportExportButtons({ onImported, showTemplate = false }) {
  const [open, setOpen] = useState(false);

  const download = async ({ template = false } = {}) => {
    try {
      const url = template ? `${COST_BASE}/export?template=true` : `${COST_BASE}/export`;
      const r = await axios.get(url, {
        headers: authHeaders(),
        responseType: 'blob',
      });
      const cd = r.headers['content-disposition'] || '';
      const m = cd.match(/filename=([^;]+)/);
      const fname = m ? m[1].trim() : `sauna_production_${Date.now()}.xlsx`;
      const dlUrl = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = dlUrl; a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(dlUrl);
      toast.success(template ? 'Шаблон выгружен' : 'Экспорт начат');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка экспорта');
    }
  };

  return (
    <>
      {showTemplate && (
        <Button variant="outline" onClick={() => download({ template: true })} className="h-9 border-amber-300 text-amber-800 hover:bg-amber-50" data-testid="prod-template-btn">
          <FilePlus className="w-4 h-4 mr-1" /> Шаблон
        </Button>
      )}
      <Button variant="outline" onClick={() => download({ template: false })} className="h-9" data-testid="prod-export-btn">
        <Download className="w-4 h-4 mr-1" /> Экспорт
      </Button>
      <Button variant="outline" onClick={() => setOpen(true)} className="h-9" data-testid="prod-import-btn">
        <Upload className="w-4 h-4 mr-1" /> Импорт
      </Button>
      {open && <ImportDialog onClose={() => setOpen(false)} onImported={onImported} />}
    </>
  );
}

function ImportDialog({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [commitDone, setCommitDone] = useState(null);

  const runDryRun = async (f) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await axios.post(`${COST_BASE}/import-dry-run`, fd, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      setPreview(r.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Не удалось прочитать файл');
    } finally { setBusy(false); }
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(null);
    setCommitDone(null);
    runDryRun(f);
  };

  const commit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await axios.post(`${COST_BASE}/import-commit`, fd, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      setCommitDone(r.data);
      toast.success('Импорт завершён');
      onImported?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка импорта');
    } finally { setBusy(false); }
  };

  const totalChanges = preview
    ? preview.components.add.length + preview.components.update.length
      + preview.techCards.add.length + preview.techCards.update.length
    : 0;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="import-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-orange-600" />Импорт компонентов и тех.карт</DialogTitle>
          <DialogDescription>
            Загрузите Excel-файл с двумя листами: <b>Components</b> и <b>TechCards</b>.
            Сначала покажем превью изменений — данные применятся только после подтверждения.
          </DialogDescription>
        </DialogHeader>

        {commitDone ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center" data-testid="import-success">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
            <div className="text-lg font-medium">Импорт выполнен</div>
            <div className="text-sm text-muted-foreground">
              Компоненты: <b className="text-foreground">+{commitDone.components.added}</b> новых, <b className="text-foreground">{commitDone.components.updated}</b> обновлено<br />
              Тех.карты:&nbsp; <b className="text-foreground">+{commitDone.techCards.added}</b> новых, <b className="text-foreground">{commitDone.techCards.updated}</b> обновлено
              {commitDone.errors?.length > 0 && (
                <div className="mt-2 text-amber-700">⚠ Предупреждения: {commitDone.errors.length}</div>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <input
              type="file"
              accept=".xlsx"
              onChange={onPick}
              className="block w-full text-sm border rounded-md p-2 cursor-pointer"
              data-testid="import-file-input"
            />
            {busy && (
              <div className="py-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
            )}
            {preview && !busy && (
              <div className="space-y-3 pt-3" data-testid="import-preview">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Найдено компонентов" value={preview.summary.componentsParsed} />
                  <Stat label="Найдено тех.карт" value={preview.summary.techCardsParsed} />
                </div>
                {preview.errors?.length > 0 && (
                  <div className="border border-red-300 rounded-md bg-red-50 p-2 text-xs">
                    <div className="font-semibold text-red-800 inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Ошибки разбора ({preview.errors.length})</div>
                    <ul className="ml-4 list-disc text-red-700 mt-1">
                      {preview.errors.slice(0, 5).map((e, i) => <li key={i}>{e.sheet} стр. {e.row}: {e.message}</li>)}
                    </ul>
                  </div>
                )}

                <DiffSection title="Компоненты" diff={preview.components} keyName="name" />
                <DiffSection title="Тех.карты" diff={preview.techCards} keyName="scope" extra={(r) => `${r.scope || r.key?.[0]} · ${r.modelId || r.optionId || ''}`} />

                {totalChanges === 0 && (
                  <div className="text-xs text-muted-foreground py-2 text-center">
                    Все позиции совпадают с базой — изменений не будет.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {commitDone ? (
            <Button onClick={onClose} data-testid="import-done">Закрыть</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-1" />Отмена</Button>
              <Button
                onClick={commit}
                disabled={busy || !preview || totalChanges === 0}
                className="bg-orange-500 hover:bg-orange-600"
                data-testid="import-commit-btn"
              >
                {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                Применить ({totalChanges})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiffSection({ title, diff, keyName, extra }) {
  return (
    <div className="border rounded-md">
      <div className="px-3 py-2 bg-slate-50 border-b text-sm font-semibold flex flex-wrap items-center gap-2">
        {title}
        <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">+{diff.add.length} новых</Badge>
        <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">{diff.update.length} обновл.</Badge>
        <Badge variant="outline" className="text-slate-600">{diff.unchanged.length} без изм.</Badge>
      </div>
      <div className="max-h-[200px] overflow-y-auto text-xs">
        {diff.add.length === 0 && diff.update.length === 0 ? (
          <div className="p-3 text-muted-foreground text-center">Изменений нет</div>
        ) : (
          <table className="w-full">
            <tbody>
              {diff.add.map((r, i) => (
                <tr key={'add' + i} className="border-t bg-emerald-50/30">
                  <td className="px-3 py-1 w-20"><Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700">+ новое</Badge></td>
                  <td className="px-3 py-1">{r[keyName] || extra?.(r) || JSON.stringify(r).slice(0, 80)}</td>
                </tr>
              ))}
              {diff.update.map((r, i) => (
                <tr key={'upd' + i} className="border-t bg-blue-50/30">
                  <td className="px-3 py-1 w-20"><Badge variant="outline" className="text-[10px] border-blue-400 text-blue-700">обновл.</Badge></td>
                  <td className="px-3 py-1">
                    <div>{r[keyName] || extra?.(r) || r.id}</div>
                    {r.changes && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {Object.entries(r.changes).map(([k, v]) => (
                          <span key={k} className="inline-block mr-2">
                            <b>{k}</b>: <s>{String(v.old ?? '—')}</s> → {String(v.new ?? '—')}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="border rounded-md p-2">
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
