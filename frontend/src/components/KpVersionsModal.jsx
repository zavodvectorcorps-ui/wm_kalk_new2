import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Loader2, History, AlertTriangle, RefreshCw, Download, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { getApiUrl } from '../utils/api';

const API_URL = getApiUrl();
const authHeaders = () => ({ 'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}` });
const fmtDate = s => s ? new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const VersionRow = ({ v, orderId, isCurrent, onRollback, busy }) => (
  <div
    className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${isCurrent ? 'bg-emerald-50 ring-1 ring-emerald-300' : 'bg-white'}`}
    data-testid={`kp-version-row-${v.version}`}
  >
    <Badge variant="outline" className="text-[10px] font-mono shrink-0">v{v.version}</Badge>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="truncate font-medium">{v.filename || `КП v${v.version}.pdf`}</span>
        {isCurrent && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shrink-0">Текущая</Badge>}
      </div>
      <div className="text-[11px] text-muted-foreground truncate">
        {fmtDate(v.created_at)}
        {v.employee_name ? ` · ${v.employee_name}` : ''}
        {v.total_amount ? ` · ${v.total_amount}` : ''}
      </div>
    </div>
    <a
      href={`${API_URL}/api/integrations/amocrm/calculator-pdf/${orderId}/version/${v.version}`}
      target="_blank" rel="noopener noreferrer"
      className="text-slate-400 hover:text-blue-600 p-1 shrink-0" title="Скачать PDF"
      data-testid={`kp-version-download-${v.version}`}
    >
      <Download className="w-4 h-4" />
    </a>
    {!isCurrent && (
      <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-blue-700" disabled={busy}
        onClick={() => {
          if (window.confirm(`Откатить КП на версию v${v.version}? Она станет текущей.`)) onRollback(v.version);
        }}
        data-testid={`kp-version-rollback-${v.version}`}>
        <RotateCcw className="w-3 h-3 mr-1" />Откатить
      </Button>
    )}
  </div>
);

export const KpVersionsModal = ({ open, onClose, orderId, onChanged }) => {
  const [versions, setVersions] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/integrations/amocrm/calculator-pdf-versions/${orderId}`, { headers: authHeaders() });
      if (r.ok) {
        const d = await r.json();
        setVersions(d.versions || []);
        setCurrent(d.currentVersion ?? null);
      } else {
        toast.error('Ошибка загрузки версий КП');
      }
    } catch (e) { toast.error('Ошибка сети'); }
    setLoading(false);
  }, [orderId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const handleRollback = async (version) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/integrations/amocrm/calculator-pdf/${orderId}/rollback/${version}`, {
        method: 'POST', headers: authHeaders(),
      });
      if (r.ok) {
        toast.success(`КП откачен на версию v${version}`);
        await load();
        onChanged?.();
      } else {
        const err = await r.json().catch(() => ({}));
        toast.error(err.detail || 'Ошибка отката');
      }
    } catch (e) { toast.error('Ошибка сети'); }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="kp-versions-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            Версии КП
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground">
            Хранятся 2 последние версии по заказу. Можно скачать любую или откатить на неё.
          </p>
          <Button size="sm" variant="ghost" className="h-7" onClick={load} disabled={loading || busy} data-testid="kp-versions-refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />Загрузка…
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground" data-testid="kp-versions-empty">
            <AlertTriangle className="w-8 h-8 mb-2 text-slate-400" />
            <p className="text-sm">Версий КП по этому заказу пока нет.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {versions.map(v => (
              <VersionRow
                key={v.version}
                v={v}
                orderId={orderId}
                isCurrent={current != null && v.version === current}
                onRollback={handleRollback}
                busy={busy}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default KpVersionsModal;
