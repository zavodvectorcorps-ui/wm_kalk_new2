import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Calculator as CalcIcon, Package, BarChart3, Settings, LogOut,
  TrendingUp, DollarSign, ShoppingCart, Building2, Loader2, Save, RefreshCw, AlertCircle, FileText, Link2, Eye, Pencil
} from 'lucide-react';
import { getApiUrl } from '../../utils/api';
import { dealerAuthHeaders, clearDealerSession, getDealerInfo, fetchDealerMe } from '../../utils/dealerAuth';
import DealerCalculatorWrapper from './DealerCalculatorWrapper';

const API = getApiUrl();

// ==================== Shared helpers ====================
const fmtPLN = (n) => `${Math.round(Number(n) || 0).toLocaleString('pl-PL').replace(/,/g, ' ')} PLN`;
const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU'); } catch (_e) { return String(d); }
};

// ==================== Stats Tab ====================
function StatsTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/dealer/stats`, { headers: dealerAuthHeaders() })
      .then(r => setStats(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!stats) return <div className="text-slate-400 py-10">Brak danych.</div>;

  const maxWeek = Math.max(...(stats.weekly || []).map(w => w.count), 1);

  return (
    <div className="space-y-6" data-testid="dealer-stats">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard icon={ShoppingCart} label="Wszystkie zamówienia" value={stats.totalOrders} color="#06b6d4" testid="stats-total-orders" />
        <KpiCard icon={DollarSign} label="Łączna kwota" value={fmtPLN(stats.totalValue)} color="#10b981" testid="stats-total-value" />
        <KpiCard icon={TrendingUp} label="Średnia wartość" value={fmtPLN(stats.avgOrderValue)} color="#f59e0b" testid="stats-avg-order" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Zamówienia tygodniowo</h3>
          <span className="text-xs text-slate-500">ostatnie 12 tygodni</span>
        </div>
        <div className="flex items-end gap-2 h-40">
          {(stats.weekly || []).map((w) => {
            const h = (w.count / maxWeek) * 100;
            return (
              <div key={w.week} className="flex-1 flex flex-col items-center gap-1" title={`${w.week}: ${w.count} zamówień · ${fmtPLN(w.value)}`}>
                <div className="text-[10px] text-slate-500">{w.count || ''}</div>
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${Math.max(h, 2)}%`,
                    background: w.count > 0 ? 'linear-gradient(to top, #f97316, #fbbf24)' : 'rgba(255,255,255,0.05)',
                  }}
                />
                <div className="text-[9px] text-slate-600 whitespace-nowrap rotate-45 origin-top-left mt-2">{w.week.split('-W')[1]}w</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color, testid }) {
  return (
    <div className="relative p-6 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden" data-testid={testid}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-30" style={{ background: color }} />
      <Icon className="h-5 w-5 text-slate-300 mb-4 relative z-10" />
      <div className="text-2xl md:text-3xl font-bold text-white relative z-10">{value}</div>
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mt-2 relative z-10">{label}</div>
    </div>
  );
}

// ==================== Orders Tab ====================
function downloadOrderPdf(orderId, type = 'offer') {
  if (type === 'full') {
    // Use the same public endpoint managers use — load the order, post it
    // to /api/sauna/generate-pdf, get back a multi-page branded PDF.
    return axios
      .get(`${API}/api/dealer/sauna/orders/${orderId}`, { headers: dealerAuthHeaders() })
      .then((orderResp) => {
        const order = orderResp.data || {};
        const pdfPayload = { ...order, orderId: order.id, language: 'pl' };
        return axios.post(`${API}/api/sauna/generate-pdf`, pdfPayload, {
          responseType: 'blob',
        });
      })
      .then((r) => {
        const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `SAUNA_${orderId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      });
  }
  // Short offer PDF — backend dealer endpoint
  return axios
    .get(`${API}/api/dealer/sauna/orders/${orderId}/pdf?type=offer`, {
      headers: dealerAuthHeaders(),
      responseType: 'blob',
    })
    .then((r) => {
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `oferta-${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    });
}

function StatusBadge({ status }) {
  const s = (status || 'draft').toLowerCase();
  if (s === 'confirmed') {
    return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Potwierdzone</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">Wersja robocza</span>;
}

function ClientLinkBadge({ order }) {
  if (order?.clientConfirmedByLink) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" title={`Potwierdzone przez klienta ${order.clientWebConfirmedAt ? new Date(order.clientWebConfirmedAt).toLocaleString('pl-PL') : ''}`}>
        ✓ Klient potwierdził
      </span>
    );
  }
  if (order?.clientWebViews) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30" title="Klient otworzył link">
        <Eye className="h-2.5 w-2.5" /> Otwarte ({order.clientWebViews})
      </span>
    );
  }
  return null;
}

function copyOfferLink(orderId) {
  const link = `${window.location.origin}/oferta/${orderId}`;
  return navigator.clipboard.writeText(link).then(() => link);
}

function OrdersTab({ onEditDraft, reloadKey = 0 }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [filter, setFilter] = useState('all'); // all | draft | confirmed

  const reload = () => {
    setLoading(true);
    axios.get(`${API}/api/dealer/sauna/orders`, { headers: dealerAuthHeaders() })
      .then(r => setOrders(r.data.orders || []))
      .finally(() => setLoading(false));
  };
  useEffect(() => { reload(); }, [reloadKey]);

  const handleDownload = async (orderId, type = 'offer') => {
    setDownloadingId(orderId + ':' + type);
    try {
      await downloadOrderPdf(orderId, type);
    } catch (_e) {
      // silent
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (orderId) => {
    if (!window.confirm(`Usunąć wersję roboczą ${orderId}?`)) return;
    try {
      await axios.delete(`${API}/api/dealer/sauna/orders/${orderId}`, { headers: dealerAuthHeaders() });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.response?.data?.detail || 'Nie udało się usunąć');
    }
  };

  const filtered = orders.filter((o) => {
    if (filter === 'all') return true;
    const s = (o.status || 'draft').toLowerCase();
    return s === filter;
  });

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400">Filtr:</span>
        {['all', 'draft', 'confirmed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            data-testid={`filter-${f}`}
            className={`px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider border transition-colors ${
              filter === f
                ? 'bg-orange-500 text-white border-orange-500'
                : 'border-white/10 text-slate-300 hover:bg-white/5'
            }`}
          >
            {f === 'all' ? 'Wszystkie' : f === 'draft' ? 'Wersje robocze' : 'Potwierdzone'}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">razem: {orders.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center" data-testid="dealer-orders-empty">
          <Package className="h-10 w-10 mx-auto text-slate-600 mb-4" />
          <div className="text-lg font-medium text-white mb-2">
            {filter === 'all' ? 'Brak zamówień' : filter === 'draft' ? 'Brak wersji roboczych' : 'Brak potwierdzonych zamówień'}
          </div>
          <div className="text-sm text-slate-400">Utwórz nowy projekt w zakładce „Kalkulator”.</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden" data-testid="dealer-orders-table">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="text-left px-4 py-3">Numer / Status</th>
                <th className="text-left px-4 py-3">Klient</th>
                <th className="text-left px-4 py-3">Model</th>
                <th className="text-right px-4 py-3">Kwota</th>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-right px-4 py-3">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const isDraft = (o.status || 'draft').toLowerCase() === 'draft';
                return (
                  <tr key={o.id} className="border-t border-white/5 hover:bg-white/[0.02]" data-testid={`dealer-order-${o.id}`}>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-slate-300">{o.id}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <StatusBadge status={o.status} />
                        <ClientLinkBadge order={o} />
                      </div>
                      {o.dealerContractNumber && (
                        <div className="text-[10px] text-slate-500 mt-0.5">№ {o.dealerContractNumber}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-200">{o.customerName || o.clientName || o.fullName || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{o.modelName || o.model?.name || '—'}</td>
                    <td className="px-4 py-3 text-right text-white font-medium">{fmtPLN(o.total)}</td>
                    <td className="px-4 py-3 text-slate-400">{fmtDate(o.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        {isDraft && (
                          <button
                            type="button"
                            onClick={() => onEditDraft?.(o)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-300 text-xs hover:bg-emerald-500/10"
                            data-testid={`dealer-order-edit-${o.id}`}
                            title="Edytuj wersję roboczą i potwierdź"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edytuj
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const link = await copyOfferLink(o.id);
                              toast.success('Link skopiowany', { description: link });
                            } catch (_e) {
                              toast.error('Nie udało się skopiować linku');
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-orange-500/40 text-orange-300 text-xs hover:bg-orange-500/10"
                          data-testid={`dealer-order-share-${o.id}`}
                          title="Skopiuj publiczny link do oferty (do wysłania klientowi)"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Link
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(o.id, 'offer')}
                          disabled={downloadingId === o.id + ':offer'}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-slate-200 text-xs hover:bg-white/10 disabled:opacity-50"
                          data-testid={`dealer-order-pdf-${o.id}`}
                          title="Oferta (krótka)"
                        >
                          {downloadingId === o.id + ':offer' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                          KP
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(o.id, 'full')}
                          disabled={downloadingId === o.id + ':full'}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-slate-200 text-xs hover:bg-white/10 disabled:opacity-50"
                          data-testid={`dealer-order-pdf-full-${o.id}`}
                          title="Pełny PDF (taki jak u menedżerów)"
                        >
                          {downloadingId === o.id + ':full' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                          Pełny
                        </button>
                        {isDraft && (
                          <button
                            type="button"
                            onClick={() => handleDelete(o.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10"
                            data-testid={`dealer-order-delete-${o.id}`}
                            title="Usuń wersję roboczą"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export { downloadOrderPdf };

// ==================== Price Editor Tab ====================
function PricesTab() {
  const [prices, setPrices] = useState(null);
  const [overrides, setOverrides] = useState({});  // key -> price (string while editing)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pricesRes, ovrRes] = await Promise.all([
        axios.get(`${API}/api/dealer/sauna/prices`, { headers: dealerAuthHeaders() }),
        axios.get(`${API}/api/dealer/sauna/overrides`, { headers: dealerAuthHeaders() }),
      ]);
      setPrices(pricesRes.data);
      const map = {};
      (ovrRes.data.overrides || []).forEach((o) => {
        map[keyOf(o)] = String(o.price);
      });
      setOverrides(map);
    } catch (e) {
      setMsg(e?.response?.data?.detail || 'Błąd ładowania');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setPrice = (key, val) => {
    setOverrides((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      const payload = { overrides: [] };
      for (const [key, val] of Object.entries(overrides)) {
        const num = parseInt(val, 10);
        if (!Number.isFinite(num) || num < 0) continue;
        payload.overrides.push({ ...unkeyOf(key), price: num, dealerId: '' });
      }
      await axios.put(`${API}/api/dealer/sauna/overrides`, payload, { headers: dealerAuthHeaders() });
      setMsg(`Zapisano (${payload.overrides.length} pozycji)`);
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e?.response?.data?.detail || 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!prices) return <div className="text-slate-400 py-10">Nie udało się załadować cennika.</div>;

  return (
    <div className="space-y-6" data-testid="dealer-prices-editor">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Mój cennik</h2>
          <p className="text-sm text-slate-400">Ustaw własne ceny. Puste pole = używana jest cena bazowa.</p>
        </div>
        <div className="flex gap-2 items-center">
          {msg && <span className="text-xs text-emerald-400 mr-2">{msg}</span>}
          <button onClick={load} className="px-3 py-2 rounded-lg border border-white/10 text-slate-300 text-sm hover:bg-white/5 flex items-center gap-2" data-testid="prices-reload">
            <RefreshCw className="h-3.5 w-3.5" /> Odśwież
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50" data-testid="prices-save">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Zapisz
          </button>
        </div>
      </div>

      {/* Models */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400 mb-3">Modele saun</h3>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">
          {(prices.models || []).map((m) => (
            <div key={m.id} className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="text-white font-medium">{m.name}</div>
                  <div className="text-xs text-slate-500">id: {m.id}</div>
                </div>
                <PriceInput
                  label="Cena bazowa"
                  value={overrides[keyOf({ kind: 'model', modelId: m.id })] ?? ''}
                  placeholder={String(m.basePrice || 0)}
                  onChange={(v) => setPrice(keyOf({ kind: 'model', modelId: m.id }), v)}
                  testid={`model-price-${m.id}`}
                />
              </div>
              {(m.variants || []).length > 0 && (
                <div className="mt-3 ml-4 space-y-2 border-l border-white/10 pl-4">
                  {m.variants.map((v) => (
                    <div key={v.id} className="flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-[200px] text-sm text-slate-300">└ {v.name}</div>
                      <PriceInput
                        label="Wariant"
                        value={overrides[keyOf({ kind: 'model_variant', modelId: m.id, variantId: v.id })] ?? ''}
                        placeholder={String(v.price || 0)}
                        onChange={(val) => setPrice(keyOf({ kind: 'model_variant', modelId: m.id, variantId: v.id }), val)}
                        testid={`variant-price-${m.id}-${v.id}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Options (flat + from categories) */}
      {(() => {
        const allOpts = [
          ...(prices.options || []),
          ...(prices.categories || []).flatMap((c) => c.options || []),
        ];
        if (allOpts.length === 0) return null;
        return (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400 mb-3">Opcje</h3>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">
              {allOpts.map((o) => (
                <div key={o.id} className="p-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="text-white text-sm font-medium">{o.name}</div>
                      <div className="text-xs text-slate-500">id: {o.id}</div>
                    </div>
                    <PriceInput
                      label="Cena"
                      value={overrides[keyOf({ kind: 'option', optionId: o.id })] ?? ''}
                      placeholder={String(o.price || 0)}
                      onChange={(v) => setPrice(keyOf({ kind: 'option', optionId: o.id }), v)}
                      testid={`option-price-${o.id}`}
                    />
                  </div>
                  {(o.variants || []).length > 0 && (
                    <div className="mt-3 ml-4 space-y-2 border-l border-white/10 pl-4">
                      {o.variants.map((v) => (
                        <div key={v.id} className="flex items-center gap-3 flex-wrap">
                          <div className="flex-1 min-w-[200px] text-sm text-slate-300">└ {v.name}</div>
                          <PriceInput
                            label="Wariant"
                            value={overrides[keyOf({ kind: 'option_variant', optionId: o.id, optionVariantId: v.id })] ?? ''}
                            placeholder={String(v.price || 0)}
                            onChange={(val) => setPrice(keyOf({ kind: 'option_variant', optionId: o.id, optionVariantId: v.id }), val)}
                            testid={`option-variant-price-${o.id}-${v.id}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })()}
    </div>
  );
}

function PriceInput({ label, value, placeholder, onChange, testid }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <input
        type="number"
        min="0"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-28 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-400"
        data-testid={testid}
      />
      <span className="text-xs text-slate-500">PLN</span>
    </div>
  );
}

function keyOf(o) {
  return [o.kind, o.modelId || '', o.variantId || '', o.optionId || '', o.optionVariantId || ''].join('|');
}
function unkeyOf(k) {
  const [kind, modelId, variantId, optionId, optionVariantId] = k.split('|');
  return {
    kind,
    modelId: modelId || null,
    variantId: variantId || null,
    optionId: optionId || null,
    optionVariantId: optionVariantId || null,
  };
}

// ==================== Calculator Tab ====================
function CalculatorTab({ editingDraft, onEditDone }) {
  return <DealerCalculatorWrapper initialDraft={editingDraft} onDone={onEditDone} key={editingDraft?.id || 'new'} />;
}

// ==================== Main Dealer App ====================
export default function DealerApp() {
  const [tab, setTab] = useState('calculator');
  const [dealer, setDealer] = useState(getDealerInfo());
  const [editingDraft, setEditingDraft] = useState(null);
  const [ordersReloadKey, setOrdersReloadKey] = useState(0);

  useEffect(() => {
    // refresh dealer info on mount
    fetchDealerMe().then(setDealer).catch(() => {
      clearDealerSession();
      window.location.reload();
    });
  }, []);

  const handleLogout = () => {
    clearDealerSession();
    window.location.reload();
  };

  const handleEditDraft = (draft) => {
    setEditingDraft(draft);
    setTab('calculator');
  };

  const handleEditDone = () => {
    setEditingDraft(null);
    setOrdersReloadKey((k) => k + 1);
    setTab('orders');
  };

  const tabs = useMemo(() => ([
    { id: 'calculator', label: 'Kalkulator', icon: CalcIcon },
    { id: 'orders', label: 'Zamówienia', icon: Package },
    { id: 'prices', label: 'Mój cennik', icon: Settings },
    { id: 'stats', label: 'Statystyki', icon: BarChart3 },
  ]), []);

  return (
    <div className="min-h-screen text-slate-100 relative" style={{ background: '#0b1020' }} data-testid="dealer-app">
      <div className="pointer-events-none fixed inset-0 -z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] opacity-20" style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 60%)' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] opacity-15" style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 60%)' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-xl" style={{ background: 'rgba(11,16,32,0.7)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Building2 className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">WM Saunas · Dealer Portal</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{dealer?.name || dealer?.username || 'dealer'}</div>
            </div>
          </div>
          <button onClick={handleLogout} data-testid="dealer-logout" className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-sm text-slate-300 hover:bg-white/5">
            <LogOut className="h-4 w-4" /> Wyloguj
          </button>
        </div>
      </header>

      {/* Tabs nav */}
      <nav className="relative z-10 border-b border-white/5 bg-white/[0.015] backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const Ic = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                data-testid={`dealer-tab-${t.id}`}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id ? 'border-orange-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Ic className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {tab === 'stats' && <StatsTab />}
        {tab === 'orders' && <OrdersTab onEditDraft={handleEditDraft} reloadKey={ordersReloadKey} />}
        {tab === 'prices' && <PricesTab />}
        {tab === 'calculator' && <CalculatorTab editingDraft={editingDraft} onEditDone={handleEditDone} />}
      </main>
    </div>
  );
}
