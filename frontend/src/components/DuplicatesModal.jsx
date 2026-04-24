import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Loader2, Users, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getApiUrl } from '../utils/api';

const API_URL = getApiUrl();

const fmtMoney = v => v ? Number(v).toLocaleString('ru-RU') + ' zł' : '—';
const fmtDate = s => s ? new Date(s).toLocaleDateString('ru-RU') : '—';

export const DuplicatesModal = ({ open, onClose, onMerged }) => {
  const [data, setData] = useState({ byAmoId: [], byPhone: [] });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('byPhone');
  const [merging, setMerging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/sauna-crm/duplicates`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token') || ''}` }
      });
      if (r.ok) setData(await r.json());
    } catch (e) { toast.error('Ошибка загрузки'); }
    setLoading(false);
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const handleMerge = async (group, keepId) => {
    if (merging) return;
    const removeIds = group.leads.map(l => l.id).filter(id => id !== keepId);
    if (!removeIds.length) return;
    if (!window.confirm(`Объединить ${removeIds.length} дубликатов в сделку ${keepId}? Удалённые сделки нельзя будет восстановить.`)) return;
    setMerging(true);
    try {
      const r = await fetch(`${API_URL}/api/sauna-crm/merge-duplicates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || ''}`
        },
        body: JSON.stringify({ keepId, removeIds })
      });
      const res = await r.json();
      if (r.ok) {
        toast.success(`Объединено: ${res.merged} → в ${res.keepId}`);
        await load();
        onMerged?.();
      } else {
        toast.error(res.detail || 'Ошибка');
      }
    } catch (e) { toast.error('Ошибка объединения'); }
    setMerging(false);
  };

  const groups = tab === 'byAmoId' ? data.byAmoId : data.byPhone;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5"/>Объединение дубликатов
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 items-center mb-3">
          <Button variant={tab === 'byPhone' ? 'default' : 'outline'} size="sm" onClick={() => setTab('byPhone')}
            data-testid="dup-tab-phone">
            По телефону <Badge variant="secondary" className="ml-2">{data.byPhone.length}</Badge>
          </Button>
          <Button variant={tab === 'byAmoId' ? 'default' : 'outline'} size="sm" onClick={() => setTab('byAmoId')}
            data-testid="dup-tab-amo">
            По amoCRM ID <Badge variant="secondary" className="ml-2">{data.byAmoId.length}</Badge>
          </Button>
          <div className="flex-1"/>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} data-testid="dup-refresh-btn">
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`}/>Обновить
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div>
        ) : !groups.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30"/>
            Дубликаты не найдены
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((g, idx) => (
              <div key={idx} className="border rounded-lg p-3" data-testid={`dup-group-${idx}`}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Badge variant="outline">{tab === 'byPhone' ? 'Телефон' : 'amoCRM ID'}: {g.key}</Badge>
                  <Badge>{g.count} дубликата</Badge>
                </div>
                <div className="space-y-1.5">
                  {g.leads.map(l => (
                    <div key={l.id} className="flex items-center gap-3 p-2 rounded border bg-muted/20 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{l.id}</span>
                          <span className="font-medium truncate">{l.clientName || '—'}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {l.phone || '—'} · {l.manager || '—'} · {fmtMoney(l.totalAmount)} · {fmtDate(l.createdAt)}
                        </div>
                      </div>
                      <Button size="sm" variant="default" onClick={() => handleMerge(g, l.id)}
                        disabled={merging}
                        data-testid={`dup-keep-${l.id}`}>
                        {merging ? <Loader2 className="h-3 w-3 animate-spin"/> : 'Оставить эту'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-[11px] text-muted-foreground mt-3 border-t pt-2">
          При объединении: данные из дубликатов копируются в выбранную сделку (если в ней пустые поля), документы и история объединяются, остальные сделки удаляются.
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DuplicatesModal;
