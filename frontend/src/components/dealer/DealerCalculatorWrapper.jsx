/**
 * DealerCalculatorWrapper
 *
 * Mounts the manager's full <SaunaCalculator /> as-is inside the dealer panel.
 * Instead of forking the 2000-line calculator + 1500-line hook, we install
 * an axios request interceptor that transparently rewrites a few sauna
 * endpoints into dealer-scoped equivalents:
 *
 *   GET  /api/sauna/prices              → /api/dealer/sauna/prices  (+ Bearer)
 *   POST /api/sauna/orders               → /api/dealer/sauna/orders  (+ Bearer, status=draft)
 *   PUT  /api/sauna/orders/{id}          → /api/dealer/sauna/orders/{id} (+ Bearer)
 *   *    /api/integrations/amocrm/...    → no-op success (dealers don't push to amoCRM)
 *   *    /api/sauna-crm/...              → no-op success (dealers don't write to internal CRM)
 *
 * The interceptor is installed on mount and torn down on unmount, so it's
 * scoped strictly to the dealer calculator screen.
 *
 * After a successful save (which now creates a draft), we surface a
 * "Confirm order" dialog where the dealer can flip the draft to status=confirmed
 * by entering the dealer's contract number with the client.
 */
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Loader2, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { getApiUrl } from '../../utils/api';
import { dealerAuthHeaders, getDealerToken } from '../../utils/dealerAuth';
import { SaunaCalculator } from '../SaunaCalculator';

const API = getApiUrl();

// ---------------------------------------------------------------------------
// Axios interceptor — rewrites manager endpoints to dealer endpoints
// ---------------------------------------------------------------------------
function installInterceptor({ dealerToken, onOrderSaved }) {
  const reqId = axios.interceptors.request.use(async (config) => {
    const url = String(config.url || '');
    const method = String(config.method || 'get').toLowerCase();

    // 1. Sauna prices → dealer prices (with overrides)
    if (/\/api\/sauna\/prices(?:\?|$)/.test(url)) {
      config.url = url.replace('/api/sauna/prices', '/api/dealer/sauna/prices');
      config.headers = { ...(config.headers || {}), Authorization: `Bearer ${dealerToken}` };
      return config;
    }

    // 2. Order create → dealer order create (force draft)
    if (method === 'post' && /\/api\/sauna\/orders(?:\?|$)/.test(url)) {
      config.url = url.replace('/api/sauna/orders', '/api/dealer/sauna/orders');
      config.headers = { ...(config.headers || {}), Authorization: `Bearer ${dealerToken}` };
      const body = (config.data && typeof config.data === 'object' && !(config.data instanceof FormData))
        ? config.data
        : {};
      config.data = { ...body, status: 'draft', source: 'dealer' };
      return config;
    }

    // 3. Order update → dealer order update
    if (method === 'put' && /\/api\/sauna\/orders\/[^/?#]+(?:\?|$)/.test(url)) {
      config.url = url.replace('/api/sauna/orders/', '/api/dealer/sauna/orders/');
      config.headers = { ...(config.headers || {}), Authorization: `Bearer ${dealerToken}` };
      return config;
    }

    // 4. Skip integrations dealers shouldn't trigger.
    if (
      /\/api\/integrations\/amocrm\//.test(url) ||
      /\/api\/sauna-crm\//.test(url)
    ) {
      // Throw a tagged error so the response interceptor can resolve it as a no-op
      const err = new Error('dealer-skip');
      err.__dealerSkip = true;
      err.config = config;
      throw err;
    }

    return config;
  });

  const respId = axios.interceptors.response.use(
    (resp) => {
      // Normalize POST /api/dealer/sauna/orders shape so SaunaCalculator
      // (which reads `orderResponse.data?.id`) keeps working.
      const url = String(resp.config?.url || '');
      const method = String(resp.config?.method || '').toLowerCase();
      if (method === 'post' && /\/api\/dealer\/sauna\/orders(?:\?|$)/.test(url) && resp.data?.order) {
        const order = resp.data.order;
        try { onOrderSaved?.(order); } catch (_e) { /* ignore */ }
        // Spread order fields up so consumers can read .id directly
        resp.data = { ...order, ...resp.data };
      }
      if (method === 'put' && /\/api\/dealer\/sauna\/orders\/[^/?#]+/.test(url) && resp.data?.order) {
        try { onOrderSaved?.(resp.data.order); } catch (_e) { /* ignore */ }
      }
      return resp;
    },
    (err) => {
      if (err && err.__dealerSkip) {
        // Pretend the integration call succeeded.
        return Promise.resolve({
          data: { ok: true, skipped: true, reason: 'dealer-mode' },
          status: 200,
          statusText: 'OK (dealer-skip)',
          headers: {},
          config: err.config || {},
        });
      }
      return Promise.reject(err);
    },
  );

  return () => {
    axios.interceptors.request.eject(reqId);
    axios.interceptors.response.eject(respId);
  };
}

// ---------------------------------------------------------------------------
// Confirm-order dialog — flips draft → confirmed via dealer endpoint
// ---------------------------------------------------------------------------
function ConfirmOrderDialog({ order, onClose, onConfirmed }) {
  const [contractNumber, setContractNumber] = useState('');
  const [clientConfirmed, setClientConfirmed] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!order) return null;

  const canSubmit = clientConfirmed && contractNumber.trim().length > 0;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const r = await axios.post(
        `${API}/api/dealer/sauna/orders/${order.id}/confirm`,
        {
          clientConfirmed: true,
          dealerContractNumber: contractNumber.trim(),
          deliveryDate: deliveryDate || null,
          notes: notes || null,
        },
        { headers: dealerAuthHeaders() },
      );
      toast.success('Заказ подтверждён и отправлен в WM');
      onConfirmed?.(r.data?.order || order);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Не удалось подтвердить заказ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !submitting && onClose()}>
      <DialogContent className="max-w-lg" data-testid="confirm-order-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Подтвердить заказ
          </DialogTitle>
          <DialogDescription>
            Подтверждение отправит этот заказ в основную CRM WM. После этого изменить заказ будет нельзя.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="font-mono text-xs text-muted-foreground">{order.id}</div>
            <div className="font-medium">{order.modelName || order.model?.name || '—'}</div>
            <div className="text-muted-foreground">{order.fullName || order.customerName || '—'}</div>
            <div className="font-semibold text-orange-600 mt-1">
              {Math.round(Number(order.total) || 0).toLocaleString('pl-PL').replace(/,/g, ' ')} PLN
            </div>
          </div>

          <div>
            <Label htmlFor="dealer-contract-number">Номер договора с клиентом *</Label>
            <Input
              id="dealer-contract-number"
              value={contractNumber}
              onChange={(e) => setContractNumber(e.target.value)}
              placeholder="напр. UM-2026/03/15"
              data-testid="dealer-contract-number-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dealer-delivery-date">Срок поставки</Label>
              <Input
                id="dealer-delivery-date"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                data-testid="dealer-delivery-date-input"
              />
            </div>
            <div>
              <Label>&nbsp;</Label>
              <div className="flex items-center h-9 gap-2 px-3 rounded-md border bg-background">
                <Checkbox
                  id="dealer-client-confirmed"
                  checked={clientConfirmed}
                  onCheckedChange={(v) => setClientConfirmed(!!v)}
                  data-testid="dealer-client-confirmed"
                />
                <Label htmlFor="dealer-client-confirmed" className="text-sm font-normal cursor-pointer">
                  Клиент подтвердил
                </Label>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="dealer-confirm-notes">Комментарий (необязательно)</Label>
            <Textarea
              id="dealer-confirm-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Любая дополнительная информация для производства…"
            />
          </div>

          {!canSubmit && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-md p-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Чтобы отправить заказ, заполните номер договора и поставьте галочку «Клиент подтвердил».</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting} data-testid="confirm-order-cancel">
            Оставить как черновик
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canSubmit || submitting}
            className="bg-emerald-600 hover:bg-emerald-700"
            data-testid="confirm-order-submit"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            Подтвердить и отправить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main wrapper
// ---------------------------------------------------------------------------
export default function DealerCalculatorWrapper({ initialDraft = null }) {
  const [lastSavedOrder, setLastSavedOrder] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const orderRef = useRef(null);

  useEffect(() => {
    const dealerToken = getDealerToken() || '';
    if (!dealerToken) {
      toast.error('Сессия дилера не найдена. Войдите заново.');
      return;
    }
    const teardown = installInterceptor({
      dealerToken,
      onOrderSaved: (order) => {
        orderRef.current = order;
        setLastSavedOrder(order);
        // Surface confirmation dialog only for new drafts (not for re-saves of confirmed orders)
        if ((order.status || 'draft') === 'draft') {
          // small delay so the calculator's own toast lands first
          setTimeout(() => setConfirmOpen(true), 400);
        }
      },
    });
    return teardown;
  }, []);

  return (
    <div className="dealer-calc-wrapper" data-testid="dealer-calc-wrapper">
      {/* Banner explaining draft/confirm flow */}
      <div className="mb-4 rounded-xl border border-orange-500/30 bg-orange-500/5 p-3 text-sm flex items-start gap-3">
        <FileText className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
        <div className="text-slate-200">
          <div className="font-medium text-white">Калькулятор и КП</div>
          <div className="text-slate-400 text-xs mt-0.5">
            Любой расчёт сохраняется как <b>черновик</b> и доступен только вам — компания WM получит заказ только после нажатия «Подтвердить и отправить» с номером договора. PDF можно скачать в любой момент.
          </div>
        </div>
      </div>

      {/* The full manager calculator, mounted as-is. The interceptor takes care of routing. */}
      <SaunaCalculator editingOrder={initialDraft} />

      {confirmOpen && lastSavedOrder && (
        <ConfirmOrderDialog
          order={lastSavedOrder}
          onClose={() => setConfirmOpen(false)}
          onConfirmed={(updated) => {
            setLastSavedOrder(updated);
            orderRef.current = updated;
          }}
        />
      )}
    </div>
  );
}
