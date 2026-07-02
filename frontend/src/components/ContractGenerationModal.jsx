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
  const [depositPct, setDepositPct] = useState(30);

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
  const selectedTotal = kps.filter(k => selected[k.orderId]).reduce((s, k) => s + (Number(k.total) || 0), 0);
  const depositAmount = Math.round(selectedTotal * (Number(depositPct) || 0) / 100);
  const budgetMismatch = Number(client.totalAmount) > 0 && Number(client.totalAmount) !== selectedTotal && selectedTotal > 0;

  const applyTotals = () => {
    setClient(prev => ({
      ...prev,
      totalAmount: selectedTotal || prev.totalAmount,
      advancePayment: depositAmount || prev.advancePayment,
    }));
    toast.success('Сумма и задаток подставлены в данные клиента');
  };

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

            {/* Totals preview + auto deposit */}
            {selectedCount > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-2" data-testid="contract-totals-panel">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Сумма выбранных КП ({selectedCount})</span>
                  <span className="font-semibold" data-testid="contract-selected-total">{selectedTotal.toLocaleString('ru-RU')}</span>
                </div>
                {budgetMismatch && (
                  <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2" data-testid="contract-budget-warning">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      Сумма КП ({selectedTotal.toLocaleString('ru-RU')}) не совпадает с суммой сделки
                      ({Number(client.totalAmount).toLocaleString('ru-RU')}). Разница: {Math.abs(selectedTotal - Number(client.totalAmount)).toLocaleString('ru-RU')}.
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 whitespace-nowrap">Задаток</span>
                  <Input
                    type="number"
                    value={depositPct}
                    onChange={e => setDepositPct(e.target.value)}
                    className="h-8 w-20"
                    data-testid="contract-deposit-pct"
                  />
                  <span className="text-sm text-gray-600">%</span>
                  <span className="text-sm font-medium ml-auto" data-testid="contract-deposit-amount">
                    = {depositAmount.toLocaleString('ru-RU')}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-blue-400 text-blue-700 hover:bg-blue-100"
                  onClick={applyTotals}
                  data-testid="contract-apply-totals"
                >
                  Подставить в сумму и задаток
                </Button>
              </div>
            )}
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
