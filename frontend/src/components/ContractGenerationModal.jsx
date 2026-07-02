import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Loader2, FileText, AlertTriangle, Package } from 'lucide-react';
import { toast } from 'sonner';

const COLLECTION_BADGE = {
  sauna_orders: 'bg-amber-100 text-amber-700',
  orders: 'bg-cyan-100 text-cyan-700',
  balia_orders: 'bg-cyan-100 text-cyan-700',
  greenhouse_orders: 'bg-green-100 text-green-700',
};

export const ContractGenerationModal = ({ open, onOpenChange, leadId, apiUrl, authHeaders, onGenerated }) => {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [client, setClient] = useState({ clientName: '', phone: '', email: '', address: '', totalAmount: '', advancePayment: '' });
  const [kps, setKps] = useState([]);
  const [selected, setSelected] = useState({});

  useEffect(() => {
    if (!open || !leadId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiUrl}/api/sauna-crm/contract-template/available-kps/${leadId}`, { headers: authHeaders });
        if (!res.ok) throw new Error('Не удалось загрузить данные');
        const data = await res.json();
        if (cancelled) return;
        const c = data.client || {};
        setClient({
          clientName: c.clientName || '',
          phone: c.phone || '',
          email: c.email || '',
          address: c.address || '',
          totalAmount: c.totalAmount ?? '',
          advancePayment: c.advancePayment ?? '',
        });
        const list = data.kps || [];
        setKps(list);
        // Default: select all KPs that have a PDF
        const initSel = {};
        list.forEach(k => { initSel[k.orderId] = !!k.hasPdf; });
        setSelected(initSel);
      } catch (e) {
        toast.error(e.message || 'Ошибка загрузки');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, leadId, apiUrl]);

  const toggleKp = (orderId) => setSelected(prev => ({ ...prev, [orderId]: !prev[orderId] }));

  const handleGenerate = async () => {
    const selectedOrderIds = kps.filter(k => selected[k.orderId]).map(k => k.orderId);
    setGenerating(true);
    try {
      const clientData = {
        clientName: client.clientName,
        phone: client.phone,
        email: client.email,
        address: client.address,
        totalAmount: client.totalAmount === '' ? null : Number(client.totalAmount),
        advancePayment: client.advancePayment === '' ? null : Number(client.advancePayment),
      };
      const res = await fetch(`${apiUrl}/api/sauna-crm/generate-contract`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, selectedOrderIds, clientData }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.kpAttached) {
          toast.success(`Договор создан (КП приложено: ${selectedOrderIds.length})`);
        } else {
          toast.warning(data.kpError ? `Договор создан без КП: ${data.kpError}` : 'Договор создан (без КП)');
        }
        if (data.contractUrl) window.open(data.contractUrl, '_blank');
        onGenerated?.(data);
        onOpenChange(false);
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(`Ошибка: ${errData.detail || res.statusText}`);
      }
    } catch (e) {
      toast.error(`Ошибка создания договора: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const selectedCount = kps.filter(k => selected[k.orderId]).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="contract-generation-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" /> Создание договора
          </DialogTitle>
          <DialogDescription>Проверьте данные клиента и выберите КП для приложения к договору.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Загрузка...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Client data (editable) */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Данные клиента</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs text-gray-500">Имя клиента</Label>
                  <Input value={client.clientName} onChange={e => setClient({ ...client, clientName: e.target.value })} data-testid="contract-client-name" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Телефон</Label>
                  <Input value={client.phone} onChange={e => setClient({ ...client, phone: e.target.value })} data-testid="contract-client-phone" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Email</Label>
                  <Input value={client.email} onChange={e => setClient({ ...client, email: e.target.value })} data-testid="contract-client-email" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-gray-500">Адрес</Label>
                  <Input value={client.address} onChange={e => setClient({ ...client, address: e.target.value })} data-testid="contract-client-address" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Сумма заказа</Label>
                  <Input type="number" value={client.totalAmount} onChange={e => setClient({ ...client, totalAmount: e.target.value })} data-testid="contract-client-total" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Предоплата</Label>
                  <Input type="number" value={client.advancePayment} onChange={e => setClient({ ...client, advancePayment: e.target.value })} data-testid="contract-client-advance" />
                </div>
              </div>
            </div>

            {/* KP selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Package className="w-4 h-4" /> Коммерческие предложения ({selectedCount} выбрано)
              </Label>
              {kps.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  КП не найдены для этого клиента. Договор будет создан без вложений.
                </div>
              ) : (
                <div className="space-y-2">
                  {kps.map(kp => (
                    <label
                      key={kp.orderId}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selected[kp.orderId] ? 'border-blue-400 bg-blue-50/60' : 'border-gray-200 hover:bg-gray-50'} ${!kp.hasPdf ? 'opacity-60' : ''}`}
                      data-testid={`contract-kp-row-${kp.orderId}`}
                    >
                      <Checkbox
                        checked={!!selected[kp.orderId]}
                        onCheckedChange={() => kp.hasPdf && toggleKp(kp.orderId)}
                        disabled={!kp.hasPdf}
                        data-testid={`contract-kp-checkbox-${kp.orderId}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs ${COLLECTION_BADGE[kp.collection] || 'bg-gray-100 text-gray-700'}`}>{kp.label}</Badge>
                          <span className="text-sm font-medium truncate">{kp.orderId}</span>
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {kp.modelName || '—'}{kp.total ? ` · ${Number(kp.total).toLocaleString('ru-RU')}` : ''}
                        </div>
                      </div>
                      {!kp.hasPdf && (
                        <span className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> нет PDF</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating} data-testid="contract-modal-cancel">
            Отмена
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={loading || generating}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="contract-modal-generate"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
            Сгенерировать договор
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
