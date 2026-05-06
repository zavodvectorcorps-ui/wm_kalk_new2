/**
 * Dealer-facing sauna calculator.
 *
 * Loads sauna prices via /api/dealer/sauna/prices (with the dealer's overrides
 * already applied and costPrice stripped) and submits the resulting order to
 * /api/dealer/sauna/orders. Designed to be focused on the dealer's needs:
 * pick a model + variant + options, fill customer info, see live total, submit.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  Loader2, ChevronRight, ChevronLeft, Check, Plus, Minus, Send, AlertCircle,
} from 'lucide-react';
import { getApiUrl } from '../../utils/api';
import { dealerAuthHeaders } from '../../utils/dealerAuth';
import { toast } from 'sonner';

const API = getApiUrl();
const fmtPLN = (n) => `${Math.round(Number(n) || 0).toLocaleString('pl-PL').replace(/,/g, ' ')} PLN`;

export default function DealerCalculator({ onCreated }) {
  const [prices, setPrices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);  // 0=customer, 1=model, 2=options, 3=review
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '', notes: '' });
  const [modelId, setModelId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [selected, setSelected] = useState({});  // { optionId: { variantId?, quantity } }
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/api/dealer/sauna/prices`, { headers: dealerAuthHeaders() })
      .then(r => setPrices(r.data))
      .catch(() => toast.error('Не удалось загрузить прайс'))
      .finally(() => setLoading(false));
  }, []);

  const allOptions = useMemo(() => {
    if (!prices) return [];
    return [
      ...(prices.options || []),
      ...(prices.categories || []).flatMap((c) => (c.options || []).map(o => ({ ...o, _categoryName: c.name }))),
    ];
  }, [prices]);

  const model = useMemo(() => (prices?.models || []).find(m => m.id === modelId), [prices, modelId]);
  const variant = useMemo(() => model?.variants?.find(v => v.id === variantId), [model, variantId]);

  const total = useMemo(() => {
    let t = 0;
    if (model) t += model.basePrice || 0;
    if (variant) t += variant.price || 0;
    Object.entries(selected).forEach(([optId, sel]) => {
      const opt = allOptions.find(o => o.id === optId);
      if (!opt || !sel) return;
      const qty = sel.quantity || 1;
      let price = opt.price || 0;
      if (sel.variantId) {
        const ov = (opt.variants || []).find(v => v.id === sel.variantId);
        if (ov) price = ov.price || 0;
      }
      t += price * qty;
    });
    return t;
  }, [model, variant, selected, allOptions]);

  const toggleOption = (opt, variantId) => {
    setSelected((prev) => {
      const next = { ...prev };
      const cur = next[opt.id];
      // For radio-with-variants: clicking same variant toggles off
      if (cur && cur.variantId === variantId) {
        delete next[opt.id];
      } else {
        next[opt.id] = { variantId: variantId || null, quantity: cur?.quantity || 1 };
      }
      return next;
    });
  };
  const setQty = (optId, delta) => {
    setSelected((prev) => {
      const next = { ...prev };
      const cur = next[optId] || { variantId: null, quantity: 0 };
      const q = Math.max(0, (cur.quantity || 0) + delta);
      if (q === 0) delete next[optId];
      else next[optId] = { ...cur, quantity: q };
      return next;
    });
  };

  const canNext = useCallback(() => {
    if (step === 0) return customer.name.trim() && customer.phone.trim();
    if (step === 1) return !!modelId;
    return true;
  }, [step, customer, modelId]);

  const submit = async () => {
    if (!model) return;
    setSubmitting(true);
    try {
      // Build options array consistent with main calculator
      const optionsArr = [];
      Object.entries(selected).forEach(([optId, sel]) => {
        const opt = allOptions.find(o => o.id === optId);
        if (!opt) return;
        let price = opt.price || 0;
        let optName = opt.name;
        if (sel.variantId) {
          const ov = (opt.variants || []).find(v => v.id === sel.variantId);
          if (ov) {
            price = ov.price || 0;
            optName = `${opt.name} (${ov.name})`;
          }
        }
        const qty = sel.quantity || 1;
        optionsArr.push({
          optionId: opt.id,
          optionName: optName,
          categoryName: opt._categoryName || '',
          price,
          quantity: qty,
          totalPrice: price * qty,
        });
      });

      const optionsTotal = optionsArr.reduce((a, o) => a + o.totalPrice, 0);
      const subtotal = (model.basePrice || 0) + (variant?.price || 0) + optionsTotal;

      const payload = {
        customerName: customer.name.trim(),
        customerPhone: customer.phone.trim(),
        customerEmail: customer.email.trim(),
        notes: customer.notes.trim(),
        modelId,
        modelName: variant ? `${model.name} (${variant.name})` : model.name,
        variantId: variantId || null,
        modelBasePrice: model.basePrice || 0,
        variantPrice: variant?.price || 0,
        options: optionsArr,
        optionsTotal,
        subtotal,
        total,
      };

      const r = await axios.post(`${API}/api/dealer/sauna/orders`, payload, { headers: dealerAuthHeaders() });
      const createdOrder = r.data.order;
      toast.success(`Заказ ${createdOrder.id} создан`);
      // Auto-download offer PDF
      try {
        const pdfRes = await axios.get(`${API}/api/dealer/sauna/orders/${createdOrder.id}/pdf`, {
          headers: dealerAuthHeaders(),
          responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([pdfRes.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `oferta-${createdOrder.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      } catch (pdfErr) {
        console.warn('PDF auto-download failed', pdfErr);
      }
      onCreated?.(createdOrder);
      // Reset form
      setStep(0);
      setCustomer({ name: '', phone: '', email: '', notes: '' });
      setModelId('');
      setVariantId('');
      setSelected({});
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка создания заказа');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (!prices || !(prices.models || []).length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center" data-testid="dealer-calc-no-prices">
        <AlertCircle className="h-10 w-10 mx-auto text-amber-400 mb-4" />
        <div className="text-lg font-medium text-white mb-2">Прайс пуст</div>
        <div className="text-sm text-slate-400">Администратор пока не настроил каталог саун. Свяжитесь с менеджером.</div>
      </div>
    );
  }

  const steps = ['Клиент', 'Модель', 'Опции', 'Заявка'];

  return (
    <div className="space-y-6" data-testid="dealer-calculator">
      {/* Stepper */}
      <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs uppercase tracking-wider transition-colors ${i === step ? 'bg-orange-500 text-white' : i < step ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-400'}`}>
              {i < step && <Check className="h-3 w-3" />}
              <span className="font-semibold">{i + 1}.</span> {s}
            </div>
            {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-slate-600" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 min-h-[300px]">
        {step === 0 && (
          <div className="space-y-4 max-w-lg" data-testid="step-customer">
            <h3 className="text-lg font-semibold text-white">Данные клиента</h3>
            <Field label="Имя клиента *" testid="cust-name" value={customer.name} onChange={(v) => setCustomer({ ...customer, name: v })} />
            <Field label="Телефон *" testid="cust-phone" value={customer.phone} onChange={(v) => setCustomer({ ...customer, phone: v })} />
            <Field label="Email" testid="cust-email" value={customer.email} onChange={(v) => setCustomer({ ...customer, email: v })} type="email" />
            <Field label="Заметки" testid="cust-notes" value={customer.notes} onChange={(v) => setCustomer({ ...customer, notes: v })} multiline />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4" data-testid="step-model">
            <h3 className="text-lg font-semibold text-white">Выберите модель</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(prices.models || []).map((m) => (
                <button
                  key={m.id}
                  data-testid={`model-${m.id}`}
                  onClick={() => { setModelId(m.id); setVariantId(''); }}
                  className={`text-left p-4 rounded-xl border transition-all ${modelId === m.id ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
                >
                  <div className="font-semibold text-white">{m.name}</div>
                  <div className="text-sm text-orange-300 mt-1">{fmtPLN(m.basePrice)}</div>
                </button>
              ))}
            </div>
            {model && (model.variants || []).length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Вариант</h4>
                <div className="flex flex-wrap gap-2">
                  {model.variants.map((v) => (
                    <button
                      key={v.id}
                      data-testid={`variant-${v.id}`}
                      onClick={() => setVariantId(variantId === v.id ? '' : v.id)}
                      className={`px-3 py-2 rounded-lg text-sm border transition-all ${variantId === v.id ? 'border-orange-500 bg-orange-500/10 text-white' : 'border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20'}`}
                    >
                      {v.name} <span className="text-orange-300 ml-1">+{fmtPLN(v.price)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4" data-testid="step-options">
            <h3 className="text-lg font-semibold text-white">Опции (необязательно)</h3>
            {allOptions.length === 0 ? (
              <div className="text-sm text-slate-500">Дополнительных опций нет.</div>
            ) : (
              <div className="space-y-3">
                {allOptions.map((opt) => {
                  const sel = selected[opt.id];
                  const hasVariants = (opt.variants || []).length > 0;
                  return (
                    <div key={opt.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3" data-testid={`opt-${opt.id}`}>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                          <div className="text-sm font-medium text-white">{opt.name}</div>
                          {opt._categoryName && <div className="text-[10px] uppercase tracking-wider text-slate-500">{opt._categoryName}</div>}
                        </div>
                        {!hasVariants && (
                          <div className="flex items-center gap-2">
                            <span className="text-orange-300 text-sm font-medium">{fmtPLN(opt.price)}</span>
                            <div className="flex items-center gap-1">
                              <button onClick={() => setQty(opt.id, -1)} className="w-7 h-7 rounded border border-white/10 hover:bg-white/10 text-slate-300 flex items-center justify-center" data-testid={`opt-${opt.id}-minus`}><Minus className="h-3 w-3" /></button>
                              <span className="w-8 text-center text-sm font-mono">{sel?.quantity || 0}</span>
                              <button onClick={() => setQty(opt.id, 1)} className="w-7 h-7 rounded border border-white/10 hover:bg-white/10 text-slate-300 flex items-center justify-center" data-testid={`opt-${opt.id}-plus`}><Plus className="h-3 w-3" /></button>
                            </div>
                          </div>
                        )}
                      </div>
                      {hasVariants && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {opt.variants.map((v) => (
                            <button
                              key={v.id}
                              data-testid={`opt-${opt.id}-var-${v.id}`}
                              onClick={() => toggleOption(opt, v.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${sel?.variantId === v.id ? 'border-orange-500 bg-orange-500/10 text-white' : 'border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20'}`}
                            >
                              {v.name} <span className="text-orange-300 ml-1">{fmtPLN(v.price)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4" data-testid="step-review">
            <h3 className="text-lg font-semibold text-white">Проверьте и отправьте</h3>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3 text-sm">
              <Row label="Клиент" value={customer.name} />
              <Row label="Телефон" value={customer.phone} />
              {customer.email && <Row label="Email" value={customer.email} />}
              {customer.notes && <Row label="Заметки" value={customer.notes} />}
              <hr className="border-white/10" />
              <Row label="Модель" value={variant ? `${model.name} (${variant.name})` : model?.name} />
              <Row label="Базовая цена" value={fmtPLN(model?.basePrice || 0)} />
              {variant && <Row label="Доплата за вариант" value={`+${fmtPLN(variant.price)}`} />}
              {Object.entries(selected).map(([optId, sel]) => {
                const opt = allOptions.find(o => o.id === optId);
                if (!opt) return null;
                let p = opt.price || 0;
                let n = opt.name;
                if (sel.variantId) {
                  const ov = (opt.variants || []).find(v => v.id === sel.variantId);
                  if (ov) { p = ov.price || 0; n = `${opt.name} (${ov.name})`; }
                }
                const qty = sel.quantity || 1;
                return <Row key={optId} label={n + (qty > 1 ? ` × ${qty}` : '')} value={fmtPLN(p * qty)} />;
              })}
            </div>
            <div className="flex justify-between items-center px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30">
              <span className="text-sm uppercase tracking-wider text-orange-200">Итого</span>
              <span className="text-2xl font-bold text-white" data-testid="review-total">{fmtPLN(total)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 text-sm hover:bg-white/5 disabled:opacity-40 flex items-center gap-2"
          data-testid="calc-prev"
        >
          <ChevronLeft className="h-4 w-4" /> Назад
        </button>
        <div className="text-sm text-slate-300">
          Текущая сумма: <span className="text-white font-bold">{fmtPLN(total)}</span>
        </div>
        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext()}
            className="px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-40"
            data-testid="calc-next"
          >
            Далее <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={submitting || !modelId}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-40"
            data-testid="calc-submit"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Отправить заявку
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', multiline = false, testid }) {
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div>
      <label className="block text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">{label}</label>
      <Tag
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={multiline ? 3 : undefined}
        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-orange-400"
        data-testid={testid}
      />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 text-slate-300">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-white text-right">{value}</span>
    </div>
  );
}
