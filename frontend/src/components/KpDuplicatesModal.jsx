import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Loader2, FileText, AlertTriangle, RefreshCw, Trash2, Archive, RotateCcw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { getApiUrl } from '../utils/api';

const API_URL = getApiUrl();
const authHeaders = () => ({ 'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}` });
const fmtDate = s => s ? new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const KpRow = ({ kp, onAction, busy }) => {
  const isObsolete = kp.obsolete;
  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${isObsolete ? 'bg-slate-50 opacity-70' : 'bg-white'} ${kp.isLinked ? 'ring-1 ring-emerald-300' : ''}`}
      data-testid={`kp-dup-row-${kp.pdfId}`}
    >
      <Badge variant="outline" className="text-[10px] font-mono shrink-0">v{kp.version}</Badge>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`truncate font-medium ${isObsolete ? 'line-through text-muted-foreground' : ''}`}>{kp.filename || 'КП.pdf'}</span>
          {kp.isLinked && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shrink-0">Привязан</Badge>}
          {kp.isLatest && !isObsolete && <Badge className="text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-100 shrink-0">Актуальный</Badge>}
          {isObsolete && <Badge className="text-[10px] bg-slate-200 text-slate-600 hover:bg-slate-200 shrink-0">Устаревший</Badge>}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{fmtDate(kp.created_at)}{kp.order_id ? ` · заказ ${kp.order_id}` : ''}</div>
      </div>
      {kp.cloudinary_url && (
        <a href={kp.cloudinary_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600 p-1 shrink-0" title="Открыть PDF" data-testid={`kp-dup-open-${kp.pdfId}`}>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
      {isObsolete ? (
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-emerald-700" disabled={busy} onClick={() => onAction([kp.pdfId], 'restore')} data-testid={`kp-dup-restore-${kp.pdfId}`}>
          <RotateCcw className="w-3 h-3 mr-1" />Вернуть
        </Button>
      ) : (
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-amber-700" disabled={busy} onClick={() => onAction([kp.pdfId], 'obsolete')} data-testid={`kp-dup-obsolete-${kp.pdfId}`}>
          <Archive className="w-3 h-3 mr-1" />Устаревший
        </Button>
      )}
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" disabled={busy} onClick={() => {
        if (window.confirm('Удалить этот КП безвозвратно из базы?')) onAction([kp.pdfId], 'delete');
      }} data-testid={`kp-dup-delete-${kp.pdfId}`}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
};

const KpGroup = ({ group, onAction, busy }) => {
  const activeOld = (group.pdfs || []).filter(p => !p.obsolete && !p.isLatest);
  return (
    <div className="border rounded-xl p-3 space-y-2" data-testid={`kp-dup-group-${group.amocrm_id}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{group.clientName || 'Без имени'}</div>
          <div className="text-[11px] text-muted-foreground">amoCRM #{group.amocrm_id} · {group.count} КП</div>
        </div>
        {activeOld.length > 0 && (
          <Button size="sm" variant="outline" className="h-7 text-[11px] shrink-0" disabled={busy}
            onClick={() => {
              if (window.confirm(`Пометить устаревшими ${activeOld.length} старых КП (оставить самый свежий)?`))
                onAction(activeOld.map(p => p.pdfId), 'obsolete');
            }}
            data-testid={`kp-dup-mark-old-${group.amocrm_id}`}>
            <Archive className="w-3 h-3 mr-1" />Старые → устаревшие ({activeOld.length})
          </Button>
        )}
      </div>
      <div className="space-y-1.5">
        {(group.pdfs || []).map(kp => <KpRow key={kp.pdfId} kp={kp} onAction={onAction} busy={busy} />)}
      </div>
    </div>
  );
};

export const KpDuplicatesModal = ({ open, onClose, leadId = null, onChanged }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = leadId
        ? `${API_URL}/api/sauna-crm/leads/${leadId}/kp-duplicates`
        : `${API_URL}/api/sauna-crm/kp-duplicates`;
      const r = await fetch(endpoint, { headers: authHeaders() });
      if (r.ok) {
        const d = await r.json();
        if (leadId) {
          setGroups(d.count > 0 ? [{ amocrm_id: d.amocrm_id, count: d.count, leadId: d.leadId, clientName: d.clientName, pdfs: d.pdfs }] : []);
        } else {
          setGroups(d.groups || []);
        }
      } else {
        toast.error('Ошибка загрузки дублей КП');
      }
    } catch (e) { toast.error('Ошибка загрузки'); }
    setLoading(false);
  }, [leadId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const handleAction = async (pdfIds, mode) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/sauna-crm/kp-duplicates/action`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfIds, mode }),
      });
      if (r.ok) {
        const d = await r.json();
        const labels = { obsolete: 'Помечено устаревшими', restore: 'Восстановлено', delete: 'Удалено' };
        toast.success(`${labels[mode] || 'Готово'}: ${d.affected}`);
        await load();
        onChanged?.();
      } else {
        const err = await r.json().catch(() => ({}));
        toast.error(err.detail || 'Ошибка операции');
      }
    } catch (e) { toast.error('Ошибка сети'); }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="kp-duplicates-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            {leadId ? 'Версии КП по этой сделке' : 'Дубли коммерческих предложений'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground">
            {leadId
              ? 'Самый свежий КП привязан к заказу. Старые можно пометить устаревшими или удалить.'
              : 'Сделки, к которым привязано больше одного КП. Оставьте актуальный, старые — в устаревшие.'}
          </p>
          <Button size="sm" variant="ghost" className="h-7" onClick={load} disabled={loading || busy} data-testid="kp-dup-refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />Загрузка…
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground" data-testid="kp-dup-empty">
            <AlertTriangle className="w-8 h-8 mb-2 text-emerald-500" />
            <p className="text-sm">{leadId ? 'Дублей КП нет — привязан один актуальный КП.' : 'Дублей КП не найдено.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map(g => <KpGroup key={g.amocrm_id} group={g} onAction={handleAction} busy={busy} />)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default KpDuplicatesModal;
